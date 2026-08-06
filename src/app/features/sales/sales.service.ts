import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Payment, PaymentMethod, PaymentRequest, Sale, SaleRequest } from './sale.models';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/sales`;

  listar(branchId?: number, paymentStatus?: string): Observable<Sale[]> {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', branchId);
    if (paymentStatus) params = params.set('paymentStatus', paymentStatus);
    return this.http.get<Sale[]>(this.base, { params });
  }

  registrar(datos: SaleRequest): Observable<Sale> {
    return this.http.post<Sale>(this.base, datos);
  }

  cancelar(id: number): Observable<Sale> {
    return this.http.patch<Sale>(`${this.base}/${id}/cancel`, null);
  }

  /** Catálogo global, compartido entre todas las carnicerías. */
  metodosPago(): Observable<PaymentMethod[]> {
    return this.http.get<PaymentMethod[]>(`${environment.apiUrl}/payment-methods`);
  }

  abonos(saleId: number): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${environment.apiUrl}/payments/sale/${saleId}`);
  }

  /** Todos los abonos de la sucursal (o de todas, si quien pregunta opera en cualquiera). */
  listarAbonos(branchId?: number): Observable<Payment[]> {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<Payment[]>(`${environment.apiUrl}/payments`, { params });
  }

  abonar(datos: PaymentRequest): Observable<Payment> {
    return this.http.post<Payment>(`${environment.apiUrl}/payments`, datos);
  }
}
