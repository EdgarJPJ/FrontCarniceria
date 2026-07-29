import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface Carniceria {
  id: number;
  nombre: string;
  slug: string;
  rfc: string | null;
  telefono: string | null;
  plan: string;
  activa: boolean;
  suscripcionActiva: boolean;
  creada: string;
  sucursales: number;
  empleados: number;
}

export interface Acceso {
  id: number;
  nombre: string;
  usuario: string;
  rol: string;
  activo: boolean;
  sucursal: string | null;
}

/**
 * Soporte del sistema. Es la única API que no manda `X-Company`: quien la usa
 * no pertenece a ninguna carnicería y trabaja sobre todas.
 */
@Injectable({ providedIn: 'root' })
export class SupportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/support`;

  carnicerias(busqueda?: string, suscripcionActiva?: boolean): Observable<Carniceria[]> {
    let params = new HttpParams();
    if (busqueda) params = params.set('busqueda', busqueda);
    if (suscripcionActiva !== undefined) {
      params = params.set('suscripcionActiva', suscripcionActiva);
    }
    return this.http.get<Carniceria[]>(`${this.base}/carnicerias`, { params });
  }

  cambiarSuscripcion(id: number, activa: boolean): Observable<Carniceria> {
    return this.http.patch<Carniceria>(`${this.base}/carnicerias/${id}/suscripcion`, null, {
      params: new HttpParams().set('activa', activa),
    });
  }

  /** El plan no se autogestiona: lo cambia soporte cuando el cliente contrata o baja de nivel. */
  cambiarPlan(id: number, plan: string): Observable<Carniceria> {
    return this.http.patch<Carniceria>(`${this.base}/carnicerias/${id}/plan`, null, {
      params: new HttpParams().set('plan', plan),
    });
  }

  accesos(idCarniceria: number): Observable<Acceso[]> {
    return this.http.get<Acceso[]>(`${this.base}/carnicerias/${idCarniceria}/accesos`);
  }

  restablecerPassword(idEmpleado: number, password: string): Observable<Acceso> {
    return this.http.patch<Acceso>(`${this.base}/accesos/${idEmpleado}/password`, { password });
  }
}
