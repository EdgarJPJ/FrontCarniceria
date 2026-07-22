import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from './auth.service';

/**
 * Firma cada petición con el turno abierto.
 *
 * `X-Company` es obligatoria: `CompanyHeaderFilter` responde 400 sin ella en
 * todo lo que no sea `/auth/login`. El slug se saca del claim del token, no
 * de una config del front, para que no puedan apuntar a otra empresa.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(AuthService).session();

  if (!session || req.url.includes('/auth/login')) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${session.jwt}`,
        'X-Company': session.companySlug,
      },
    }),
  );
};
