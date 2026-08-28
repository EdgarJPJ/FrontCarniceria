import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';

import { mensajeDeError } from '../../core/http/api-error';
import { BatchReport, estadoDeReporte } from '../../features/batches/batch.models';
import { BatchesService } from '../../features/batches/batches.service';
import { SidePanel } from '../side-panel/side-panel';

/**
 * El reporte de merma de una canal, con el desglose por producto. Antes vivía
 * solo dentro de `batches.page.ts`; ahora lo abre también Mermas, así que se
 * volvió un componente aparte en vez de duplicar el marcado.
 */
@Component({
  selector: 'app-batch-report-modal',
  imports: [SidePanel, DatePipe],
  templateUrl: './batch-report-modal.html',
  styleUrl: './batch-report-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BatchReportModal {
  private readonly lotes = inject(BatchesService);

  readonly batchId = input.required<number>();
  readonly cerrar = output<void>();

  protected readonly reporte = signal<BatchReport | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.batchId();
      this.reporte.set(null);
      this.cargando.set(true);
      this.error.set(null);

      this.lotes.reporte(id).subscribe({
        next: (r) => {
          this.reporte.set(r);
          this.cargando.set(false);
        },
        error: (e: unknown) => {
          this.error.set(mensajeDeError(e));
          this.cargando.set(false);
        },
      });
    });
  }

  protected readonly estadoDeReporte = estadoDeReporte;

  /** Los 50 g de tolerancia que usa el backend para dar una canal por cuadrada. */
  private static readonly TOLERANCIA_KG = 0.05;

  /** Verdadero solo si se capturó la merma esperada y hay con qué compararla. */
  protected hayComparacionDeMerma(r: BatchReport): boolean {
    return r.medible && r.expectedLossPercent !== null;
  }

  /** `butcheringLoss - expectedLoss`: positivo cuando se perdió más de lo previsto. */
  protected difEsperada(r: BatchReport): number {
    return r.butcheringLoss - r.expectedLoss;
  }

  /** Rojo solo cuando la merma real superó a la esperada más allá de la tolerancia. */
  protected peorQueEsperado(r: BatchReport): boolean {
    return this.difEsperada(r) > BatchReportModal.TOLERANCIA_KG;
  }

  protected textoDifEsperada(r: BatchReport): string {
    const d = this.difEsperada(r);
    if (Math.abs(d) <= BatchReportModal.TOLERANCIA_KG) return 'como lo esperado';
    const abs = Math.abs(d).toFixed(3) + ' kg';
    return d > 0 ? abs + ' más de lo esperado' : abs + ' menos de lo esperado';
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
}
