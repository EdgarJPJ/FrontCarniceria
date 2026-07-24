import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Los íconos del sistema, dibujados a trazo sobre una retícula de 24 y
 * heredando el color de quien los pone. No hay librería detrás: son doce
 * formas, y traerse un paquete entero para eso costaría más que dibujarlas.
 *
 * Van siempre acompañados de su etiqueta —un ícono solo no dice nada a quien
 * entra por primera vez—, así que se marcan como decorativos: el nombre
 * accesible lo pone el texto de al lado.
 *
 * El gancho de "canales" es el único que se sale de la geometría: es la
 * herramienta de la que cuelga la mercancía, y nombra mejor esa sección que
 * cualquier caja o etiqueta genérica.
 */
const TRAZOS: Record<string, string[]> = {
  inicio: ['M3.5 11.3 12 4.2l8.5 7.1', 'M5.9 9.6V19.8h12.2V9.6'],

  ventas: [
    'M6 3.2h12v17.6l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4Z',
    'M9.3 8.4h5.4',
    'M9.3 12.2h5.4',
  ],

  inventario: ['M4.2 7.6h15.6v12.2H4.2Z', 'M4.2 7.6 6.2 3.9h11.6l2 3.7', 'M9.8 11.6h4.4'],

  clientes: [
    'M9.4 5.2a2.9 2.9 0 1 1 0 5.8 2.9 2.9 0 0 1 0-5.8',
    'M3.6 19.6c0-3.2 2.6-5.4 5.8-5.4s5.8 2.2 5.8 5.4',
    'M16.4 5.6a2.9 2.9 0 0 1 0 5.4',
    'M17.6 14.6c1.9.7 2.9 2.5 2.9 5',
  ],

  pago: ['M2.8 6.6h18.4v10.8H2.8Z', 'M12 9.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2'],

  // Un gancho de carnicero: la curva que se cuelga arriba, el asta y la punta.
  canal: ['M15 6.4a3 3 0 0 1-6 0V14.6a3.4 3.4 0 0 0 6.8 0'],

  entradas: [
    'M12 3.4v9.4',
    'm8.3 9.3 3.7 3.7 3.7-3.7',
    'M4 15.4v3.4a1.4 1.4 0 0 0 1.4 1.4h13.2a1.4 1.4 0 0 0 1.4-1.4v-3.4',
  ],

  mermas: ['M4.2 6.6h15.6', 'M9.6 6.6V4.2h4.8v2.4', 'M6.3 6.6 7.1 20h9.8l.8-13.4'],

  productos: ['M11.6 3.2H20v8.4l-8.8 8.8L3 11.6Z', 'M16.1 6.9a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8'],

  sucursales: ['M4.4 9.6h15.2V20H4.4Z', 'M3 9.6 5.1 4h13.8L21 9.6', 'M10 20v-5.2h4V20'],

  personal: [
    'M5 4.4h14v15.2H5Z',
    'M12 8a2.4 2.4 0 1 1 0 4.8A2.4 2.4 0 0 1 12 8',
    'M8.2 17.2c.7-1.7 2.1-2.6 3.8-2.6s3.1.9 3.8 2.6',
  ],

  empresa: ['M6.2 3.2h8.4L18 6.6v14.2H6.2Z', 'M14.6 3.2v3.4H18', 'M9.2 12h5.6', 'M9.2 15.6h5.6'],

  soporte: ['M12 3.4 19.6 6v6.2c0 4.2-3.2 7.2-7.6 8.4-4.4-1.2-7.6-4.2-7.6-8.4V6Z'],

  nueva: ['M12 5.4v13.2', 'M5.4 12h13.2'],

  galon: ['m7.5 10 4.5 4.5L16.5 10'],
};

@Component({
  selector: 'app-icono',
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @for (trazo of trazos(); track trazo) {
        <path [attr.d]="trazo" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 20px;
      height: 20px;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icono {
  readonly nombre = input.required<string>();

  protected readonly trazos = computed(() => TRAZOS[this.nombre()] ?? []);
}
