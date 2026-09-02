import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Icono } from '../../shared/icono/icono';
import { InventoryLine, InventoryService } from '../inventory/inventory.service';
import { Payment, Sale } from '../sales/sale.models';
import { SalesService } from '../sales/sales.service';

/** Cuántos cortes bajos se listan antes de mandar al inventario completo. */
const MAX_BAJOS = 5;

/**
 * Portada del turno: lo que se viene a hacer, cómo va el día y qué necesita
 * atención. Todo lo que muestra sale de módulos que ya existen, así que no
 * consulta nada aparte.
 */
@Component({
  selector: 'app-mostrador-page',
  imports: [RouterLink, Icono],
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
  protected readonly abonos = signal<Payment[]>([]);
  protected readonly existencias = signal<InventoryLine[]>([]);
  protected readonly cargando = signal(true);

  private readonly hoy = computed(() => new Date().toDateString());

  private readonly deHoy = computed(() => {
    const hoy = this.hoy();
    return this.lista().filter(
      (v) => v.status === 'ACTIVA' && new Date(v.date).toDateString() === hoy,
    );
  });

  protected readonly vendidoHoy = computed(() =>
    this.deHoy().reduce((s, v) => s + v.total, 0),
  );

  protected readonly ventasHoy = computed(() => this.deHoy().length);

  /**
   * Lo cobrado de contado hoy. Se filtra por si la venta tiene cliente, no
   * por su `paymentStatus` actual: una venta fiada que se salda el mismo día
   * también queda `PAGADO`, y contarla aquí la duplicaría con lo que ya suma
   * `abonosHoy` a través de sus abonos.
   */
  protected readonly contadoHoy = computed(() =>
    this.deHoy()
      .filter((v) => v.clientId === null)
      .reduce((s, v) => s + v.total, 0),
  );

  /**
   * Abonos que entraron hoy, sin importar de qué día sea la venta que
   * liquidan. Un abono de una venta fiada la semana pasada es dinero que
   * entra a la caja hoy igual que una venta de contado.
   */
  protected readonly abonosHoy = computed(() => {
    const hoy = this.hoy();
    return this.abonos()
      .filter((a) => new Date(a.date).toDateString() === hoy)
      .reduce((s, a) => s + a.amount, 0);
  });

  /** Todo lo que debería estar en la caja hoy: contado más abonos cobrados hoy. */
  protected readonly enCajaHoy = computed(() => this.contadoHoy() + this.abonosHoy());

  /** Lo que se fio hoy y todavía no entra, de las ventas de hoy nada más. */
  protected readonly fiadoHoy = computed(() => this.vendidoHoy() - this.contadoHoy());

  protected readonly pendientes = computed(
    () => this.lista().filter((v) => v.status === 'ACTIVA' && v.paymentStatus !== 'PAGADO').length,
  );

  /**
   * Un corte pide reponerse si se agotó, o si su existencia bajó del punto de
   * reorden que le pusieron. Sin punto de reorden solo cuenta el cero: un
   * umbral único para todo llenaba la sección de cortes que en realidad
   * estaban bien y enseñaba a ignorarla.
   */
  private esBajo(l: InventoryLine): boolean {
    return l.stock <= 0 || (l.reorderPoint !== null && l.stock <= l.reorderPoint);
  }

  /**
   * Los cortes que están por acabarse, los más urgentes primero: agotado
   * antes que bajo, y dentro de cada grupo el de menos existencia. Es el
   * estado del inventario que se mira de reojo sin entrar a la lista entera.
   */
  protected readonly cortesBajos = computed(() =>
    this.existencias()
      .filter((l) => this.esBajo(l))
      .sort((a, b) => a.stock - b.stock)
      .slice(0, MAX_BAJOS),
  );

  protected readonly totalBajos = computed(
    () => this.existencias().filter((l) => this.esBajo(l)).length,
  );

  /**
   * Verdadero cuando hay existencias pero a ningún producto se le puso punto
   * de reorden: entonces esta sección solo avisará de agotados, y conviene
   * decir cómo activarla.
   */
  protected readonly sinPuntosDeReorden = computed(() => {
    const ls = this.existencias();
    return ls.length > 0 && ls.every((l) => l.reorderPoint === null);
  });

  constructor() {
    this.ventas.listar().subscribe({
      next: (vs) => {
        this.lista.set(vs);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });

    this.ventas.listarAbonos().subscribe({
      next: (ps) => this.abonos.set(ps),
      error: () => this.abonos.set([]),
    });

    this.inventario.listar().subscribe({
      next: (ls) => this.existencias.set(ls),
      error: () => this.existencias.set([]),
    });
  }

  protected agotado(linea: InventoryLine): boolean {
    return linea.stock <= 0;
  }

  /** El kilo lleva decimales porque se pesa; la pieza no, porque se cuenta. */
  protected cantidad(linea: InventoryLine): string {
    return linea.unitOfMeasure === 'KILO'
      ? `${linea.stock.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg`
      : `${Math.round(linea.stock)} pz`;
  }

  protected pesos(monto: number): string {
    return monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}
