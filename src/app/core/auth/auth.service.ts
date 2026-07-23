import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse, Perfil, RegistroRequest, Session } from './auth.models';
import { isExpired, sessionFromJwt } from './jwt';

const ALMACEN = 'carniceria.session';
const ALMACEN_EMPRESA = 'carniceria.empresa';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _session = signal<Session | null>(leerSesionGuardada());

  readonly session = this._session.asReadonly();
  readonly isAuthenticated = computed(() => this._session() !== null);
  readonly username = computed(() => this._session()?.username ?? null);
  readonly companySlug = computed(() => this._session()?.companySlug ?? null);

  /*
   * Los mismos tres niveles que `config/Roles` en el backend. Esto solo decide
   * qué se dibuja: quien manda es el @PreAuthorize del servidor. Ocultar un
   * botón es cortesía, no seguridad.
   */
  readonly esSoporte = computed(() => this.tieneRol('DEVELOPER'));
  readonly esGestion = computed(() => this.tieneRol('DEVELOPER', 'ADMINISTRADOR'));

  private tieneRol(...roles: string[]): boolean {
    const propios = this._session()?.roles ?? [];
    return roles.some((rol) => propios.includes(`ROLE_${rol}`));
  }

  login(credenciales: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, credenciales)
      .pipe(tap((respuesta) => this.abrirTurno(respuesta.jwt)));
  }

  /** Alta inicial: crea empresa, sucursal y administrador, y abre el turno. */
  registrar(datos: RegistroRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/registro`, datos)
      .pipe(tap((respuesta) => this.abrirTurno(respuesta.jwt)));
  }

  /**
   * Nombres para mostrar y el id del empleado, que el token no trae. Se
   * comparte entre pantallas: casi todas lo necesitan y no tiene caso pedirlo
   * una vez por cada una.
   */
  perfil(): Observable<Perfil> {
    this.perfilEnCurso ??= this.http
      .get<Perfil>(`${environment.apiUrl}/auth/perfil`)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.perfilEnCurso;
  }

  private perfilEnCurso: Observable<Perfil> | null = null;

  /**
   * La carnicería del último turno en este equipo. Una terminal de mostrador
   * es siempre de la misma carnicería, así que se teclea una vez y después
   * entrar vuelve a ser solo clave y contraseña.
   */
  empresaRecordada(): string {
    return localStorage.getItem(ALMACEN_EMPRESA) ?? '';
  }

  /** Cierra el turno pero deja la carnicería puesta: el equipo no cambia de dueño. */
  logout(): void {
    this._session.set(null);
    this.perfilEnCurso = null;
    localStorage.removeItem(ALMACEN);
  }

  private abrirTurno(jwt: string): void {
    const session = sessionFromJwt(jwt);
    if (!session) {
      throw new Error('El servidor devolvió un token que no se pudo leer.');
    }
    this._session.set(session);
    localStorage.setItem(ALMACEN, jwt);
    // Se guarda el slug del token, no lo que se tecleó: es la forma canónica.
    localStorage.setItem(ALMACEN_EMPRESA, session.companySlug);
  }
}

/**
 * Se guarda solo el JWT y la sesión se reconstruye al arrancar: así el token
 * es la única fuente de verdad y no puede quedar desfasado de sus claims.
 * El token dura una hora, por lo que un turno viejo se descarta aquí mismo.
 */
function leerSesionGuardada(): Session | null {
  const jwt = localStorage.getItem(ALMACEN);
  if (!jwt) return null;

  const session = sessionFromJwt(jwt);
  if (!session || isExpired(session)) {
    localStorage.removeItem(ALMACEN);
    return null;
  }
  return session;
}
