import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { mensajeDeError } from '../../core/http/api-error';
import { Branch } from '../branches/branch.models';
import { BranchesService } from '../branches/branches.service';
import { SidePanel } from '../../shared/side-panel/side-panel';
import { Employee, Role } from './employee.models';
import { EmployeesService } from './employees.service';

@Component({
  selector: 'app-employees-page',
  imports: [ReactiveFormsModule, SidePanel],
  templateUrl: './employees.page.html',
  styleUrl: './employees.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeesPage {
  private readonly fb = inject(FormBuilder);
  private readonly empleados = inject(EmployeesService);
  private readonly sucursales = inject(BranchesService);
  protected readonly auth = inject(AuthService);

  protected readonly lista = signal<Employee[]>([]);
  protected readonly roles = signal<Role[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly verContrasena = signal(false);

  protected readonly editando = signal<Employee | 'nuevo' | null>(null);
  /** Panel aparte: reemplazar la contraseña de alguien. */
  protected readonly reseteando = signal<Employee | null>(null);

  protected readonly activos = computed(() => this.lista().filter((e) => e.active).length);

  /**
   * Un administrador ya no puede dar de alta ni mover a nadie fuera de su
   * sucursal —el backend lo rechaza—, así que ni se le ofrece elegir otra.
   * Solo el propietario ve la lista completa.
   */
  protected readonly sucursalesElegibles = computed(() =>
    this.auth.esPropietario()
      ? this.branches()
      : this.branches().filter((b) => b.id === this.auth.sucursalOperativa()),
  );

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    phone: [''],
    idRole: [0, [Validators.required, Validators.min(1)]],
    idBranch: [0, [Validators.required, Validators.min(1)]],
  });

  protected readonly formPassword = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
  });

  constructor() {
    this.empleados.roles().subscribe({ next: (rs) => this.roles.set(rs) });
    this.sucursales.listar(true).subscribe({ next: (bs) => this.branches.set(bs) });
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.empleados.listar().subscribe({
      next: (es) => {
        this.lista.set(es);
        this.cargando.set(false);
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  protected abrirAlta(): void {
    this.form.reset({
      name: '', username: '', password: '', phone: '',
      idRole: this.roles()[0]?.id ?? 0,
      idBranch: this.auth.sucursalOperativa() ?? this.sucursalesElegibles()[0]?.id ?? 0,
    });
    // La clave y la contraseña solo se piden al dar de alta.
    this.form.controls.username.enable();
    this.form.controls.password.enable();
    this.form.controls.idRole.enable();
    this.editando.set('nuevo');
  }

  protected abrirEdicion(empleado: Employee): void {
    this.form.reset({
      name: empleado.name,
      username: empleado.username,
      password: 'sin-cambios',
      phone: empleado.phone ?? '',
      idRole: empleado.roleId,
      idBranch: empleado.branchId,
    });
    // La clave identifica al empleado y la contraseña tiene su propio panel.
    this.form.controls.username.disable();
    this.form.controls.password.disable();
    // Si se quita el rol a sí mismo y no queda otro administrador, nadie
    // podría volver a dar de alta ni gestionar nada: se cambia desde otra
    // cuenta con el mismo rol, no desde la propia.
    if (this.esUnoMismo(empleado)) {
      this.form.controls.idRole.disable();
    } else {
      this.form.controls.idRole.enable();
    }
    this.editando.set(empleado);
  }

  protected cerrarPanel(): void {
    this.editando.set(null);
    this.reseteando.set(null);
    this.error.set(null);
    this.verContrasena.set(false);
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

    const v = this.form.getRawValue();
    const peticion =
      enCurso === 'nuevo'
        ? this.empleados.registrar({
            name: v.name, username: v.username, password: v.password,
            phone: v.phone, idRole: Number(v.idRole), idBranch: Number(v.idBranch),
          })
        : this.empleados.actualizar(enCurso.id, {
            name: v.name, phone: v.phone,
            idRole: Number(v.idRole), idBranch: Number(v.idBranch),
          });

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

  protected abrirReseteo(empleado: Employee): void {
    this.formPassword.reset({ password: '' });
    this.reseteando.set(empleado);
  }

  protected guardarPassword(): void {
    const quien = this.reseteando();
    if (!quien || this.formPassword.invalid || this.guardando()) {
      this.formPassword.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    this.empleados.cambiarPassword(quien.id, this.formPassword.getRawValue().password).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarPanel();
      },
      error: (e: unknown) => {
        this.guardando.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }

  protected alternarEstado(empleado: Employee): void {
    this.error.set(null);
    this.empleados.cambiarEstado(empleado.id, !empleado.active).subscribe({
      next: () => this.cargar(),
      error: (e: unknown) => this.error.set(mensajeDeError(e)),
    });
  }

  protected alternarVer(): void {
    this.verContrasena.update((v) => !v);
  }

  /** El propio turno abierto: no tiene caso ofrecerle darse de baja. */
  protected esUnoMismo(empleado: Employee): boolean {
    return empleado.username === this.auth.username();
  }
}
