---
description: Workflows for gold transactions including partial swaps, production, and custody.
---

# Gold Transaction Scenarios

These workflows cover complex trade and service scenarios.

## Case 1: Partial Swap / Closing Harga Partial
1. Open **Direct Swap** module.
2. Enter the incoming material.
3. For the outgoing items (Weight Out), enter only the amount the customer takes immediately.
4. If the pure gold weight in > weight out, the system automatically shows a **"Hutang ke Customer (Debt)"** balance.
5. Save the transaction.
6. To "Close" the price later, a second Direct Swap or **Receipt Voucher (BKM)** can be created to settle the value based on the closing price.

## Case 2: Marva Production (Bahan 99.99% or Tidak Murni)
1. If "Bahan Tidak Murni":
   - Create a **Job Order** for "Refinery".
   - Use **Direct Swap** to convert the output to Pure Bar 99.99%.
2. Create a **Production Batch** (Batch Produksi).
3. Select the BOM for "Marva Gold Bar".
4. Material "Pure Gold 99.99%" will be deducted from inventory.
5. "Marva Gold Bar" stock will be increased with its Serial/Bar ID.

## Case 3: Custody (Hanya Titip Saja)
1. Create a **Job Order**.
2. Set the service type or notes to **"TITIP / SAFE KEEPING"**.
3. The item is tracked in the **"Customer Custody (Titipan)"** section of the **Inventory vs Custody Report**.
4. The item remains Off-Balance Sheet (not company asset).

## Case 4: Credit Sales (Beli Emas Utang)
1. Go to **Sales Order** or **Penjualan Kredit**.
2. Enter the gold items sold.
3. Set **Payment Terms** (e.g., Net 30).
4. Save to generate an Accounts Receivable (A/R) record.
