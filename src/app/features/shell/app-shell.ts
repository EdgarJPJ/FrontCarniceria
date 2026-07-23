import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';

interface Seccion {
  ruta: string;
  etiqueta: string;
  /** Si es true, solo la ve quien administra. */
  soloGestion?: boolean;
}

/**
 * Armazón de la aplicación con turno abierto: riel de acero a la izquierda y
 * la superficie de trabajo a la derecha.
 *
 * Las secciones se filtran por rol, pero eso es solo para no ofrecer lo que no
 * se puede hacer: quien decide de verdad es el backend.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Lo que usa el carnicero, dentro de su propia carnicería. */
  private readonly delNegocio: Seccion[] = [
    { ruta: '/mostrador', etiqueta: 'Mostrador' },
    { ruta: '/ventas', etiqueta: 'Ventas' },
    // El fiado va junto a las ventas: es la venta que todavía no se cobra.
    { ruta: '/fiado', etiqueta: 'Fiado', soloGestion: true },
    { ruta: '/inventario', etiqueta: 'Inventario' },
    { ruta: '/entradas', etiqueta: 'Entradas' },
    { ruta: '/mermas', etiqueta: 'Mermas' },
    { ruta: '/productos', etiqueta: 'Productos' },
    { ruta: '/clientes', etiqueta: 'Clientes' },
    { ruta: '/lotes', etiqueta: 'Lotes', soloGestion: true },
    { ruta: '/sucursales', etiqueta: 'Sucursales' },
    { ruta: '/personal', etiqueta: 'Personal', soloGestion: true },
    { ruta: '/empresa', etiqueta: 'Mi carnicería', soloGestion: true },
  ];

  /** Lo que usa el soporte del sistema, que no tiene carnicería. */
  private readonly deSoporte: Seccion[] = [{ ruta: '/soporte', etiqueta: 'Carnicerías' }];

  protected readonly perfil = toSignal(
    this.auth.perfil().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  /**
   * El soporte no atiende un mostrador: mezclarle inventario y ventas de una
   * carnicería a la que no pertenece solo confundiría.
   */
  protected readonly visibles = computed(() =>
    this.auth.esSoporte()
      ? this.deSoporte
      : this.delNegocio.filter((s) => !s.soloGestion || this.auth.esGestion()),
  );

  /** En soporte, el encabezado dice qué es el sistema, no de quién es. */
  protected readonly rotulo = computed(() =>
    this.auth.esSoporte() ? 'Soporte del sistema' : (this.perfil()?.empresaNombre ?? 'Carnicería'),
  );

  protected readonly subrotulo = computed(() =>
    this.auth.esSoporte() ? 'Todas las carnicerías' : (this.perfil()?.sucursalNombre ?? ''),
  );

  protected salir(): void {
    this.auth.logout();
    this.router.navigateByUrl('/entrar');
  }
}
