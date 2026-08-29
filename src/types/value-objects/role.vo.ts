export interface RoleVO {
  id: string;
  name: string;
  slug: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
  createdAt: string;
}

export interface RoleDetailVO extends RoleVO {
  permissionKeys: string[];
}

export interface RoleListVO {
  items: RoleVO[];
  total: number;
  page: number;
  pageSize: number;
  isEmpty: boolean;
}

export interface RoleOptionVO {
  value: string;
  label: string;
  disabled?: boolean;
}
