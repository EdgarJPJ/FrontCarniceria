import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { InventoryService } from '../inventory/inventory.service';
import { Sale } from '../sales/sale.models';
import { SalesService } from '../sales/sales.service';

/** Debajo de esto se avisa: hay que reponer antes de que se acabe. */
const UMBRAL_BAJO = 5;

/**
 * Portada del turno: cómo va el día y qué necesita atención. Todo lo que
 * muestra sale de módulos que ya existen, así que no consulta nada aparte.
 */
@Component({
  selector: 'app-mostrador-page',
  imports: [RouterLink],
  templateUrl: './mostrador.page.html',
  styleUrl: './mostrador.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MostradorPage {
  protected readonly auth = inject(AuthService);
  private readonly ventas = inject(SalesService);
  private readonly inventario = inject(InventoryService);

  protected readonly perfil = toSignal(
    this.auth.perfil().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  protected readonly lista = signal<Sale[]>([]);
  protected readonly porReponer = signal(0);
  protected readonly cargando = signal(true);

  private readonly deHoy = computed(() => {
    const hoy = new Date().toDateString();
    return this.lista().filter(
      (v) => v.status === 'ACTIVA' && new Date(v.date).toDateString() === hoy,
    );
  });

  protected readonly vendidoHoy = computed(() =>
    this.deHoy().reduce((s, v) => s + v.total, 0),
  );

  protected readonly ventasHoy = computed(() => this.deHoy().length);

  /** Lo cobrado de contado hoy: es lo que debería estar en la caja. */
  protected readonly enCajaHoy = computed(() =>
    this.deHoy()
      .filter((v) => v.paymentStatus === 'PAGADO')
      .reduce((s, v) => s + v.total, 0),
  );

  /** Lo que se fio hoy y todavía no entra. */
  protected readonly fiadoHoy = computed(() => this.vendidoHoy() - this.enCajaHoy());

  protected readonly pendientes = computed(
    () => this.lista().filter((v) => v.status === 'ACTIVA' && v.paymentStatus !== 'PAGADO').length,
  );

  constructor() {
    this.ventas.listar().subscribe({
      next: (vs) => {
        this.lista.set(vs);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });

    this.inventario.listar().subscribe({
      next: (ls) => this.porReponer.set(ls.filter((l) => l.stock <= UMBRAL_BAJO).length),
      error: () => this.porReponer.set(0),
    });
  }

  protected pesos(monto: number): string {
    return monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}
