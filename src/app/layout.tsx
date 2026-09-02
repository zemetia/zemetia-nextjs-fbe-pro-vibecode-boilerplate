import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Inter, JetBrains_Mono, Outfit } from 'next/font/google';

import Script from 'next/script';

import { Toaster } from '@/components/ui/Sonner';
import { PostHogProvider, QueryProvider, SessionProvider, ThemeProvider, StorageInitProvider } from '@/providers';
import { siteConfig } from '@/config/site';
import { parseThemeCookie, resolveTheme, THEME_COOKIE } from '@/lib/theme';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  weight: ['500', '600', '700', '800'],
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
  const cookieStore = await cookies();
  const resolved = resolveTheme(parseThemeCookie(cookieStore.get(THEME_COOKIE)?.value)) || 'dark';

  return (
    <html
      lang="id"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable} ${resolved === 'dark' ? 'dark' : ''}`}
      suppressHydrationWarning
    >
      <body>
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" strategy="beforeInteractive" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js" strategy="beforeInteractive" />
        <QueryProvider>
          <SessionProvider>
            <ThemeProvider>
              <PostHogProvider>
                <StorageInitProvider>{children}</StorageInitProvider>
              </PostHogProvider>
              <Toaster theme={resolved} />
            </ThemeProvider>
          </SessionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
