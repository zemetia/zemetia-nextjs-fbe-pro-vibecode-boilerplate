/**
 * Client-ready counterpart of `PaginatedDTO` — camelCase, with the booleans a
 * table/pager needs already derived so components never compute them in JSX.
 * Domain list VOs alias this:
 *
 * ```ts
 * export type UserListVO = PaginatedVO<UserVO>;
 * ```
 */
export interface PaginatedVO<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  isEmpty: boolean;
}
