---
description: Workflows for receiving various gold materials (Scrap, Granule, CTD, Bar).
---

# Gold Receiving Scenarios

These scenarios are handled by either the **Direct Swap** module (for immediate trade) or **Job Order** (for refining services).

## Case 1: Scrap/Rongsok Gold (99.1% - 99.65%)
1. Open **Direct Swap** module.
2. Select "Tukar Tambah Baru".
3. Add a batch row for "Incoming Scrap".
4. Enter the weight.
5. Purity will be detected via **XRF Bridge** or entered as **99.1%** or **99.65%**.
6. The system calculates the pure content and value based on these percentages.

## Case 2: Pure Gold (99.99%) with/without Certificate
1. Follow the same steps as Case 1.
2. Set purity to **99.99%**.
3. For "Sertifikat Ber merk", ensure the **Bar ID** is captured in the "Serial/Bar ID" field.
4. If "Tanpa Sertifikat", leave the Bar ID field generic or mark as "Non-Cert".
5. The system allows selecting the specific Master Item for "Emas Murni Sertifikat" vs "Emas Murni Non-Cert" to handle different pricing if needed.

## Case 3: Raw Mining Gold / Granule
1. Follow the same steps as Case 1.
2. Select the item type as "Gold Granule" or "Raw Mining Gold".
3. Use XRF to detect variable purity.
4. The system calculates **Net Weight** based on the refining recovery rate (e.g., 99.1% from Raw Gold).
