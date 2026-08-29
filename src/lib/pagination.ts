import type { PaginatedDTO } from '@/types/dtos';

/**
 * Server-side pagination helpers for route handlers. Pair them with a query
 * schema built from `paginationSchema` (`@/lib/validations`):
 *
 * ```ts
 * const query = parseListQuery(request, userListQuerySchema);
 * const { skip, take } = toPageWindow(query);
 *
 * const [rows, total] = await Promise.all([
 *   prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'asc' } }),
 *   prisma.user.count({ where }),
 * ]);
 *
 * return NextResponse.json(buildPaginatedDTO(rows, total, query, toUserDTO));
 * ```
 *
 * The client-side half lives in `@/services/pagination`.
 */

export interface PageInput {
  page: number;
  limit: number;
}

export interface PageWindow extends PageInput {
  skip: number;
  take: number;
}

/** Turns a validated `{ page, limit }` into Prisma's `skip`/`take`. */
export function toPageWindow({ page, limit }: PageInput): PageWindow {
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

/**
 * Reads the request's query string and validates it with the route's own
 * schema. Blank values are dropped first, so `?q=` or `?page=` behaves like an
 * omitted param instead of failing coercion — a browser submitting an empty
 * search box shouldn't produce a 400.
 *
 * A `ZodError` here is already handled by `handleApiError` as a 400.
 */
export function parseListQuery<T>(
  request: Request,
  schema: { parse: (value: unknown) => T },
): T {
  const { searchParams } = new URL(request.url);
  const entries = Array.from(searchParams.entries()).filter(([, value]) => value !== '');
  return schema.parse(Object.fromEntries(entries));
}

/**
 * Wraps mapped rows in the paginated envelope. `total` is the unpaginated count
 * — pass the `prisma.<model>.count()` result, not `rows.length`.
 */
export function buildPaginatedDTO<TRow, TItem>(
  rows: TRow[],
  total: number,
  { page, limit }: PageInput,
  toDTO: (row: TRow) => TItem,
): PaginatedDTO<TItem> {
  return {
    data: rows.map(toDTO),
    total,
    page,
    page_size: limit,
    total_pages: Math.ceil(total / limit),
  };
}
