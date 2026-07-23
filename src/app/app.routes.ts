import { inject } from '@angular/core';
import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guard';
import { AuthService } from './core/auth/auth.service';

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
        loadComponent: () => import('./features/shell/mostrador.page').then((m) => m.MostradorPage),
      },
      {
        path: 'ventas',
        title: 'Ventas · Carnicería',
        loadComponent: () => import('./features/sales/sales.page').then((m) => m.SalesPage),
      },
      {
        path: 'entradas',
        title: 'Entradas · Carnicería',
        loadComponent: () => import('./features/movements/entries.page').then((m) => m.EntriesPage),
      },
      {
        path: 'mermas',
        title: 'Mermas · Carnicería',
        loadComponent: () => import('./features/movements/waste.page').then((m) => m.WastePage),
      },
      {
        path: 'inventario',
        title: 'Inventario · Carnicería',
        loadComponent: () =>
          import('./features/inventory/inventory.page').then((m) => m.InventoryPage),
      },
      {
        path: 'clientes',
        title: 'Clientes · Carnicería',
        loadComponent: () => import('./features/clients/clients.page').then((m) => m.ClientsPage),
      },
      {
        path: 'sucursales',
        title: 'Sucursales · Carnicería',
        loadComponent: () =>
          import('./features/branches/branches.page').then((m) => m.BranchesPage),
      },
      /*
       * Personal y lotes son de gestión. El guard evita entrar por URL escrita
       * a mano; el backend responde 403 igual, esto solo ahorra el viaje.
       */
      {
        path: 'personal',
        title: 'Personal · Carnicería',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/employees/employees.page').then((m) => m.EmployeesPage),
      },
      {
        path: 'lotes',
        title: 'Lotes · Carnicería',
        loadComponent: () => import('./features/batches/batches.page').then((m) => m.BatchesPage),
      },
      {
        path: 'soporte',
        title: 'Soporte · Carnicería',
        loadComponent: () => import('./features/support/support.page').then((m) => m.SupportPage),
      },
      /*
       * El soporte no atiende un mostrador: su punto de partida es la lista de
       * carnicerías. Se decide al vuelo porque depende de quién abrió turno.
       */
      {
        path: '',
        pathMatch: 'full',
        redirectTo: () => (inject(AuthService).esSoporte() ? 'soporte' : 'mostrador'),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
