export interface Batch {
  id: number;
  date: string;
  description: string | null;
  totalWeight: number | null;
  totalPrice: number | null;
  createdAt: string;
  branchId: number;
  branchName: string;
}

/**
 * Para elegir canal al registrar una entrada o una merma: sin peso ni costo,
 * que es información de gestión. `despieceTerminado` sí viaja porque no
 * revela ninguna cifra, solo si ya se marcó la última entrada de esa canal.
 */
export interface BatchOption {
  id: number;
  description: string | null;
  branchId: number;
  branchName: string;
  despieceTerminado: boolean;
}

export interface BatchRequest {
  description: string;
  totalWeight: number | null;
  totalPrice: number | null;
  branchId: number;
}

/**
 * Reporte de merma del lote. `butcheringLoss` es lo que se perdió al
 * despiezar la canal; `handlingWaste` es lo que salió del despiece y todavía
 * no se vendió ni se reportó como merma: mientras la canal está abierta eso
 * es lo que queda en el mostrador, y sólo cuando ya no debería quedar nada
 * se lee como pérdida sin explicar.
 *
 * `medible` es falso cuando falta el peso de compra o ninguna entrada de
 * inventario está ligada a la canal: entonces las restas no significan nada
 * y el backend las devuelve en cero.
 */
export interface BatchReport {
  batchId: number;
  description: string | null;
  branchId: number;
  date: string;
  weightPurchased: number;
  weightProduced: number;
  weightSold: number;
  weightManualWaste: number;
  butcheringLoss: number;
  handlingWaste: number;
  /** Cuántas entradas de inventario se registraron contra esta canal. */
  entryCount: number;
  medible: boolean;
  /** Verdadero cuando se marcó la última entrada de despiece de esta canal. */
  despieceTerminado: boolean;
  /** Ya calculado por el backend, con la tolerancia de captura incluida. */
  agotado: boolean;
  /** Lo que se pagó por la canal completa. */
  totalCost: number;
  /**
   * Suma de lo vendido de esta canal en pesos, ya con el precio propio de
   * cada corte en que se convirtió al despiezarla. Cero cuando no es
   * `medible`.
   */
  revenueSold: number;
  /** `revenueSold - totalCost`. Cero cuando no es `medible`. */
  profit: number;
}

/** Cómo está una canal según lo que queda de ella. */
export type EstadoCanal = 'agotada' | 'abierta' | 'sin-despiezar' | 'sin-datos';
