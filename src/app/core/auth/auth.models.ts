/** Contrato con `POST /api/auth/login` del backend Spring Boot. */

/**
 * Cuerpo que espera `EmployeeLoginRequest`. `empresa` casi nunca hace falta:
 * el backend busca la clave entre todas las carnicerías y solo la pide de
 * vuelta si la clave y la contraseña coinciden en más de una (código
 * `EMPRESA_REQUERIDA_EXCEPTION`). Acepta el slug ("el-buen-corte") o el
 * nombre del negocio ("El Buen Corte").
 */
export interface LoginRequest {
  empresa?: string;
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
  /** Ausente en el soporte del sistema, que no pertenece a ninguna carnicería. */
  'X-Company'?: string;
  branch?: number;
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
  /** Necesario para registrar ventas, entradas y mermas. */
  empleadoId: number;
  usuario: string;
  nombre: string;
  rol: string;
  /** Vacíos en el soporte del sistema, que no pertenece a una carnicería. */
  empresaId: number | null;
  empresaNombre: string | null;
  empresaSlug: string | null;
  sucursalId: number | null;
  sucursalNombre: string | null;
}

/** Lo que la app guarda de un turno abierto. */
export interface Session {
  username: string;
  jwt: string;
  /** Nulo en el soporte del sistema. */
  companySlug: string | null;
  branchId: number | null;
  roles: string[];
  expiresAt: number;
}
