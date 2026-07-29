/**
 * `SidePanel` y `ConfirmDialog` bloquean el scroll de fondo mientras están
 * abiertos. Si uno se abre encima del otro —el desglose de una canal sobre
 * el panel de registrar merma, por ejemplo—, cerrar el de encima no debe
 * desbloquear el scroll: el de abajo lo sigue necesitando. De ahí el conteo,
 * en vez de que cada quien ponga y quite `overflow: hidden` a ciegas.
 */
let bloqueos = 0;

export function bloquearScroll(): void {
  bloqueos++;
  document.body.style.overflow = 'hidden';
}

export function desbloquearScroll(): void {
  bloqueos = Math.max(0, bloqueos - 1);
  if (bloqueos === 0) {
    document.body.style.overflow = '';
  }
}
