/** Contrato con `POST /api/auth/login` del backend Spring Boot. */

/**
 * Cuerpo que espera `EmployeeLoginRequest`. `empresa` acepta el slug
 * ("el-buen-corte") o el nombre del negocio ("El Buen Corte"): la clave de
 * usuario solo es única dentro de una empresa, así que sin este dato el
 * backend no puede saber de qué empleado se trata.
 */
export interface LoginRequest {
  empresa: string;
  username: string;
  password: string;
}

/**
 * Respuesta 200 (`EmployeeResponseLogin`).
 * Ojo: `name` trae el usuario capturado, no el nombre del empleado —
 * el backend devuelve `userRequest.username()` en ese campo.
 */
export interface LoginResponse {
  name: string;
  message: string;
  jwt: string;
  status: boolean;
}

/** Cuerpo de error uniforme (`CustomErrorResponse`) para 4xx y 5xx. */
export interface ApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  code: string;
}

/**
 * Claims que `JwtUtils.createToken` mete en el token. `X-Company` y `branch`
 * no son adorno: el backend exige la cabecera `X-Company` en todas las
 * peticiones que no sean el login, y el slug sale de aquí.
 */
export interface JwtClaims {
  sub: string;
  authorities: string;
  'X-Company': string;
  branch: number;
  exp: number;
  iat: number;
}

/** Cuerpo de `POST /api/auth/registro`: alta inicial de una carnicería. */
export interface RegistroRequest {
  empresa: { nombre: string; rfc: string; telefono: string };
  sucursal: { nombre: string; direccion: string; telefono: string };
  cuenta: { nombre: string; usuario: string; password: string; telefono: string };
}

/**
 * `GET /api/auth/perfil`. El JWT solo trae ids; los nombres para mostrar
 * salen de aquí, resueltos por el backend desde el empleado autenticado.
 */
export interface Perfil {
  usuario: string;
  nombre: string;
  rol: string;
  empresaId: number;
  empresaNombre: string;
  empresaSlug: string;
  sucursalId: number;
  sucursalNombre: string;
}

/** Lo que la app guarda de un turno abierto. */
export interface Session {
  username: string;
  jwt: string;
  companySlug: string;
  branchId: number;
  roles: string[];
  expiresAt: number;
}
