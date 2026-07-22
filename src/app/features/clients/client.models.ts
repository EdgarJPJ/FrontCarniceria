/** Contrato con `/api/clients`. */

export interface Client {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  creditLimit: number;
  creditDays: number;
  active: boolean;
  createdAt: string;
}

export interface ClientRequest {
  name: string;
  phone: string;
  address: string;
  creditLimit: number;
  creditDays: number;
}
