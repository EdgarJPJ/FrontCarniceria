import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { mensajeDeError } from '../../core/http/api-error';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { SidePanel } from '../../shared/side-panel/side-panel';
import { Product, ProductsService } from './products.service';

@Component({
  selector: 'app-products-page',
  imports: [ReactiveFormsModule, SidePanel, ConfirmDialog],
  templateUrl: './products.page.html',
  styleUrl: './products.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsPage {
  private readonly fb = inject(FormBuilder);
  private readonly productos = inject(ProductsService);
  protected readonly auth = inject(AuthService);

  protected readonly lista = signal<Product[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly editando = signal<Product | 'nuevo' | null>(null);
  protected readonly busqueda = signal('');
  /** Producto a punto de quitarse, en espera de que confirmen. */
  protected readonly borrando = signal<Product | null>(null);

  protected readonly activos = computed(() => this.lista().filter((p) => p.active).length);

  protected readonly visibles = computed(() => {
    const t = this.busqueda().trim().toLowerCase();
    if (!t) return this.lista();
    return this.lista().filter((p) => p.name.toLowerCase().includes(t));
  });

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    unitMeasure: ['kilo', Validators.required],
    salePrice: [0, [Validators.required, Validators.min(0.01)]],
    /**
     * Si el corte sale de una canal que se despieza aquí. Por defecto no: la
     * mayoría de la mercancía llega ya despiezada de fuera, y solo los cortes
     * que de verdad salen de una canal conviene ligarlos a un lote.
     */
    sourcedFromBatch: [false],
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.productos.listar().subscribe({
      next: (ps) => {
        this.lista.set(ps);
        this.cargando.set(false);
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  protected abrirAlta(): void {
    this.form.reset({ name: '', unitMeasure: 'kilo', salePrice: 0, sourcedFromBatch: false });
    this.editando.set('nuevo');
  }

  protected abrirEdicion(p: Product): void {
    this.form.reset({
      name: p.name,
      unitMeasure: p.unitOfMeasure.toLowerCase(),
      salePrice: p.salePrice,
      sourcedFromBatch: p.sourcedFromBatch,
    });
    this.editando.set(p);
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

    const datos = this.form.getRawValue();
    const peticion =
      enCurso === 'nuevo'
        ? this.productos.registrar(datos)
        : this.productos.actualizar(enCurso.id, datos);

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

  /**
   * El backend borra de verdad, y la fila se va con sus ventas colgando. Por
   * eso se avisa antes: no hay forma de deshacerlo.
   */
  protected eliminar(p: Product): void {
    this.borrando.set(p);
  }

  protected confirmarEliminar(): void {
    const p = this.borrando();
    if (!p) return;

    this.borrando.set(null);
    this.error.set(null);
    this.productos.eliminar(p.id).subscribe({
      next: () => this.cargar(),
      error: (e: unknown) => this.error.set(mensajeDeError(e)),
    });
  }

  protected unidad(p: Product): string {
    return p.unitOfMeasure === 'KILO' ? 'por kilo' : 'por pieza';
  }

  protected pesos(monto: number): string {
    return monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}
