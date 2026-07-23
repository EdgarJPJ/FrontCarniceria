import { DatePipe, LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { Perfil } from '../../core/auth/auth.models';
import { mensajeDeError } from '../../core/http/api-error';
import { Client } from '../clients/client.models';
import { ClientsService } from '../clients/clients.service';
import { Product, ProductsService } from '../products/products.service';
import { SidePanel } from '../../shared/side-panel/side-panel';
import { PaymentMethod, Sale } from './sale.models';
import { SalesService } from './sales.service';

/** Una línea del ticket en construcción, antes de mandarla al servidor. */
interface Partida {
  product: Product;
  quantity: number;
}

@Component({
  selector: 'app-sales-page',
  imports: [FormsModule, DatePipe, LowerCasePipe, SidePanel],
  templateUrl: './sales.page.html',
  styleUrl: './sales.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesPage {
  private readonly ventas = inject(SalesService);
  private readonly productos = inject(ProductsService);
  private readonly clientes = inject(ClientsService);
  protected readonly auth = inject(AuthService);

  protected readonly lista = signal<Sale[]>([]);
  protected readonly catalogo = signal<Product[]>([]);
  protected readonly clientesActivos = signal<Client[]>([]);
  protected readonly metodos = signal<PaymentMethod[]>([]);
  protected readonly perfil = signal<Perfil | null>(null);

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly cobrando = signal(false);
  protected readonly cajaAbierta = signal(false);

  /** El ticket en construcción. */
  protected readonly partidas = signal<Partida[]>([]);
  protected readonly productoElegido = signal<number | null>(null);
  protected readonly cantidad = signal<number | null>(null);
  protected readonly clienteElegido = signal<number | null>(null);
  protected readonly metodoElegido = signal<number | null>(null);
  protected readonly descuento = signal(0);

  protected readonly subtotal = computed(() =>
    this.partidas().reduce((s, p) => s + p.product.salePrice * p.quantity, 0),
  );

  protected readonly total = computed(() => Math.max(0, this.subtotal() - (this.descuento() || 0)));

  /** Fiado: si hay cliente, la venta nace pendiente de pago. */
  protected readonly esFiado = computed(() => this.clienteElegido() !== null);

  protected readonly ventaDelDia = computed(() => {
    const hoy = new Date().toDateString();
    return this.lista()
      .filter((v) => v.status === 'ACTIVA' && new Date(v.date).toDateString() === hoy)
      .reduce((s, v) => s + v.total, 0);
  });

  protected readonly porCobrar = computed(() =>
    this.lista().filter((v) => v.status === 'ACTIVA' && v.paymentStatus !== 'PAGADO').length,
  );

  constructor() {
    this.auth.perfil().subscribe({ next: (p) => this.perfil.set(p) });
    this.productos.listar().subscribe({ next: (ps) => this.catalogo.set(ps.filter((p) => p.active)) });
    this.clientes.listar(undefined, true).subscribe({ next: (cs) => this.clientesActivos.set(cs) });
    this.ventas.metodosPago().subscribe({ next: (ms) => this.metodos.set(ms) });
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.ventas.listar().subscribe({
      next: (vs) => {
        this.lista.set(vs);
        this.cargando.set(false);
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  protected abrirCaja(): void {
    this.partidas.set([]);
    this.productoElegido.set(null);
    this.cantidad.set(null);
    this.clienteElegido.set(null);
    this.metodoElegido.set(null);
    this.descuento.set(0);
    this.error.set(null);
    this.cajaAbierta.set(true);
  }

  protected cerrarCaja(): void {
    this.cajaAbierta.set(false);
    this.error.set(null);
  }

  protected agregarPartida(): void {
    const id = this.productoElegido();
    const cant = this.cantidad();
    if (!id || !cant || cant <= 0) return;

    const product = this.catalogo().find((p) => p.id === Number(id));
    if (!product) return;

    // Si el producto ya está en el ticket, se suma en vez de duplicar la línea.
    this.partidas.update((ps) => {
      const existente = ps.find((p) => p.product.id === product.id);
      return existente
        ? ps.map((p) => (p.product.id === product.id ? { ...p, quantity: p.quantity + cant } : p))
        : [...ps, { product, quantity: cant }];
    });

    // Se limpian los dos campos: si el selector se quedara con el producto que
    // se acaba de agregar, parecería que todavía no entra al ticket. El foco
    // vuelve al producto, no a la cantidad, porque lo normal es que la
    // siguiente pieza sea de otro corte.
    this.productoElegido.set(null);
    this.cantidad.set(null);
    document.getElementById('producto')?.focus();
  }

  protected quitarPartida(productId: number): void {
    this.partidas.update((ps) => ps.filter((p) => p.product.id !== productId));
  }

  protected cobrar(): void {
    const p = this.perfil();
    // Sin sucursal no hay dónde registrar la venta: es el caso del soporte,
    // que no pertenece a ninguna carnicería.
    if (!p?.sucursalId || this.partidas().length === 0 || this.cobrando()) return;

    this.cobrando.set(true);
    this.error.set(null);

    this.ventas
      .registrar({
        clientId: this.clienteElegido() ? Number(this.clienteElegido()) : null,
        branchId: p.sucursalId,
        employeeId: p.empleadoId,
        paymentMethodId: this.metodoElegido() ? Number(this.metodoElegido()) : null,
        discount: this.descuento() || 0,
        details: this.partidas().map((x) => ({
          productId: x.product.id,
          quantity: x.quantity,
        })),
      })
      .subscribe({
        next: () => {
          this.cobrando.set(false);
          this.cerrarCaja();
          this.cargar();
        },
        error: (e: unknown) => {
          this.cobrando.set(false);
          this.error.set(mensajeDeError(e));
        },
      });
  }

  protected cancelar(venta: Sale): void {
    this.error.set(null);
    this.ventas.cancelar(venta.id).subscribe({
      next: () => this.cargar(),
      error: (e: unknown) => this.error.set(mensajeDeError(e)),
    });
  }

  protected unidad(p: Product): string {
    return p.unitOfMeasure === 'KILO' ? 'kg' : 'pz';
  }

  protected pesos(monto: number): string {
    return monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}
