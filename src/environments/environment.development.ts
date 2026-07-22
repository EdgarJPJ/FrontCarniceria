export const environment = {
  production: false,
  /**
   * En desarrollo las peticiones a /api las reenvía el proxy de `ng serve`
   * al Spring Boot local (ver proxy.conf.json). Se hace así porque el
   * backend todavía no configura CORS: para el navegador todo sale del
   * mismo origen y no hay preflight que falle.
   */
  apiUrl: '/api',
};
