/** La respuesta nunca trae contraseña, ni hasheada. */
export interface Employee {
  id: number;
  name: string;
  username: string;
  phone: string | null;
  active: boolean;
  createdAt: string;
  roleId: number;
  roleName: string;
  branchId: number;
  branchName: string;
}

export interface EmployeeRequest {
  name: string;
  username: string;
  password: string;
  phone: string;
  idRole: number;
  idBranch: number;
}

/** La edición no lleva contraseña: cambiarla es otra operación. */
export interface EmployeeUpdateRequest {
  name: string;
  phone: string;
  idRole: number;
  idBranch: number;
}

export interface Role {
  id: number;
  name: string;
}
