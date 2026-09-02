// @ts-nocheck
'use client';

import { useEffect, useState, type ReactNode } from 'react';

export function StorageInitProvider({ children }: { children: ReactNode }) {
  const [_initialized, setInitialized] = useState(false);

  useEffect(() => {
    Promise.all([
      import('../../data/storage.js'),
      import('../../modules/auth.js'),
      import('../../modules/_validators.js'),
      import('../../modules/purchaseOrder.js'),
      import('../../modules/paymentVoucher.js'),
      import('../../modules/receiptVoucher.js'),
      import('../../modules/journalEntry.js'),
      import('../../modules/generalLedger.js'),
      import('../../modules/incomeStatement.js'),
      import('../../modules/balanceSheet.js'),
      import('../../modules/cashFlow.js'),
      import('../../modules/journalReport.js'),
      import('../../modules/balanceReports.js'),
      import('../../modules/finalReports.js'),
      import('../../modules/pdfExporter.js'),
    ])
      .then(() => {
        const win = typeof window !== 'undefined' ? (window as unknown as { Storage?: { init: () => void } }) : null;
        if (win?.Storage?.init) {
          win.Storage.init();
        }
        setInitialized(true);
      })
      .catch((err) => {
        console.error('Failed to init legacy storage engine:', err);
        setInitialized(true);
      });
  }, []);

  return <>{children}</>;
}

