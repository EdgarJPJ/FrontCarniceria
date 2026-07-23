import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

/**
 * Un cliente que debe. Sale de la vista `vw_saldos_clientes`, que solo lista a
 * quienes tienen saldo pendiente mayor que cero.
 */
export interface SaldoCliente {
  clientId: number;
  name: string;
  creditLimit: number;
  totalSold: number;
  totalPaid: number;
  balance: number;
}

@Injectable({ providedIn: 'root' })
export class CreditService {
  private readonly http = inject(HttpClient);

  saldos(): Observable<SaldoCliente[]> {
    return this.http.get<SaldoCliente[]>(`${environment.apiUrl}/client-balances`);
  }
}
