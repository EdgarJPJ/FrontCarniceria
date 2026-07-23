import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, filter, of } from 'rxjs';

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
 *
 * En angosto el riel no cabe: un administrador ve hasta doce secciones, y
 * acostarlas en una fila que se desliza horizontal no avisa que hay más ni
 * dice dónde se quedó. Ahí el riel se vuelve un menú que se abre con un
 * botón — con el mismo trato de foco y Escape que un panel — y se cierra
 * solo al elegir una sección.
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
  private readonly destroyRef = inject(DestroyRef);

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

  @ViewChild('botonMenu') private botonMenu?: ElementRef<HTMLElement>;
  @ViewChild('riel') private riel?: ElementRef<HTMLElement>;

  protected readonly perfil = toSignal(
    this.auth.perfil().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  /** Solo importa en angosto: en escritorio el riel siempre está visible. */
  protected readonly menuAbierto = signal(false);

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

  constructor() {
    // Cambiar de sección cierra el menú solo: nadie debería tener que
    // cerrarlo a mano después de ya haber elegido a dónde ir.
    this.router.events
      .pipe(
        filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.menuAbierto.set(false));
  }

  protected abrirMenu(): void {
    this.menuAbierto.set(true);
    queueMicrotask(() => {
      this.riel?.nativeElement.querySelector<HTMLElement>('.riel__paso')?.focus();
    });
  }

  protected cerrarMenu(): void {
    const estabaAbierto = this.menuAbierto();
    this.menuAbierto.set(false);
    // Vuelve el foco al botón que lo abrió, en vez de perderlo en la página.
    if (estabaAbierto) {
      this.botonMenu?.nativeElement.focus();
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.menuAbierto()) {
      this.cerrarMenu();
    }
  }

  protected salir(): void {
    this.auth.logout();
    this.router.navigateByUrl('/entrar');
  }
}
