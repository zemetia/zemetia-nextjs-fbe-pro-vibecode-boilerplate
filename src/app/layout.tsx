import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Inter, JetBrains_Mono } from 'next/font/google';

import { Toaster } from '@/components/ui/Sonner';
import { PostHogProvider, QueryProvider, SessionProvider, ThemeProvider } from '@/providers';
import { siteConfig } from '@/config/site';
import { parseThemeCookie, resolveTheme, THEME_COOKIE } from '@/lib/theme';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: {
    template: siteConfig.seo.titleTemplate,
    default: siteConfig.seo.defaultTitle,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read the persisted preference so <html> carries the right class on the
  // very first paint — otherwise the page flashes light before hydration.
  const cookieStore = await cookies();
  const resolved = resolveTheme(parseThemeCookie(cookieStore.get(THEME_COOKIE)?.value));

  return (
    <html
      lang="id"
      className={`${inter.variable} ${jetbrainsMono.variable} ${resolved === 'dark' ? 'dark' : ''}`}
      suppressHydrationWarning
    >
      <body>
        <QueryProvider>
          <SessionProvider>
            <ThemeProvider>
              <PostHogProvider>{children}</PostHogProvider>
              <Toaster theme={resolved} />
            </ThemeProvider>
          </SessionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
