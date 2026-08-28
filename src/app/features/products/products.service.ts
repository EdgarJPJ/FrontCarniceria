import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface Product {
  id: number;
  name: string;
  unitOfMeasure: 'KILO' | 'PIEZA';
  salePrice: number;
  active: boolean;
  /**
   * Si este corte sale de despiezar una canal. Cuando es `true`, la pantalla
   * de Entradas avisa si se registra una entrada suya sin ligarla a un lote;
   * cuando es `false` (mercancía que llega ya despiezada de fuera) no molesta.
   */
  sourcedFromBatch: boolean;
  createdAt: string;
}

export interface ProductRequest {
  name: string;
  /** El backend lo compara sin distinguir mayúsculas: "kilo" o "pieza". */
  unitMeasure: string;
  salePrice: number;
  sourcedFromBatch: boolean;
}

/** Catálogo de productos. Lo lee todo el mostrador: hace falta para vender. */
@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/productos`;

  listar(): Observable<Product[]> {
    return this.http.get<Product[]>(this.base);
  }

  registrar(datos: ProductRequest): Observable<Product> {
    return this.http.post<Product>(this.base, datos);
  }

  actualizar(id: number, datos: ProductRequest): Observable<Product> {
    return this.http.put<Product>(`${this.base}/${id}`, datos);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
