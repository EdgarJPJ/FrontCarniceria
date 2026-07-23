import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from './auth.service';

/**
 * Firma cada petición con el turno abierto.
 *
 * `X-Company` es obligatoria en casi todo: `CompanyHeaderFilter` responde 400
 * sin ella. El slug se saca del claim del token, no de una config del front,
 * para que no puedan apuntar a otra empresa.
 *
 * El soporte del sistema no pertenece a ninguna carnicería, así que su token
 * no trae slug y la cabecera se omite. Sus rutas (`/api/support`) están
 * excluidas de ese filtro justamente por eso.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(AuthService).session();

  if (!session || req.url.includes('/auth/login')) {
    return next(req);
  }

  const cabeceras: Record<string, string> = {
    Authorization: `Bearer ${session.jwt}`,
  };
  if (session.companySlug) {
    cabeceras['X-Company'] = session.companySlug;
  }

  return next(req.clone({ setHeaders: cabeceras }));
};
