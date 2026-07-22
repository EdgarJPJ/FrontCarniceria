import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Client, ClientRequest } from './client.models';

/**
 * La empresa no viaja en ningún parámetro: el backend la saca del token.
 * Mandarla desde aquí sería justamente el agujero que se cerró.
 */
@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/clients`;

  listar(name?: string, active?: boolean): Observable<Client[]> {
    let params = new HttpParams();
    if (name) params = params.set('name', name);
    if (active !== undefined) params = params.set('active', active);
    return this.http.get<Client[]>(this.base, { params });
  }

  registrar(datos: ClientRequest): Observable<Client> {
    return this.http.post<Client>(this.base, datos);
  }

  actualizar(id: number, datos: ClientRequest): Observable<Client> {
    return this.http.put<Client>(`${this.base}/${id}`, datos);
  }

  cambiarEstado(id: number, activo: boolean): Observable<Client> {
    return this.http.patch<Client>(`${this.base}/${id}/estado`, null, {
      params: new HttpParams().set('activo', activo),
    });
  }
}
