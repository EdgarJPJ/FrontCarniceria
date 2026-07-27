import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { mensajeDeError } from '../../core/http/api-error';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { SidePanel } from '../../shared/side-panel/side-panel';
import { CreditService } from '../credit/credit.service';
import { Client } from './client.models';
import { ClientsService } from './clients.service';

@Component({
  selector: 'app-clients-page',
  imports: [ReactiveFormsModule, SidePanel, ConfirmDialog],
  templateUrl: './clients.page.html',
  styleUrl: './clients.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsPage {
  private readonly fb = inject(FormBuilder);
  private readonly clientes = inject(ClientsService);
  private readonly credito = inject(CreditService);
  protected readonly auth = inject(AuthService);

  protected readonly lista = signal<Client[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);

  /** Cuánto debe cada cliente ahora mismo, por id. Ausente = no debe nada. */
  protected readonly saldosClientes = signal<Map<number, number>>(new Map());
  /** Cliente a punto de darse de baja debiendo, en espera de que confirmen. */
  protected readonly dandoDeBajaConSaldo = signal<Client | null>(null);

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
    this.credito.saldos().subscribe({
      next: (ss) => this.saldosClientes.set(new Map(ss.map((s) => [s.clientId, s.balance]))),
      error: () => this.saldosClientes.set(new Map()),
    });
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

  /**
   * Dar de baja no borra la deuda —sigue viva en Fiado—, pero nadie debería
   * hacerlo sin saber que ahí se queda. Reactivar no necesita este paso.
   */
  protected alternarEstado(cliente: Client): void {
    if (cliente.active && (this.saldosClientes().get(cliente.id) ?? 0) > 0) {
      this.dandoDeBajaConSaldo.set(cliente);
      return;
    }
    this.cambiarEstado(cliente);
  }

  protected confirmarBajaConSaldo(): void {
    const cliente = this.dandoDeBajaConSaldo();
    this.dandoDeBajaConSaldo.set(null);
    if (cliente) this.cambiarEstado(cliente);
  }

  private cambiarEstado(cliente: Client): void {
    this.clientes.cambiarEstado(cliente.id, !cliente.active).subscribe({
      next: () => this.cargar(),
      error: (e: unknown) => this.error.set(mensajeDeError(e)),
    });
  }

  protected pesos(monto: number): string {
    return monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}
