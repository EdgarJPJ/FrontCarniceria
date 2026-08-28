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
import { SidePanel } from '../../shared/side-panel/side-panel';
import { MovementsService, StockEntry } from './movements.service';

@Component({
  selector: 'app-entries-page',
  imports: [FormsModule, DatePipe, SidePanel],
  templateUrl: './entries.page.html',
  styleUrl: './entries.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntriesPage {
  private readonly movimientos = inject(MovementsService);
  private readonly productos = inject(ProductsService);
  private readonly lotes = inject(BatchesService);
  private readonly sucursales = inject(BranchesService);
  protected readonly auth = inject(AuthService);

  protected readonly lista = signal<StockEntry[]>([]);
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
  protected readonly loteElegido = signal<number | null>(null);
  protected readonly nota = signal('');
  protected readonly despieceTerminado = signal(false);

  /** Si el corte elegido sale de una canal (ver `Product.sourcedFromBatch`). */
  protected readonly productoEsDeCanal = computed(() => {
    const id = this.productoElegido();
    if (id === null) return false;
    return this.catalogo().find((p) => p.id === Number(id))?.sourcedFromBatch === true;
  });

  /**
   * El reporte de merma se calcula contra el lote, así que una entrada de un
   * corte que sale de canal conviene ligarla. Para la mercancía que llega ya
   * despiezada de fuera no aplica: no es producción de ninguna canal.
   */
  protected readonly faltaLigarCanal = computed(
    () => this.productoEsDeCanal() && this.loteElegido() === null,
  );

  /**
   * Solo cuenta las entradas de cortes que salen de canal y quedaron sin
   * ligar: son las únicas que dejan un reporte de merma incompleto. Las de
   * mercancía independiente sin canal son lo normal y no se avisan.
   */
  protected readonly sinLigar = computed(() => {
    const deCanal = new Set(
      this.catalogo().filter((p) => p.sourcedFromBatch).map((p) => p.id),
    );
    return this.lista().filter((e) => e.batchId === null && deCanal.has(e.productId)).length;
  });

  /**
   * Las que ya se marcaron como terminadas no aparecen en el selector: no
   * deberían recibir más despiece aunque todavía les quede algo por vender.
   */
  protected readonly lotesSeleccionables = computed(() =>
    this.lotesDisponibles().filter((l) => !l.despieceTerminado),
  );

  /** En qué se captura el producto elegido: nadie debería adivinar si es a kilo o a pieza. */
  protected readonly unidadElegida = computed(() => {
    const id = this.productoElegido();
    if (id === null) return null;
    return this.unidadDe(Number(id)) === 'pz' ? 'piezas' : 'kilos';
  });

  constructor() {
    this.auth.perfil().subscribe({ next: (p) => this.perfil.set(p) });
    this.productos.listar().subscribe({ next: (ps) => this.catalogo.set(ps.filter((p) => p.active)) });
    this.sucursales.listar(true).subscribe({ next: (bs) => this.branches.set(bs) });
    this.cargarCanales();
    this.cargar();
  }

  /**
   * Se pide de nuevo cada vez que se abre el panel, no solo al arrancar:
   * el propietario puede haber cambiado de sucursal activa desde entonces, y
   * las canales de otra sucursal no le sirven aquí.
   */
  private cargarCanales(): void {
    this.lotes.seleccionables(this.auth.sucursalOperativa() ?? undefined).subscribe({
      next: (ls) => this.lotesDisponibles.set(ls),
      error: () => this.lotesDisponibles.set([]),
    });
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.movimientos.entradas(this.sucursalElegida() ?? undefined).subscribe({
      next: (es) => {
        this.lista.set(es);
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
    this.loteElegido.set(null);
    this.nota.set('');
    this.despieceTerminado.set(false);
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
    // Sin sucursal no hay a qué inventario sumarle.
    if (!p || !sucursal || !producto || !cant || cant <= 0 || this.guardando()) return;

    this.guardando.set(true);
    this.error.set(null);

    this.movimientos
      .registrarEntrada({
        branchId: sucursal,
        productId: Number(producto),
        employeeId: p.empleadoId,
        batchId: this.loteElegido() ? Number(this.loteElegido()) : null,
        quantity: cant,
        note: this.nota(),
        despieceTerminado: this.loteElegido() !== null && this.despieceTerminado(),
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

  protected unidadDe(productId: number): string {
    const p = this.catalogo().find((x) => x.id === productId);
    return p?.unitOfMeasure === 'PIEZA' ? 'pz' : 'kg';
  }
}
