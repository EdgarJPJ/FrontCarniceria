import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'entrar',
    title: 'Inicia tu turno · Carnicería',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'registrar',
    title: 'Da de alta tu carnicería · Carnicería',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/registro/registro.page').then((m) => m.RegistroPage),
  },
  {
    path: 'mostrador',
    title: 'Mostrador · Carnicería',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/mostrador.page').then((m) => m.MostradorPage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'mostrador' },
  { path: '**', redirectTo: 'mostrador' },
];
