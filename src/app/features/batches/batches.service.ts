import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Batch, BatchOption, BatchReport, BatchRequest } from './batch.models';

@Injectable({ providedIn: 'root' })
export class BatchesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/batches`;

  listar(idSucursal?: number): Observable<Batch[]> {
    let params = new HttpParams();
    if (idSucursal) params = params.set('idSucursal', idSucursal);
    return this.http.get<Batch[]>(this.base, { params });
  }

  /** Para el selector de Entradas y Mermas: cualquiera con turno abierto, sin costos. */
  seleccionables(idSucursal?: number): Observable<BatchOption[]> {
    let params = new HttpParams();
    if (idSucursal) params = params.set('idSucursal', idSucursal);
    return this.http.get<BatchOption[]>(`${this.base}/seleccionables`, { params });
  }

  registrar(datos: BatchRequest): Observable<Batch> {
    return this.http.post<Batch>(this.base, datos);
  }

  actualizar(id: number, datos: BatchRequest): Observable<Batch> {
    return this.http.put<Batch>(`${this.base}/${id}`, datos);
  }

  reporte(id: number): Observable<BatchReport> {
    return this.http.get<BatchReport>(`${this.base}/${id}/report`);
  }
}
