# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Angular 20 front end for `carniceria`, a multi-tenant butcher shop management system. The Spring Boot backend lives in a **separate repo** at `D:/ProgramaCarniceria/Carniceria` and has its own `CLAUDE.md` documenting the API, the role model and the tenant rules — read it before changing anything that touches the contract.

UI text, comments and commit messages are in **Spanish**; this file and identifiers are in English.

## Commands

```bash
npm start                                             # dev server on 4200
npm run build
npx ng test --watch=false --browsers=ChromeHeadless   # the 16 unit tests
```

`npm test` alone opens a real Chrome and stays watching, which hangs a non-interactive run — always pass `--watch=false --browsers=ChromeHeadless`.

The dev server needs the backend up on `http://localhost:8080`. `ng serve` proxies everything under `/api` there (`proxy.conf.json`). It is a proxy rather than direct calls **because the backend configures no CORS**: same-origin means no preflight to fail. If the backend moves ports, that file is the only place to change.

## Architecture

Standalone components, signals, functional guards and lazy `loadComponent` routes. No NgModules anywhere — don't introduce one.

```
src/app/
  core/auth/    session, JWT decoding, guards, interceptor
  core/http/    backend error codes → Spanish messages
  features/     one folder per screen, plus auth/ and shell/
```

Each feature folder holds its own `*.service.ts` and models; there is no shared data layer beyond `core/`. Components use `ChangeDetectionStrategy.OnPush` and hold state in `signal`s, with `computed` for anything derived.

## The session is the JWT

`AuthService` keeps **only the token** in `localStorage` and rebuilds the session from it on boot, so the stored data can never drift from the claims. Tokens last one hour; an expired one is discarded at startup.

`authInterceptor` signs every request with `Authorization` and **`X-Company`**, taking the slug from the token claim — never from config or user input, because that header is what the backend scopes queries by.

Two consequences that are easy to break:

- **Support has no company.** A `developer` token carries no `X-Company`/`branch` claims, so `companySlug` and `branchId` are `null` and the interceptor omits the header entirely. `sessionFromJwt` accepts that on purpose; it only rejects a token with no `sub`. Anything reading those fields must handle null — the three screens that register movements (sales, entries, waste) bail out when `sucursalId` is missing, since there is no branch to book against.
- **The company is remembered per device, not per session.** `logout()` clears the token but keeps the last slug, so a counter terminal pre-fills its own carnicería and only the employee key and password get typed each day. Login leaves `empresa` optional: blank is how support signs in.

## Roles decide what is drawn, not what is allowed

`auth.esGestion()` and `auth.esSoporte()` filter rail sections and hide buttons. That is courtesy so nobody is offered an action that will 403 — **the backend's `@PreAuthorize` is the actual gate**. Never move a rule into the front end only.

The rail (`features/shell/app-shell.ts`) marks gestion-only sections with `soloGestion`. When adding one, check the matching endpoint's role in the backend's `config/Roles`, and don't link to a section the current role cannot open (the mostrador's "por cobrar" notice is gated for exactly that reason).

## Errors

`core/http/api-error.ts` maps the `code` of the backend's `CustomErrorResponse` to a Spanish sentence — by code, which is stable, not by `message`, which changes with the Java exception. When the backend gains an `@ExceptionHandler`, add its code here.

One subtlety: a 5xx **with** a body is a real server fault, one **without** is the `ng serve` proxy failing to reach the backend, and they say different things. Don't collapse those two branches.

## Design system

Direction is "Mostrador": glazed tile, cold steel, a single red ink. Tokens live in `src/styles.scss` as CSS variables with Spanish names — `--azulejo` (tile), `--acero` (steel/text), `--sangre` (the one accent), `--rotulo`/`--texto`/`--dato` (display/body/mono), `--toque` (52px minimum control height, these are used in a hurry).

Red means one thing: action, focus, error, loss. Don't spend it on decoration. Figures are right-aligned with `font-variant-numeric: tabular-nums` so they can be compared at a glance; kilos show decimals and pieces don't, because one is weighed and the other counted.

**Shared styles are global, and must stay global.** `src/styles/_acceso.scss` (form controls) and `_tabla.scss` (list header, table, empty state, side panel) are loaded once from `styles.scss`. A component that does `@use 'acceso'` gets Sass to copy the whole partial into its scoped sheet — six copies of the same CSS, and one page already blew the budget that way. Component stylesheets should hold only what is theirs.

List screens all follow the same shape: `.encabezado` with a one-line summary, `.filtro`, `.libreta` wrapping a table that scrolls inside itself, and a `.panel` sliding in for create/edit. Empty states are written as an invitation to act, and change text depending on whether the reader is allowed to act.

## Traps already hit

- **`autofocus` does nothing here.** The attribute only acts while the HTML is parsed, and these pages are painted when a route resolves. Focus programmatically inside `afterNextRender`; the same applies to anything reading `aria-invalid`, which the template only paints after controls are marked as touched.
- **`auth.perfil()` is shared with `shareReplay`** because nearly every screen needs it. It carries `empleadoId`, which registering a sale, entry or waste requires and which a `vendedor` cannot get anywhere else (`/api/employees` is gestion-only).
- Angular's strict typed forms won't resolve `.get()` across a union of differently-shaped groups — cast to `FormGroup` (see `registro.page.ts`).

## State

Every backend endpoint has a screen. Sections: mostrador (daily cut), ventas, fiado, inventario, entradas, mermas, productos, clientes, lotes, sucursales, personal, and soporte for the `developer` role, which sees only that one.

Tests cover `jwt.ts` and `api-error.ts` — the two pieces with real logic and no backend needed. Screens are verified by driving the running app against the real API, not by component tests.

Known gaps: no screen edits the company's own data (`PUT /api/companies/{id}` exists), product removal calls a hard `DELETE` so a sold product takes its history with it, and `Product.active` is never set false by any endpoint.

## Git

The repo is on `main` with no remote configured yet. Commit messages are in Spanish, and the working tree is CRLF — commits are made with `git -c core.autocrlf=false` to keep LF in the objects.
