import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { Perfil } from '../../core/auth/auth.models';
import { mensajeDeError } from '../../core/http/api-error';
import { Branch } from '../branches/branch.models';
import { BranchesService } from '../branches/branches.service';
import { Client } from '../clients/client.models';
import { ClientsService } from '../clients/clients.service';
import { CreditService } from '../credit/credit.service';
import { InventoryService } from '../inventory/inventory.service';
import { Product, ProductsService } from '../products/products.service';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { SidePanel } from '../../shared/side-panel/side-panel';
import { Payment, PaymentMethod, Sale } from './sale.models';
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
  private readonly inventario = inject(InventoryService);
  private readonly sucursales = inject(BranchesService);
  private readonly clientes = inject(ClientsService);
  private readonly credito = inject(CreditService);
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly lista = signal<Sale[]>([]);
  protected readonly catalogo = signal<Product[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  /** Solo la usa el propietario: administrador y vendedor ya están fijos a la suya. */
  protected readonly sucursalElegida = signal<number | null>(null);
  protected readonly clientesActivos = signal<Client[]>([]);

  /** Cuánto hay de cada producto en la sucursal donde se está vendiendo. */
  protected readonly existencias = signal<Map<number, number>>(new Map());

  /** Ofrecer un corte que no tiene nada en el mostrador solo lleva a un error después. */
  protected readonly productosConStock = computed(() =>
    this.catalogo().filter((p) => (this.existencias().get(p.id) ?? 0) > 0),
  );
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
  /** Sus abonos, si los tiene: null mientras se cargan, [] si no hubo ninguno. */
  protected readonly abonosDeVenta = signal<Payment[] | null>(null);

  /**
   * Cobrar un abono sin salir del detalle de la venta: es lo único que un
   * vendedor puede ver de lo que debe un cliente (`/fiado` es de gestión
   * porque lista los saldos de todos), así que aquí es donde tiene que poder
   * abonarle a la venta puntual que ya tiene enfrente.
   */
  protected readonly abonandoDetalle = signal(false);
  protected readonly montoAbono = signal<number | null>(null);
  protected readonly metodoAbono = signal<number | null>(null);
  protected readonly guardandoAbono = signal(false);
  protected readonly avisoAbono = signal<string | null>(null);

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
    this.sucursales.listar(true).subscribe({ next: (bs) => this.branches.set(bs) });
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
    this.ventas.listar(this.sucursalElegida() ?? undefined).subscribe({
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

  protected cambiarSucursal(valor: string): void {
    this.sucursalElegida.set(valor ? Number(valor) : null);
    this.cargar();
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
    this.cargarExistencias();
  }

  /**
   * Se pide de nuevo cada vez que se abre la caja: el stock cambia a lo
   * largo del turno, y el propietario puede haber cambiado de sucursal
   * activa desde la última venta.
   */
  private cargarExistencias(): void {
    const sucursal = this.auth.sucursalOperativa();
    this.inventario.listar(sucursal ?? undefined, true).subscribe({
      next: (lineas) => this.existencias.set(new Map(lineas.map((l) => [l.productId, l.stock]))),
      error: () => this.existencias.set(new Map()),
    });
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

    // No dejar armar un ticket que el backend va a rechazar hasta el último
    // paso: se avisa aquí, con lo que ya lleva de ese corte sumado.
    const yaEnTicket = this.partidas().find((p) => p.product.id === product.id)?.quantity ?? 0;
    if (yaEnTicket + cant > this.stockDisponible(product.id)) {
      this.avisoPaso.set(`Solo hay ${this.existencia(product)} de ${product.name} en el mostrador.`);
      return;
    }

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
    const producto = this.partidas().find((p) => p.product.id === productId)?.product;
    if (producto && cantidad > this.stockDisponible(productId)) {
      this.avisoPaso.set(`Solo hay ${this.existencia(producto)} de ${producto.name} en el mostrador.`);
      return;
    }
    this.partidas.update((ps) =>
      ps.map((p) => (p.product.id === productId ? { ...p, quantity: cantidad } : p)),
    );
  }

  /**
   * A veces es más fácil decir "deme $200 de bistec" que calcular a mano
   * cuántos kilos son: se captura el importe y la cantidad sale del precio
   * fijo del producto, redondeada como se pesa o se cuenta cada quien.
   */
  protected cambiarImporte(productId: number, importe: number): void {
    if (!importe || importe <= 0) return;
    const partida = this.partidas().find((p) => p.product.id === productId);
    if (!partida || partida.product.salePrice <= 0) return;

    const cruda = importe / partida.product.salePrice;
    const cantidad =
      partida.product.unitOfMeasure === 'PIEZA' ? Math.round(cruda) : Math.round(cruda * 1000) / 1000;
    if (cantidad <= 0) return;
    if (cantidad > this.stockDisponible(productId)) {
      this.avisoPaso.set(
        `Solo hay ${this.existencia(partida.product)} de ${partida.product.name} en el mostrador.`,
      );
      return;
    }

    this.partidas.update((ps) =>
      ps.map((p) => (p.product.id === productId ? { ...p, quantity: cantidad } : p)),
    );
  }

  protected cobrar(): void {
    const p = this.perfil();
    const sucursal = this.auth.sucursalOperativa();
    if (this.partidas().length === 0 || this.cobrando()) return;

    /*
     * Sin sucursal no hay dónde registrar la venta: es el caso del soporte,
     * que no pertenece a ninguna carnicería, o del propietario que todavía
     * no eligió en cuál de las suyas está operando.
     */
    if (!p || !sucursal) {
      this.error.set('No hay una sucursal elegida, así que no hay dónde registrar la venta.');
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
        branchId: sucursal,
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
    this.cancelarAbonoDetalle();
    // Una venta de contado (sin cliente) nunca tiene abonos que pedir.
    if (venta.clientId === null) {
      this.abonosDeVenta.set([]);
      return;
    }
    this.abonosDeVenta.set(null);
    this.ventas.abonos(venta.id).subscribe({
      next: (as) => this.abonosDeVenta.set(as),
      error: () => this.abonosDeVenta.set([]),
    });
  }

  protected cerrarDetalle(): void {
    this.viendoDetalle.set(null);
    this.abonosDeVenta.set(null);
    this.cancelarAbonoDetalle();
  }

  protected abrirAbonoDetalle(): void {
    this.abonandoDetalle.set(true);
    this.montoAbono.set(null);
    this.metodoAbono.set(null);
    this.avisoAbono.set(null);
  }

  protected cancelarAbonoDetalle(): void {
    this.abonandoDetalle.set(false);
    this.montoAbono.set(null);
    this.metodoAbono.set(null);
    this.avisoAbono.set(null);
  }

  /**
   * Igual que `registrarAbono` en `/fiado`, pero sobre la venta que ya se
   * está viendo: no hace falta volver a elegir cliente ni venta.
   */
  protected registrarAbonoDetalle(): void {
    const venta = this.viendoDetalle();
    const cantidad = this.montoAbono();
    if (!venta || this.guardandoAbono()) return;

    if (!cantidad || cantidad <= 0) {
      this.avisoAbono.set('Escribe cuánto está entregando el cliente.');
      return;
    }

    this.avisoAbono.set(null);
    this.guardandoAbono.set(true);

    this.ventas
      .abonar({
        saleId: venta.id,
        paymentMethodId: this.metodoAbono() ? Number(this.metodoAbono()) : null,
        amount: cantidad,
        note: '',
      })
      .subscribe({
        next: (abono) => {
          this.guardandoAbono.set(false);
          this.cancelarAbonoDetalle();
          this.abonosDeVenta.update((as) => [...(as ?? []), abono]);
          // El estado de pago de la venta cambió: se refleja aquí y en la lista de atrás.
          const resta = abono.remainingBalance ?? 0;
          this.viendoDetalle.update((v) =>
            v ? { ...v, paymentStatus: resta > 0 ? 'PARCIAL' : 'PAGADO' } : v,
          );
          this.cargar();
        },
        error: (e: unknown) => {
          this.guardandoAbono.set(false);
          this.avisoAbono.set(mensajeDeError(e));
        },
      });
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

  /**
   * Cancelar solo devuelve el inventario y anula lo que se deba: un abono ya
   * cobrado se queda en el historial de la venta, sin devolverse solo. Quien
   * cancela tiene que saberlo antes de hacerlo, no descubrirlo después.
   */
  protected mensajeCancelar(v: Sale): string {
    const base = `¿Cancelar la venta #${v.id} de ${this.pesos(v.total)}? Esto devuelve el inventario y no se puede deshacer.`;
    if (v.paymentStatus === 'PAGADO') {
      return `${base} Ya se cobraron ${this.pesos(v.total)} de esta venta: asegúrate de devolvérselos al cliente.`;
    }
    if (v.paymentStatus === 'PARCIAL') {
      return `${base} Esta venta ya tiene abonos registrados: asegúrate de devolverle ese dinero al cliente.`;
    }
    return base;
  }

  protected unidad(p: Product): string {
    return p.unitOfMeasure === 'KILO' ? 'kg' : 'pz';
  }

  /** Lo que queda en el mostrador de este producto, como se pesa o se cuenta. */
  protected existencia(p: Product): string {
    const stock = this.existencias().get(p.id) ?? 0;
    const valor = p.unitOfMeasure === 'KILO' ? stock.toFixed(3) : String(Math.round(stock));
    return `${valor} ${this.unidad(p)}`;
  }

  /** Cuánto queda de un producto en la sucursal donde se está vendiendo. */
  private stockDisponible(productId: number): number {
    return this.existencias().get(productId) ?? 0;
  }

  /** Qué se vendió, para verlo de un vistazo en la lista sin abrir nada. */
  protected productosVendidos(venta: Sale): string {
    return venta.details.map((d) => d.productName).join(', ');
  }

  /** El estado de pago en palabras del mostrador, no el enum del servidor. */
  protected estadoPago(v: Sale): string {
    if (v.status === 'CANCELADA') return 'cancelada';
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

  /** A dos decimales, para que el input de importe no arrastre ruido de punto flotante. */
  protected redondeado(monto: number): number {
    return Math.round(monto * 100) / 100;
  }
}
