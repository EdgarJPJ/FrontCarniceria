import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { mensajeDeError } from '../../core/http/api-error';
import { SidePanel } from '../../shared/side-panel/side-panel';
import { Acceso, Carniceria, SupportService } from './support.service';

@Component({
  selector: 'app-support-page',
  imports: [FormsModule, SidePanel],
  templateUrl: './support.page.html',
  styleUrl: './support.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportPage {
  private readonly soporte = inject(SupportService);

  protected readonly lista = signal<Carniceria[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly busqueda = signal('');

  /** Carnicería cuyas cuentas se están viendo. */
  protected readonly atendiendo = signal<Carniceria | null>(null);
  protected readonly accesos = signal<Acceso[]>([]);
  protected readonly cargandoAccesos = signal(false);

  /** Cuenta a la que se le va a poner contraseña nueva. */
  protected readonly restableciendo = signal<Acceso | null>(null);
  protected readonly passwordNueva = signal('');
  protected readonly guardando = signal(false);

  protected readonly suspendidas = computed(
    () => this.lista().filter((c) => !c.suscripcionActiva).length,
  );

  protected readonly visibles = computed(() => {
    const t = this.busqueda().trim().toLowerCase();
    if (!t) return this.lista();
    return this.lista().filter(
      (c) => c.nombre.toLowerCase().includes(t) || c.slug.includes(t),
    );
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.soporte.carnicerias().subscribe({
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

  protected alternarSuscripcion(c: Carniceria): void {
    this.error.set(null);
    this.soporte.cambiarSuscripcion(c.id, !c.suscripcionActiva).subscribe({
      next: (actualizada) => {
        this.lista.update((cs) => cs.map((x) => (x.id === actualizada.id ? actualizada : x)));
        this.aviso.set(
          actualizada.suscripcionActiva
            ? `${actualizada.nombre} puede volver a entrar.`
            : `${actualizada.nombre} queda suspendida: su personal ya no puede entrar.`,
        );
      },
      error: (e: unknown) => this.error.set(mensajeDeError(e)),
    });
  }

  protected cambiarPlan(c: Carniceria, plan: string): void {
    if (plan === c.plan.toLowerCase()) return;
    this.error.set(null);
    this.soporte.cambiarPlan(c.id, plan).subscribe({
      next: (actualizada) => {
        this.lista.update((cs) => cs.map((x) => (x.id === actualizada.id ? actualizada : x)));
        this.aviso.set(`${actualizada.nombre} pasó al plan ${actualizada.plan.toLowerCase()}.`);
      },
      error: (e: unknown) => this.error.set(mensajeDeError(e)),
    });
  }

  protected verAccesos(c: Carniceria): void {
    this.atendiendo.set(c);
    this.accesos.set([]);
    this.cargandoAccesos.set(true);
    this.error.set(null);

    this.soporte.accesos(c.id).subscribe({
      next: (as) => {
        this.accesos.set(as);
        this.cargandoAccesos.set(false);
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.cargandoAccesos.set(false);
      },
    });
  }

  protected cerrarPanel(): void {
    this.atendiendo.set(null);
    this.restableciendo.set(null);
    this.passwordNueva.set('');
    this.aviso.set(null);
  }

  protected abrirRestablecer(a: Acceso): void {
    this.passwordNueva.set('');
    this.restableciendo.set(a);
  }

  protected guardarPassword(): void {
    const quien = this.restableciendo();
    const nueva = this.passwordNueva();
    if (!quien || nueva.length < 8 || this.guardando()) return;

    this.guardando.set(true);
    this.error.set(null);

    this.soporte.restablecerPassword(quien.id, nueva).subscribe({
      next: () => {
        this.guardando.set(false);
        this.restableciendo.set(null);
        // La contraseña se muestra una vez: es lo que hay que dictarle.
        this.aviso.set(
          `Listo. Dile a ${quien.nombre} que entre con la clave «${quien.usuario}» y la contraseña que acabas de poner.`,
        );
        this.passwordNueva.set('');
      },
      error: (e: unknown) => {
        this.guardando.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }
}
