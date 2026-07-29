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
   * Los mismos niveles que `config/Roles` en el backend. Esto solo decide
   * qué se dibuja: quien manda es el @PreAuthorize del servidor. Ocultar un
   * botón es cortesía, no seguridad.
   */
  readonly esSoporte = computed(() => this.tieneRol('DEVELOPER'));
  readonly esPropietario = computed(() => this.tieneRol('PROPIETARIO'));
  readonly esGestion = computed(() => this.tieneRol('DEVELOPER', 'PROPIETARIO', 'ADMINISTRADOR'));
  /** Sucursales y datos de la empresa: ya no es cosa de cada administrador. */
  readonly puedeAdministrarEmpresa = computed(() => this.tieneRol('DEVELOPER', 'PROPIETARIO'));

  private tieneRol(...roles: string[]): boolean {
    const propios = this._session()?.roles ?? [];
    return roles.some((rol) => propios.includes(`ROLE_${rol}`));
  }

  /**
   * En qué sucursal opera ahora mismo. Para administrador y vendedor es fija
   * (la del token); el propietario, que no está atado a una sola, la elige
   * aquí — arranca en la suya propia y no se guarda entre sesiones, para no
   * dejar puesta una sucursal vieja sin que el dueño se dé cuenta.
   */
  private readonly _sucursalActiva = signal<number | null>(null);
  readonly sucursalActiva = this._sucursalActiva.asReadonly();

  readonly sucursalOperativa = computed(() =>
    this.esPropietario() ? this._sucursalActiva() : (this._session()?.branchId ?? null),
  );

  elegirSucursal(idSucursal: number): void {
    this._sucursalActiva.set(idSucursal);
  }

  login(credenciales: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, credenciales)
      .pipe(tap((respuesta) => this.abrirTurno(respuesta.jwt)));
  }

  /** Alta inicial: crea empresa, sucursal y propietario, y abre el turno. */
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
      .pipe(
        tap((p) => this._sucursalActiva.update((actual) => actual ?? p.sucursalId)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.perfilEnCurso;
  }

  private perfilEnCurso: Observable<Perfil> | null = null;

  /**
   * La carnicería del último turno en este equipo. Ya no hace falta para
   * entrar —el backend resuelve la clave sin ella—, pero sirve para precargar
   * el campo si la clave y la contraseña resultan ambiguas entre carnicerías.
   */
  empresaRecordada(): string {
    return localStorage.getItem(ALMACEN_EMPRESA) ?? '';
  }

  /** Cierra el turno pero deja la carnicería puesta: el equipo no cambia de dueño. */
  logout(): void {
    this._session.set(null);
    this.perfilEnCurso = null;
    this._sucursalActiva.set(null);
    localStorage.removeItem(ALMACEN);
  }

  private abrirTurno(jwt: string): void {
    const session = sessionFromJwt(jwt);
    if (!session) {
      throw new Error('El servidor devolvió un token que no se pudo leer.');
    }
    this._session.set(session);
    localStorage.setItem(ALMACEN, jwt);

    /*
     * Se guarda el slug del token, no lo que se tecleó: es la forma canónica.
     * El soporte no trae ninguno, y en ese caso no se toca lo guardado: si esa
     * terminal es de una carnicería, debe seguir recordando la suya para
     * cuando vuelva a entrar su personal.
     */
    if (session.companySlug) {
      localStorage.setItem(ALMACEN_EMPRESA, session.companySlug);
    }
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
