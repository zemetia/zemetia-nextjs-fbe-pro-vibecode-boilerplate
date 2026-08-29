import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validations';

/**
 * How long the JWT's permission snapshot may lag the database. It drives nav
 * visibility and disabled buttons only — never a server-side gate — so a short
 * window costs nothing but a stale menu item, while re-reading on every request
 * would put a query in front of every page load.
 */
const PERMISSION_SNAPSHOT_TTL_MS = 5 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/sign-in',
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const u = user as {
          id: string;
          roleId: string;
          roleName: string;
          roleSlug: string;
          permissions: string[];
        };
        token.id = u.id;
        token.roleId = u.roleId;
        token.roleName = u.roleName;
        token.roleSlug = u.roleSlug;
        token.permissions = u.permissions;
        token.permissionsSyncedAt = Date.now();
        return token;
      }

      // The snapshot was written once at sign-in and would otherwise stay frozen
      // for the life of the token. That is how a role granted a new module's
      // permissions — or a whole new module seeded into the catalog — stays
      // invisible in the sidebar until the user happens to sign in again.
      //
      // It is refreshed on a timer rather than on every call because this
      // callback runs on every `auth()`, including the middleware on each page
      // request. Being a few minutes stale is harmless: the snapshot is a UI
      // hint only, and `requirePermission()` always re-reads the database.
      const syncedAt = typeof token.permissionsSyncedAt === 'number' ? token.permissionsSyncedAt : 0;
      const isStale = Date.now() - syncedAt > PERMISSION_SNAPSHOT_TTL_MS;

      if (typeof token.id === 'string' && (trigger === 'update' || isStale)) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            isActive: true,
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
                rolePermissions: { select: { permission: { select: { key: true } } } },
              },
            },
          },
        });

        // A user deactivated mid-session keeps a valid token until it expires,
        // so strip the permissions rather than leaving the old set in place.
        if (!fresh || !fresh.isActive) {
          token.permissions = [];
        } else {
          token.roleId = fresh.role.id;
          token.roleName = fresh.role.name;
          token.roleSlug = fresh.role.slug;
          token.permissions = fresh.role.rolePermissions.map((rp) => rp.permission.key);
        }

        token.permissionsSyncedAt = Date.now();
      }

      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.roleId = token.roleId as string;
      session.user.roleName = token.roleName as string;
      session.user.roleSlug = token.roleSlug as string;
      session.user.permissions = (token.permissions as string[]) ?? [];
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            password: true,
            isActive: true,
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
                rolePermissions: { select: { permission: { select: { key: true } } } },
              },
            },
          },
        });
        // Deactivated accounts keep their row (and audit trail) but cannot sign in.
        if (!user?.password || !user.isActive) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          roleId: user.role.id,
          roleName: user.role.name,
          roleSlug: user.role.slug,
          permissions: user.role.rolePermissions.map((rp) => rp.permission.key),
        };
      },
    }),
  ],
});
