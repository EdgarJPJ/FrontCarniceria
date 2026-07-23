import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { mensajeDeError } from '../../core/http/api-error';
import { SidePanel } from '../../shared/side-panel/side-panel';
import { PaymentMethod, Sale } from '../sales/sale.models';
import { SalesService } from '../sales/sales.service';
import { CreditService, SaldoCliente } from './credit.service';

@Component({
  selector: 'app-credit-page',
  imports: [FormsModule, DatePipe, SidePanel],
  templateUrl: './credit.page.html',
  styleUrl: './credit.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditPage {
  private readonly credito = inject(CreditService);
  private readonly ventas = inject(SalesService);

  protected readonly saldos = signal<SaldoCliente[]>([]);
  protected readonly metodos = signal<PaymentMethod[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  /** Cliente al que se le está cobrando. */
  protected readonly cobrando = signal<SaldoCliente | null>(null);
  protected readonly ventasDelCliente = signal<Sale[]>([]);
  protected readonly cargandoVentas = signal(false);

  /** Venta concreta sobre la que se registra el abono. */
  protected readonly abonando = signal<Sale | null>(null);
  protected readonly monto = signal<number | null>(null);
  protected readonly metodoElegido = signal<number | null>(null);
  protected readonly guardando = signal(false);

  protected readonly totalPorCobrar = computed(() =>
    this.saldos().reduce((s, c) => s + c.balance, 0),
  );

  /** Quien ya pasó de lo que se le autorizó: es lo que hay que vigilar. */
  protected readonly sobrepasados = computed(
    () => this.saldos().filter((c) => c.creditLimit > 0 && c.balance > c.creditLimit).length,
  );

  constructor() {
    this.ventas.metodosPago().subscribe({ next: (ms) => this.metodos.set(ms) });
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.credito.saldos().subscribe({
      next: (ss) => {
        this.saldos.set(ss);
        this.cargando.set(false);
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  protected abrirCobro(cliente: SaldoCliente): void {
    this.cobrando.set(cliente);
    this.abonando.set(null);
    this.ventasDelCliente.set([]);
    this.cargandoVentas.set(true);
    this.error.set(null);

    // Solo las que siguen debiendo: una pagada ya no se cobra.
    this.ventas.listar(undefined, undefined).subscribe({
      next: (vs) => {
        this.ventasDelCliente.set(
          vs.filter(
            (v) =>
              v.clientId === cliente.clientId &&
              v.status === 'ACTIVA' &&
              v.paymentStatus !== 'PAGADO',
          ),
        );
        this.cargandoVentas.set(false);
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.cargandoVentas.set(false);
      },
    });
  }

  protected cerrarPanel(): void {
    this.cobrando.set(null);
    this.abonando.set(null);
    this.monto.set(null);
    this.error.set(null);
  }

  protected abrirAbono(venta: Sale): void {
    this.abonando.set(venta);
    this.monto.set(null);
    this.metodoElegido.set(null);
  }

  protected registrarAbono(): void {
    const venta = this.abonando();
    const cantidad = this.monto();
    if (!venta || !cantidad || cantidad <= 0 || this.guardando()) return;

    this.guardando.set(true);
    this.error.set(null);

    this.ventas
      .abonar({
        saleId: venta.id,
        paymentMethodId: this.metodoElegido() ? Number(this.metodoElegido()) : null,
        amount: cantidad,
        note: '',
      })
      .subscribe({
        next: (abono) => {
          this.guardando.set(false);
          const resta = abono.remainingBalance ?? 0;
          this.aviso.set(
            resta > 0
              ? `Abono registrado. A esa venta le restan ${this.pesos(resta)}.`
              : 'Abono registrado. Esa venta queda saldada.',
          );
          this.cerrarPanel();
          this.cargar();
        },
        error: (e: unknown) => {
          this.guardando.set(false);
          this.error.set(mensajeDeError(e));
        },
      });
  }

  protected sobrepasa(c: SaldoCliente): boolean {
    return c.creditLimit > 0 && c.balance > c.creditLimit;
  }

  protected pesos(monto: number): string {
    return monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}
