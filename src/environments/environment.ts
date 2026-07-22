export const environment = {
  production: true,
  /**
   * En producción el front se sirve detrás del mismo host que la API,
   * así que las rutas van relativas. Si se despliegan por separado,
   * poner aquí el origen completo del backend.
   */
  apiUrl: '/api',
};
