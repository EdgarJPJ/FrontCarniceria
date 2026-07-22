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

  // Todo lo que exige turno abierto cuelga del armazón con el riel.
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: 'mostrador',
        title: 'Mostrador · Carnicería',
        loadComponent: () =>
          import('./features/shell/mostrador.page').then((m) => m.MostradorPage),
      },
      {
        path: 'clientes',
        title: 'Clientes · Carnicería',
        loadComponent: () =>
          import('./features/clients/clients.page').then((m) => m.ClientsPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'mostrador' },
    ],
  },
  { path: '**', redirectTo: '' },
];
