import type { PaginatedDTO } from '@/types/dtos';
import type { PaginatedVO } from '@/types/value-objects';

/**
 * Service-side pagination helpers — the client half of `@/lib/pagination`.
 * Every list method in `src/services/` should be expressible as:
 *
 * ```ts
 * export type UserListParams = ListParams;
 *
 * export const userService = {
 *   list: async (params?: UserListParams): Promise<UserListVO> =>
 *     toPaginatedVO(
 *       await apiClient.get<UserListDTO>(`/api/users${buildListQuery(params)}`, {
 *         cache: 'no-store',
 *       }),
 *       toVO,
 *     ),
 * };
 * ```
 */

export type QueryValue = string | number | boolean | undefined | null;

/**
 * Params accepted by every list service. Extend per domain with extra filters:
 *
 * ```ts
 * export type InvoiceListParams = ListParams & { status?: InvoiceStatus };
 * ```
 *
 * Declare those as a `type` alias, not an `interface` — only type aliases get
 * TypeScript's implicit index signature, which `buildListQuery` needs.
 */
export type ListParams = {
  page?: number;
  limit?: number;
  q?: string;
};

/**
 * Serializes list params into a query string, skipping values that aren't set
 * so a cleared filter never reaches the API as a blank `&q=`. Returns an empty
 * string when nothing is set, making it safe to interpolate unconditionally.
 */
export function buildListQuery(params?: Record<string, QueryValue>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

/** Maps a paginated DTO envelope to its VO, deriving the pager booleans. */
export function toPaginatedVO<TDTO, TVO>(
  dto: PaginatedDTO<TDTO>,
  toVO: (item: TDTO) => TVO,
): PaginatedVO<TVO> {
  return {
    items: dto.data.map(toVO),
    total: dto.total,
    page: dto.page,
    pageSize: dto.page_size,
    totalPages: dto.total_pages,
    hasPrevPage: dto.page > 1,
    hasNextPage: dto.page < dto.total_pages,
    isEmpty: dto.data.length === 0,
  };
}
