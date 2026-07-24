import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { esEmpresaRequerida, mensajeDeError } from '../../../core/http/api-error';
import { AccesoLayout } from '../acceso-layout/acceso-layout';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, AccesoLayout],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly verContrasena = signal(false);

  /*
   * La carnicería casi nunca hace falta: el backend busca la clave entre
   * todas. Este campo arranca oculto y solo aparece si el backend responde
   * que esa clave y contraseña coinciden en más de una carnicería.
   */
  protected readonly pedirEmpresa = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    empresa: [''],
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  constructor() {
    afterNextRender(() => {
      document.getElementById('username')?.focus();
    });
  }

  protected get empresa() {
    return this.form.controls.empresa;
  }

  protected get username() {
    return this.form.controls.username;
  }

  protected get password() {
    return this.form.controls.password;
  }

  protected alternarContrasena(): void {
    this.verContrasena.update((visible) => !visible);
  }

  protected entrar(): void {
    if (this.enviando()) return;

    this.errorServidor.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.form.disable({ emitEvent: false });

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        const volverA = this.route.snapshot.queryParamMap.get('volverA');
        // El soporte arranca en su lista de carnicerías, no en un mostrador.
        this.router.navigateByUrl(volverA ?? (this.auth.esSoporte() ? '/soporte' : '/mostrador'));
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.form.enable({ emitEvent: false });
        this.errorServidor.set(mensajeDeError(error));

        // La clave y la contraseña ya eran correctas: lo que falta es decir
        // de cuál carnicería, no volver a teclear una contraseña que ya
        // quedó comprobada.
        if (esEmpresaRequerida(error)) {
          this.pedirEmpresa.set(true);
          this.empresa.addValidators(Validators.required);
          this.empresa.updateValueAndValidity();
          this.empresa.setValue(this.auth.empresaRecordada());
          queueMicrotask(() => document.getElementById('empresa')?.focus());
        } else {
          this.password.reset('');
          document.getElementById('password')?.focus();
        }
      },
    });
  }
}
