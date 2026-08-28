import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { mensajeDeError } from '../../core/http/api-error';
import { BatchReportModal } from '../../shared/batch-report-modal/batch-report-modal';
import { SidePanel } from '../../shared/side-panel/side-panel';
import { Branch } from '../branches/branch.models';
import { BranchesService } from '../branches/branches.service';
import { Batch, BatchReport, EstadoCanal, estadoDeReporte } from './batch.models';
import { BatchesService } from './batches.service';

@Component({
  selector: 'app-batches-page',
  imports: [ReactiveFormsModule, SidePanel, DatePipe, BatchReportModal],
  templateUrl: './batches.page.html',
  styleUrl: './batches.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BatchesPage {
  private readonly fb = inject(FormBuilder);
  private readonly lotes = inject(BatchesService);
  private readonly sucursales = inject(BranchesService);
  protected readonly auth = inject(AuthService);

  protected readonly lista = signal<Batch[]>([]);
  protected readonly branches = signal<Branch[]>([]);

  /**
   * Un administrador ya no puede registrar una canal en otra sucursal —el
   * backend la forzaría a la suya igual—, así que ni se le ofrece elegir
   * una distinta. Solo el propietario ve la lista completa.
   */
  protected readonly sucursalesElegibles = computed(() =>
    this.auth.esPropietario()
      ? this.branches()
      : this.branches().filter((b) => b.id === this.auth.sucursalOperativa()),
  );
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);

  protected readonly editando = signal<Batch | 'nuevo' | null>(null);
  /** El id de la canal cuyo reporte se está mirando; null si el modal está cerrado. */
  protected readonly viendoReporteDe = signal<number | null>(null);

  /**
   * El reporte de cada canal, por id. Es lo único que sabe cuánto queda de
   * ella: `lotes` no guarda ningún estado, así que "agotada" se deduce de los
   * pesos. Un reporte que falla se omite del mapa y la canal queda sin estado
   * en vez de aparecer acabada por error.
   */
  protected readonly reportes = signal<Map<number, BatchReport>>(new Map());

  /** Las acabadas estorban a diario; se pueden volver a mostrar. */
  protected readonly ocultarAgotadas = signal(true);

  protected readonly invertido = computed(() =>
    this.lista().reduce((suma, l) => suma + (l.totalPrice ?? 0), 0),
  );

  protected readonly agotadas = computed(
    () => this.lista().filter((l) => this.estado(l) === 'agotada').length,
  );

  protected readonly abiertas = computed(() => this.lista().length - this.agotadas());

  protected readonly visibles = computed(() =>
    this.ocultarAgotadas()
      ? this.lista().filter((l) => this.estado(l) !== 'agotada')
      : this.lista(),
  );

  protected readonly form = this.fb.nonNullable.group({
    description: ['', Validators.maxLength(100)],
    totalWeight: [null as number | null, Validators.min(0)],
    totalPrice: [null as number | null, Validators.min(0)],
    /**
     * Solo de UI: no viaja a `BatchRequest` ni se guarda en la base. Rellena
     * `totalPrice`, que sigue siendo el campo real y se puede corregir a mano
     * después sin que esto se lo vuelva a pisar.
     */
    precioPorKilo: [null as number | null, Validators.min(0)],
    /** Merma de despiece esperada, como % del peso comprado. Opcional. */
    expectedLossPercent: [null as number | null, [Validators.min(0), Validators.max(100)]],
    branchId: [0, [Validators.required, Validators.min(1)]],
  });

  constructor() {
    this.sucursales.listar(true).subscribe({ next: (bs) => this.branches.set(bs) });
    this.cargar();

    this.form.controls.precioPorKilo.valueChanges.subscribe(() => this.recalcularTotalPagado());
    this.form.controls.totalWeight.valueChanges.subscribe(() => this.recalcularTotalPagado());
  }

  /** Solo calcula si hay un precio por kilo capturado; si no, `totalPrice` se sigue tecleando a mano. */
  private recalcularTotalPagado(): void {
    const precio = this.form.controls.precioPorKilo.value;
    const peso = this.form.controls.totalWeight.value;
    if (!precio || !peso) return;

    this.form.controls.totalPrice.setValue(Math.round(precio * peso * 100) / 100);
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.lotes.listar().subscribe({
      next: (ls) => {
        this.lista.set(ls);
        this.cargando.set(false);
        this.cargarReportes(ls);
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  /**
   * Un reporte por canal, en paralelo. Es una petición por fila, pero es la
   * única forma de saber qué queda de cada una sin un endpoint que las
   * resuma. Cada una absorbe su propio error para que una canal rota no deje
   * la lista entera sin estado.
   */
  private cargarReportes(lotes: Batch[]): void {
    if (lotes.length === 0) {
      this.reportes.set(new Map());
      return;
    }

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

  protected abrirAlta(): void {
    // emitEvent: false — si no, el propio reset dispara el recálculo y
    // podría redondear un totalPrice que todavía ni se ha tecleado.
    this.form.reset(
      {
        description: '', totalWeight: null, totalPrice: null, precioPorKilo: null,
        expectedLossPercent: null,
        branchId: this.auth.sucursalOperativa() ?? this.sucursalesElegibles()[0]?.id ?? 0,
      },
      { emitEvent: false },
    );
    this.editando.set('nuevo');
  }

  protected abrirEdicion(lote: Batch): void {
    this.form.reset(
      {
        description: lote.description ?? '',
        totalWeight: lote.totalWeight,
        totalPrice: lote.totalPrice,
        // Se muestra el precio por kilo que ya tenía, solo informativo: no se
        // recalcula totalPrice con él a menos que se toque uno de los dos.
        precioPorKilo: lote.totalWeight && lote.totalPrice ? lote.totalPrice / lote.totalWeight : null,
        expectedLossPercent: lote.expectedLossPercent,
        branchId: lote.branchId,
      },
      { emitEvent: false },
    );
    this.editando.set(lote);
  }

  protected cerrarPanel(): void {
    this.editando.set(null);
    this.error.set(null);
  }

  protected guardar(): void {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }
    const enCurso = this.editando();
    if (!enCurso) return;

    this.guardando.set(true);
    this.error.set(null);

    const { precioPorKilo, ...v } = this.form.getRawValue();
    const datos = { ...v, branchId: Number(v.branchId) };
    const peticion =
      enCurso === 'nuevo'
        ? this.lotes.registrar(datos)
        : this.lotes.actualizar(enCurso.id, datos);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarPanel();
        this.cargar();
      },
      error: (e: unknown) => {
        this.guardando.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }

  protected verReporte(lote: Batch): void {
    this.viendoReporteDe.set(lote.id);
  }

  protected cerrarReporte(): void {
    this.viendoReporteDe.set(null);
  }

  /**
   * Cuánto queda de la canal: lo que salió del despiece menos lo vendido y lo
   * mermado. Null cuando no hay con qué calcularlo.
   */
  protected restante(lote: Batch): number | null {
    const r = this.reportes().get(lote.id);
    if (!r || !r.medible) return null;
    return r.weightProduced - r.weightSold - r.weightManualWaste;
  }

  /**
   * En qué punto va la canal. No hay campo en la base: se deduce del peso, y
   * cuando falta captura se dice eso en vez de inventar un estado.
   */
  protected estado(lote: Batch): EstadoCanal {
    const r = this.reportes().get(lote.id);
    return r ? estadoDeReporte(r) : 'sin-datos';
  }

  /** Lo que se pinta en la columna de restante. */
  protected textoRestante(lote: Batch): string {
    switch (this.estado(lote)) {
      case 'agotada':
        return 'Agotada';
      case 'sin-despiezar':
        return 'Sin despiezar';
      case 'sin-datos':
        return '—';
      default:
        return this.kilos(this.restante(lote));
    }
  }

  protected kilos(valor: number | null): string {
    return valor === null ? '—' : valor.toFixed(3) + ' kg';
  }

  protected pesos(monto: number | null): string {
    return monto === null
      ? '—'
      : monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }

  /** Costo por kilo comprado: con eso se sabe si el precio de venta da margen. */
  protected costoPorKilo(lote: Batch): string {
    if (!lote.totalPrice || !lote.totalWeight) return '—';
    return this.pesos(lote.totalPrice / lote.totalWeight);
  }
}
