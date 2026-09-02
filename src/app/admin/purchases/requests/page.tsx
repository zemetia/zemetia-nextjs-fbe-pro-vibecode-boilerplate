'use client';

import dynamic from 'next/dynamic';
import { AdminPageWrapper } from '@/components/layout/AdminPageWrapper';

interface PageViewProps {
  setActivePage: (pageId: string) => void;
}

const View = dynamic<PageViewProps>(() => import('@/views/PurchaseRequestPage'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center">
      <div className="flex items-center gap-2 text-fg-soft font-medium">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        <span>Memuat modul...</span>
      </div>
    </div>
  ),
});

export default function Page() {
  return (
    <AdminPageWrapper>
      {({ setActivePage }) => <View setActivePage={setActivePage} />}
    </AdminPageWrapper>
  );
}
