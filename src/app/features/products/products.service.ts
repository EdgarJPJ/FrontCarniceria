import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface Product {
  id: number;
  name: string;
  cutType: string | null;
  unitOfMeasure: 'KILO' | 'PIEZA';
  salePrice: number;
  active: boolean;
  createdAt: string;
}

export interface ProductRequest {
  name: string;
  cutType: string;
  /** El backend lo compara sin distinguir mayúsculas: "kilo" o "pieza". */
  unitMeasure: string;
  salePrice: number;
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
