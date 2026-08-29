import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { FrameworkListDTO } from '@/types/dtos';

export const runtime = 'edge';

const FRAMEWORKS: FrameworkListDTO['data'] = [
  { id: 'nextjs', display_name: 'Next.js' },
  { id: 'sveltekit', display_name: 'SvelteKit' },
  { id: 'nuxt', display_name: 'Nuxt' },
  { id: 'remix', display_name: 'Remix' },
  { id: 'astro', display_name: 'Astro' },
  { id: 'vue', display_name: 'Vue' },
  { id: 'angular', display_name: 'Angular' },
  { id: 'solidstart', display_name: 'SolidStart' },
];

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = querySchema.safeParse({ q: searchParams.get('q') ?? undefined });

  if (!result.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }

  const { q } = result.data;
  const data = q
    ? FRAMEWORKS.filter((f) => f.display_name.toLowerCase().includes(q.toLowerCase()))
    : FRAMEWORKS;

  return NextResponse.json<FrameworkListDTO>({ data });
}
