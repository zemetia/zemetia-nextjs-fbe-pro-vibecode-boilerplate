import { defineConfig } from 'prisma/config';

// prisma.config.ts is evaluated directly by the Prisma CLI, outside of
// Next.js's own env loading — load .env explicitly so `prisma migrate`/`db:seed`
// see DATABASE_URL without requiring it to be exported in the shell.
try {
  process.loadEnvFile();
} catch {
  // No .env file (e.g. CI, where env vars are injected directly) — fine.
}

export default defineConfig({
  schema: './prisma/schema',
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
