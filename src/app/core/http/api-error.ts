import { HttpErrorResponse } from '@angular/common/http';

import { ApiErrorResponse } from '../auth/auth.models';

/**
 * Traduce un fallo HTTP a una frase que le sirva a quien está en el mostrador:
 * qué pasó y qué hacer. Se mapea por el `code` de `CustomErrorResponse`, que
 * es estable, en vez del `message`, que cambia según la excepción de Java.
 */
export function mensajeDeError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Algo falló al iniciar el turno. Intenta de nuevo.';
  }

  // status 0: la petición nunca salió (backend apagado, red caída, proxy mal).
  if (error.status === 0) {
    return 'No hay conexión con el servidor. Revisa que el sistema esté encendido.';
  }

  const cuerpo = error.error as Partial<ApiErrorResponse> | null;

  switch (cuerpo?.code) {
    case 'AUTHENTICATION_FAILED_EXCEPTION':
    case 'UNAUTHORIZED_ACCESS':
      return 'La clave o la contraseña no coinciden. Revísalas e intenta de nuevo.';

    case 'SUBSCRIPTION_EXPIRED':
      return 'La suscripción de esta carnicería está suspendida. Contacta a soporte para reactivarla.';

    case 'METHOD_ARGUMENT_NOT_VALID_EXCEPTION':
    case 'CONSTRAINT_VIOLATION_EXCEPTION':
      return cuerpo.message ?? 'Faltan datos para entrar.';

    case 'ACCESS_DENIED_EXCEPTION':
    case 'AUTHORIZATION_DENIED_EXCEPTION':
      return 'Tu usuario no tiene permiso para entrar aquí. Habla con el administrador.';

    // Hoy solo lo lanza el alta, y siempre por la clave de usuario ocupada.
    case 'RECURSO_DUPLICADO_EXCEPTION':
      return cuerpo.message ?? 'Esa clave de usuario ya está ocupada. Elige otra.';

    case 'DATA_INTEGRITY_VIOLATION_EXCEPTION':
      return 'Esos datos chocan con algo que ya existe. Revisa la clave de usuario.';
  }

  // Sin `code` reconocible, se responde por estado.
  if (error.status === 401 || error.status === 403) {
    return 'La clave o la contraseña no coinciden. Revísalas e intenta de nuevo.';
  }
  if (error.status >= 500) {
    /*
     * Un Spring vivo siempre contesta con `CustomErrorResponse`, así que un
     * 5xx sin `code` casi siempre es el proxy de `ng serve` que no encontró
     * el backend. Se dice eso, que es lo accionable, en vez de culpar al
     * servidor de una falla interna que no ocurrió.
     */
    return cuerpo?.code
      ? 'El servidor no respondió bien. Vuelve a intentar en un momento.'
      : 'No se pudo contactar al servidor. Revisa que el sistema esté encendido.';
  }

  return cuerpo?.message ?? 'Algo falló al iniciar el turno. Intenta de nuevo.';
}
