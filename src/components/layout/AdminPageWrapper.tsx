'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { getRouteForPageId } from '@/config/page-routes';

interface AdminPageWrapperProps {
  children: (props: { setActivePage: (pageId: string) => void }) => React.ReactNode;
}

export function AdminPageWrapper({ children }: AdminPageWrapperProps) {
  const router = useRouter();

  const setActivePage = (pageId: string) => {
    if (!pageId) return;
    const targetRoute = getRouteForPageId(pageId);
    router.push(targetRoute as Route);
  };

  return <>{children({ setActivePage })}</>;
}
