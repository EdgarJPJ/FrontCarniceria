import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { mensajeDeError } from '../../core/http/api-error';
import { SidePanel } from '../../shared/side-panel/side-panel';
import { Branch } from '../branches/branch.models';
import { BranchesService } from '../branches/branches.service';
import { Batch, BatchReport } from './batch.models';
import { BatchesService } from './batches.service';

@Component({
  selector: 'app-batches-page',
  imports: [ReactiveFormsModule, SidePanel],
  templateUrl: './batches.page.html',
  styleUrl: './batches.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BatchesPage {
  private readonly fb = inject(FormBuilder);
  private readonly lotes = inject(BatchesService);
  private readonly sucursales = inject(BranchesService);

  protected readonly lista = signal<Batch[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);

  protected readonly editando = signal<Batch | 'nuevo' | null>(null);
  protected readonly reporte = signal<BatchReport | null>(null);
  protected readonly cargandoReporte = signal(false);

  protected readonly invertido = computed(() =>
    this.lista().reduce((suma, l) => suma + (l.totalPrice ?? 0), 0),
  );

  protected readonly form = this.fb.nonNullable.group({
    description: ['', Validators.maxLength(100)],
    totalWeight: [null as number | null, Validators.min(0)],
    totalPrice: [null as number | null, Validators.min(0)],
    branchId: [0, [Validators.required, Validators.min(1)]],
  });

  constructor() {
    this.sucursales.listar(true).subscribe({ next: (bs) => this.branches.set(bs) });
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.lotes.listar().subscribe({
      next: (ls) => {
        this.lista.set(ls);
        this.cargando.set(false);
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  protected abrirAlta(): void {
    this.form.reset({
      description: '', totalWeight: null, totalPrice: null,
      branchId: this.branches()[0]?.id ?? 0,
    });
    this.editando.set('nuevo');
  }

  protected abrirEdicion(lote: Batch): void {
    this.form.reset({
      description: lote.description ?? '',
      totalWeight: lote.totalWeight,
      totalPrice: lote.totalPrice,
      branchId: lote.branchId,
    });
    this.editando.set(lote);
  }

  protected cerrarPanel(): void {
    this.editando.set(null);
    this.reporte.set(null);
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

    const v = this.form.getRawValue();
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
    this.cargandoReporte.set(true);
    this.error.set(null);
    this.lotes.reporte(lote.id).subscribe({
      next: (r) => {
        this.reporte.set(r);
        this.cargandoReporte.set(false);
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.cargandoReporte.set(false);
      },
    });
  }

  /** Qué proporción del peso comprado se perdió. */
  protected porcentaje(parte: number, total: number): string {
    if (!total) return '—';
    return ((parte / total) * 100).toFixed(1) + '%';
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
