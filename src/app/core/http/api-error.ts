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

    // A diferencia de AUTHENTICATION_FAILED_EXCEPTION, aquí la contraseña ya
    // era correcta: decir la razón real no ayuda a nadie a tantear cuentas.
    case 'CUENTA_DESACTIVADA_EXCEPTION':
      return cuerpo.message ?? 'Tu cuenta fue desactivada. Habla con quien administra tu sucursal.';

    case 'SUBSCRIPTION_EXPIRED':
      return 'La suscripción de esta carnicería está suspendida. Contacta a soporte para reactivarla.';

    // A diferencia de AUTHENTICATION_FAILED_EXCEPTION, aquí sí conviene el
    // mensaje del backend: dice justo lo que falta (la carnicería), y solo se
    // dispara cuando la clave y la contraseña ya eran correctas.
    case 'EMPRESA_REQUERIDA_EXCEPTION':
      return cuerpo.message ?? 'Escribe el nombre de tu carnicería para entrar.';

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

    case 'BATCH_AGOTADA_EXCEPTION':
      return 'Esa canal ya se agotó, no se le pueden ligar más entradas.';

    case 'CREDIT_LIMIT_EXCEEDED_EXCEPTION':
      return cuerpo.message ?? 'Esta venta deja al cliente por encima de su límite de crédito.';
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

/**
 * Solo es cierto cuando el backend ya validó clave y contraseña y encontró
 * más de una carnicería con ellas — nunca por una contraseña incorrecta, así
 * que no sirve para tantear cuentas ajenas.
 */
export function esEmpresaRequerida(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) return false;
  const cuerpo = error.error as Partial<ApiErrorResponse> | null;
  return cuerpo?.code === 'EMPRESA_REQUERIDA_EXCEPTION';
}
