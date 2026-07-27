import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { mensajeDeError } from '../../core/http/api-error';
import { SidePanel } from '../../shared/side-panel/side-panel';
import { Branch } from './branch.models';
import { BranchesService } from './branches.service';

@Component({
  selector: 'app-branches-page',
  imports: [ReactiveFormsModule, SidePanel],
  templateUrl: './branches.page.html',
  styleUrl: './branches.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchesPage {
  private readonly fb = inject(FormBuilder);
  private readonly sucursales = inject(BranchesService);
  protected readonly auth = inject(AuthService);

  protected readonly lista = signal<Branch[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly editando = signal<Branch | 'nueva' | null>(null);

  protected readonly activas = computed(() => this.lista().filter((s) => s.active).length);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    address: ['', [Validators.required, Validators.maxLength(255)]],
    phone: ['', Validators.maxLength(20)],
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.sucursales.listar().subscribe({
      next: (bs) => {
        this.lista.set(bs);
        this.cargando.set(false);
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  protected abrirAlta(): void {
    this.form.reset({ name: '', address: '', phone: '' });
    this.editando.set('nueva');
    this.aviso.set(null);
  }

  protected abrirEdicion(sucursal: Branch): void {
    this.form.reset({
      name: sucursal.name,
      address: sucursal.address,
      phone: sucursal.phone ?? '',
    });
    this.editando.set(sucursal);
    this.aviso.set(null);
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
    // Si es la sucursal del turno actual, el riel no se entera solo: ya
    // sacó el nombre de auth.perfil(), que se cachea sin invalidarse.
    const esLaPropia = enCurso !== 'nueva' && enCurso.id === this.auth.session()?.branchId;
    const peticion =
      enCurso === 'nueva'
        ? this.sucursales.registrar(datos)
        : this.sucursales.actualizar(enCurso.id, datos);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarPanel();
        this.cargar();
        if (esLaPropia) {
          this.aviso.set('Guardado. El nombre en el riel se actualiza al volver a iniciar turno.');
        }
      },
      error: (e: unknown) => {
        this.guardando.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }

  /**
   * El backend rechaza dar de baja la última sucursal activa. El mensaje que
   * devuelve ya explica el motivo, así que se muestra tal cual.
   */
  protected alternarEstado(sucursal: Branch): void {
    this.error.set(null);
    this.sucursales.cambiarEstado(sucursal.id, !sucursal.active).subscribe({
      next: () => this.cargar(),
      error: (e: unknown) => this.error.set(mensajeDeError(e)),
    });
  }
}
