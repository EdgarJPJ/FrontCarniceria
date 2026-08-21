import { HttpErrorResponse } from '@angular/common/http';

import { mensajeDeError } from './api-error';

function respuestaDeError(status: number, code?: string, message?: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: code ? { status, code, message } : null,
  });
}

describe('mensajeDeError', () => {
  it('explica que la conexión no salió cuando el servidor no responde', () => {
    expect(mensajeDeError(respuestaDeError(0))).toContain('No hay conexión');
  });

  it('no culpa al servidor cuando las credenciales están mal', () => {
    const mensaje = mensajeDeError(respuestaDeError(401, 'AUTHENTICATION_FAILED_EXCEPTION'));
    expect(mensaje).toContain('no coinciden');
  });

  it('distingue la suscripción suspendida de una contraseña incorrecta', () => {
    const mensaje = mensajeDeError(respuestaDeError(403, 'SUBSCRIPTION_EXPIRED'));
    expect(mensaje).toContain('suscripción');
    expect(mensaje).toContain('soporte');
  });

  it('usa el mensaje del backend cuando la validación dice qué campo falta', () => {
    const mensaje = mensajeDeError(
      respuestaDeError(400, 'METHOD_ARGUMENT_NOT_VALID_EXCEPTION', 'username: Usuario requerido'),
    );
    expect(mensaje).toBe('username: Usuario requerido');
  });

  it('usa el mensaje del backend para un conflicto de datos, no uno fijo sobre usuarios', () => {
    // El mismo código lo lanza cualquier violación de integridad, no solo un
    // usuario duplicado (por ejemplo, borrar un producto que ya tiene ventas).
    const mensaje = mensajeDeError(
      respuestaDeError(
        409,
        'DATA_INTEGRITY_VIOLATION_EXCEPTION',
        'No se puede completar la operación porque el recurso tiene datos relacionados o duplicados.',
      ),
    );
    expect(mensaje).toBe(
      'No se puede completar la operación porque el recurso tiene datos relacionados o duplicados.',
    );
    expect(mensaje).not.toContain('clave de usuario');
  });

  it('trata un 5xx sin cuerpo como backend inalcanzable, no como falla interna', () => {
    expect(mensajeDeError(respuestaDeError(500))).toContain('No se pudo contactar');
  });

  it('reporta falla interna cuando el 5xx sí trae cuerpo de Spring', () => {
    expect(mensajeDeError(respuestaDeError(500, 'GENERAL_EXCEPTION'))).toContain(
      'servidor no respondió',
    );
  });
});
