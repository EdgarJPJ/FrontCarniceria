import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { mensajeDeError } from '../../../core/http/api-error';
import { AccesoLayout } from '../acceso-layout/acceso-layout';

@Component({
  selector: 'app-registro-page',
  imports: [ReactiveFormsModule, RouterLink, AccesoLayout],
  templateUrl: './registro.page.html',
  styleUrl: './registro.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly verContrasena = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    empresa: this.fb.nonNullable.group({
      nombre: ['', [Validators.required, Validators.maxLength(150)]],
      rfc: ['', Validators.maxLength(20)],
      telefono: ['', Validators.maxLength(20)],
    }),
    sucursal: this.fb.nonNullable.group({
      nombre: ['', [Validators.required, Validators.maxLength(100)]],
      direccion: ['', [Validators.required, Validators.maxLength(255)]],
      telefono: ['', Validators.maxLength(20)],
    }),
    cuenta: this.fb.nonNullable.group({
      nombre: ['', [Validators.required, Validators.maxLength(150)]],
      usuario: [
        '',
        [Validators.required, Validators.minLength(3), Validators.maxLength(50)],
      ],
      // BCrypt solo lee los primeros 72 bytes; el backend valida lo mismo.
      password: [
        '',
        [Validators.required, Validators.minLength(8), Validators.maxLength(72)],
      ],
      telefono: ['', Validators.maxLength(20)],
    }),
  });

  protected get empresa(): FormGroup {
    return this.form.controls.empresa;
  }

  protected get sucursal(): FormGroup {
    return this.form.controls.sucursal;
  }

  protected get cuenta(): FormGroup {
    return this.form.controls.cuenta;
  }

  /**
   * Devuelve el control para consultarlo desde la plantilla. Los tres grupos
   * tienen formas distintas, así que se accede por `FormGroup` genérico en vez
   * de por la unión de sus tipos.
   */
  protected campo(grupo: 'empresa' | 'sucursal' | 'cuenta', nombre: string): AbstractControl {
    return (this.form.controls[grupo] as FormGroup).get(nombre)!;
  }

  protected alternarContrasena(): void {
    this.verContrasena.update((visible) => !visible);
  }

  protected crear(): void {
    if (this.enviando()) return;

    this.errorServidor.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.enfocarPrimerError();
      return;
    }

    this.enviando.set(true);
    this.form.disable({ emitEvent: false });

    this.auth.registrar(this.form.getRawValue()).subscribe({
      // El backend devuelve el JWT del alta, así que se entra directo.
      next: () => this.router.navigateByUrl('/mostrador'),
      error: (error: unknown) => {
        this.enviando.set(false);
        this.form.enable({ emitEvent: false });
        this.errorServidor.set(mensajeDeError(error));
      },
    });
  }

  /**
   * Con tres bloques, decir "revisa el formulario" no basta: hay que llevar a
   * la persona al primer campo que falta. Se espera al siguiente render porque
   * `aria-invalid` lo pinta la plantilla al marcar los controles como tocados;
   * si se buscara de inmediato, todavía no estaría en el DOM.
   */
  private enfocarPrimerError(): void {
    afterNextRender(
      () => {
        const invalido = document.querySelector<HTMLElement>('[aria-invalid="true"]');
        invalido?.focus();
        invalido?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      },
      { injector: this.injector },
    );
  }
}
