import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  input,
  output,
} from '@angular/core';

const SELECTOR_ENFOCABLE =
  'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]';

let contador = 0;

/**
 * El armazón de cada panel de alta/edición del sistema: el fondo oscurecido,
 * la hoja que se desliza y el comportamiento que antes faltaba en las doce
 * pantallas que abrían un `<div class="panel">` a mano.
 *
 * Al abrirse, mete el foco en el primer campo — nadie debería tener que
 * hacer clic para empezar a escribir. Escape lo cierra, un clic en el fondo
 * también, y el foco vuelve a quien lo abrió (normalmente el botón "Nuevo…")
 * en vez de perderse en la página. El Tab no se escapa hacia la lista de
 * atrás: un panel encima de la pantalla se comporta como lo único presente.
 *
 * No pide un título aparte: toma el `<h2 class="panel__titulo">` que cada
 * página ya escribe y lo usa como nombre accesible del diálogo, para no
 * repetir el mismo texto dos veces.
 */
@Component({
  selector: 'app-side-panel',
  template: `
    <div class="panel" (mousedown)="onFondo($event)">
      <div #hoja class="panel__forma" [class]="ancho()" role="dialog" aria-modal="true">
        <ng-content />
      </div>
    </div>
  `,
  styleUrl: './side-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidePanel implements AfterViewInit, OnDestroy {
  /** Clase extra para panels que necesitan más ancho (la caja de ventas). */
  readonly ancho = input<string>('');
  readonly cerrar = output<void>();

  @ViewChild('hoja') private hoja!: ElementRef<HTMLElement>;

  private quienTeniaElFoco: HTMLElement | null = null;

  ngAfterViewInit(): void {
    this.quienTeniaElFoco = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';

    // Un tick para que el contenido proyectado ya esté en el DOM.
    queueMicrotask(() => {
      this.nombrarDialogo();
      const primero = this.hoja.nativeElement.querySelector<HTMLElement>(SELECTOR_ENFOCABLE);
      primero?.focus();
    });
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    // Vuelve el foco a donde estaba: normalmente el botón que abrió esto.
    this.quienTeniaElFoco?.focus?.();
  }

  private nombrarDialogo(): void {
    const titulo = this.hoja.nativeElement.querySelector('.panel__titulo');
    if (!titulo) return;

    if (!titulo.id) {
      titulo.id = `panel-titulo-${++contador}`;
    }
    this.hoja.nativeElement.setAttribute('aria-labelledby', titulo.id);
  }

  protected onFondo(evento: MouseEvent): void {
    if (evento.target === evento.currentTarget) {
      this.cerrar.emit();
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.cerrar.emit();
  }

  @HostListener('document:keydown', ['$event'])
  protected onTab(evento: KeyboardEvent): void {
    if (evento.key !== 'Tab') return;

    const enfocables = Array.from(
      this.hoja.nativeElement.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLE),
    ).filter((el) => el.offsetParent !== null);
    if (enfocables.length === 0) return;

    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];

    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }
}
