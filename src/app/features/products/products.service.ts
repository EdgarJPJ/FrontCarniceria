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

/** Catálogo de productos. Lo lee todo el mostrador: hace falta para vender. */
@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly http = inject(HttpClient);

  listar(): Observable<Product[]> {
    return this.http.get<Product[]>(`${environment.apiUrl}/productos`);
  }
}
