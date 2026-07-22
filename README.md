# FrontCarniceria

Frontend Angular 20 del sistema de carnicería. El backend Spring Boot vive
aparte, en `../Carniceria`.

## Levantarlo

```bash
npm start
```

Queda en `http://localhost:4200`. Necesita el backend corriendo en
`http://localhost:8080`: `ng serve` reenvía todo lo que empiece con `/api`
hacia allá (ver `proxy.conf.json`). Se hace con proxy porque el backend
todavía no configura CORS — así el navegador ve un solo origen y no hay
preflight que falle. Si el backend cambia de puerto, se ajusta ahí.

Otros comandos:

```bash
npm run build                                   # compila a dist/
npx ng test --watch=false --browsers=ChromeHeadless   # pruebas unitarias
```

## Cómo está armado

```
src/app/
  core/
    auth/      sesión, guards e interceptor
    http/      traducción de errores del backend a español
  features/
    auth/login/   pantalla de inicio de sesión
    shell/        marcador de posición del mostrador
```

Standalone components, signals y guards funcionales — sin NgModules. Las
rutas cargan en diferido con `loadComponent`.

## Lo que hay que saber de la sesión

El login pega a `POST /api/auth/login` y recibe un JWT. **De ese token sale
todo lo demás**: `AuthService` lo decodifica y guarda el usuario, el slug de
la empresa (claim `X-Company`), la sucursal (claim `branch`) y los roles.

`authInterceptor` firma cada petición posterior con dos cabeceras:

- `Authorization: Bearer <jwt>`
- `X-Company: <slug>` — obligatoria. Sin ella `CompanyHeaderFilter` responde
  400 en todo lo que no sea el login.

El slug se toma siempre del claim del token, nunca de una configuración del
front, para que no se pueda apuntar a otra empresa desde el navegador.

En `localStorage` se guarda únicamente el JWT y la sesión se reconstruye al
arrancar, así los datos nunca quedan desfasados del token. El backend lo
emite con **una hora** de vigencia; al vencer, el turno se descarta solo.

## Errores

`core/http/api-error.ts` mapea el `code` de `CustomErrorResponse` a un mensaje
en español. Los que ya están cubiertos: credenciales incorrectas, suscripción
suspendida (`SUBSCRIPTION_EXPIRED`), permisos, validación y backend caído.
Al agregar un `@ExceptionHandler` nuevo en el backend, conviene agregar aquí
su `code`.
