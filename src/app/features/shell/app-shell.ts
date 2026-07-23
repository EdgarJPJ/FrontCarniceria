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

  private readonly secciones: Seccion[] = [
    { ruta: '/mostrador', etiqueta: 'Mostrador' },
    { ruta: '/ventas', etiqueta: 'Ventas' },
    { ruta: '/inventario', etiqueta: 'Inventario' },
    { ruta: '/entradas', etiqueta: 'Entradas' },
    { ruta: '/mermas', etiqueta: 'Mermas' },
    { ruta: '/clientes', etiqueta: 'Clientes' },
    { ruta: '/sucursales', etiqueta: 'Sucursales' },
    { ruta: '/lotes', etiqueta: 'Lotes', soloGestion: true },
    { ruta: '/personal', etiqueta: 'Personal', soloGestion: true },
  ];

  protected readonly perfil = toSignal(
    this.auth.perfil().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  protected readonly visibles = computed(() =>
    this.secciones.filter((s) => !s.soloGestion || this.auth.esGestion()),
  );

  protected salir(): void {
    this.auth.logout();
    this.router.navigateByUrl('/entrar');
  }
}
