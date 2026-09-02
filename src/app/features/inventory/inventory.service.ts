import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

/** Una línea de existencias: cuánto hay de un producto en una sucursal. */
export interface InventoryLine {
  branchId: number;
  branchName: string;
  productId: number;
  productName: string;
  unitOfMeasure: 'KILO' | 'PIEZA';
  salePrice: number;
  /** Punto de reorden del producto. `null` si no se configuró. */
  reorderPoint: number | null;
  stock: number;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);

  listar(idSucursal?: number, soloConStock?: boolean): Observable<InventoryLine[]> {
    let params = new HttpParams();
    if (idSucursal) params = params.set('idSucursal', idSucursal);
    if (soloConStock) params = params.set('soloConStock', true);
    return this.http.get<InventoryLine[]>(`${environment.apiUrl}/inventory`, { params });
  }
}
