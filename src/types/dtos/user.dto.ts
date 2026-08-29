export interface UserDTO {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: { id: string; name: string; slug: string };
  is_active: boolean;
  created_at: string;
}

export interface UserListDTO {
  data: UserDTO[];
  total: number;
  page: number;
  page_size: number;
}
