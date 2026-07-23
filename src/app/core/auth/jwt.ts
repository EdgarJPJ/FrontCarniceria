import { JwtClaims, Session } from './auth.models';

/**
 * Decodifica el payload de un JWT. No verifica la firma —de eso se encarga
 * el backend—, solo lee los claims para saber a qué empresa y sucursal
 * pertenece el turno.
 */
export function decodeJwtPayload(jwt: string): JwtClaims | null {
  const payload = jwt.split('.')[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

/** Arma la sesión a partir del token. Devuelve null si el token no sirve. */
export function sessionFromJwt(jwt: string): Session | null {
  const claims = decodeJwtPayload(jwt);
  // El soporte del sistema no trae empresa; el usuario sí es indispensable.
  if (!claims?.sub) return null;

  return {
    username: claims.sub,
    jwt,
    companySlug: claims['X-Company'] ?? null,
    branchId: claims.branch ?? null,
    roles: parseAuthorities(claims.authorities),
    expiresAt: claims.exp * 1000,
  };
}

export function isExpired(session: Session, now = Date.now()): boolean {
  return session.expiresAt <= now;
}

/**
 * El backend serializa las autoridades con `Collection.toString()`, así que
 * llegan como `"[ROLE_ADMINISTRADOR]"` y no como una lista JSON.
 */
function parseAuthorities(authorities: string | undefined): string[] {
  if (!authorities) return [];
  return authorities
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
}
