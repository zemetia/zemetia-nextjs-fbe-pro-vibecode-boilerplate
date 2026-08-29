export interface PermissionVO {
  id: string;
  resource: string;
  action: string;
  key: string;
  endpoint: string;
  description: string;
  label: string;
}

export interface PermissionGroupVO {
  resource: string;
  resourceLabel: string;
  permissions: PermissionVO[];
}

export interface PermissionModuleVO {
  module: string;
  moduleLabel: string;
  groups: PermissionGroupVO[];
}
