/**
 * Runs `task` over `items` with a bounded number of queries in flight.
 *
 * Reference-data seeders push hundreds of rows: firing them all through a single
 * `Promise.all` exhausts the Prisma connection pool and trips its acquire
 * timeout, while a plain `for` loop pays one full round trip per row. Batching
 * keeps both in check.
 */
export async function mapInBatches<T, R>(
  items: readonly T[],
  task: (item: T) => Promise<R>,
  size = 20,
): Promise<R[]> {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += size) {
    results.push(...(await Promise.all(items.slice(index, index + size).map(task))));
  }

  return results;
}
