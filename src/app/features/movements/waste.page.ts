import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Perfil } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeDeError } from '../../core/http/api-error';
import { BatchOption } from '../batches/batch.models';
import { BatchesService } from '../batches/batches.service';
import { Branch } from '../branches/branch.models';
import { BranchesService } from '../branches/branches.service';
import { Product, ProductsService } from '../products/products.service';
import { BatchReportModal } from '../../shared/batch-report-modal/batch-report-modal';
import { SidePanel } from '../../shared/side-panel/side-panel';
import { MovementsService, Waste } from './movements.service';

/** Motivos frecuentes, para no obligar a teclear lo mismo cada vez. */
const MOTIVOS = ['Caducado', 'Descompuesto', 'Golpeado', 'Derrame', 'Robo', 'Otro'];

@Component({
  selector: 'app-waste-page',
  imports: [FormsModule, DatePipe, SidePanel, BatchReportModal],
  templateUrl: './waste.page.html',
  styleUrl: './waste.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WastePage {
  private readonly movimientos = inject(MovementsService);
  private readonly productos = inject(ProductsService);
  private readonly lotes = inject(BatchesService);
  private readonly sucursales = inject(BranchesService);
  protected readonly auth = inject(AuthService);

  protected readonly motivos = MOTIVOS;

  protected readonly lista = signal<Waste[]>([]);
  protected readonly catalogo = signal<Product[]>([]);
  protected readonly lotesDisponibles = signal<BatchOption[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  /** Solo la usa el propietario: administrador y vendedor ya están fijos a la suya. */
  protected readonly sucursalElegida = signal<number | null>(null);
  protected readonly perfil = signal<Perfil | null>(null);

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly panelAbierto = signal(false);

  protected readonly productoElegido = signal<number | null>(null);
  protected readonly cantidad = signal<number | null>(null);
  protected readonly motivo = signal<string>(MOTIVOS[0]);
  protected readonly nota = signal('');
  protected readonly loteElegido = signal<number | null>(null);
  /** El id de la canal cuyo desglose se está mirando; null si el modal está cerrado. */
  protected readonly viendoDesgloseDe = signal<number | null>(null);

  /** En qué se captura el producto elegido: nadie debería adivinar si es a kilo o a pieza. */
  protected readonly unidadElegida = computed(() => {
    const id = this.productoElegido();
    if (id === null) return null;
    return this.unidadDe(Number(id)) === 'pz' ? 'piezas' : 'kilos';
  });

  /** Cuánto se perdió este mes: es la cifra que duele y la que hay que vigilar. */
  protected readonly perdidoEsteMes = computed(() => {
    const ahora = new Date();
    return this.lista()
      .filter((m) => {
        const f = new Date(m.date);
        return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
      })
      .reduce((s, m) => s + m.quantity, 0);
  });

  constructor() {
    this.auth.perfil().subscribe({ next: (p) => this.perfil.set(p) });
    this.productos.listar().subscribe({ next: (ps) => this.catalogo.set(ps.filter((p) => p.active)) });
    this.sucursales.listar(true).subscribe({ next: (bs) => this.branches.set(bs) });
    this.cargarCanales();
    this.cargar();
  }

  /**
   * Se pide de nuevo cada vez que se abre el panel: el propietario puede
   * haber cambiado de sucursal activa desde que se cargó la pantalla.
   */
  private cargarCanales(): void {
    this.lotes.seleccionables(this.auth.sucursalOperativa() ?? undefined).subscribe({
      next: (ls) => this.lotesDisponibles.set(ls),
      error: () => this.lotesDisponibles.set([]),
    });
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.movimientos.mermas(this.sucursalElegida() ?? undefined).subscribe({
      next: (ms) => {
        this.lista.set(ms);
        this.cargando.set(false);
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  protected cambiarSucursal(valor: string): void {
    this.sucursalElegida.set(valor ? Number(valor) : null);
    this.cargar();
  }

  protected abrir(): void {
    this.productoElegido.set(null);
    this.cantidad.set(null);
    this.motivo.set(MOTIVOS[0]);
    this.nota.set('');
    this.loteElegido.set(null);
    this.error.set(null);
    this.panelAbierto.set(true);
    this.cargarCanales();
  }

  protected cerrar(): void {
    this.panelAbierto.set(false);
    this.error.set(null);
  }

  protected guardar(): void {
    const p = this.perfil();
    const sucursal = this.auth.sucursalOperativa();
    const producto = this.productoElegido();
    const cant = this.cantidad();
    // Sin sucursal no hay de qué inventario descontar.
    if (!p || !sucursal || !producto || !cant || cant <= 0 || this.guardando()) return;

    this.guardando.set(true);
    this.error.set(null);

    this.movimientos
      .registrarMerma({
        productId: Number(producto),
        branchId: sucursal,
        employeeId: p.empleadoId,
        // Sin lote la merma descuenta igual, pero no se le atribuye a ninguna
        // canal y el reporte de ese lote la contará como pérdida sin explicar.
        batchId: this.loteElegido() ? Number(this.loteElegido()) : null,
        quantity: cant,
        reason: this.motivo(),
        note: this.nota(),
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.cerrar();
          this.cargar();
        },
        error: (e: unknown) => {
          this.guardando.set(false);
          this.error.set(mensajeDeError(e));
        },
      });
  }

  protected verDesglose(batchId: number): void {
    this.viendoDesgloseDe.set(batchId);
  }

  protected cerrarDesglose(): void {
    this.viendoDesgloseDe.set(null);
  }

  protected unidadDe(productId: number): string {
    const p = this.catalogo().find((x) => x.id === productId);
    return p?.unitOfMeasure === 'PIEZA' ? 'pz' : 'kg';
  }
}
