import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      /** Snapshot for UI hints only (e.g. hiding a nav link); refreshed periodically. */
      roleId: string;
      roleName: string;
      roleSlug: string;
      /** Stale-tolerant — never authoritative. Use requirePermission() server-side. */
      permissions: string[];
    } & DefaultSession['user'];
  }
  interface User {
    roleId?: string;
    roleName?: string;
    roleSlug?: string;
    permissions?: string[];
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id?: string;
    roleId?: string;
    roleName?: string;
    roleSlug?: string;
    permissions?: string[];
    /**
     * Epoch ms of the last re-read from the database. Without it the snapshot
     * written at sign-in would live as long as the token, so a role granted new
     * permissions stays invisible until the user signs in again.
     */
    permissionsSyncedAt?: number;
  }
}
