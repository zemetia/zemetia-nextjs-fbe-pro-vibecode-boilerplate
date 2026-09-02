import { describe, expect, it } from 'vitest';

import {
  findDeliveryJournals,
  postReceiptJournal,
  postShipmentJournal,
  voidDeliveryJournals,
} from './metal-purchase-journal';
import {
  buildReceiptJournalLines,
  buildShipmentJournalLines,
} from './metal-purchase';

describe('metal purchase delivery journal helpers', () => {
  it('exports the delivery journal functions required by the API routes', () => {
    expect(typeof findDeliveryJournals).toBe('function');
    expect(typeof postShipmentJournal).toBe('function');
    expect(typeof postReceiptJournal).toBe('function');
    expect(typeof voidDeliveryJournals).toBe('function');
  });

  it('keeps shipment and receipt journal lines balanced', () => {
    const shipment = buildShipmentJournalLines(
      [
        { transitAccountId: 'transit-1', amount: 1250000, memo: 'Emas 1kg' },
        { transitAccountId: 'transit-2', amount: 400000, memo: 'Emas 300g' },
      ],
      'payable-2110',
    );

    const receipt = buildReceiptJournalLines([
      {
        inventoryAccountId: 'inventory-1157',
        contraAccountId: 'transit-1',
        amount: 1250000,
        memo: 'Emas 1kg',
      },
      {
        inventoryAccountId: 'inventory-1157',
        contraAccountId: 'transit-2',
        amount: 400000,
        memo: 'Emas 300g',
      },
    ]);

    // Jurnal berimbang: Σ debit = Σ credit = total nilai. Menjumlahkan
    // debit+credit sekaligus akan menghasilkan 2× total — asersi lama keliru.
    const sumDebit = (lines: { debit?: number; credit?: number }[]) =>
      lines.reduce((sum, line) => sum + (line.debit ?? 0), 0);
    const sumCredit = (lines: { debit?: number; credit?: number }[]) =>
      lines.reduce((sum, line) => sum + (line.credit ?? 0), 0);

    expect(sumDebit(shipment)).toBe(1650000);
    expect(sumCredit(shipment)).toBe(1650000);
    expect(sumDebit(shipment)).toBe(sumCredit(shipment));

    expect(sumDebit(receipt)).toBe(1650000);
    expect(sumCredit(receipt)).toBe(1650000);
    expect(sumDebit(receipt)).toBe(sumCredit(receipt));
  });
});
