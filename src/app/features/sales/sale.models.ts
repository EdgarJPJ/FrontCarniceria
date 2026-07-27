export interface SaleDetail {
  id: number;
  productId: number;
  productName: string;
  batchId: number | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Sale {
  id: number;
  clientId: number | null;
  clientName: string | null;
  branchId: number;
  employeeId: number;
  /** Quién la cobró. Viene en la respuesta porque un vendedor no puede
   *  consultar /api/employees para resolverlo. */
  employeeName: string | null;
  paymentMethodId: number | null;
  paymentMethodName: string | null;
  date: string;
  subtotal: number;
  discount: number;
  total: number;
  status: 'ACTIVA' | 'CANCELADA';
  paymentStatus: 'PAGADO' | 'PARCIAL' | 'PENDIENTE';
  details: SaleDetail[];
}

export interface SaleRequest {
  clientId: number | null;
  branchId: number;
  employeeId: number;
  paymentMethodId: number | null;
  discount: number;
  details: { productId: number; quantity: number }[];
  /** Solo gestión puede mandarla en true: registra la venta aunque deje al cliente por encima de su límite. */
  overrideCreditLimit: boolean;
}

export interface PaymentMethod {
  id: number;
  name: string;
}

export interface PaymentRequest {
  saleId: number;
  paymentMethodId: number | null;
  amount: number;
  note: string;
}

export interface Payment {
  id: number;
  saleId: number;
  paymentMethodId: number | null;
  paymentMethodName: string | null;
  amount: number;
  date: string;
  note: string | null;
  remainingBalance: number | null;
}
