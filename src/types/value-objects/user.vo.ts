export interface UserVO {
  id: string;
  name: string;
  email: string;
  image: string | null;
  initials: string;
  roleId: string;
  roleName: string;
  roleSlug: string;
  isActive: boolean;
  statusLabel: string;
  createdAt: string;
}

export interface UserListVO {
  items: UserVO[];
  total: number;
  page: number;
  pageSize: number;
  isEmpty: boolean;
}
