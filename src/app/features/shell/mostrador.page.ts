import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';

/**
 * Marcador de posición: confirma que el turno abrió. Aquí va el mostrador
 * cuando se construya.
 *
 * Los nombres de empresa y sucursal salen de `GET /api/auth/perfil`, no del
 * JWT: el token solo carga ids, y un id de sucursal no le dice nada a quien
 * está atendiendo. Si esa llamada falla, se muestra lo que sí trae el token
 * para no dejar la pantalla vacía.
 */
@Component({
  selector: 'app-mostrador-page',
  template: `
    <main class="sala">
      <p class="sala__gremio">Turno abierto</p>
      <h1 class="sala__titulo">Hola, {{ perfil()?.nombre ?? auth.username() }}</h1>

      <dl class="sala__datos">
        <div>
          <dt>Carnicería</dt>
          <dd>{{ perfil()?.empresaNombre ?? auth.session()?.companySlug }}</dd>
        </div>
        <div>
          <dt>Sucursal</dt>
          <dd>{{ perfil()?.sucursalNombre ?? 'Sucursal ' + auth.session()?.branchId }}</dd>
        </div>
        <div>
          <dt>Rol</dt>
          <dd>{{ perfil()?.rol ?? rolDelToken() }}</dd>
        </div>
        <div>
          <dt>Código para entrar</dt>
          <dd class="sala__codigo">{{ perfil()?.empresaSlug ?? auth.session()?.companySlug }}</dd>
        </div>
      </dl>

      <!-- Sin este dato, el resto del personal no puede iniciar sesión. -->
      <p class="sala__apunte">
        Pásale este código a tu personal: lo necesitan junto con su clave para entrar.
      </p>

      <button class="sala__salir" type="button" (click)="salir()">Cerrar turno</button>
    </main>
  `,
  styles: `
    .sala {
      max-width: 560px;
      margin: 0 auto;
      padding: clamp(48px, 10vh, 96px) 24px;
    }
    .sala__gremio {
      font-family: var(--dato);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--sangre);
    }
    .sala__titulo {
      margin-top: 8px;
      font-family: var(--rotulo);
      font-size: 40px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .sala__datos {
      margin: 32px 0 0;
      border-top: 1px solid var(--junta);
    }
    .sala__datos > div {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 13px 0;
      border-bottom: 1px solid var(--junta);
    }
    dt {
      font-family: var(--dato);
      font-size: 11.5px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--acero-medio);
    }
    dd {
      margin: 0;
      font-size: 15px;
      text-align: right;
      color: var(--acero);
    }
    .sala__codigo {
      font-family: var(--dato);
      font-size: 14px;
      letter-spacing: 0.04em;
      color: var(--sangre);
    }
    .sala__apunte {
      margin-top: 14px;
      font-size: 13px;
      line-height: 1.5;
      color: var(--acero-tenue);
    }
    .sala__salir {
      height: var(--toque);
      margin-top: 32px;
      padding: 0 22px;
      font-family: var(--rotulo);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--acero);
      background: none;
      border: 1px solid var(--acero);
      border-radius: var(--canto);
      cursor: pointer;
    }
    .sala__salir:hover {
      color: var(--hueso);
      background: var(--acero);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MostradorPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly perfil = toSignal(
    this.auth.perfil().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  /** Del token solo llega "ROLE_ADMINISTRADOR"; se muestra legible. */
  protected rolDelToken(): string {
    const rol = this.auth.session()?.roles[0];
    return rol ? rol.replace(/^ROLE_/, '').toLowerCase() : '—';
  }

  protected salir(): void {
    this.auth.logout();
    this.router.navigateByUrl('/entrar');
  }
}
