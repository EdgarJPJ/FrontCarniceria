import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Branch, BranchRequest } from './branch.models';

@Injectable({ providedIn: 'root' })
export class BranchesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/branches`;

  listar(active?: boolean): Observable<Branch[]> {
    let params = new HttpParams();
    if (active !== undefined) params = params.set('active', active);
    return this.http.get<Branch[]>(this.base, { params });
  }

  registrar(datos: BranchRequest): Observable<Branch> {
    return this.http.post<Branch>(this.base, datos);
  }

  actualizar(id: number, datos: BranchRequest): Observable<Branch> {
    return this.http.put<Branch>(`${this.base}/${id}`, datos);
  }

  cambiarEstado(id: number, activo: boolean): Observable<Branch> {
    return this.http.patch<Branch>(`${this.base}/${id}/estado`, null, {
      params: new HttpParams().set('activo', activo),
    });
  }
}
