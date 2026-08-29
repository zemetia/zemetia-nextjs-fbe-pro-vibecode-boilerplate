/**
 * Envelope returned by every paginated list endpoint. Domain list DTOs alias
 * this instead of redeclaring the fields:
 *
 * ```ts
 * export type UserListDTO = PaginatedDTO<UserDTO>;
 * ```
 */
export interface PaginatedDTO<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
