import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';

import { Perfil } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeDeError } from '../../core/http/api-error';
import { Batch, BatchReport } from '../batches/batch.models';
import { BatchesService } from '../batches/batches.service';
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
  protected readonly auth = inject(AuthService);

  protected readonly lista = signal<StockEntry[]>([]);
  protected readonly catalogo = signal<Product[]>([]);
  protected readonly lotesDisponibles = signal<Batch[]>([]);
  /**
   * Reporte de cada lote, por id. Un reporte que falla se omite en vez de
   * ocultar el lote: la canal queda seleccionable si no se pudo saber su
   * estado, ya que el backend es quien de verdad impide usar una agotada.
   */
  protected readonly reportes = signal<Map<number, BatchReport>>(new Map());
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

  /**
   * El reporte de merma se calcula contra el lote. Una entrada sin lote no
   * aporta produccion a ningun lote, y el reporte no puede medir nada.
   */
  protected readonly sinLote = computed(() => this.loteElegido() === null);

  protected readonly sinLigar = computed(
    () => this.lista().filter((e) => e.batchId === null).length,
  );

  /** Las agotadas no aparecen en el selector: no tiene sentido despiezar más contra ellas. */
  protected readonly lotesSeleccionables = computed(() =>
    this.lotesDisponibles().filter((l) => !this.reportes().get(l.id)?.agotado),
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
    // Los lotes son de gestión: a un vendedor le responde 403 y se queda sin selector.
    this.lotes.listar().subscribe({
      next: (ls) => {
        this.lotesDisponibles.set(ls);
        this.cargarReportes(ls);
      },
      error: () => this.lotesDisponibles.set([]),
    });
    this.cargar();
  }

  private cargarReportes(lotes: Batch[]): void {
    if (lotes.length === 0) return;

    forkJoin(
      lotes.map((l) => this.lotes.reporte(l.id).pipe(catchError(() => of(null)))),
    ).subscribe((rs) => {
      const mapa = new Map<number, BatchReport>();
      rs.forEach((r) => {
        if (r) mapa.set(r.batchId, r);
      });
      this.reportes.set(mapa);
    });
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.movimientos.entradas().subscribe({
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

  protected abrir(): void {
    this.productoElegido.set(null);
    this.cantidad.set(null);
    this.loteElegido.set(null);
    this.nota.set('');
    this.despieceTerminado.set(false);
    this.error.set(null);
    this.panelAbierto.set(true);
  }

  protected cerrar(): void {
    this.panelAbierto.set(false);
    this.error.set(null);
  }

  protected guardar(): void {
    const p = this.perfil();
    const producto = this.productoElegido();
    const cant = this.cantidad();
    // Sin sucursal no hay a qué inventario sumarle.
    if (!p?.sucursalId || !producto || !cant || cant <= 0 || this.guardando()) return;

    this.guardando.set(true);
    this.error.set(null);

    this.movimientos
      .registrarEntrada({
        branchId: p.sucursalId,
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
