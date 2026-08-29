import Image from 'next/image';

import { cn } from '@/lib/cn';

export interface LogoProps {
  /** Rendered edge length in px — the mark is square. */
  size?: number;
  className?: string;
  /** Set on the app shell instance; the mark sits above the fold there. */
  priority?: boolean;
}

/** Brand mark PT TAN — gold on transparent, so it reads on light and dark surfaces. */
export function Logo({ size = 32, className, priority = false }: LogoProps) {
  return (
    <Image
      src="/logo/logo-tan.png"
      alt="Logo PT TAN"
      width={size}
      height={size}
      priority={priority}
      className={cn('shrink-0 object-contain select-none', className)}
    />
  );
}

Logo.displayName = 'Logo';
