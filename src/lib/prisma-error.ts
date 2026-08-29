/**
 * Duck-typed Prisma error probes. Kept structural on purpose — importing
 * `Prisma.PrismaClientKnownRequestError` pulls the client runtime into modules
 * that only need to know "was this the unique constraint?".
 */

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const { code } = error as { code: unknown };
  return typeof code === 'string' ? code : undefined;
}

/** P2002 — unique constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
  return errorCode(error) === 'P2002';
}

/** P2003 — foreign key constraint violation. */
export function isForeignKeyViolation(error: unknown): boolean {
  return errorCode(error) === 'P2003';
}
