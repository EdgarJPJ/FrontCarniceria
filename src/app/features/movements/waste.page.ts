import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Perfil } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeDeError } from '../../core/http/api-error';
import { Product, ProductsService } from '../products/products.service';
import { MovementsService, Waste } from './movements.service';

/** Motivos frecuentes, para no obligar a teclear lo mismo cada vez. */
const MOTIVOS = ['Caducado', 'Descompuesto', 'Golpeado', 'Derrame', 'Robo', 'Otro'];

@Component({
  selector: 'app-waste-page',
  imports: [FormsModule, DatePipe],
  templateUrl: './waste.page.html',
  styleUrl: './waste.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WastePage {
  private readonly movimientos = inject(MovementsService);
  private readonly productos = inject(ProductsService);
  protected readonly auth = inject(AuthService);

  protected readonly motivos = MOTIVOS;

  protected readonly lista = signal<Waste[]>([]);
  protected readonly catalogo = signal<Product[]>([]);
  protected readonly perfil = signal<Perfil | null>(null);

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly panelAbierto = signal(false);

  protected readonly productoElegido = signal<number | null>(null);
  protected readonly cantidad = signal<number | null>(null);
  protected readonly motivo = signal<string>(MOTIVOS[0]);
  protected readonly nota = signal('');

  /** Cuánto se perdió este mes: es la cifra que duele y la que hay que vigilar. */
  protected readonly perdidoEsteMes = computed(() => {
    const ahora = new Date();
    return this.lista()
      .filter((m) => {
        const f = new Date(m.date);
        return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
      })
      .reduce((s, m) => s + m.quantity, 0);
  });

  constructor() {
    this.auth.perfil().subscribe({ next: (p) => this.perfil.set(p) });
    this.productos.listar().subscribe({ next: (ps) => this.catalogo.set(ps.filter((p) => p.active)) });
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.movimientos.mermas().subscribe({
      next: (ms) => {
        this.lista.set(ms);
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
    this.motivo.set(MOTIVOS[0]);
    this.nota.set('');
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
    if (!p || !producto || !cant || cant <= 0 || this.guardando()) return;

    this.guardando.set(true);
    this.error.set(null);

    this.movimientos
      .registrarMerma({
        productId: Number(producto),
        branchId: p.sucursalId,
        employeeId: p.empleadoId,
        batchId: null,
        quantity: cant,
        reason: this.motivo(),
        note: this.nota(),
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
