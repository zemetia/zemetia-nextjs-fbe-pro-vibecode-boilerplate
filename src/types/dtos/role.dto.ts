export interface RoleDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  user_count: number;
  permission_count: number;
  created_at: string;
  updated_at: string;
}

export interface RoleDetailDTO extends RoleDTO {
  permission_keys: string[];
}

export interface RoleListDTO {
  data: RoleDTO[];
  total: number;
  page: number;
  page_size: number;
}
