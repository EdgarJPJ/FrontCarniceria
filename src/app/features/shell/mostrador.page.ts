import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';

/**
 * Portada del turno. Por ahora confirma con quién y dónde se abrió, y entrega
 * el código que el administrador necesita repartir para que su personal pueda
 * entrar. El corte del día irá aquí cuando exista el módulo de ventas.
 */
@Component({
  selector: 'app-mostrador-page',
  template: `
    <p class="gremio">Turno abierto</p>
    <h1 class="titulo">Hola, {{ perfil()?.nombre ?? auth.username() }}</h1>

    @if (auth.esGestion()) {
      <section class="codigo">
        <p class="codigo__rotulo">Código para entrar</p>
        <p class="codigo__valor">{{ perfil()?.empresaSlug ?? auth.session()?.companySlug }}</p>
        <p class="codigo__nota">
          Tu personal lo necesita junto con su clave para iniciar turno.
        </p>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: clamp(24px, 3.5vw, 44px);
    }
    .gremio {
      font-family: var(--dato);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--sangre);
    }
    .titulo {
      margin-top: 8px;
      font-family: var(--rotulo);
      font-size: clamp(30px, 4vw, 42px);
      font-weight: 800;
      letter-spacing: -0.025em;
      color: var(--acero);
    }
    .codigo {
      max-width: 420px;
      margin-top: 32px;
      padding: 20px 22px;
      background: var(--azulejo);
      border-left: 3px solid var(--sangre);
      border-radius: 0 var(--canto) var(--canto) 0;
    }
    .codigo__rotulo {
      font-family: var(--dato);
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--acero-medio);
    }
    .codigo__valor {
      margin-top: 6px;
      font-family: var(--dato);
      font-size: 19px;
      font-weight: 500;
      letter-spacing: 0.04em;
      color: var(--sangre);
    }
    .codigo__nota {
      margin-top: 8px;
      font-size: 13px;
      line-height: 1.5;
      color: var(--acero-tenue);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MostradorPage {
  protected readonly auth = inject(AuthService);

  protected readonly perfil = toSignal(
    this.auth.perfil().pipe(catchError(() => of(null))),
    { initialValue: null },
  );
}
