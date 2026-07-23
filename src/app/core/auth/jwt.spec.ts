import { JwtClaims } from './auth.models';
import { decodeJwtPayload, isExpired, sessionFromJwt } from './jwt';

/** Arma un JWT de mentiras: firma inválida, payload real. */
function armarJwt(claims: Partial<JwtClaims>): string {
  const base64url = (valor: object) =>
    btoa(JSON.stringify(valor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return [base64url({ alg: 'HS256' }), base64url(claims), 'firma-que-no-se-verifica'].join('.');
}

const claimsBase: JwtClaims = {
  sub: 'jaf01',
  authorities: '[ROLE_ADMINISTRADOR]',
  'X-Company': 'carniceria-el-buen-corte',
  branch: 3,
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
};

describe('decodeJwtPayload', () => {
  it('lee los claims del payload', () => {
    expect(decodeJwtPayload(armarJwt(claimsBase))?.sub).toBe('jaf01');
  });

  it('devuelve null si el token está mal formado', () => {
    expect(decodeJwtPayload('esto-no-es-un-jwt')).toBeNull();
    expect(decodeJwtPayload('a.b.c')).toBeNull();
  });
});

describe('sessionFromJwt', () => {
  it('arma la sesión con la empresa y la sucursal del token', () => {
    const session = sessionFromJwt(armarJwt(claimsBase))!;

    expect(session.username).toBe('jaf01');
    expect(session.companySlug).toBe('carniceria-el-buen-corte');
    expect(session.branchId).toBe(3);
  });

  it('desenvuelve las autoridades que el backend manda como "[ROLE_X, ROLE_Y]"', () => {
    const session = sessionFromJwt(
      armarJwt({ ...claimsBase, authorities: '[ROLE_ADMINISTRADOR, ROLE_VENDEDOR]' }),
    )!;

    expect(session.roles).toEqual(['ROLE_ADMINISTRADOR', 'ROLE_VENDEDOR']);
  });

  /*
   * El soporte del sistema no pertenece a ninguna carnicería y su token sale
   * sin esos claims. La sesión tiene que aceptarlo: el interceptor omite la
   * cabecera X-Company cuando no hay slug, y sus rutas no la exigen.
   */
  it('acepta un token sin empresa, que es el del soporte del sistema', () => {
    const session = sessionFromJwt(
      armarJwt({ ...claimsBase, 'X-Company': undefined, branch: undefined }),
    )!;

    expect(session).not.toBeNull();
    expect(session.companySlug).toBeNull();
    expect(session.branchId).toBeNull();
    expect(session.username).toBe('jaf01');
  });

  it('rechaza un token sin usuario, que no identifica a nadie', () => {
    expect(sessionFromJwt(armarJwt({ ...claimsBase, sub: undefined }))).toBeNull();
  });
});

describe('isExpired', () => {
  it('marca como vencido un turno cuya hora ya pasó', () => {
    const vencido = sessionFromJwt(
      armarJwt({ ...claimsBase, exp: Math.floor(Date.now() / 1000) - 60 }),
    )!;

    expect(isExpired(vencido)).toBe(true);
  });

  it('deja pasar un turno vigente', () => {
    expect(isExpired(sessionFromJwt(armarJwt(claimsBase))!)).toBe(false);
  });
});
