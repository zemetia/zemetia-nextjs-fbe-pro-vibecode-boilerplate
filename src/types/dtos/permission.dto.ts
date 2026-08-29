export interface PermissionDTO {
  id: string;
  resource: string;
  action: string;
  key: string;
  description: string | null;
}

export interface PermissionListDTO {
  data: PermissionDTO[];
}
