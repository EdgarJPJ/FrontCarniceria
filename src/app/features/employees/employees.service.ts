import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Employee, EmployeeRequest, EmployeeUpdateRequest, Role } from './employee.models';

@Injectable({ providedIn: 'root' })
export class EmployeesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/employees`;

  listar(idSucursal?: number, activo?: boolean): Observable<Employee[]> {
    let params = new HttpParams();
    if (idSucursal) params = params.set('idSucursal', idSucursal);
    if (activo !== undefined) params = params.set('activo', activo);
    return this.http.get<Employee[]>(this.base, { params });
  }

  /**
   * El backend le oculta el rol developer a quien no lo tiene, así que la
   * lista que llega ya viene filtrada por lo que esta persona puede asignar.
   */
  roles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${environment.apiUrl}/roles`);
  }

  registrar(datos: EmployeeRequest): Observable<Employee> {
    return this.http.post<Employee>(this.base, datos);
  }

  actualizar(id: number, datos: EmployeeUpdateRequest): Observable<Employee> {
    return this.http.put<Employee>(`${this.base}/${id}`, datos);
  }

  cambiarPassword(id: number, password: string): Observable<Employee> {
    return this.http.patch<Employee>(`${this.base}/${id}/password`, { password });
  }

  cambiarEstado(id: number, activo: boolean): Observable<Employee> {
    return this.http.patch<Employee>(`${this.base}/${id}/estado`, null, {
      params: new HttpParams().set('activo', activo),
    });
  }
}
