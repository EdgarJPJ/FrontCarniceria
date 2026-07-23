import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { mensajeDeError } from '../../core/http/api-error';
import { SidePanel } from '../../shared/side-panel/side-panel';
import { Client } from './client.models';
import { ClientsService } from './clients.service';

@Component({
  selector: 'app-clients-page',
  imports: [ReactiveFormsModule, SidePanel],
  templateUrl: './clients.page.html',
  styleUrl: './clients.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsPage {
  private readonly fb = inject(FormBuilder);
  private readonly clientes = inject(ClientsService);
  protected readonly auth = inject(AuthService);

  protected readonly lista = signal<Client[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);

  /** null = panel cerrado; un cliente = editando; 'nuevo' = alta. */
  protected readonly editando = signal<Client | 'nuevo' | null>(null);
  protected readonly busqueda = signal('');

  protected readonly visibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    if (!texto) return this.lista();
    return this.lista().filter((c) => c.name.toLowerCase().includes(texto));
  });

  protected readonly fiadoTotal = computed(() =>
    this.lista()
      .filter((c) => c.active)
      .reduce((suma, c) => suma + c.creditLimit, 0),
  );

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    phone: ['', Validators.maxLength(20)],
    address: ['', Validators.maxLength(255)],
    creditLimit: [0, [Validators.required, Validators.min(0)]],
    creditDays: [0, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.clientes.listar().subscribe({
      next: (cs) => {
        this.lista.set(cs);
        this.cargando.set(false);
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  protected abrirAlta(): void {
    this.form.reset({ name: '', phone: '', address: '', creditLimit: 0, creditDays: 0 });
    this.editando.set('nuevo');
  }

  protected abrirEdicion(cliente: Client): void {
    this.form.reset({
      name: cliente.name,
      phone: cliente.phone ?? '',
      address: cliente.address ?? '',
      creditLimit: cliente.creditLimit,
      creditDays: cliente.creditDays,
    });
    this.editando.set(cliente);
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
        ? this.clientes.registrar(datos)
        : this.clientes.actualizar(enCurso.id, datos);

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

  protected alternarEstado(cliente: Client): void {
    this.clientes.cambiarEstado(cliente.id, !cliente.active).subscribe({
      next: () => this.cargar(),
      error: (e: unknown) => this.error.set(mensajeDeError(e)),
    });
  }

  protected pesos(monto: number): string {
    return monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}
