import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { mensajeDeError } from '../../core/http/api-error';
import { BranchesService } from '../branches/branches.service';
import { Branch } from '../branches/branch.models';
import { InventoryLine, InventoryService } from './inventory.service';

/** Debajo de esto se avisa: hay que reponer antes de que se acabe. */
const UMBRAL_BAJO = 5;

@Component({
  selector: 'app-inventory-page',
  imports: [DatePipe],
  templateUrl: './inventory.page.html',
  styleUrl: './inventory.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryPage {
  private readonly inventario = inject(InventoryService);
  private readonly sucursales = inject(BranchesService);

  protected readonly lineas = signal<InventoryLine[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly sucursalElegida = signal<number | null>(null);
  protected readonly busqueda = signal('');

  protected readonly visibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    if (!texto) return this.lineas();
    return this.lineas().filter(
      (l) =>
        l.productName.toLowerCase().includes(texto) ||
        (l.cutType ?? '').toLowerCase().includes(texto),
    );
  });

  /** Lo que hay que reponer: agotado o por agotarse. */
  protected readonly porReponer = computed(
    () => this.lineas().filter((l) => l.stock <= UMBRAL_BAJO).length,
  );

  constructor() {
    this.sucursales.listar(true).subscribe({
      next: (bs) => this.branches.set(bs),
      error: () => this.branches.set([]),
    });
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.inventario.listar(this.sucursalElegida() ?? undefined).subscribe({
      next: (ls) => {
        this.lineas.set(ls);
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

  protected agotado(linea: InventoryLine): boolean {
    return linea.stock <= 0;
  }

  protected bajo(linea: InventoryLine): boolean {
    return linea.stock > 0 && linea.stock <= UMBRAL_BAJO;
  }

  protected cantidad(linea: InventoryLine): string {
    // El kilo se pesa con decimales; la pieza se cuenta entera.
    const unidad = linea.unitOfMeasure === 'KILO' ? 'kg' : 'pz';
    const valor =
      linea.unitOfMeasure === 'KILO' ? linea.stock.toFixed(3) : String(Math.round(linea.stock));
    return `${valor} ${unidad}`;
  }

  protected pesos(monto: number): string {
    return monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}
