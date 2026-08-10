---
description: Workflows for receiving various silver materials (Granule, Bar).
---

# Silver Receiving Scenarios

Silver transactions follow a similar logic to gold but use a separate silver price index and purity standards.

## Case 1: Silver Granule (Local vs Murni)
1. Open **Direct Swap** module.
2. Select "Tukar Tambah Baru".
3. Select "Silver Granule Local" or "Silver Granule Murni".
4. Enter weight. 
5. The system uses the **Silver Price** and applies purity factors (Local: ~99%, Murni: 99.9%).

## Case 2: Silver Bar (Murni vs Tidak Murni)
1. Follow the same steps as Case 1.
2. For "Murni", select the Item "Silver Bar 99.9%".
3. For "Tidak Murni", use XRF to detect the actual purity.
4. The system calculates pure silver content and its corresponding trade value.
5. If it's a "Batangan Marva", the **Serial/Bar ID** should be recorded to track internal production returns.
