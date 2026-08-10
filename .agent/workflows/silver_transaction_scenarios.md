---
description: Workflows for silver transactions including production and sales.
---

# Silver Transaction Scenarios

Silver transactions handle production and trading of pure silver bars and granules.

## Case 1: Silver Production (Marva Silver / White Label)
1. Ensure raw/scrap silver is processed via **Refining (Job Order)** if needed.
2. Create a **Production Batch**.
3. Select "Silver Bar 99.9%" or "Silver Bar Marva" BOM.
4. Issue materials from inventory.
5. Receive the output bars (recorded with Bar ID).

## Case 2: Trading (Jual/Beli Granule vs Bar)
1. For selling: Use **Sales Order** or **Direct Swap**.
2. Select Item: "Silver Granule Murni" or "Silver Bar Marva".
3. Record weight and actual price.
4. For purchase: Use **Purchase Order** or **Direct Swap (Incoming)**.
5. The system adjusts the Silver Inventory accounts and stock position.
