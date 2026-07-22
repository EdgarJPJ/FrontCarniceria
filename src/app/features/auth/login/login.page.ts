import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { mensajeDeError } from '../../../core/http/api-error';
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

  protected readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

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
        this.router.navigateByUrl(volverA ?? '/mostrador');
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.form.enable({ emitEvent: false });
        this.errorServidor.set(mensajeDeError(error));
        this.password.reset('');
        document.getElementById('password')?.focus();
      },
    });
  }
}
