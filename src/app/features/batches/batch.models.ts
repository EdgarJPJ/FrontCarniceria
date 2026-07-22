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

export interface BatchRequest {
  description: string;
  totalWeight: number | null;
  totalPrice: number | null;
  branchId: number;
}

/**
 * Reporte de merma del lote. `butcheringLoss` es lo que se perdió al
 * despiezar la canal; `handlingWaste` lo que se perdió después, ya en
 * mostrador, y que no se registró como merma manual.
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
}
