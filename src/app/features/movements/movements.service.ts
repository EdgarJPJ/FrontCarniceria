import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface StockEntry {
  id: number;
  branchId: number;
  productId: number;
  productName: string;
  employeeId: number;
  batchId: number | null;
  quantity: number;
  date: string;
  note: string | null;
}

export interface StockEntryRequest {
  branchId: number;
  productId: number;
  employeeId: number;
  batchId: number | null;
  quantity: number;
  note: string;
  /** Marca la canal como despiezada por completo: no se esperan más entradas contra ella. */
  despieceTerminado: boolean;
}

export interface Waste {
  id: number;
  productId: number;
  productName: string;
  branchId: number;
  employeeId: number;
  batchId: number | null;
  date: string;
  quantity: number;
  reason: string;
  note: string | null;
}

export interface WasteRequest {
  productId: number;
  branchId: number;
  employeeId: number;
  batchId: number | null;
  quantity: number;
  reason: string;
  note: string;
}

/** Los dos movimientos que mueven el inventario a mano: lo que entra y lo que se pierde. */
@Injectable({ providedIn: 'root' })
export class MovementsService {
  private readonly http = inject(HttpClient);

  entradas(): Observable<StockEntry[]> {
    return this.http.get<StockEntry[]>(`${environment.apiUrl}/stock-entries`);
  }

  registrarEntrada(datos: StockEntryRequest): Observable<StockEntry> {
    return this.http.post<StockEntry>(`${environment.apiUrl}/stock-entries`, datos);
  }

  mermas(): Observable<Waste[]> {
    return this.http.get<Waste[]>(`${environment.apiUrl}/waste`);
  }

  registrarMerma(datos: WasteRequest): Observable<Waste> {
    return this.http.post<Waste>(`${environment.apiUrl}/waste`, datos);
  }
}
