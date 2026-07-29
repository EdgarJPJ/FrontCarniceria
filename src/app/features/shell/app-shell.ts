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
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, filter, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Branch } from '../branches/branch.models';
import { BranchesService } from '../branches/branches.service';
import { Icono } from '../../shared/icono/icono';

interface Seccion {
  ruta: string;
  etiqueta: string;
  icono: string;
  /** Si es true, solo la ve quien administra. */
  soloGestion?: boolean;
  /** Si es true, solo la ve el dueño de la empresa (no cada administrador). */
  soloPropietario?: boolean;
}

/**
 * Armazón de la aplicación con turno abierto: riel de acero a la izquierda y
 * la superficie de trabajo a la derecha.
 *
 * El riel está ordenado por con qué frecuencia se usa cada cosa, no por cómo
 * está partido el backend. Arriba, separadas del resto, las dos acciones que
 * se hacen varias veces al día —cobrar una venta y recibir un abono—, para
 * que estén a un clic desde cualquier pantalla y no solo desde la suya. En
 * medio, lo que se consulta a diario o casi. Y debajo de "Más", plegado, lo
 * que se toca una vez al mes: precios, sucursales, personal y el registro
 * del negocio. Cuesta un clic extra llegar ahí, y está bien que cueste.
 *
 * Las secciones se filtran por rol, pero eso es solo para no ofrecer lo que no
 * se puede hacer: quien decide de verdad es el backend.
 *
 * En angosto el riel no cabe: acostar las secciones en una fila que se
 * desliza horizontal no avisa que hay más ni dice dónde se quedó. Ahí el riel
 * se vuelve un menú que se abre con un botón — con el mismo trato de foco y
 * Escape que un panel — y se cierra solo al elegir una sección.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icono, FormsModule],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  protected readonly auth = inject(AuthService);
  private readonly branches = inject(BranchesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** El día del carnicero: lo que abre a diario o casi. */
  private readonly delDia: Seccion[] = [
    { ruta: '/mostrador', etiqueta: 'Inicio', icono: 'inicio' },
    { ruta: '/ventas', etiqueta: 'Ventas del día', icono: 'ventas' },
    // El fiado va junto a las ventas: es la venta que todavía no se cobra.
    { ruta: '/fiado', etiqueta: 'Fiado y cobros', icono: 'pago', soloGestion: true },
    { ruta: '/inventario', etiqueta: 'Inventario', icono: 'inventario' },
    { ruta: '/clientes', etiqueta: 'Clientes', icono: 'clientes' },
    { ruta: '/entradas', etiqueta: 'Entrada de mercancía', icono: 'entradas' },
    // "Lote" es palabra de sistema; la del oficio es la canal que se compró.
    { ruta: '/lotes', etiqueta: 'Canales compradas', icono: 'canal', soloGestion: true },
  ];

  /** Lo que se ajusta de vez en cuando, no lo que se atiende. */
  private readonly deAjustes: Seccion[] = [
    { ruta: '/mermas', etiqueta: 'Mermas', icono: 'mermas' },
    { ruta: '/productos', etiqueta: 'Productos y precios', icono: 'productos' },
    { ruta: '/sucursales', etiqueta: 'Sucursales', icono: 'sucursales', soloPropietario: true },
    { ruta: '/personal', etiqueta: 'Personal', icono: 'personal', soloGestion: true },
    { ruta: '/empresa', etiqueta: 'Mi carnicería', icono: 'empresa', soloPropietario: true },
  ];

  /** Lo que usa el soporte del sistema, que no tiene carnicería. */
  private readonly deSoporte: Seccion[] = [
    { ruta: '/soporte', etiqueta: 'Carnicerías', icono: 'soporte' },
  ];

  @ViewChild('botonMenu') private botonMenu?: ElementRef<HTMLElement>;
  @ViewChild('riel') private riel?: ElementRef<HTMLElement>;

  protected readonly perfil = toSignal(
    this.auth.perfil().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  /**
   * Solo el propietario elige sucursal: administrador y vendedor están fijos
   * a la suya, así que ofrecerles el selector no tendría nada que hacer.
   */
  protected readonly sucursalesDelDueno = toSignal(
    this.auth.esPropietario() ? this.branches.listar(true).pipe(catchError(() => of([]))) : of([]),
    { initialValue: [] as Branch[] },
  );

  protected elegirSucursal(valor: string): void {
    if (!valor) return;
    this.auth.elegirSucursal(Number(valor));
  }

  /** Solo importa en angosto: en escritorio el riel siempre está visible. */
  protected readonly menuAbierto = signal(false);

  /** El grupo "Más" nace plegado: es lo que casi nunca se abre. */
  protected readonly masAbierto = signal(false);

  private puedeVer(s: Seccion): boolean {
    if (s.soloPropietario) return this.auth.puedeAdministrarEmpresa();
    return !s.soloGestion || this.auth.esGestion();
  }

  /**
   * El soporte no atiende un mostrador: mezclarle inventario y ventas de una
   * carnicería a la que no pertenece solo confundiría.
   */
  protected readonly visibles = computed(() =>
    this.auth.esSoporte() ? this.deSoporte : this.delDia.filter((s) => this.puedeVer(s)),
  );

  protected readonly ajustes = computed(() =>
    this.auth.esSoporte() ? [] : this.deAjustes.filter((s) => this.puedeVer(s)),
  );

  /** En soporte, el encabezado dice qué es el sistema, no de quién es. */
  protected readonly rotulo = computed(() =>
    this.auth.esSoporte() ? 'Soporte del sistema' : (this.perfil()?.empresaNombre ?? 'Carnicería'),
  );

  protected readonly subrotulo = computed(() =>
    this.auth.esSoporte() ? 'Todas las carnicerías' : (this.perfil()?.sucursalNombre ?? ''),
  );

  constructor() {
    this.abrirMasSiEstamosDentro(this.router.url);

    this.router.events
      .pipe(
        filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((evento) => {
        // Cambiar de sección cierra el menú solo: nadie debería tener que
        // cerrarlo a mano después de ya haber elegido a dónde ir.
        this.menuAbierto.set(false);
        this.abrirMasSiEstamosDentro(evento.urlAfterRedirects);
      });
  }

  /**
   * Si la pantalla abierta vive dentro de "Más", el grupo se despliega: un
   * riel que no muestra dónde estás parado deja de servir de mapa.
   */
  private abrirMasSiEstamosDentro(url: string): void {
    if (this.deAjustes.some((s) => url.startsWith(s.ruta))) {
      this.masAbierto.set(true);
    }
  }

  protected alternarMas(): void {
    this.masAbierto.update((abierto) => !abierto);
  }

  protected abrirMenu(): void {
    this.menuAbierto.set(true);
    queueMicrotask(() => {
      this.riel?.nativeElement.querySelector<HTMLElement>('.riel__venta, .riel__paso')?.focus();
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
