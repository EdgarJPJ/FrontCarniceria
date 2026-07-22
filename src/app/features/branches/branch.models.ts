export interface Branch {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  active: boolean;
  createdAt: string;
}

export interface BranchRequest {
  name: string;
  address: string;
  phone: string;
}
