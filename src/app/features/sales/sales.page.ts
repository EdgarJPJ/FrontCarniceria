import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { Perfil } from '../../core/auth/auth.models';
import { mensajeDeError } from '../../core/http/api-error';
import { Client } from '../clients/client.models';
import { ClientsService } from '../clients/clients.service';
import { CreditService } from '../credit/credit.service';
import { Product, ProductsService } from '../products/products.service';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { SidePanel } from '../../shared/side-panel/side-panel';
import { PaymentMethod, Sale } from './sale.models';
import { SalesService } from './sales.service';

/** Una línea del ticket en construcción, antes de mandarla al servidor. */
interface Partida {
  product: Product;
  quantity: number;
}

/** Los tres pasos de la caja, en orden. */
type Paso = 1 | 2 | 3;

/** Lo que se muestra al terminar: el recibo de que la venta quedó. */
interface Recibo {
  total: number;
  productos: number;
  fiado: boolean;
}

@Component({
  selector: 'app-sales-page',
  imports: [FormsModule, DatePipe, SidePanel, ConfirmDialog],
  templateUrl: './sales.page.html',
  styleUrl: './sales.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesPage {
  private readonly ventas = inject(SalesService);
  private readonly productos = inject(ProductsService);
  private readonly clientes = inject(ClientsService);
  private readonly credito = inject(CreditService);
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly lista = signal<Sale[]>([]);
  protected readonly catalogo = signal<Product[]>([]);
  protected readonly clientesActivos = signal<Client[]>([]);
  protected readonly metodos = signal<PaymentMethod[]>([]);
  protected readonly perfil = signal<Perfil | null>(null);

  /**
   * Cuánto debe cada cliente ahora mismo, por id. Es de gestión
   * (`/api/client-balances`); a un vendedor le responde 403 y se queda
   * vacío — la venta que exceda el límite la rechaza igual el backend, solo
   * que sin el aviso previo.
   */
  protected readonly saldosClientes = signal<Map<number, number>>(new Map());
  protected readonly forzarCredito = signal(false);

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly cobrando = signal(false);
  protected readonly cajaAbierta = signal(false);

  /** En qué paso de la caja va: qué lleva, para quién, cómo paga. */
  protected readonly paso = signal<Paso>(1);

  /** Lo que falta para seguir. Se dice, no se deja el botón mudo. */
  protected readonly avisoPaso = signal<string | null>(null);

  /** Cuando existe, la caja muestra el recibo en vez del formulario. */
  protected readonly recibo = signal<Recibo | null>(null);

  /** Venta cuyo detalle completo se está mirando. */
  protected readonly viendoDetalle = signal<Sale | null>(null);

  /** Venta a punto de cancelarse, en espera de que confirmen. */
  protected readonly cancelando = signal<Sale | null>(null);

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

  protected readonly clienteInfo = computed(() => {
    const id = this.clienteElegido();
    if (id === null) return null;
    return this.clientesActivos().find((c) => c.id === Number(id)) ?? null;
  });

  /** Si esta venta se registra tal cual, deja al cliente por encima de lo que se le autorizó. */
  protected readonly excedeLimite = computed(() => {
    const cliente = this.clienteInfo();
    if (!cliente) return false;
    const saldoActual = this.saldosClientes().get(cliente.id) ?? 0;
    return saldoActual + this.total() > cliente.creditLimit;
  });

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
    this.credito.saldos().subscribe({
      next: (ss) => this.saldosClientes.set(new Map(ss.map((s) => [s.clientId, s.balance]))),
      error: () => this.saldosClientes.set(new Map()),
    });
    this.ventas.metodosPago().subscribe({ next: (ms) => this.metodos.set(ms) });
    this.cargar();

    // El riel abre la caja desde cualquier pantalla con ?nueva=1. Se limpia
    // el parámetro al vuelo para que recargar o volver atrás no la reabra.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      if (params.get('nueva') !== null) {
        this.abrirCaja();
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    });
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
    this.forzarCredito.set(false);
    this.error.set(null);
    this.avisoPaso.set(null);
    this.recibo.set(null);
    this.paso.set(1);
    this.cajaAbierta.set(true);
  }

  /** Cambiar de cliente no debe arrastrar la autorización que se dio para otro. */
  protected elegirCliente(id: number | null): void {
    this.clienteElegido.set(id);
    this.forzarCredito.set(false);
  }

  protected cerrarCaja(): void {
    this.cajaAbierta.set(false);
    this.error.set(null);
    this.avisoPaso.set(null);
  }

  /** Avanza al paso siguiente, pero solo si lo del paso actual está completo. */
  protected siguiente(): void {
    if (this.paso() === 1 && this.partidas().length === 0) {
      this.avisoPaso.set('Agrega al menos un producto para continuar.');
      return;
    }
    if (this.paso() === 2 && this.excedeLimite() && !(this.auth.esGestion() && this.forzarCredito())) {
      this.avisoPaso.set('Esta venta deja al cliente por encima de su límite de crédito.');
      return;
    }
    this.avisoPaso.set(null);
    this.paso.update((p) => (p < 3 ? ((p + 1) as Paso) : p));
  }

  /** Solo deja volver a un paso ya recorrido: hacia adelante se valida. */
  protected irAPaso(destino: Paso): void {
    if (destino <= this.paso()) {
      this.avisoPaso.set(null);
      this.paso.set(destino);
    }
  }

  protected agregarPartida(): void {
    const id = this.productoElegido();
    const cant = this.cantidad();

    // El botón no se queda mudo: dice qué falta en vez de no hacer nada.
    if (!id) {
      this.avisoPaso.set('Elige un producto de la lista.');
      return;
    }
    if (!cant || cant <= 0) {
      this.avisoPaso.set('Escribe cuánto lleva, en kilos o piezas.');
      return;
    }

    const product = this.catalogo().find((p) => p.id === Number(id));
    if (!product) return;

    this.avisoPaso.set(null);

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

  /** Corrige una cantidad ya agregada, sin quitar la línea y volver a escribirla. */
  protected cambiarCantidad(productId: number, cantidad: number): void {
    if (!cantidad || cantidad <= 0) return;
    this.partidas.update((ps) =>
      ps.map((p) => (p.product.id === productId ? { ...p, quantity: cantidad } : p)),
    );
  }

  protected cobrar(): void {
    const p = this.perfil();
    if (this.partidas().length === 0 || this.cobrando()) return;

    // Sin sucursal no hay dónde registrar la venta: es el caso del soporte,
    // que no pertenece a ninguna carnicería. Antes fallaba en silencio.
    if (!p?.sucursalId) {
      this.error.set('Tu usuario no está en una sucursal, así que no hay dónde registrar la venta.');
      return;
    }

    const fiado = this.esFiado();
    const total = this.total();
    const productos = this.partidas().length;

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
        overrideCreditLimit: this.forzarCredito(),
      })
      .subscribe({
        next: () => {
          this.cobrando.set(false);
          // La caja no se cierra sola: muestra el recibo de que quedó. Cerrar
          // sin decir nada dejaba al carnicero sin saber si se cobró o no.
          this.recibo.set({ total, productos, fiado });
          this.cargar();
        },
        error: (e: unknown) => {
          this.cobrando.set(false);
          this.error.set(mensajeDeError(e));
        },
      });
  }

  /** Tras cobrar: deja la caja lista para la siguiente sin cerrarla. */
  protected otraVenta(): void {
    this.abrirCaja();
  }

  protected verDetalle(venta: Sale): void {
    this.viendoDetalle.set(venta);
  }

  protected cerrarDetalle(): void {
    this.viendoDetalle.set(null);
  }

  /**
   * Cancelar descuenta la venta y devuelve el inventario: no es un clic del
   * que se vuelva con un "deshacer", así que se confirma antes.
   */
  protected cancelar(venta: Sale): void {
    this.cancelando.set(venta);
  }

  protected confirmarCancelar(): void {
    const venta = this.cancelando();
    if (!venta) return;

    this.cancelando.set(null);
    this.error.set(null);
    this.ventas.cancelar(venta.id).subscribe({
      next: () => this.cargar(),
      error: (e: unknown) => this.error.set(mensajeDeError(e)),
    });
  }

  protected unidad(p: Product): string {
    return p.unitOfMeasure === 'KILO' ? 'kg' : 'pz';
  }

  /** Qué se vendió, para verlo de un vistazo en la lista sin abrir nada. */
  protected productosVendidos(venta: Sale): string {
    return venta.details.map((d) => d.productName).join(', ');
  }

  /** El estado de pago en palabras del mostrador, no el enum del servidor. */
  protected estadoPago(v: Sale): string {
    switch (v.paymentStatus) {
      case 'PAGADO':
        return 'pagada';
      case 'PARCIAL':
        return 'abonada en parte';
      default:
        return 'sin pagar';
    }
  }

  protected pesos(monto: number): string {
    return monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}
