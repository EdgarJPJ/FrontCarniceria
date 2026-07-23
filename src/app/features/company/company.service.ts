import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface Company {
  id: number;
  name: string;
  rfc: string | null;
  phone: string | null;
  /** "BASICO" | "PRO", como lo devuelve el enum del backend. */
  plan: string;
  active: boolean;
  createdAt: string;
  /** El código con el que entra el personal. No se edita desde aquí. */
  slug: string;
}

export interface CompanyRequest {
  name: string;
  rfc: string;
  phone: string;
  /** El backend la compara sin distinguir mayúsculas: "basico" o "pro". */
  plan: string;
}

/**
 * La empresa del propio turno abierto. Usa `/mine`, no `/{id}`: ese último es
 * solo de soporte, y esta ruta nunca manda un id — lo resuelve el backend
 * desde el token, así que no hay forma de pedir o editar la de otra
 * carnicería.
 */
@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/companies/mine`;

  obtener(): Observable<Company> {
    return this.http.get<Company>(this.base);
  }

  actualizar(datos: CompanyRequest): Observable<Company> {
    return this.http.put<Company>(this.base, datos);
  }
}
