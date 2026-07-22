import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * El armazón de las pantallas de acceso: la pared de azulejo con el sello a
 * la izquierda y la superficie de trabajo a la derecha. El contenido que se
 * proyecta es el formulario de turno.
 */
@Component({
  selector: 'app-acceso-layout',
  templateUrl: './acceso-layout.html',
  styleUrl: './acceso-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccesoLayout {
  /** Mientras se envía, el sello se presiona sobre la pared. */
  readonly sellando = input(false);
}
