import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env['SENTRY_ORG'],
  project: process.env['SENTRY_PROJECT'],
  // Suppress non-error output unless in CI
  silent: !process.env['CI'],
  widenClientFileUpload: true,
  webpack: {
    reactComponentAnnotation: { enabled: true },
    treeshake: { removeDebugLogging: true },
  },
  // Proxy Sentry requests through Next.js to avoid ad-blockers
  tunnelRoute: '/monitoring',
  sourcemaps: { disable: process.env['NODE_ENV'] !== 'production' },
});
