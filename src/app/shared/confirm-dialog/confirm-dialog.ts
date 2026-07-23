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

/**
 * Confirmación para una acción que no se puede deshacer — hoy, quitar un
 * producto del catálogo. Un `confirm()` del navegador rompe la identidad
 * visual justo en el momento en que más cuenta tenerla clara: cuando alguien
 * está a punto de borrar algo de verdad.
 *
 * A diferencia de `<app-side-panel>`, esto no se desliza desde el borde: es
 * una decisión de sí o no, así que se centra como una interrupción, no como
 * una superficie de trabajo.
 */
@Component({
  selector: 'app-confirm-dialog',
  template: `
    <div class="confirmar" (mousedown)="onFondo($event)">
      <div #caja class="confirmar__caja" role="alertdialog" aria-modal="true">
        <p class="confirmar__mensaje">{{ mensaje() }}</p>
        <div class="confirmar__botones">
          <button #botonCancelar class="confirmar__cancelar" type="button" (click)="cancelar.emit()">
            {{ textoCancelar() }}
          </button>
          <button class="confirmar__ok" type="button" (click)="confirmar.emit()">
            {{ textoConfirmar() }}
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog implements AfterViewInit, OnDestroy {
  readonly mensaje = input.required<string>();
  readonly textoConfirmar = input('Quitar');
  readonly textoCancelar = input('Cancelar');

  readonly confirmar = output<void>();
  readonly cancelar = output<void>();

  @ViewChild('caja') private caja!: ElementRef<HTMLElement>;
  @ViewChild('botonCancelar') private botonCancelar!: ElementRef<HTMLElement>;

  private quienTeniaElFoco: HTMLElement | null = null;

  ngAfterViewInit(): void {
    this.quienTeniaElFoco = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';
    // Cancelar es el destino por defecto: perder de un tab es más barato
    // que perder de un clic accidental en "Quitar".
    queueMicrotask(() => this.botonCancelar.nativeElement.focus());
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.quienTeniaElFoco?.focus?.();
  }

  protected onFondo(evento: MouseEvent): void {
    if (evento.target === evento.currentTarget) {
      this.cancelar.emit();
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.cancelar.emit();
  }

  @HostListener('document:keydown', ['$event'])
  protected onTab(evento: KeyboardEvent): void {
    if (evento.key !== 'Tab') return;

    const enfocables = Array.from(
      this.caja.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled])'),
    );
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
