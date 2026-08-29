import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Typography } from '@/components/ui/Typography';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

const STACK_ITEMS = [
  'Next.js 16',
  'React 19',
  'TypeScript',
  'Tailwind v4',
  'Zustand',
  'Storybook 8',
  'Vitest',
] as const;

const FEATURES = [
  {
    key: 'components',
    badge: 'CVA + Tailwind',
    title: 'Komponen Ketat',
    description:
      'Setiap komponen ada di direktorinya sendiri dengan tipe TypeScript penuh, varian CVA, dan cerita Storybook.',
  },
  {
    key: 'storybook',
    badge: 'Storybook 8',
    title: 'Storybook 8',
    description:
      'Kembangkan dan dokumentasikan komponen secara terisolasi dengan pengujian a11y dan docs otomatis.',
  },
  {
    key: 'services',
    badge: 'Typed Fetch',
    title: 'Lapisan Layanan',
    description: 'Klien fetch yang diketik dengan penanganan kesalahan, hints caching, dan interceptors.',
  },
  {
    key: 'testing',
    badge: 'Vitest + RTL',
    title: 'Vitest + RTL',
    description: 'Pengujian komponen dengan Testing Library. Laporan cakupan. Tanpa konfigurasi Jest yang rumit.',
  },
  {
    key: 'typescript',
    badge: 'Strict Mode',
    title: 'TypeScript Ketat',
    description: 'noUncheckedIndexedAccess, noImplicitReturns, consistent-type-imports dan lainnya.',
  },
] as const;

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        {/* Hero */}
        <section className="container-page flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center py-24 text-center">
          <Badge variant="secondary" className="mb-6">
            Template Siap Produksi
          </Badge>

          <Typography
            variant="h1"
            className="mb-6 max-w-3xl text-balance bg-gradient-to-b from-foreground to-foreground-muted bg-clip-text text-transparent"
            style={{ whiteSpace: 'pre-line' }}
          >
            {'Bangun cepat.\nRilis dengan percaya diri.'}
          </Typography>

          <Typography variant="lead" className="mb-10 max-w-xl text-foreground-muted">
            Template Next.js 16 yang ketat dengan TypeScript, arsitektur berbasis komponen, Storybook, dan
            lapisan layanan yang bersih.
          </Typography>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button size="lg">Mulai</Button>
            <Button size="lg" variant="outline">
              Lihat Kode
            </Button>
          </div>

          {/* Ambient glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          >
            <div
              className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-3xl"
              style={{ background: 'var(--color-primary)' }}
            />
          </div>
        </section>

        {/* Features */}
        <section className="container-page py-24">
          <div className="mb-12 text-center">
            <Typography variant="h2" className="mb-3">
              Semua sudah termasuk
            </Typography>
            <Typography variant="lead" className="text-foreground-muted">
              Fondasi yang benar-benar ingin Anda bangun
            </Typography>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ key, badge, title, description }) => (
              <Card key={key} className="border-gradient transition-shadow hover:shadow-lg">
                <CardHeader>
                  <Badge variant="outline" className="mb-2 w-fit text-xs">
                    {badge}
                  </Badge>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            ))}
          </div>
        </section>

        {/* Stack */}
        <section className="container-page pb-24">
          <Typography variant="h3" className="mb-8 text-center text-foreground-muted">
            Tumpukan Teknologi
          </Typography>
          <div className="flex flex-wrap justify-center gap-3">
            {STACK_ITEMS.map((label) => (
              <span
                key={label}
                className="rounded-full border border-border bg-surface px-4 py-1.5 font-mono text-sm font-medium text-foreground-muted shadow-xs"
              >
                {label}
              </span>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
