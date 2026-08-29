// ==========================================
// Simple Transaction Module
// User-friendly transaction templates for non-accountants
// ==========================================

const SimpleTransaction = {
    currentTemplate: null,

    resolvePaymentAccount(selectedAccount, fallbackAccount) {
        if (!selectedAccount) return fallbackAccount;

        const bankAccounts = typeof Storage.getBankAccounts === 'function' ? Storage.getBankAccounts() : [];
        const matchedBank = bankAccounts.find(bank => {
            return [
                bank.glAccount,
                bank.accountCode,
                bank.code,
                bank.id,
                bank.accountNumber,
                bank.bankName
            ].filter(Boolean).map(String).includes(String(selectedAccount));
        });

        return matchedBank?.glAccount || matchedBank?.accountCode || selectedAccount || fallbackAccount;
    },

    // Transaction Templates
    templates: [
        // ===== REVENUE / INCOME =====
        {
            id: 'sales_cash',
            name: '💰 Penjualan (Tunai)',
            category: 'sales',
            description: 'Penjualan produk/jasa ke customer secara tunai',
            fields: [
                { name: 'itemCode', label: 'Barang (dari Master)', type: 'item_select', required: true },
                { name: 'warehouseCode', label: 'Gudang Asal', type: 'warehouse_select', required: true },
                { name: 'customerName', label: 'Customer', type: 'customer_select', required: true },
                { name: 'quantity', label: 'Jumlah/Qty', type: 'number', required: true, step: 0.01 },
                { name: 'unitPrice', label: 'Harga Jual per Unit', type: 'currency', required: true },
                { name: 'totalAmount', label: 'Total Penjualan', type: 'currency', required: true, readonly: true, calculated: true },
                {
                    name: 'taxStatus', label: 'Status Pajak', type: 'select', required: true, options: [
                        { value: 'non_ppn', label: 'Non-PPN' },
                        { value: 'ppn', label: 'PPN 11%' }
                    ]
                },
                { name: 'paymentAccount', label: 'Terima Di', type: 'payment_account_select', required: true },
                { name: 'description', label: 'Catatan', type: 'text', required: false, placeholder: 'Catatan tambahan (opsional)' }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const journal = {
                    description: `Penjualan ${data.itemCode} (${data.quantity} unit @ ${data.unitPrice.toLocaleString('id-ID')}) ke ${data.customerName}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: mapping.sales_revenue, description: `Pendapatan - ${data.itemCode}`, debit: 0, credit: data.amount }
                    ]
                };

                let totalReceived = data.amount;
                if (data.taxStatus === 'ppn') {
                    const vatAmount = Math.round(data.amount * 0.11);
                    journal.lines.push({ accountCode: mapping.tax_out, description: 'PPN Keluaran (11%)', debit: 0, credit: vatAmount });
                    totalReceived += vatAmount;
                }

                journal.lines.push({ accountCode: SimpleTransaction.resolvePaymentAccount(data.paymentAccount, mapping.cash), description: 'Penerimaan penjualan tunai', debit: totalReceived, credit: 0 });
                return journal;
            }
        },
        {
            id: 'sales_credit',
            name: '📋 Penjualan (Kredit)',
            category: 'sales',
            description: 'Penjualan produk/jasa ke customer secara kredit (piutang)',
            fields: [
                { name: 'itemCode', label: 'Barang (dari Master)', type: 'item_select', required: true },
                { name: 'warehouseCode', label: 'Gudang Asal', type: 'warehouse_select', required: true },
                { name: 'customerName', label: 'Customer', type: 'customer_select', required: true },
                { name: 'quantity', label: 'Jumlah/Qty', type: 'number', required: true, step: 0.01 },
                { name: 'unitPrice', label: 'Harga Jual per Unit', type: 'currency', required: true },
                { name: 'totalAmount', label: 'Total Penjualan', type: 'currency', required: true, readonly: true, calculated: true },
                {
                    name: 'taxStatus', label: 'Status Pajak', type: 'select', required: true, options: [
                        { value: 'non_ppn', label: 'Non-PPN' },
                        { value: 'ppn', label: 'PPN 11%' }
                    ]
                },
                { name: 'description', label: 'Catatan', type: 'text', required: false, placeholder: 'Catatan tambahan (opsional)' }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const journal = {
                    description: `Penjualan ${data.itemCode} (${data.quantity} unit @ ${data.unitPrice.toLocaleString('id-ID')}) ke ${data.customerName}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: mapping.sales_revenue, description: `Pendapatan - ${data.itemCode}`, debit: 0, credit: data.amount }
                    ]
                };

                let totalReceivable = data.amount;
                if (data.taxStatus === 'ppn') {
                    const vatAmount = Math.round(data.amount * 0.11);
                    journal.lines.push({ accountCode: mapping.tax_out, description: 'PPN Keluaran (11%)', debit: 0, credit: vatAmount });
                    totalReceivable += vatAmount;
                }

                journal.lines.push({ accountCode: mapping.accounts_receivable, description: `Piutang ${data.customerName}`, debit: totalReceivable, credit: 0 });
                return journal;
            }
        },
        {
            id: 'receive_payment',
            name: '💵 Terima Pembayaran Piutang',
            category: 'sales',
            description: 'Penerimaan pembayaran dari customer',
            fields: [
                { name: 'amount', label: 'Jumlah Diterima', type: 'currency', required: true },
                { name: 'customerName', label: 'Nama Customer', type: 'customer_select', required: true },
                { name: 'paymentAccount', label: 'Terima Di', type: 'payment_account_select', required: true },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                return {
                    description: `Penerimaan pembayaran dari ${data.customerName}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: SimpleTransaction.resolvePaymentAccount(data.paymentAccount, mapping.cash), description: 'Penerimaan pembayaran piutang', debit: data.amount, credit: 0 },
                        { accountCode: mapping.accounts_receivable, description: `Pelunasan piutang ${data.customerName}`, debit: 0, credit: data.amount }
                    ]
                };
            }
        },
        {
            id: 'other_income',
            name: '🎁 Pendapatan Lain-lain',
            category: 'sales',
            description: 'Pendapatan di luar usaha utama',
            fields: [
                { name: 'amount', label: 'Jumlah', type: 'currency', required: true },
                { name: 'description', label: 'Keterangan', type: 'text', required: true, placeholder: 'Contoh: Bunga bank, sewa gedung' }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                return {
                    description: data.description,
                    lines: [
                        { accountCode: mapping.cash, description: 'Penerimaan kas', debit: data.amount, credit: 0 },
                        { accountCode: mapping.other_income, description: 'Pendapatan lain-lain', debit: 0, credit: data.amount }
                    ]
                };
            }
        },

        // ===== EXPENSES / PURCHASES =====
        {
            id: 'purchase_cash',
            name: '🛒 Pembelian Bahan Baku (Tunai)',
            category: 'purchase',
            description: 'Pembelian bahan baku/barang untuk produksi secara tunai',
            fields: [
                { name: 'itemCode', label: 'Barang (dari Master)', type: 'item_select', required: true },
                { name: 'supplierName', label: 'Supplier', type: 'supplier_select', required: true },
                { name: 'warehouseCode', label: 'Gudang Tujuan', type: 'warehouse_select', required: true },
                { name: 'quantity', label: 'Jumlah/Qty', type: 'number', required: true, step: 0.01 },
                { name: 'unitPrice', label: 'Harga Satuan', type: 'currency', required: true },
                { name: 'totalAmount', label: 'Total Harga', type: 'currency', required: true, readonly: true, calculated: true },
                {
                    name: 'taxStatus', label: 'Status Pajak', type: 'select', required: true, options: [
                        { value: 'non_ppn', label: 'Non-PPN' },
                        { value: 'ppn', label: 'PPN 11%' }
                    ]
                },
                { name: 'paymentAccount', label: 'Bayar Dari', type: 'payment_account_select', required: true },
                { name: 'description', label: 'Catatan', type: 'text', required: false, placeholder: 'Catatan tambahan (opsional)' }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const purchaseItems = Array.isArray(data.items) && data.items.length > 0
                    ? data.items
                    : [{
                        itemCode: data.itemCode,
                        quantity: data.quantity,
                        unitPrice: data.unitPrice,
                        amount: data.amount
                    }];
                const subtotal = purchaseItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
                const journal = {
                    description: `Pembelian ${purchaseItems.map(item => item.itemCode).join(', ')} dari ${data.supplierName}${data.description ? ' - ' + data.description : ''}`,
                    lines: purchaseItems.map(item => ({
                        accountCode: mapping.cogs,
                        description: `HPP - ${item.itemCode}`,
                        debit: parseFloat(item.amount) || 0,
                        credit: 0
                    }))
                };

                let totalPayment = subtotal;
                if (data.taxStatus === 'ppn') {
                    const vatAmount = Math.round(subtotal * 0.11);
                    journal.lines.push({ accountCode: mapping.tax_in, description: 'PPN Masukan (11%)', debit: vatAmount, credit: 0 });
                    totalPayment += vatAmount;
                }

                journal.lines.push({ accountCode: SimpleTransaction.resolvePaymentAccount(data.paymentAccount, mapping.cash), description: 'Pengeluaran pembelian tunai', debit: 0, credit: totalPayment });
                return journal;
            }
        },
        {
            id: 'purchase_credit',
            name: '📋 Pembelian Bahan Baku (Kredit)',
            category: 'purchase',
            description: 'Pembelian bahan baku/barang untuk produksi secara kredit (hutang)',
            fields: [
                { name: 'itemCode', label: 'Barang (dari Master)', type: 'item_select', required: true },
                { name: 'supplierName', label: 'Supplier', type: 'supplier_select', required: true },
                { name: 'warehouseCode', label: 'Gudang Tujuan', type: 'warehouse_select', required: true },
                { name: 'quantity', label: 'Jumlah/Qty', type: 'number', required: true, step: 0.01 },
                { name: 'unitPrice', label: 'Harga Satuan', type: 'currency', required: true },
                { name: 'totalAmount', label: 'Total Harga', type: 'currency', required: true, readonly: true, calculated: true },
                {
                    name: 'taxStatus', label: 'Status Pajak', type: 'select', required: true, options: [
                        { value: 'non_ppn', label: 'Non-PPN' },
                        { value: 'ppn', label: 'PPN 11%' }
                    ]
                },
                { name: 'downPayment', label: 'Uang Muka/DP (Opsional)', type: 'currency', required: false },
                { name: 'paymentAccount', label: 'Bayar DP Dari', type: 'payment_account_select', required: false },
                { name: 'description', label: 'Catatan', type: 'text', required: false, placeholder: 'Catatan tambahan (opsional)' }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const purchaseItems = Array.isArray(data.items) && data.items.length > 0
                    ? data.items
                    : [{
                        itemCode: data.itemCode,
                        quantity: data.quantity,
                        unitPrice: data.unitPrice,
                        amount: data.amount
                    }];
                const subtotal = purchaseItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
                const journal = {
                    description: `Pembelian ${purchaseItems.map(item => item.itemCode).join(', ')} dari ${data.supplierName}${data.description ? ' - ' + data.description : ''}`,
                    lines: purchaseItems.map(item => ({
                        accountCode: mapping.cogs,
                        description: `HPP - ${item.itemCode}`,
                        debit: parseFloat(item.amount) || 0,
                        credit: 0
                    }))
                };

                let totalHutang = subtotal;
                if (data.taxStatus === 'ppn') {
                    const vatAmount = Math.round(subtotal * 0.11);
                    journal.lines.push({ accountCode: mapping.tax_in, description: 'PPN Masukan (11%)', debit: vatAmount, credit: 0 });
                    totalHutang += vatAmount;
                }
                
                const dp = data.downPayment || 0;
                if (dp > 0) {
                    journal.lines.push({ accountCode: SimpleTransaction.resolvePaymentAccount(data.paymentAccount, mapping.cash), description: 'Pembayaran DP Pembelian', debit: 0, credit: dp });
                    totalHutang -= dp;
                }

                if (totalHutang > 0) {
                    journal.lines.push({ accountCode: mapping.accounts_payable, description: `Hutang kepada ${data.supplierName}`, debit: 0, credit: totalHutang });
                }
                return journal;
            }
        },
        {
            id: 'pay_supplier',
            name: '💸 Bayar Hutang Supplier',
            category: 'purchase',
            description: 'Pembayaran hutang kepada supplier',
            fields: [
                { name: 'amount', label: 'Jumlah Dibayar', type: 'currency', required: true },
                { name: 'supplierName', label: 'Nama Supplier', type: 'supplier_select', required: true },
                { name: 'paymentAccount', label: 'Bayar Dari', type: 'payment_account_select', required: true },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                return {
                    description: `Pembayaran hutang kepada ${data.supplierName}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: mapping.accounts_payable, description: `Pelunasan hutang ${data.supplierName}`, debit: data.amount, credit: 0 },
                        { accountCode: SimpleTransaction.resolvePaymentAccount(data.paymentAccount, mapping.cash), description: 'Pengeluaran pembayaran hutang', debit: 0, credit: data.amount }
                    ]
                };
            }
        },
        {
            id: 'pay_salary',
            name: '💼 Bayar Gaji Karyawan',
            category: 'purchase',
            description: 'Pembayaran gaji/upah karyawan',
            fields: [
                { name: 'amount', label: 'Total Gaji', type: 'currency', required: true },
                { name: 'period', label: 'Periode', type: 'text', required: true, placeholder: 'Contoh: Januari 2025' },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                return {
                    description: `Pembayaran gaji ${data.period}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: mapping.salary_expense, description: 'Beban gaji', debit: data.amount, credit: 0 },
                        { accountCode: mapping.cash, description: 'Pengeluaran kas', debit: 0, credit: data.amount }
                    ]
                };
            }
        },
        {
            id: 'pay_rent',
            name: '🏢 Bayar Sewa',
            category: 'purchase',
            description: 'Pembayaran sewa kantor/toko/gudang',
            fields: [
                { name: 'amount', label: 'Jumlah Sewa', type: 'currency', required: true },
                { name: 'period', label: 'Periode', type: 'text', required: true, placeholder: 'Contoh: Januari 2025' },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                return {
                    description: `Pembayaran sewa ${data.period}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: mapping.rent_expense, description: 'Beban sewa', debit: data.amount, credit: 0 },
                        { accountCode: mapping.cash, description: 'Pengeluaran kas', debit: 0, credit: data.amount }
                    ]
                };
            }
        },
        {
            id: 'pay_utilities',
            name: '⚡ Bayar Listrik/Air/Telepon',
            category: 'purchase',
            description: 'Pembayaran utilitas (listrik, air, telepon, internet)',
            fields: [
                { name: 'amount', label: 'Jumlah', type: 'currency', required: true },
                { name: 'description', label: 'Keterangan', type: 'text', required: true, placeholder: 'Contoh: Listrik dan air bulan Januari' }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                return {
                    description: data.description,
                    lines: [
                        { accountCode: mapping.utilities_expense, description: 'Beban listrik dan air', debit: data.amount, credit: 0 },
                        { accountCode: mapping.cash, description: 'Pengeluaran kas', debit: 0, credit: data.amount }
                    ]
                };
            },
        },
        {
            id: 'operational_expense',
            name: '💼 Biaya Operasional Umum',
            category: 'purchase',
            description: 'Biaya operasional lainnya (transportasi, makan, dll)',
            fields: [
                { name: 'amount', label: 'Jumlah', type: 'currency', required: true },
                {
                    name: 'expenseType',
                    label: 'Jenis Biaya',
                    type: 'select',
                    required: true,
                    options: [
                        { value: '5240', label: 'Transportasi' },
                        { value: '5250', label: 'Perlengkapan' },
                        { value: '5260', label: 'Perbaikan & Pemeliharaan' },
                        { value: '5270', label: 'Marketing & Promosi' },
                        { value: '5280', label: 'Administrasi' },
                        { value: '5290', label: 'Lain-lain' }
                    ]
                },
                {
                    name: 'paymentMethod',
                    label: 'Metode Pembayaran',
                    type: 'select',
                    required: true,
                    options: [
                        { value: 'cash', label: '💵 Tunai/Cash' },
                        { value: 'bank', label: '🏦 Transfer Bank' },
                        { value: 'credit', label: '🧾 Kredit/Hutang' }
                    ]
                },
                { name: 'description', label: 'Keterangan', type: 'text', required: true, placeholder: 'Jelaskan biaya ini' }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const journal = {
                    description: data.description,
                    lines: [
                        { accountCode: data.expenseType, description: 'Beban operasional', debit: data.amount, credit: 0 }
                    ]
                };

                if (data.paymentMethod === 'cash') {
                    journal.lines.push({ accountCode: mapping.cash, description: 'Pengeluaran kas', debit: 0, credit: data.amount });
                } else if (data.paymentMethod === 'bank') {
                    journal.lines.push({ accountCode: mapping.bank, description: 'Transfer bank', debit: 0, credit: data.amount });
                } else if (data.paymentMethod === 'credit') {
                    journal.lines.push({ accountCode: mapping.accounts_payable, description: 'Hutang biaya', debit: 0, credit: data.amount });
                }

                return journal;
            }
        },
        {
            id: 'buy_supplies',
            name: '📦 Beli Perlengkapan Kantor',
            category: 'purchase',
            description: 'Pembelian perlengkapan kantor (ATK, dll)',
            fields: [
                { name: 'amount', label: 'Jumlah', type: 'currency', required: true },
                { name: 'description', label: 'Keterangan', type: 'text', required: true, placeholder: 'Contoh: ATK untuk 1 bulan' }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                return {
                    description: data.description,
                    lines: [
                        { accountCode: mapping.supplies_expense, description: 'Beban perlengkapan', debit: data.amount, credit: 0 },
                        { accountCode: mapping.cash, description: 'Pengeluaran kas', debit: 0, credit: data.amount }
                    ]
                };
            }
        },

        // ===== ASSETS =====
        {
            id: 'buy_asset_cash',
            name: '🚗 Beli Aset Tetap (Tunai)',
            category: 'finance',
            description: 'Pembelian aset tetap seperti kendaraan, peralatan, furniture',
            fields: [
                { name: 'amount', label: 'Harga Beli', type: 'currency', required: true },
                {
                    name: 'assetType', label: 'Jenis Aset', type: 'select', required: true, options: [
                        { value: '1210', label: 'Tanah' },
                        { value: '1220', label: 'Bangunan' },
                        { value: '1230', label: 'Kendaraan' },
                        { value: '1240', label: 'Peralatan' },
                        { value: '1250', label: 'Furniture' }
                    ]
                },
                {
                    name: 'taxStatus', label: 'Status Pajak', type: 'select', required: true, options: [
                        { value: 'non_ppn', label: 'Non-PPN' },
                        { value: 'ppn', label: 'PPN 11%' }
                    ]
                },
                { name: 'description', label: 'Keterangan', type: 'text', required: true }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const journal = {
                    description: data.description,
                    lines: [
                        { accountCode: data.assetType, description: 'Pembelian aset tetap', debit: data.amount, credit: 0 }
                    ]
                };

                let totalPayment = data.amount;
                if (data.taxStatus === 'ppn') {
                    const vatAmount = Math.round(data.amount * 0.11);
                    journal.lines.push({ accountCode: mapping.tax_in, description: 'PPN Masukan (11%)', debit: vatAmount, credit: 0 });
                    totalPayment += vatAmount;
                }

                journal.lines.push({ accountCode: mapping.cash, description: 'Pengeluaran kas', debit: 0, credit: totalPayment });
                return journal;
            }
        },
        {
            id: 'buy_asset_credit',
            name: '📋 Beli Aset Tetap (Kredit/Hutang)',
            category: 'finance',
            description: 'Pembelian aset tetap secara kredit 100% dari supplier (hutang usaha)',
            fields: [
                { name: 'amount', label: 'Harga Beli', type: 'currency', required: true },
                {
                    name: 'assetType', label: 'Jenis Aset', type: 'select', required: true, options: [
                        { value: '1210', label: 'Tanah' },
                        { value: '1220', label: 'Bangunan' },
                        { value: '1230', label: 'Kendaraan' },
                        { value: '1240', label: 'Peralatan' },
                        { value: '1250', label: 'Furniture' }
                    ]
                },
                {
                    name: 'taxStatus', label: 'Status Pajak', type: 'select', required: true, options: [
                        { value: 'non_ppn', label: 'Non-PPN' },
                        { value: 'ppn', label: 'PPN 11%' }
                    ]
                },
                { name: 'supplierName', label: 'Nama Supplier', type: 'supplier_select', required: true },
                { name: 'description', label: 'Keterangan', type: 'text', required: true }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const journal = {
                    description: data.description,
                    lines: [
                        { accountCode: data.assetType, description: 'Pembelian aset tetap', debit: data.amount, credit: 0 }
                    ]
                };

                let totalHutang = data.amount;
                if (data.taxStatus === 'ppn') {
                    const vatAmount = Math.round(data.amount * 0.11);
                    journal.lines.push({ accountCode: mapping.tax_in, description: 'PPN Masukan (11%)', debit: vatAmount, credit: 0 });
                    totalHutang += vatAmount;
                }

                journal.lines.push({ accountCode: mapping.accounts_payable, description: `Hutang kepada ${data.supplierName}`, debit: 0, credit: totalHutang });
                return journal;
            }
        },
        {
            id: 'buy_asset_loan',
            name: '🏦 Beli Aset Tetap (DP + Pinjaman)',
            category: 'finance',
            description: 'Pembelian aset tetap dengan uang muka (DP) dan sisanya pinjaman/financing',
            fields: [
                { name: 'assetPrice', label: 'Harga Aset', type: 'currency', required: true },
                { name: 'cashPayment', label: 'Uang Muka (DP)', type: 'currency', required: true },
                {
                    name: 'assetType', label: 'Jenis Aset', type: 'select', required: true, options: [
                        { value: '1210', label: 'Tanah' },
                        { value: '1220', label: 'Bangunan' },
                        { value: '1230', label: 'Kendaraan' },
                        { value: '1240', label: 'Peralatan' },
                        { value: '1250', label: 'Furniture' }
                    ]
                },
                {
                    name: 'taxStatus', label: 'Status Pajak', type: 'select', required: true, options: [
                        { value: 'non_ppn', label: 'Non-PPN' },
                        { value: 'ppn', label: 'PPN 11%' }
                    ]
                },
                { name: 'description', label: 'Keterangan', type: 'text', required: true }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const journal = {
                    description: data.description,
                    lines: [
                        { accountCode: data.assetType, description: 'Pembelian aset tetap', debit: data.assetPrice, credit: 0 }
                    ]
                };

                let totalPrice = data.assetPrice;
                if (data.taxStatus === 'ppn') {
                    const vatAmount = Math.round(data.assetPrice * 0.11);
                    journal.lines.push({ accountCode: mapping.tax_in, description: 'PPN Masukan (11%)', debit: vatAmount, credit: 0 });
                    totalPrice += vatAmount;
                }

                const loanAmount = totalPrice - data.cashPayment;
                journal.lines.push({ accountCode: mapping.cash, description: 'Uang muka', debit: 0, credit: data.cashPayment });
                journal.lines.push({ accountCode: mapping.long_term_debt, description: 'Hutang jangka panjang', debit: 0, credit: loanAmount });

                return journal;
            }
        },

        // ===== FINANCING =====
        {
            id: 'capital_investment',
            name: '💎 Modal Masuk (Investasi Pemilik)',
            category: 'finance',
            description: 'Pemilik menyetorkan modal ke perusahaan',
            fields: [
                { name: 'amount', label: 'Jumlah Modal', type: 'currency', required: true },
                { name: 'ownerName', label: 'Nama Pemilik', type: 'text', required: true },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                return {
                    description: `Modal dari ${data.ownerName}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: mapping.cash, description: 'Penerimaan kas', debit: data.amount, credit: 0 },
                        { accountCode: mapping.capital, description: 'Modal disetor', debit: 0, credit: data.amount }
                    ]
                };
            }
        },
        {
            id: 'receive_loan',
            name: '🏦 Terima Pinjaman',
            category: 'finance',
            description: 'Penerimaan pinjaman dari bank/pihak lain',
            fields: [
                { name: 'amount', label: 'Jumlah Pinjaman', type: 'currency', required: true },
                { name: 'lender', label: 'Pemberi Pinjaman', type: 'text', required: true, placeholder: 'Contoh: Bank BCA' },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                return {
                    description: `Pinjaman dari ${data.lender}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: mapping.cash, description: 'Penerimaan kas', debit: data.amount, credit: 0 },
                        { accountCode: mapping.long_term_debt, description: 'Hutang jangka panjang', debit: 0, credit: data.amount }
                    ]
                };
            }
        },
        {
            id: 'pay_loan',
            name: '💰 Bayar Angsuran Pinjaman',
            category: 'finance',
            description: 'Pembayaran angsuran pinjaman (pokok + bunga)',
            fields: [
                { name: 'principal', label: 'Angsuran Pokok', type: 'currency', required: true },
                { name: 'interest', label: 'Bunga', type: 'currency', required: true },
                { name: 'lender', label: 'Pemberi Pinjaman', type: 'text', required: true },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const total = data.principal + data.interest;
                return {
                    description: `Angsuran pinjaman ${data.lender}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: mapping.long_term_debt, description: 'Pembayaran pokok pinjaman', debit: data.principal, credit: 0 },
                        { accountCode: mapping.interest_expense, description: 'Beban bunga', debit: data.interest, credit: 0 },
                        { accountCode: mapping.cash, description: 'Pengeluaran kas', debit: 0, credit: total }
                    ]
                };
            }
        },
        {
            id: 'owner_withdrawal',
            name: '📤 Prive (Penarikan Modal)',
            category: 'finance',
            description: 'Pemilik mengambil uang dari perusahaan untuk keperluan pribadi',
            fields: [
                { name: 'amount', label: 'Jumlah Penarikan', type: 'currency', required: true },
                { name: 'ownerName', label: 'Nama Pemilik', type: 'text', required: true },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                return {
                    description: `Prive ${data.ownerName}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: mapping.drawings, description: 'Prive/penarikan', debit: data.amount, credit: 0 },
                        { accountCode: mapping.cash, description: 'Pengeluaran kas', debit: 0, credit: data.amount }
                    ]
                };
            }
        },

        // ===== BANK / CASH =====
        {
            id: 'deposit_to_bank',
            name: '🏧 Setor Tunai ke Bank',
            category: 'finance',
            description: 'Transfer uang dari kas ke rekening bank',
            fields: [
                { name: 'amount', label: 'Jumlah Setor', type: 'currency', required: true },
                { name: 'bankName', label: 'Nama Bank', type: 'text', required: true },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                return {
                    description: `Setoran ke ${data.bankName}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: mapping.bank, description: 'Saldo bank', debit: data.amount, credit: 0 },
                        { accountCode: mapping.cash, description: 'Pengeluaran kas', debit: 0, credit: data.amount }
                    ]
                };
            }
        },
        {
            id: 'withdraw_from_bank',
            name: '💵 Tarik Tunai dari Bank',
            category: 'finance',
            description: 'Penarikan uang dari rekening bank ke kas',
            fields: [
                { name: 'amount', label: 'Jumlah Tarik', type: 'currency', required: true },
                { name: 'bankName', label: 'Nama Bank', type: 'text', required: true },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            createJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                return {
                    description: `Penarikan dari ${data.bankName}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: mapping.cash, description: 'Penerimaan kas', debit: data.amount, credit: 0 },
                        { accountCode: mapping.bank, description: 'Saldo bank', debit: 0, credit: data.amount }
                    ]
                };
            }
        },

        // ===== GOLD REFINERY SPECIFIC =====
        {
            id: 'receive_gold_pending_lab',
            name: '📥 Terima Emas Mentah (Pending Lab Test)',
            category: 'gold_purchase',
            description: 'Pencatatan penerimaan emas mentah yang belum di-lab test (masuk gudang LAB/Quarantine)',
            fields: [
                { name: 'itemCode', label: 'Jenis Emas (dari Master)', type: 'item_select', required: true, filter: 'gold' },
                { name: 'supplierName', label: 'Supplier', type: 'supplier_select', required: true },
                { name: 'warehouseCode', label: 'Gudang (LAB/Quarantine)', type: 'warehouse_select', required: true },
                { name: 'weight', label: 'Berat Kotor (gram)', type: 'number', required: true, step: 0.01 },
                { name: 'estimatedPurity', label: 'Estimasi Kadar (%) - Claim Supplier', type: 'number', required: true, step: 0.01, placeholder: 'Contoh: 85.5' },
                { name: 'estimatedPureWeight', label: 'Estimasi Berat Murni (gram)', type: 'number', required: true, readonly: true, calculated: true },
                { name: 'pricePerGram', label: 'Harga per Gram Kotor (Rp)', type: 'currency', required: true },
                { name: 'totalAmount', label: 'Total Harga Estimasi', type: 'currency', required: true, readonly: true, calculated: true },
                { name: 'description', label: 'Catatan', type: 'text', required: false, placeholder: 'No. DO, kondisi fisik, dll' }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const estimatedPure = (data.weight * data.estimatedPurity / 100).toFixed(2);
                const desc = `Terima ${data.weight}g emas mentah (est. ${data.estimatedPurity}% = ${estimatedPure}g pure) dari ${data.supplierName} - PENDING LAB TEST${data.description ? ' - ' + data.description : ''}`;
                return {
                    description: desc,
                    lines: [
                        { accountCode: mapping.gold_in_lab, description: `Emas dalam pemeriksaan lab - ${data.itemCode} @ ${data.warehouseCode}`, debit: data.amount, credit: 0 },
                        { accountCode: mapping.gold_payable_pending, description: `Hutang pembelian emas (pending confirmation) - ${data.supplierName}`, debit: 0, credit: data.amount }
                    ]
                };
            }
        },
        {
            id: 'purchase_raw_gold_cash',
            name: '⚜️ Beli Emas Mentah (Tunai)',
            category: 'gold_purchase',
            description: 'Pembelian emas mentah/scrap untuk produksi (dengan sampling & lab test)',
            fields: [
                { name: 'itemCode', label: 'Barang (dari Master)', type: 'item_select', required: true, filter: 'gold' },
                { name: 'supplierName', label: 'Supplier', type: 'supplier_select', required: true },
                { name: 'weight', label: 'Berat Kotor (gram)', type: 'number', required: true, step: 0.01 },
                { name: 'purity', label: 'Kadar/Purity (%) - Hasil Lab Test', type: 'number', required: true, step: 0.01, placeholder: 'Contoh: 85.5' },
                { name: 'pureWeight', label: 'Berat Murni (gram)', type: 'number', required: true, readonly: true, calculated: true },
                { name: 'pricePerGram', label: 'Harga per Gram Kotor (Rp)', type: 'currency', required: true },
                { name: 'totalAmount', label: 'Total Harga', type: 'currency', required: true, readonly: true, calculated: true },
                {
                    name: 'taxStatus', label: 'Status Pajak', type: 'select', required: true, options: [
                        { value: 'non_ppn', label: 'Non-PPN' },
                        { value: 'ppn', label: 'PPN 11%' }
                    ]
                },
                { name: 'labTestNo', label: 'No. Lab Test', type: 'text', required: false, placeholder: 'Nomor sertifikat lab (opsional)' },
                { name: 'description', label: 'Catatan', type: 'text', required: false, placeholder: 'Catatan tambahan (opsional)' }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const pureGold = (data.weight * data.purity / 100).toFixed(2);
                const desc = `Pembelian ${data.weight}g emas @ ${data.purity}% = ${pureGold}g pure dari ${data.supplierName}${data.labTestNo ? ' (Lab: ' + data.labTestNo + ')' : ''}${data.description ? ' - ' + data.description : ''}`;
                const journal = {
                    description: desc,
                    lines: [
                        { accountCode: mapping.raw_gold_inventory, description: `Emas mentah: ${data.itemCode}`, debit: data.amount, credit: 0 }
                    ]
                };

                let totalPayment = data.amount;
                if (data.taxStatus === 'ppn') {
                    const vatAmount = Math.round(data.amount * 0.11);
                    journal.lines.push({ accountCode: mapping.tax_in, description: 'PPN Masukan (11%)', debit: vatAmount, credit: 0 });
                    totalPayment += vatAmount;
                }

                journal.lines.push({ accountCode: mapping.cash, description: 'Pengeluaran kas', debit: 0, credit: totalPayment });
                return journal;
            }
        },
        {
            id: 'purchase_raw_gold_credit',
            name: '⚜️📋 Beli Emas Mentah (Kredit)',
            category: 'gold_purchase',
            description: 'Pembelian emas mentah/scrap secara kredit',
            fields: [
                { name: 'weight', label: 'Berat (gram)', type: 'number', required: true, step: 0.01 },
                { name: 'purity', label: 'Kadar (%)', type: 'number', required: true, step: 0.01 },
                { name: 'pricePerGram', label: 'Harga per Gram (Rp)', type: 'currency', required: true },
                {
                    name: 'taxStatus', label: 'Status Pajak', type: 'select', required: true, options: [
                        { value: 'non_ppn', label: 'Non-PPN' },
                        { value: 'ppn', label: 'PPN 11%' }
                    ]
                },
                { name: 'supplierName', label: 'Nama Supplier', type: 'supplier_select', required: true },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const subtotal = data.weight * data.pricePerGram;
                const pureGold = (data.weight * data.purity / 100).toFixed(2);
                const journal = {
                    description: `Pembelian ${data.weight}g emas mentah (${data.purity}% = ${pureGold}g pure) dari ${data.supplierName}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: mapping.raw_gold_inventory, description: `Emas mentah ${data.weight}g @ ${data.purity}%`, debit: subtotal, credit: 0 }
                    ]
                };

                let totalHutang = subtotal;
                if (data.taxStatus === 'ppn') {
                    const vatAmount = Math.round(subtotal * 0.11);
                    journal.lines.push({ accountCode: mapping.tax_in, description: 'PPN Masukan (11%)', debit: vatAmount, credit: 0 });
                    totalHutang += vatAmount;
                }

                journal.lines.push({ accountCode: mapping.gold_payable, description: `Hutang supplier emas - ${data.supplierName}`, debit: 0, credit: totalHutang });
                return journal;
            }
        },
        {
            id: 'confirm_lab_test_gold',
            name: '🔬 Konfirmasi Lab Test & Finalisasi Pembelian Emas',
            category: 'gold_purchase',
            description: 'Konfirmasi hasil lab test emas mentah dan finalisasi pembelian (transfer dari LAB ke VAULT, bayar supplier)',
            fields: [
                { name: 'itemCode', label: 'Jenis Emas (dari Master)', type: 'item_select', required: true, filter: 'gold' },
                { name: 'supplierName', label: 'Supplier', type: 'supplier_select', required: true },
                { name: 'weight', label: 'Berat Kotor (gram)', type: 'number', required: true, step: 0.01 },
                { name: 'actualPurity', label: 'Kadar ACTUAL (%) - Hasil Lab Test', type: 'number', required: true, step: 0.01, placeholder: 'Contoh: 84.3' },
                { name: 'actualPureWeight', label: 'Berat Murni Actual (gram)', type: 'number', required: true, readonly: true, calculated: true },
                { name: 'pricePerGram', label: 'Harga per Gram Kotor (Rp)', type: 'currency', required: true },
                { name: 'totalAmount', label: 'Total Harga Final', type: 'currency', required: true, readonly: true, calculated: true },
                { name: 'warehouseFrom', label: 'Gudang Asal (LAB)', type: 'warehouse_select', required: true },
                { name: 'warehouseTo', label: 'Gudang Tujuan (VAULT)', type: 'warehouse_select', required: true },
                { name: 'labTestNo', label: 'No. Sertifikat Lab Test', type: 'text', required: true, placeholder: 'Nomor sertifikat hasil lab' },
                { name: 'description', label: 'Catatan', type: 'text', required: false, placeholder: 'Catatan tambahan' }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const actualPure = (data.weight * data.actualPurity / 100).toFixed(2);
                const desc = `Konfirmasi lab test ${data.weight}g emas @ ${data.actualPurity}% = ${actualPure}g pure dari ${data.supplierName} (Cert: ${data.labTestNo})${data.description ? ' - ' + data.description : ''}`;
                return {
                    description: desc,
                    lines: [
                        // Transfer dari Emas Dalam Pemeriksaan Lab (1152) ke Raw Gold Inventory (1151)
                        { accountCode: mapping.raw_gold_inventory, description: `Raw Gold Inventory - ${data.itemCode} @ ${data.warehouseTo}`, debit: data.amount, credit: 0 },
                        { accountCode: mapping.gold_in_lab, description: `Emas dalam pemeriksaan lab - ${data.itemCode} @ ${data.warehouseFrom}`, debit: 0, credit: data.amount },
                        // Bayar supplier - hapus hutang pending
                        { accountCode: mapping.gold_payable_pending, description: `Pelunasan hutang emas - ${data.supplierName}`, debit: data.amount, credit: 0 },
                        { accountCode: mapping.cash, description: 'Pembayaran kas ke supplier', debit: 0, credit: data.amount }
                    ]
                };
            }
        },
        {
            id: 'sell_gold_bar',
            name: '🥇 Jual Gold Bar',
            category: 'gold_sales',
            description: 'Penjualan Gold Bar 24K (99.99% pure)',
            fields: [
                { name: 'weight', label: 'Berat (gram)', type: 'number', required: true, step: 0.01 },
                { name: 'pricePerGram', label: 'Harga Jual per Gram (Rp)', type: 'currency', required: true },
                { name: 'customerName', label: 'Nama Customer', type: 'customer_select', required: true },
                {
                    name: 'paymentType', label: 'Metode Pembayaran', type: 'select', required: true, options: [
                        { value: 'cash', label: 'Tunai' },
                        { value: 'credit', label: 'Kredit/Piutang' }
                    ]
                },
                {
                    name: 'taxStatus', label: 'Status Pajak', type: 'select', required: true, options: [
                        { value: 'non_ppn', label: 'Non-PPN' },
                        { value: 'ppn', label: 'PPN 11%' }
                    ]
                },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const subtotal = data.weight * data.pricePerGram;
                const journal = {
                    description: `Penjualan ${data.weight}g Gold Bar kepada ${data.customerName}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: mapping.gold_bar_revenue, description: 'Pendapatan penjualan Gold Bar', debit: 0, credit: subtotal }
                    ]
                };

                let totalPayment = subtotal;
                if (data.taxStatus === 'ppn') {
                    const vatAmount = Math.round(subtotal * 0.11);
                    journal.lines.push({ accountCode: mapping.tax_out, description: 'PPN Keluaran (11%)', debit: 0, credit: vatAmount });
                    totalPayment += vatAmount;
                }

                const debitAccount = data.paymentType === 'cash' ? mapping.cash : mapping.accounts_receivable;
                const debitDesc = data.paymentType === 'cash' ? 'Penerimaan kas' : `Piutang ${data.customerName}`;
                journal.lines.push({ accountCode: debitAccount, description: debitDesc, debit: totalPayment, credit: 0 });

                return journal;
            }
        },
        {
            id: 'sell_gold_grain',
            name: '✨ Jual Gold Grain/Granules',
            category: 'gold_sales',
            description: 'Penjualan Gold Grain atau Granules',
            fields: [
                { name: 'weight', label: 'Berat (gram)', type: 'number', required: true, step: 0.01 },
                { name: 'pricePerGram', label: 'Harga Jual per Gram (Rp)', type: 'currency', required: true },
                { name: 'customerName', label: 'Nama Customer', type: 'customer_select', required: true },
                {
                    name: 'paymentType', label: 'Metode Pembayaran', type: 'select', required: true, options: [
                        { value: 'cash', label: 'Tunai' },
                        { value: 'credit', label: 'Kredit/Piutang' }
                    ]
                },
                {
                    name: 'taxStatus', label: 'Status Pajak', type: 'select', required: true, options: [
                        { value: 'non_ppn', label: 'Non-PPN' },
                        { value: 'ppn', label: 'PPN 11%' }
                    ]
                },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const subtotal = data.weight * data.pricePerGram;
                const journal = {
                    description: `Penjualan ${data.weight}g Gold Grain kepada ${data.customerName}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: mapping.gold_grain_revenue, description: 'Pendapatan penjualan Gold Grain', debit: 0, credit: subtotal }
                    ]
                };

                let totalPayment = subtotal;
                if (data.taxStatus === 'ppn') {
                    const vatAmount = Math.round(subtotal * 0.11);
                    journal.lines.push({ accountCode: mapping.tax_out, description: 'PPN Keluaran (11%)', debit: 0, credit: vatAmount });
                    totalPayment += vatAmount;
                }

                const debitAccount = data.paymentType === 'cash' ? mapping.cash : mapping.accounts_receivable;
                const debitDesc = data.paymentType === 'cash' ? 'Penerimaan kas' : `Piutang ${data.customerName}`;
                journal.lines.push({ accountCode: debitAccount, description: debitDesc, debit: totalPayment, credit: 0 });

                return journal;
            }
        },
        {
            id: 'purchase_chemicals',
            name: '🧪 Beli Chemicals & Bahan Produksi',
            category: 'gold_production',
            description: 'Pembelian chemicals, flux, crucibles untuk produksi',
            fields: [
                { name: 'itemCode', label: 'Barang (dari Master)', type: 'item_select', required: true, filter: 'chemicals' },
                { name: 'supplierName', label: 'Supplier', type: 'supplier_select', required: true },
                { name: 'warehouseCode', label: 'Gudang Tujuan', type: 'warehouse_select', required: true },
                { name: 'quantity', label: 'Jumlah/Qty', type: 'number', required: true, step: 0.01 },
                { name: 'unitPrice', label: 'Harga Satuan', type: 'currency', required: true },
                { name: 'totalAmount', label: 'Total Harga', type: 'currency', required: true, readonly: true, calculated: true },
                {
                    name: 'taxStatus', label: 'Status Pajak', type: 'select', required: true, options: [
                        { value: 'non_ppn', label: 'Non-PPN' },
                        { value: 'ppn', label: 'PPN 11%' }
                    ]
                },
                { name: 'description', label: 'Catatan', type: 'text', required: false, placeholder: 'Contoh: Borax 10kg, Crucible 5pcs' }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                // Determine account based on item category
                const accountCode = data.itemCode.includes('CHEM') || data.itemCode.includes('FLUX') ? mapping.chemicals_inventory : mapping.consumables_inventory;
                const journal = {
                    description: `Pembelian ${data.itemCode} (${data.quantity} unit @ ${data.unitPrice.toLocaleString('id-ID')}) dari ${data.supplierName}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: accountCode, description: `Persediaan bahan produksi: ${data.itemCode}`, debit: data.amount, credit: 0 }
                    ]
                };

                let totalPayment = data.amount;
                if (data.taxStatus === 'ppn') {
                    const vatAmount = Math.round(data.amount * 0.11);
                    journal.lines.push({ accountCode: mapping.tax_in, description: 'PPN Masukan (11%)', debit: vatAmount, credit: 0 });
                    totalPayment += vatAmount;
                }

                journal.lines.push({ accountCode: mapping.cash, description: 'Pengeluaran kas', debit: 0, credit: totalPayment });
                return journal;
            }
        },
        {
            id: 'record_production_loss',
            name: '📉 Catat Susut Produksi',
            category: 'gold_production',
            description: 'Pencatatan susut/loss saat proses refining',
            fields: [
                { name: 'amount', label: 'Nilai Susut (Rp)', type: 'currency', required: true },
                { name: 'weightLoss', label: 'Berat Susut (gram)', type: 'number', required: true, step: 0.01 },
                {
                    name: 'lossType', label: 'Jenis Susut', type: 'select', required: true, options: [
                        { value: '5141', label: 'Susut Normal (expected)' },
                        { value: '5142', label: 'Susut Abnormal (unexpected)' }
                    ]
                },
                { name: 'batchNumber', label: 'Batch Number', type: 'text', required: true, placeholder: 'Contoh: BATCH-001' },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                return {
                    description: `Susut produksi ${data.weightLoss}g - ${data.batchNumber}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: data.lossType, description: 'Beban susut produksi', debit: data.amount, credit: 0 },
                        { accountCode: mapping.wip, description: 'Pengurangan WIP', debit: 0, credit: data.amount }
                    ]
                };
            }
        },
        {
            id: 'receive_customer_gold',
            name: '📥 Terima Emas Titipan Customer (Refining Service)',
            category: 'gold_service',
            description: 'Penerimaan emas dari customer untuk jasa refining',
            fields: [
                { name: 'weight', label: 'Berat (gram)', type: 'number', required: true, step: 0.01 },
                { name: 'purity', label: 'Kadar Awal (%)', type: 'number', required: true, step: 0.01 },
                { name: 'estimatedValue', label: 'Estimasi Nilai (Rp)', type: 'currency', required: true },
                { name: 'customerName', label: 'Nama Customer', type: 'customer_select', required: true },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                return {
                    description: `Terima ${data.weight}g emas @ ${data.purity}% dari ${data.customerName} untuk refining${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: mapping.gold_consignment, description: `Emas titipan - ${data.customerName}`, debit: data.estimatedValue, credit: 0 },
                        { accountCode: mapping.customer_gold_liability, description: `Kewajiban emas titipan - ${data.customerName}`, debit: 0, credit: data.estimatedValue }
                    ]
                };
            }
        },
        {
            id: 'return_refined_gold',
            name: '📤 Kembalikan Emas Hasil Refining + Catat Fee',
            category: 'gold_service',
            description: 'Pengembalian emas yang sudah di-refine + pencatatan service fee',
            fields: [
                { name: 'weight', label: 'Berat Hasil (gram)', type: 'number', required: true, step: 0.01 },
                { name: 'purity', label: 'Kadar Akhir (%)', type: 'number', required: true, step: 0.01 },
                { name: 'estimatedValue', label: 'Nilai Emas Dikembalikan (Rp)', type: 'currency', required: true },
                { name: 'serviceFee', label: 'Biaya Jasa Refining (Rp)', type: 'currency', required: true },
                { name: 'customerName', label: 'Nama Customer', type: 'customer_select', required: true },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                return {
                    description: `Kembalikan ${data.weight}g emas @ ${data.purity}% ke ${data.customerName} + fee Rp ${data.serviceFee.toLocaleString('id-ID')}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: mapping.customer_gold_liability, description: 'Pelunasan kewajiban emas titipan', debit: data.estimatedValue, credit: 0 },
                        { accountCode: mapping.cash, description: 'Penerimaan fee refining', debit: data.serviceFee, credit: 0 },
                        { accountCode: mapping.gold_consignment, description: 'Pengembalian emas titipan', debit: 0, credit: data.estimatedValue },
                        { accountCode: mapping.refining_service_revenue, description: 'Pendapatan jasa refining', debit: 0, credit: data.serviceFee }
                    ]
                };
            }
        },
        {
            id: 'pay_production_costs',
            name: '⚡ Bayar Biaya Produksi',
            category: 'gold_production',
            description: 'Pembayaran biaya produksi (listrik furnace, gas, assay)',
            fields: [
                { name: 'amount', label: 'Jumlah', type: 'currency', required: true },
                {
                    name: 'costType', label: 'Jenis Biaya', type: 'select', required: true, options: [
                        { value: Storage.getAccountMapping().production_electricity, label: 'Listrik Produksi (Furnace)' },
                        { value: Storage.getAccountMapping().production_gas, label: 'Gas & Fuel' },
                        { value: Storage.getAccountMapping().assay_lab, label: 'Assay & Lab Testing' },
                        { value: Storage.getAccountMapping().production_safety, label: 'Safety & PPE' }
                    ]
                },
                { name: 'period', label: 'Periode', type: 'text', required: true, placeholder: 'Contoh: Januari 2025' },
                { name: 'description', label: 'Keterangan', type: 'text', required: false }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                return {
                    description: `Biaya produksi ${data.period}${data.description ? ' - ' + data.description : ''}`,
                    lines: [
                        { accountCode: data.costType, description: 'Biaya produksi', debit: data.amount, credit: 0 },
                        { accountCode: mapping.cash, description: 'Pengeluaran kas', debit: 0, credit: data.amount }
                    ]
                };
            }
        },
        {
            id: 'transfer_to_production',
            name: '📤 Transfer ke Produksi (Start Production)',
            category: 'gold_production',
            description: 'Transfer emas dari VAULT ke PROD - mulai proses produksi (create WIP)',
            fields: [
                { name: 'itemCode', label: 'Jenis Emas (dari Master)', type: 'item_select', required: true, filter: 'gold' },
                { name: 'warehouseFrom', label: 'Gudang Asal (VAULT)', type: 'warehouse_select', required: true },
                { name: 'warehouseTo', label: 'Gudang Tujuan (PROD)', type: 'warehouse_select', required: true },
                { name: 'weight', label: 'Berat (gram)', type: 'number', required: true, step: 0.01 },
                { name: 'purity', label: 'Kadar (%)', type: 'number', required: true, step: 0.01 },
                { name: 'pureWeight', label: 'Berat Murni (gram)', type: 'number', required: true, readonly: true, calculated: true },
                { name: 'valuePerGram', label: 'Nilai per Gram (Rp)', type: 'currency', required: true },
                { name: 'totalValue', label: 'Total Nilai WIP', type: 'currency', required: true, readonly: true, calculated: true },
                { name: 'description', label: 'Catatan', type: 'text', required: false, placeholder: 'Untuk production batch #, dll' }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const pureGold = (data.weight * data.purity / 100).toFixed(2);
                const desc = `Transfer ${data.weight}g emas @ ${data.purity}% = ${pureGold}g pure dari ${data.warehouseFrom} ke ${data.warehouseTo} - START PRODUCTION${data.description ? ' - ' + data.description : ''}`;
                return {
                    description: desc,
                    lines: [
                        { accountCode: mapping.wip, description: `Work in Progress - ${data.itemCode} @ ${data.warehouseTo}`, debit: data.amount, credit: 0 },
                        { accountCode: mapping.raw_gold_inventory, description: `Raw Gold Inventory - ${data.itemCode} @ ${data.warehouseFrom}`, debit: 0, credit: data.amount }
                    ]
                };
            }
        },
        {
            id: 'warehouse_transfer',
            name: '📦 Transfer Antar Gudang (Location Move)',
            category: 'gold_production',
            description: 'Transfer barang antar gudang tanpa perubahan status (memo only, no journal)',
            fields: [
                { name: 'itemCode', label: 'Barang (dari Master)', type: 'item_select', required: true },
                { name: 'warehouseFrom', label: 'Gudang Asal', type: 'warehouse_select', required: true },
                { name: 'warehouseTo', label: 'Gudang Tujuan', type: 'warehouse_select', required: true },
                { name: 'quantity', label: 'Jumlah', type: 'number', required: true, step: 0.01 },
                { name: 'description', label: 'Alasan Transfer', type: 'text', required: true, placeholder: 'Contoh: Reorganisasi, security, dll' }
            ],
            generateJournal: (data) => {
                const desc = `MEMO: Transfer ${data.quantity} ${data.itemCode} dari ${data.warehouseFrom} ke ${data.warehouseTo} - ${data.description}`;
                return {
                    description: desc,
                    lines: [
                        // NO JOURNAL - Memo only for tracking
                        // Same account, just different location
                    ]
                };
            }
        },
        {
            id: 'buy_production_equipment',
            name: '🔥 Beli Peralatan Produksi',
            category: 'gold_production',
            description: 'Pembelian furnace, assay equipment, refining equipment',
            fields: [
                { name: 'amount', label: 'Harga Beli', type: 'currency', required: true },
                {
                    name: 'equipmentType', label: 'Jenis Peralatan', type: 'select', required: true, options: [
                        { value: Storage.getAccountMapping().furnace_equipment, label: 'Furnace & Melting Equipment' },
                        { value: Storage.getAccountMapping().assay_equipment, label: 'Assay Equipment' },
                        { value: Storage.getAccountMapping().refining_equipment, label: 'Refining Equipment' },
                        { value: Storage.getAccountMapping().casting_equipment, label: 'Casting Equipment' },
                        { value: Storage.getAccountMapping().testing_equipment, label: 'Testing Equipment' },
                        { value: Storage.getAccountMapping().safety_equipment, label: 'Safety & Ventilation Equipment' }
                    ]
                },
                {
                    name: 'taxStatus', label: 'Status Pajak', type: 'select', required: true, options: [
                        { value: 'non_ppn', label: 'Non-PPN' },
                        { value: 'ppn', label: 'PPN 11%' }
                    ]
                },
                { name: 'description', label: 'Keterangan', type: 'text', required: true, placeholder: 'Contoh: Induction Furnace 5kg capacity' }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                const journal = {
                    description: data.description,
                    lines: [
                        { accountCode: data.equipmentType, description: 'Pembelian peralatan produksi', debit: data.amount, credit: 0 }
                    ]
                };

                let totalPayment = data.amount;
                if (data.taxStatus === 'ppn') {
                    const vatAmount = Math.round(data.amount * 0.11);
                    journal.lines.push({ accountCode: mapping.tax_in, description: 'PPN Masukan (11%)', debit: vatAmount, credit: 0 });
                    totalPayment += vatAmount;
                }

                journal.lines.push({ accountCode: mapping.cash, description: 'Pengeluaran kas', debit: 0, credit: totalPayment });
                return journal;
            }
        },
        {
            id: 'gold_price_revaluation',
            name: '💹 Revaluasi Harga Emas (Mark-to-Market)',
            category: 'gold_adjustment',
            description: 'Penyesuaian nilai inventory berdasarkan harga emas terkini',
            fields: [
                { name: 'amount', label: 'Nilai Selisih (Rp)', type: 'currency', required: true },
                {
                    name: 'adjustmentType', label: 'Jenis Penyesuaian', type: 'select', required: true, options: [
                        { value: 'gain', label: 'Gain (harga naik)' },
                        { value: 'loss', label: 'Loss (harga turun)' }
                    ]
                },
                {
                    name: 'inventoryAccount', label: 'Akun Inventory', type: 'select', required: true, options: [
                        { value: Storage.getAccountMapping().raw_gold_inventory, label: 'Emas Mentah' },
                        { value: '1181', label: 'Gold Bar 24K' },
                        { value: '1182', label: 'Gold Grain' }
                    ]
                },
                { name: 'description', label: 'Keterangan', type: 'text', required: true, placeholder: 'Contoh: Revaluasi per 31 Des 2025' }
            ],
            generateJournal: (data) => {
                const mapping = Storage.getAccountMapping();
                if (data.adjustmentType === 'gain') {
                    return {
                        description: data.description,
                        lines: [
                            { accountCode: data.inventoryAccount, description: 'Revaluasi inventory - gain', debit: data.amount, credit: 0 },
                            { accountCode: mapping.revaluation_gain, description: 'Gain on gold price revaluation', debit: 0, credit: data.amount }
                        ]
                    };
                } else {
                    return {
                        description: data.description,
                        lines: [
                            { accountCode: mapping.revaluation_loss, description: 'Loss on gold price revaluation', debit: data.amount, credit: 0 },
                            { accountCode: data.inventoryAccount, description: 'Revaluasi inventory - loss', debit: 0, credit: data.amount }
                        ]
                    };
                }
            }
        },

        // ===== WAREHOUSE OPERATIONS =====
        {
            id: 'warehouse-transfer',
            name: '🔄 Mutasi Gudang',
            category: 'warehouse',
            description: 'Transfer stock barang antar gudang',
            fields: [
                {
                    name: 'sourceWarehouse', label: 'Dari Gudang', type: 'warehouse_select', required: true
                },
                {
                    name: 'destinationWarehouse', label: 'Ke Gudang', type: 'warehouse_select', required: true
                },
                {
                    name: 'itemCode', label: 'Barang', type: 'item_select', required: true
                },
                {
                    name: 'quantity', label: 'Jumlah', type: 'number', required: true
                },
                { name: 'description', label: 'Catatan', type: 'text', required: false, placeholder: 'Keterangan transfer (opsional)' }
            ],
            // Warehouse transfer doesn't create journal entry - only stock movements
            generateJournal: (data) => null,
            // Custom processing for warehouse transfers
            customProcess: async (data) => {
                // Validate source and destination are different
                if (data.sourceWarehouse === data.destinationWarehouse) {
                    throw new Error('Gudang sumber dan tujuan tidak boleh sama!');
                }

                // Get item details for description
                const items = Storage.get(Storage.KEYS.ITEMS) || [];
                const item = items.find(i => i.code === data.itemCode);
                if (!item) {
                    throw new Error('Item tidak ditemukan!');
                }

                // Check stock availability in source warehouse
                const sourceStock = WarehouseStock.getStock(data.sourceWarehouse, data.itemCode);
                if (sourceStock < data.quantity) {
                    throw new Error(`Stock tidak cukup! Tersedia: ${sourceStock} ${item.uom}, Diminta: ${data.quantity} ${item.uom}`);
                }

                // Create stock movements
                const referenceNumber = `TR-${Date.now()}`;
                const description = `Transfer ${item.name} dari ${data.sourceWarehouse} ke ${data.destinationWarehouse}${data.description ? ' - ' + data.description : ''}`;

                // OUT from source warehouse
                WarehouseStock.updateStock({
                    warehouseCode: data.sourceWarehouse,
                    itemCode: data.itemCode,
                    quantity: -data.quantity,
                    type: 'OUT',
                    reference: referenceNumber,
                    description: description
                });

                // IN to destination warehouse
                WarehouseStock.updateStock({
                    warehouseCode: data.destinationWarehouse,
                    itemCode: data.itemCode,
                    quantity: data.quantity,
                    type: 'IN',
                    reference: referenceNumber,
                    description: description
                });

                // Store transfer record for printing
                const transferRecord = {
                    referenceNumber,
                    date: data.date || new Date().toISOString().split('T')[0],
                    sourceWarehouse: data.sourceWarehouse,
                    destinationWarehouse: data.destinationWarehouse,
                    itemCode: data.itemCode,
                    itemName: item.name,
                    quantity: data.quantity,
                    uom: item.uom,
                    description: data.description || '',
                    createdBy: Auth?.getCurrentUser?.()?.name || 'System',
                    createdAt: new Date().toLocaleString('id-ID')
                };

                return {
                    success: true,
                    message: `✅ Transfer berhasil!<br>Ref: ${referenceNumber}<br>${data.quantity} ${item.uom} ${item.name}<br>Dari: ${data.sourceWarehouse} → Ke: ${data.destinationWarehouse}`,
                    transferRecord: transferRecord
                };
            }
        }
    ],

    init(templateId = null) {
        console.log('🔍 SimpleTransaction.init called with templateId:', templateId);

        // SECURITY: If template is specified from menu, go directly to form
        // Do NOT show template selector (prevents unauthorized access)
        if (templateId) {
            this.renderDirectForm(templateId);
        } else {
            // No template specified - show full template selector
            this.render();
        }
    },

    renderDirectForm(templateId) {
        const content = document.getElementById('main-content');

        // Render minimal header
        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">💳 Transaksi Sederhana</h1>
                <p class="page-description">Input transaksi dengan mudah</p>
            </div>
            
            <div id="transaction-form-container"></div>
            <div id="transaction-history-container" class="mt-4">
                ${this.renderHistory()}
            </div>
        `;

        // Directly select and show the template form
        setTimeout(() => {
            this.selectTemplate(templateId);
        }, 50);
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">💳 Transaksi Sederhana</h1>
        <p class="page-description">Input transaksi dengan mudah tanpa perlu tahu debit/kredit</p>
      </div>

      <div class="alert alert-info mb-3">
        <strong>ℹ️ Mode Sederhana:</strong> Pilih jenis transaksi, isi form, dan sistem akan otomatis membuat jurnal yang benar sesuai standar akuntansi.
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Pilih Jenis Transaksi</h2>
        </div>
        <div class="card-body">
          ${this.renderTemplateSelector()}
        </div>
      </div>

      <div id="transaction-form-container"></div>
      <div id="transaction-history-container" class="mt-4">
        ${this.renderHistory()}
      </div>
    `;
    },

    renderTemplateSelector() {
        const categories = {
            sales: { name: '💰 PENJUALAN', icon: '', color: '#10b981' },
            purchase: { name: '🛒 PEMBELIAN', icon: '', color: '#ef4444' },
            warehouse: { name: '📦 GUDANG', icon: '', color: '#8b5cf6' },
            finance: { name: '🏦 KEUANGAN', icon: '', color: '#3b82f6' },
            gold_purchase: { name: '⚜️ Pembelian Emas', icon: '', color: '#f59e0b' },
            gold_sales: { name: '🥇 Penjualan Emas', icon: '', color: '#eab308' },
            gold_production: { name: '🔥 Produksi Emas', icon: '', color: '#f97316' },
            gold_service: { name: '✨ Jasa Refining', icon: '', color: '#a78bfa' },
            gold_adjustment: { name: '💹 Adjustment Emas', icon: '', color: '#6366f1' }
        };

        let html = '<div class="template-categories">';

        for (const [catKey, catInfo] of Object.entries(categories)) {
            const templates = this.templates.filter(t => t.category === catKey);

            html += `
        <div class="template-category">
          <h3 class="category-title" style="color: ${catInfo.color}">
            ${catInfo.icon} ${catInfo.name}
          </h3>
          <div class="template-grid">
            ${templates.map(template => `
              <button class="template-card" onclick="SimpleTransaction.selectTemplate('${template.id}')">
                <div class="template-name">${template.name}</div>
                <div class="template-desc">${template.description}</div>
              </button>
            `).join('')}
          </div>
        </div>
      `;
        }

        html += '</div>';
        return html;
    },

    selectTemplate(templateId) {
        console.log('🔍 SimpleTransaction.selectTemplate called with:', templateId);
        this.currentTemplate = this.templates.find(t => t.id === templateId);

        if (!this.currentTemplate) {
            console.error('❌ Template not found:', templateId);
            console.log('📋 Available templates:', this.templates.map(t => t.id));

            // Show error to user
            const container = document.getElementById('transaction-form-container');
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-error mt-3">
                        <strong>⚠️ Template tidak ditemukan:</strong> "${templateId}"<br>
                        Silakan pilih template dari daftar di bawah.
                    </div>
                `;
            }
            return;
        }

        console.log('✅ Template found:', this.currentTemplate.name);

        const container = document.getElementById('transaction-form-container');
        container.innerHTML = `
      <div class="card mt-3">
        <div class="card-header">
          <h2 class="card-title">${this.currentTemplate.name}</h2>
          <p style="color: var(--text-secondary); margin: 0.5rem 0 0 0;">${this.currentTemplate.description}</p>
        </div>
        <div class="card-body">
          ${this.renderTransactionForm()}
        </div>
      </div>
        `;

        if (this.currentTemplate.id === 'purchase_credit' || this.currentTemplate.id === 'purchase_cash') {
            setTimeout(() => {
                if (document.querySelectorAll('#purchase-items .purchase-item-row').length === 0) {
                    this.addPurchaseItemRow();
                }
            }, 0);
        }

        // Scroll to form
        container.scrollIntoView({ behavior: 'smooth' });
    },

    renderTransactionForm() {
        const today = new Date().toISOString().split('T')[0];

        // Auto-detect transaction type for preview
        let previewType = 'JRN';
        const templateId = this.currentTemplate.id;

        // Detect cash transactions
        if (templateId.includes('cash') || templateId.includes('tunai') ||
            templateId.includes('pay_') || templateId.includes('buy_supplies') ||
            templateId.includes('pay_utilities') || templateId.includes('pay_rent') ||
            templateId.includes('pay_salary') || templateId.includes('buy_asset_cash') ||
            templateId.includes('_withdrawal') || templateId.includes('purchase_') ||
            templateId.includes('sales_cash') || templateId.includes('receive_payment') ||
            templateId.includes('other_income') || templateId.includes('capital_investment') ||
            templateId.includes('receive_loan') || templateId.includes('pay_loan')) {
            previewType = 'CSH';
        }
        // Detect bank transactions  
        else if (templateId.includes('bank') || templateId.includes('deposit') ||
            templateId.includes('withdraw')) {
            previewType = 'BNK';
        }

        const previewRef = Storage.previewNextReferenceNumber(previewType);

        if (this.currentTemplate.id === 'purchase_credit' || this.currentTemplate.id === 'purchase_cash') {
            return this.renderPurchaseMultiItemForm(today, previewRef);
        }

        return `
      <form id="simple-transaction-form" onsubmit="SimpleTransaction.handleSubmit(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Tanggal</label>
            <input type="date" name="date" class="form-input" value="${today}" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">No. Referensi (Auto)</label>
            <input type="text" class="form-input" value="${previewRef}" readonly 
                   style="background: var(--bg-secondary); color: var(--text-secondary); cursor: not-allowed;">
            <small class="text-gray">Otomatis generated saat simpan</small>
          </div>
        </div>

        ${this.currentTemplate.fields.map(field => this.renderField(field)).join('')}

        <div class="flex justify-between align-center mt-3">
          <button type="button" class="btn btn-secondary" onclick="SimpleTransaction.cancel()">
            Batal
          </button>
          <button type="submit" class="btn btn-success">
            💾 Simpan Transaksi
          </button>
        </div>
      </form>
    `;
    },

    renderPurchaseMultiItemForm(today, previewRef) {
        const isCredit = this.currentTemplate.id === 'purchase_credit';
        return `
      <form id="simple-transaction-form" onsubmit="SimpleTransaction.handleSubmit(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Tanggal</label>
            <input type="date" name="date" class="form-input" value="${today}" required>
          </div>
          <div class="form-group">
            <label class="form-label">No. Referensi (Auto)</label>
            <input type="text" class="form-input" value="${previewRef}" readonly
                   style="background: var(--bg-secondary); color: var(--text-secondary); cursor: not-allowed;">
            <small class="text-gray">Otomatis generated saat simpan transaksi</small>
          </div>
        </div>

        ${this.renderField({ name: 'supplierName', label: 'Supplier', type: 'supplier_select', required: true })}
        ${this.renderField({ name: 'warehouseCode', label: 'Gudang Tujuan', type: 'warehouse_select', required: true })}

        <div class="form-group">
          <label class="form-label required">Barang Pembelian</label>
          <div class="table-container">
            <table class="table" style="table-layout: fixed; width: 100%;">
              <thead>
                <tr>
                  <th style="width: 36%;">Barang</th>
                  <th style="width: 14%;">Qty</th>
                  <th style="width: 22%;">Harga Satuan</th>
                  <th style="width: 22%;">Subtotal</th>
                  <th style="width: 6%;"></th>
                </tr>
              </thead>
              <tbody id="purchase-items"></tbody>
            </table>
          </div>
          <button type="button" class="btn btn-secondary btn-sm mt-1" onclick="SimpleTransaction.addPurchaseItemRow()">
            + Tambah Item Lainnya
          </button>
        </div>

        <div class="form-group">
          <label class="form-label required">Total Harga</label>
          <input type="number" name="totalAmount" id="totalAmount" class="form-input"
                 value="0" readonly required style="background: var(--bg-secondary); cursor: not-allowed;">
          <small class="text-gray">Total otomatis dari semua item</small>
        </div>

        ${this.renderField({
            name: 'taxStatus', label: 'Status Pajak', type: 'select', required: true, options: [
                { value: 'non_ppn', label: 'Non-PPN' },
                { value: 'ppn', label: 'PPN 11%' }
            ]
        })}
        ${isCredit ? this.renderField({ name: 'downPayment', label: 'Uang Muka/DP (Opsional)', type: 'currency', required: false }) : ''}
        ${this.renderField({ name: 'paymentAccount', label: isCredit ? 'Bayar DP Dari' : 'Bayar Dari', type: 'payment_account_select', required: !isCredit })}
        ${this.renderField({ name: 'description', label: 'Catatan', type: 'text', required: false, placeholder: 'Catatan tambahan (opsional)' })}

        <div class="flex justify-between align-center mt-3">
          <button type="button" class="btn btn-secondary" onclick="SimpleTransaction.cancel()">Batal</button>
          <div class="btn-group">
            <button type="button" class="btn btn-warning" onclick="SimpleTransaction.saveDraft()">💾 Simpan Draft</button>
            <button type="submit" class="btn btn-success">✅ Simpan Transaksi</button>
          </div>
        </div>
      </form>
    `;
    },

    addPurchaseItemRow(item = {}) {
        const tbody = document.getElementById('purchase-items');
        if (!tbody) return;

        const rowId = `purchase-item-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const items = Storage.getItems() || [];
        const options = items.map(masterItem => `
            <option value="${masterItem.code}" ${item.itemCode === masterItem.code ? 'selected' : ''}>
                ${masterItem.code} - ${masterItem.name}
            </option>
        `).join('');

        tbody.insertAdjacentHTML('beforeend', `
            <tr id="${rowId}" class="purchase-item-row">
              <td>
                <select name="purchaseItemCode" class="form-select" required>
                  <option value="">-- Pilih Barang --</option>
                  ${options}
                </select>
              </td>
              <td><input type="number" name="purchaseQuantity" class="form-input" min="0" step="0.01" value="${item.quantity || ''}" onchange="SimpleTransaction.calculateTotal()" required></td>
              <td><input type="number" name="purchaseUnitPrice" class="form-input" min="0" step="1" value="${item.unitPrice || ''}" onchange="SimpleTransaction.calculateTotal()" required></td>
              <td><input type="number" name="purchaseSubtotal" class="form-input" value="${item.amount || 0}" readonly style="background: var(--bg-secondary); cursor: not-allowed;"></td>
              <td class="text-center">
                <button type="button" class="btn btn-sm btn-danger" onclick="document.getElementById('${rowId}').remove(); SimpleTransaction.calculateTotal();" title="Hapus item">×</button>
              </td>
            </tr>
        `);

        this.calculateTotal();
    },

    collectPurchaseItems() {
        const rows = Array.from(document.querySelectorAll('#purchase-items .purchase-item-row'));
        return rows.map(row => {
            const itemCode = row.querySelector('[name="purchaseItemCode"]')?.value || '';
            const quantity = parseFloat(row.querySelector('[name="purchaseQuantity"]')?.value) || 0;
            const unitPrice = parseFloat(row.querySelector('[name="purchaseUnitPrice"]')?.value) || 0;
            return {
                itemCode,
                quantity,
                unitPrice,
                amount: quantity * unitPrice
            };
        }).filter(item => item.itemCode && item.quantity > 0 && item.unitPrice > 0);
    },

    getDrafts() {
        try {
            return JSON.parse(localStorage.getItem('simple_transaction_drafts') || '[]');
        } catch (error) {
            return [];
        }
    },

    saveDraft() {
        if (!this.currentTemplate) return;

        const form = document.getElementById('simple-transaction-form');
        if (!form) return;

        const formData = new FormData(form);
        const data = {};
        this.currentTemplate.fields.forEach(field => {
            const value = formData.get(field.name);
            data[field.name] = (field.type === 'currency' || field.type === 'number') ? (parseFloat(value) || 0) : value;
        });

        if (this.currentTemplate.id === 'purchase_credit' || this.currentTemplate.id === 'purchase_cash') {
            data.items = this.collectPurchaseItems();
            data.totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);
        }

        const drafts = this.getDrafts();
        drafts.unshift({
            id: Date.now(),
            templateId: this.currentTemplate.id,
            templateName: this.currentTemplate.name,
            date: formData.get('date'),
            data,
            createdAt: new Date().toISOString(),
            createdBy: Auth?.getCurrentUser?.()?.name || 'System'
        });

        localStorage.setItem('simple_transaction_drafts', JSON.stringify(drafts.slice(0, 50)));
        this.showAlert('success', '✅ Draft berhasil disimpan. Belum ada jurnal atau stok yang diposting.');
        this.updateHistoryUI();
    },

    loadDraft(draftId) {
        const draft = this.getDrafts().find(item => String(item.id) === String(draftId));
        if (!draft) {
            this.showAlert('error', 'Draft tidak ditemukan');
            return;
        }

        this.selectTemplate(draft.templateId);
        setTimeout(() => {
            const form = document.getElementById('simple-transaction-form');
            if (!form) return;

            if (draft.date) {
                const dateInput = form.querySelector('[name="date"]');
                if (dateInput) dateInput.value = draft.date;
            }

            Object.entries(draft.data || {}).forEach(([key, value]) => {
                if (key === 'items') return;
                const input = form.querySelector(`[name="${key}"]`);
                if (input) input.value = value;
            });

            if (draft.templateId === 'purchase_credit' || draft.templateId === 'purchase_cash') {
                const tbody = document.getElementById('purchase-items');
                if (tbody) tbody.innerHTML = '';
                (draft.data.items || []).forEach(item => this.addPurchaseItemRow(item));
                if (!draft.data.items || draft.data.items.length === 0) this.addPurchaseItemRow();
                this.calculateTotal();
            }
        }, 50);
    },

    deleteDraft(draftId) {
        const drafts = this.getDrafts().filter(item => String(item.id) !== String(draftId));
        localStorage.setItem('simple_transaction_drafts', JSON.stringify(drafts));
        this.updateHistoryUI();
    },

    renderField(field) {
        if (field.type === 'currency') {
            const readonlyAttr = field.readonly ? 'readonly style="background: var(--bg-secondary); cursor: not-allowed;"' : '';
            const onchangeAttr = field.calculated ? '' : 'onchange="SimpleTransaction.calculateTotal()"';
            return `
        <div class="form-group">
          <label class="form-label ${field.required ? 'required' : ''}">${field.label}</label>
          <input type="number" name="${field.name}" id="${field.name}" class="form-input" 
                 placeholder="${field.placeholder || '0'}" 
                 min="0" step="1" ${field.required ? 'required' : ''} ${readonlyAttr} ${onchangeAttr}>
          ${field.calculated ? '<small class="text-gray">Kalkulasi otomatis dari Qty x Harga Satuan</small>' : ''}
        </div>
      `;
        } else if (field.type === 'number') {
            return `
        <div class="form-group">
          <label class="form-label ${field.required ? 'required' : ''}">${field.label}</label>
          <input type="number" name="${field.name}" id="${field.name}" class="form-input" 
                 placeholder="${field.placeholder || '0'}" 
                 step="${field.step || '1'}" ${field.required ? 'required' : ''} 
                 onchange="SimpleTransaction.calculateTotal()">
        </div>
      `;
        } else if (field.type === 'customer_select') {
            const customers = Storage.getCustomers();
            return `
        <div class="form-group">
          <label class="form-label ${field.required ? 'required' : ''}">${field.label}</label>
          <select name="${field.name}" class="form-select" ${field.required ? 'required' : ''}>
            <option value="">-- Pilih Customer --</option>
            ${customers.map(c => `<option value="${c.name}">${c.code} - ${c.name}</option>`).join('')}
          </select>
          <small class="text-gray">Data dari Master Customer. <a href="#" onclick="event.preventDefault(); App.navigateTo('master-customer');">Kelola Customer →</a></small>
        </div>
      `;
        } else if (field.type === 'supplier_select') {
            const suppliers = Storage.getSuppliers();
            return `
        <div class="form-group">
          <label class="form-label ${field.required ? 'required' : ''}">${field.label}</label>
          <select name="${field.name}" class="form-select" ${field.required ? 'required' : ''}>
            <option value="">-- Pilih Supplier --</option>
            ${suppliers.map(s => `<option value="${s.name}">${s.code} - ${s.name}</option>`).join('')}
          </select>
          <small class="text-gray">Data dari Master Supplier. <a href="#" onclick="event.preventDefault(); App.navigateTo('master-supplier');">Kelola Supplier →</a></small>
        </div>
      `;
        } else if (field.type === 'warehouse_select') {
            const warehouses = Storage.getWarehouses() || [];
            return `
        <div class="form-group">
          <label class="form-label ${field.required ? 'required' : ''}">${field.label}</label>
          <select name="${field.name}" id="${field.name}" class="form-select" ${field.required ? 'required' : ''}>
            <option value="">-- Pilih Gudang --</option>
            ${warehouses.map(w => `<option value="${w.code}">${w.code} - ${w.name}</option>`).join('')}
          </select>
          <small class="text-gray">Data dari Master Warehouse. <a href="#" onclick="event.preventDefault(); App.navigateTo('master-warehouse');">Kelola Warehouse →</a></small>
        </div>
      `;
        } else if (field.type === 'item_select') {
            const items = Storage.getItems() || [];
            let filteredItems = items;
            if (field.filter === 'gold') {
                filteredItems = items.filter(i => i.category && (i.category.toLowerCase().includes('emas') || i.category.toLowerCase().includes('gold')));
            } else if (field.filter === 'chemicals') {
                filteredItems = items.filter(i => i.category && (i.category.toLowerCase().includes('chemical') || i.category.toLowerCase().includes('consumable') || i.category.toLowerCase().includes('flux')));
            }
            return `
        <div class="form-group">
          <label class="form-label ${field.required ? 'required' : ''}">${field.label}</label>
          <select name="${field.name}" id="${field.name}" class="form-select" ${field.required ? 'required' : ''}>
            <option value="">-- Pilih Barang --</option>
            ${filteredItems.map(item => `<option value="${item.code}" data-name="${item.name}">${item.code} - ${item.name}</option>`).join('')}
          </select>
          <small class="text-gray">Data dari Master Item. <a href="#" onclick="event.preventDefault(); App.navigateTo('master-item');">Kelola Item →</a></small>
        </div>
      `;
        } else if (field.type === 'payment_account_select') {
            const mapping = Storage.getAccountMapping();
            const bankAccounts = typeof Storage.getBankAccounts === 'function' ? Storage.getBankAccounts() : [];
            const coa = typeof Storage.getChartOfAccounts === 'function' ? Storage.getChartOfAccounts() : [];
            let options = `<option value="${mapping.cash}">Kas Tunai (${mapping.cash})</option>`;
            
            bankAccounts.forEach(bank => {
                const accountCode = bank.glAccount || bank.accountCode || bank.code;
                const coaAccount = coa.find(acc => String(acc.code) === String(accountCode));
                const accountName = coaAccount?.name || bank.name || bank.bankName || 'Bank';
                if (!accountCode) return;
                options += `<option value="${accountCode}">${accountName} (${accountCode}) - ${bank.accountNumber || ''}</option>`;
            });

            return `
        <div class="form-group">
          <label class="form-label ${field.required ? 'required' : ''}">${field.label}</label>
          <select name="${field.name}" id="${field.name}" class="form-select" ${field.required ? 'required' : ''}>
            ${options}
          </select>
          <small class="text-gray">Pilih sumber dana pembayaran (Kas atau Bank)</small>
        </div>
      `;
        } else if (field.type === 'select') {
            return `
        <div class="form-group">
          <label class="form-label ${field.required ? 'required' : ''}">${field.label}</label>
          <select name="${field.name}" class="form-select" ${field.required ? 'required' : ''}>
            <option value="">Pilih ${field.label}...</option>
            ${field.options.map(opt => `
              <option value="${opt.value}">${opt.label}</option>
            `).join('')}
          </select>
        </div>
      `;
        } else if (field.type === 'textarea') {
            return `
        <div class="form-group">
          <label class="form-label ${field.required ? 'required' : ''}">${field.label}</label>
          <textarea name="${field.name}" class="form-textarea" rows="3" 
                    placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}></textarea>
        </div>
      `;
        } else {
            return `
        <div class="form-group">
          <label class="form-label ${field.required ? 'required' : ''}">${field.label}</label>
          <input type="text" name="${field.name}" class="form-input" 
                 placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}>
        </div>
      `;
        }
    },

    calculateTotal() {
        const purchaseRows = document.querySelectorAll('#purchase-items .purchase-item-row');
        if (purchaseRows.length > 0) {
            let total = 0;
            purchaseRows.forEach(row => {
                const quantity = parseFloat(row.querySelector('[name="purchaseQuantity"]')?.value) || 0;
                const unitPrice = parseFloat(row.querySelector('[name="purchaseUnitPrice"]')?.value) || 0;
                const subtotal = quantity * unitPrice;
                const subtotalInput = row.querySelector('[name="purchaseSubtotal"]');
                if (subtotalInput) subtotalInput.value = subtotal;
                total += subtotal;
            });

            const totalAmountInput = document.getElementById('totalAmount');
            if (totalAmountInput) totalAmountInput.value = total;
            return;
        }

        // Calculate total amount for purchase/sales forms with quantity
        const quantityInput = document.getElementById('quantity');
        const unitPriceInput = document.getElementById('unitPrice');
        const totalAmountInput = document.getElementById('totalAmount');

        // For regular items (quantity x unit price)
        if (quantityInput && unitPriceInput && totalAmountInput) {
            const quantity = parseFloat(quantityInput.value) || 0;
            const unitPrice = parseFloat(unitPriceInput.value) || 0;
            const total = quantity * unitPrice;
            totalAmountInput.value = total;
        }

        // For gold purchases (weight x purity% = pure weight, and weight x price = total)
        const weightInput = document.getElementById('weight');
        const purityInput = document.getElementById('purity');
        const pureWeightInput = document.getElementById('pureWeight');
        const pricePerGramInput = document.getElementById('pricePerGram');
        const totalAmountInputGold = document.getElementById('totalAmount');

        // For standard purity (existing templates)
        if (weightInput && purityInput && pureWeightInput) {
            const weight = parseFloat(weightInput.value) || 0;
            const purity = parseFloat(purityInput.value) || 0;
            const pureWeight = (weight * purity / 100).toFixed(2);
            pureWeightInput.value = pureWeight;
        }

        // For ESTIMATED purity (pending lab test)
        const estimatedPurityInput = document.getElementById('estimatedPurity');
        const estimatedPureWeightInput = document.getElementById('estimatedPureWeight');
        if (weightInput && estimatedPurityInput && estimatedPureWeightInput) {
            const weight = parseFloat(weightInput.value) || 0;
            const purity = parseFloat(estimatedPurityInput.value) || 0;
            const pureWeight = (weight * purity / 100).toFixed(2);
            estimatedPureWeightInput.value = pureWeight;
        }

        // For ACTUAL purity (after lab test confirmation)
        const actualPurityInput = document.getElementById('actualPurity');
        const actualPureWeightInput = document.getElementById('actualPureWeight');
        if (weightInput && actualPurityInput && actualPureWeightInput) {
            const weight = parseFloat(weightInput.value) || 0;
            const purity = parseFloat(actualPurityInput.value) || 0;
            const pureWeight = (weight * purity / 100).toFixed(2);
            actualPureWeightInput.value = pureWeight;
        }

        // Calculate total amount (weight x price per gram)
        if (weightInput && pricePerGramInput && totalAmountInputGold) {
            const weight = parseFloat(weightInput.value) || 0;
            const pricePerGram = parseFloat(pricePerGramInput.value) || 0;
            const total = weight * pricePerGram;
            totalAmountInputGold.value = total;
        }
    },

    validateDataIntegrity() {
        if (!this.currentTemplate) {
            alert('⚠️ Transaksi tidak valid: Template tidak terpilih.');
            return false;
        }

        const form = document.getElementById('simple-transaction-form');
        if (!form) {
            console.error('🛑 [Integrity Guard] Missing #simple-transaction-form');
            alert('⚠️ Sistem Tidak Stabil: Form transaksi hilang. Harap refresh halaman.');
            return false;
        }

        // Check mandatory fields defined in template
        for (const field of this.currentTemplate.fields) {
            if ((this.currentTemplate.id === 'purchase_credit' || this.currentTemplate.id === 'purchase_cash') && ['itemCode', 'quantity', 'unitPrice'].includes(field.name)) {
                continue;
            }
            if (field.required) {
                const el = form.querySelector(`[name="${field.name}"]`);
                if (!el) {
                    console.error(`🛑 [Integrity Guard] Missing required field element: ${field.name}`);
                    alert(`⚠️ Sistem Tidak Stabil: Kolom "${field.label}" hilang dari form. Harap refresh halaman.`);
                    return false;
                }
            }
        }

        return true;
    },

    async handleSubmit(event) {
        if (!this.validateDataIntegrity()) return;
        event.preventDefault();
        const formData = new FormData(event.target);

        // Collect field data
        const data = {};
        this.currentTemplate.fields.forEach(field => {
            const value = formData.get(field.name);
            if (field.type === 'currency' || field.type === 'number') {
                data[field.name] = parseFloat(value) || 0;
            } else {
                data[field.name] = value;
            }
        });

        if (this.currentTemplate.id === 'purchase_credit' || this.currentTemplate.id === 'purchase_cash') {
            data.items = this.collectPurchaseItems();
            data.amount = data.items.reduce((sum, item) => sum + item.amount, 0);
            data.itemCode = data.items.map(item => item.itemCode).join(', ');
            data.quantity = data.items.reduce((sum, item) => sum + item.quantity, 0);
            data.unitPrice = data.items.length === 1 ? data.items[0].unitPrice : 0;
            data.totalAmount = data.amount;
        }

        // Calculate total amount if needed
        if (this.currentTemplate.id === 'purchase_credit' || this.currentTemplate.id === 'purchase_cash') {
            // Already calculated from multi-item rows.
        } else if (data.quantity && data.unitPrice) {
            data.amount = data.quantity * data.unitPrice;
        } else if (data.totalAmount) {
            data.amount = data.totalAmount;
        }

        //  Validate
        const errors = this.validateData(data);
        if (errors.length > 0) {
            alert('Error:\n' + errors.join('\n'));
            return;
        }

        // DAY 3 INTEGRATION: Validate stock availability for sales transactions BEFORE processing
        if ((this.currentTemplate.id === 'sales_cash' || this.currentTemplate.id === 'sales_credit')
            && data.itemCode && data.quantity && data.warehouseCode) {
            try {
                const currentStock = WarehouseStock.getStock(data.warehouseCode, data.itemCode);
                if (currentStock.quantity < data.quantity) {
                    this.showAlert('error',
                        `❌ Stock tidak mencukupi!\n\n` +
                        `Item: ${data.itemCode}\n` +
                        `Gudang: ${data.warehouseCode}\n` +
                        `Stock Tersedia: ${currentStock.quantity.toFixed(2)}\n` +
                        `Jumlah Diminta: ${data.quantity.toFixed(2)}\n\n` +
                        `Silakan kurangi quantity atau pilih gudang lain.`
                    );
                    return; // Stop transaction
                }
            } catch (stockError) {
                console.error('Warning: Stock validation failed:', stockError);
                // Continue transaction if stock check fails (defensive)
            }
        }

        // Check if template has custom processing (e.g., warehouse transfer)
        if (this.currentTemplate.customProcess) {
            try {
                const result = await this.currentTemplate.customProcess(data);
                if (result.success) {
                    // Show success message with print button for warehouse transfer
                    if (result.transferRecord) {
                        const printButtonHtml = `<br><br><button class="btn btn-primary" onclick="SimpleTransaction.printWarehouseTransfer(${JSON.stringify(result.transferRecord).replace(/"/g, '&quot;')})">🖨️ Print Surat Mutasi</button>`;
                        this.showAlert('success', result.message + printButtonHtml);
                    } else {
                        this.showAlert('success', result.message);
                    }
                    this.cancel();
                    return;
                } else {
                    this.showAlert('error', result.message || 'Transaction failed');
                    return;
                }
            } catch (error) {
                this.showAlert('error', error.message);
                return;
            }
        }

        // Generate journal entry
        const journalData = this.currentTemplate.generateJournal(data);

        // Skip journal creation if generateJournal returns null (e.g. warehouse transfer)
        if (!journalData) {
            this.showAlert('error', 'Template configuration error: No journal data generated');
            return;
        }

        try {
            // Auto-detect transaction type based on accounts
            let transactionType = 'JRN';
            const mapping = Storage.getAccountMapping();
            
            if (journalData.lines.some(l => {
                const code = l.accountCode || '';
                return code.startsWith('111') || code === mapping.cash;
            })) {
                transactionType = 'CSH'; // Cash transaction
            } else if (journalData.lines.some(l => {
                const code = l.accountCode || '';
                return code.startsWith('112') || code === mapping.bank;
            })) {
                transactionType = 'BNK'; // Bank transaction
            }

            // Use existing JournalEntry module to create entry
            const journalEntry = await JournalEntry.createEntry({
                date: formData.get('date'),
                reference: '', // Will be auto-generated
                description: journalData.description,
                lines: journalData.lines,
                transactionType: transactionType,
                manualReference: false
            });

            // DAY 2 INTEGRATION: Update warehouse stock for purchase transactions
            if ((this.currentTemplate.id === 'purchase_cash' || this.currentTemplate.id === 'purchase_credit')
                && data.itemCode && data.quantity && data.warehouseCode) {
                try {
                    const stockItems = Array.isArray(data.items) && data.items.length > 0
                        ? data.items
                        : [{ itemCode: data.itemCode, quantity: data.quantity, unitPrice: data.unitPrice }];

                    stockItems.forEach(item => {
                        WarehouseStock.updateStock(
                            data.warehouseCode,
                            item.itemCode,
                            item.quantity,
                            item.unitPrice,
                            journalEntry.reference || `PO-${Date.now()}`,
                            'IN'
                        );
                    });
                    console.log(`✅ Stock updated: ${stockItems.length} item(s) added to ${data.warehouseCode}`);
                } catch (stockError) {
                    console.error('Warning: Stock update failed:', stockError);
                    // Don't block transaction if stock update fails
                }
            }

            // DAY 3 INTEGRATION: Update warehouse stock for sales transactions (OUT movement)
            if ((this.currentTemplate.id === 'sales_cash' || this.currentTemplate.id === 'sales_credit')
                && data.itemCode && data.quantity && data.warehouseCode) {
                try {
                    WarehouseStock.updateStock(
                        data.warehouseCode,
                        data.itemCode,
                        data.quantity,
                        data.unitPrice,
                        journalEntry.reference || `SO-${Date.now()}`,
                        'OUT'
                    );
                    console.log(`✅ Stock updated: ${data.quantity} ${data.itemCode} removed from ${data.warehouseCode}`);
                } catch (stockError) {
                    console.error('Critical: Stock OUT movement failed:', stockError);
                    // This should not happen since we validated above, but log it
                }
            }

            // GOLD REFINERY INTEGRATION: Update stock for specific gold transaction types
            const ref = journalEntry.reference || `GLD-${Date.now()}`;

            // 1. Receive Gold Pending Lab (IN to LAB)
            if (this.currentTemplate.id === 'receive_gold_pending_lab' && data.itemCode && data.weight && data.warehouseCode) {
                try {
                    WarehouseStock.updateStock(
                        data.warehouseCode,
                        data.itemCode,
                        data.weight,
                        data.pricePerGram,
                        ref,
                        'IN'
                    );
                    console.log(`✅ Gold received to LAB: ${data.weight}g ${data.itemCode} added to ${data.warehouseCode}`);
                } catch (stockError) {
                    console.error('Warning: Gold receipt stock update failed:', stockError);
                }
            }

            // 2. Confirm Lab Test (OUT from LAB, IN to VAULT)
            if (this.currentTemplate.id === 'confirm_lab_test_gold' && data.itemCode && data.weight && data.warehouseFrom && data.warehouseTo) {
                try {
                    // OUT from LAB
                    WarehouseStock.updateStock(
                        data.warehouseFrom,
                        data.itemCode,
                        data.weight,
                        data.pricePerGram,
                        ref,
                        'OUT'
                    );
                    // IN to VAULT
                    WarehouseStock.updateStock(
                        data.warehouseTo,
                        data.itemCode,
                        data.weight,
                        data.pricePerGram,
                        ref,
                        'IN'
                    );
                    console.log(`✅ Gold moved from LAB (${data.warehouseFrom}) to VAULT (${data.warehouseTo})`);
                } catch (stockError) {
                    console.error('Warning: Gold confirmation stock move failed:', stockError);
                }
            }

            // 3. Transfer to Production (OUT from VAULT, IN to PROD)
            if (this.currentTemplate.id === 'transfer_to_production' && data.itemCode && data.weight && data.warehouseFrom && data.warehouseTo) {
                try {
                    // OUT from VAULT
                    WarehouseStock.updateStock(
                        data.warehouseFrom,
                        data.itemCode,
                        data.weight,
                        data.valuePerGram,
                        ref,
                        'OUT'
                    );
                    // IN to PROD
                    WarehouseStock.updateStock(
                        data.warehouseTo,
                        data.itemCode,
                        data.weight,
                        data.valuePerGram,
                        ref,
                        'IN'
                    );
                    console.log(`✅ Gold transferred to production from ${data.warehouseFrom} to ${data.warehouseTo}`);
                } catch (stockError) {
                    console.error('Warning: Gold production transfer failed:', stockError);
                }
            }

            this.showAlert('success', '✅ Transaksi berhasil disimpan dan jurnal otomatis dibuat!');

            // Reset form
            this.cancel();
            
            // Refresh history UI
            this.updateHistoryUI();

            // Refresh journal list if on journal page
            if (typeof JournalEntry !== 'undefined' && typeof JournalEntry.loadEntries === 'function') {
                JournalEntry.loadEntries();
            }
        } catch (error) {
            this.showAlert('error', error.message);
        }
    },

    validateData(data) {
        const errors = [];

        this.currentTemplate.fields.forEach(field => {
            if ((this.currentTemplate.id === 'purchase_credit' || this.currentTemplate.id === 'purchase_cash') && ['itemCode', 'quantity', 'unitPrice'].includes(field.name)) {
                return;
            }
            if (field.required && !data[field.name]) {
                errors.push(`${field.label} harus diisi`);
            }
            if (field.type === 'currency' && field.required && data[field.name] <= 0) {
                errors.push(`${field.label} harus lebih dari 0`);
            }
        });

        if (this.currentTemplate.id === 'purchase_credit' || this.currentTemplate.id === 'purchase_cash') {
            if (!data.items || data.items.length === 0) {
                errors.push('Minimal 1 barang pembelian harus diisi lengkap');
            }
            if (!data.amount || data.amount <= 0) {
                errors.push('Total harga harus lebih dari 0');
            }
            if (this.currentTemplate.id === 'purchase_credit' && data.downPayment && data.downPayment > data.amount * (data.taxStatus === 'ppn' ? 1.11 : 1)) {
                errors.push('Uang muka/DP tidak boleh lebih besar dari total tagihan');
            }
        }

        // Special validations
        if (this.currentTemplate.id === 'buy_asset_loan') {
            if (data.cashPayment > data.assetPrice) {
                errors.push('Uang muka tidak boleh lebih besar dari harga aset');
            }
        }

        return errors;
    },

    cancel() {
        this.currentTemplate = null;
        document.getElementById('transaction-form-container').innerHTML = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    updateHistoryUI() {
        const container = document.getElementById('transaction-history-container');
        if (container) {
            container.innerHTML = this.renderHistory();
        }
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount || 0);
    },

    renderHistory() {
        const journals = Storage.getJournalEntries() || [];
        const drafts = this.getDrafts();
        // Get last 5 simple transactions (usually CSH or BNK type, or recent ones)
        const sorted = journals.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)).slice(0, 5);
        
        if (sorted.length === 0 && drafts.length === 0) return '<p class="text-gray">Belum ada transaksi.</p>';
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">📜 Riwayat Transaksi Terakhir</h3>
                </div>
                <div class="card-body">
                    ${drafts.length > 0 ? `
                        <div style="margin-bottom: 16px;">
                            <h4 style="margin-bottom: 8px;">Draft Tersimpan</h4>
                            <div class="table-container">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>Tanggal</th>
                                            <th>Jenis</th>
                                            <th>Keterangan</th>
                                            <th class="text-right">Total</th>
                                            <th class="text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${drafts.slice(0, 5).map(draft => `
                                            <tr>
                                                <td>${draft.date || '-'}</td>
                                                <td><span class="badge badge-warning">Draft</span> ${draft.templateName}</td>
                                                <td>${draft.data?.supplierName || draft.data?.description || '-'}</td>
                                                <td class="text-right">${this.formatCurrency(draft.data?.totalAmount || draft.data?.amount || 0)}</td>
                                                <td class="text-center">
                                                    <button class="btn btn-sm btn-primary" onclick="SimpleTransaction.loadDraft(${draft.id})">Buka</button>
                                                    <button class="btn btn-sm btn-danger" onclick="SimpleTransaction.deleteDraft(${draft.id})">Hapus</button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ` : ''}
                    <div style="overflow-x: auto;">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Referensi</th>
                                    <th>Keterangan</th>
                                    <th style="text-align: right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sorted.map(j => {
                                    const total = j.lines.reduce((sum, line) => sum + (line.debit > 0 ? line.debit : 0), 0);
                                    return `
                                        <tr>
                                            <td>${j.date}</td>
                                            <td><strong>${j.reference}</strong></td>
                                            <td>${j.description}</td>
                                            <td style="text-align: right; font-weight: bold; color: #10b981;">
                                                ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(total)}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    printWarehouseTransfer(transferRecord) {
        if (!transferRecord) {
            alert('Data transfer tidak tersedia untuk dicetak.');
            return;
        }

        // Get company settings
        const settings = Storage.getSettings() || {};
        const companyName = settings.companyName || 'PT Golden Alura';

        // Get warehouse details
        const warehouses = Storage.getWarehouses() || [];
        const sourceWH = warehouses.find(w => w.code === transferRecord.sourceWarehouse);
        const destWH = warehouses.find(w => w.code === transferRecord.destinationWarehouse);

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(companyName, 105, 20, { align: 'center' });

        doc.setFontSize(16);
        doc.text('SURAT MUTASI BARANG', 105, 30, { align: 'center' });

        // Document info
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`No. Dokumen: ${transferRecord.referenceNumber}`, 20, 45);
        doc.text(`Tanggal: ${transferRecord.date}`, 20, 52);

        // Separator line
        doc.setLineWidth(0.5);
        doc.line(20, 58, 190, 58);

        // Source and Destination
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('DARI GUDANG:', 20, 68);
        doc.setFont('helvetica', 'normal');
        doc.text(sourceWH ? `${sourceWH.code} - ${sourceWH.name}` : transferRecord.sourceWarehouse, 60, 68);

        doc.setFont('helvetica', 'bold');
        doc.text('KE GUDANG:', 20, 76);
        doc.setFont('helvetica', 'normal');
        doc.text(destWH ? `${destWH.code} - ${destWH.name}` : transferRecord.destinationWarehouse, 60, 76);

        // Separator line
        doc.setLineWidth(0.3);
        doc.line(20, 82, 190, 82);

        // Item details table header
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('DETAIL BARANG:', 20, 92);

        // Table
        const tableData = [[
            transferRecord.itemCode,
            transferRecord.itemName,
            transferRecord.quantity.toString(),
            transferRecord.uom
        ]];

        doc.autoTable({
            startY: 96,
            head: [['Kode Barang', 'Nama Barang', 'Jumlah', 'Satuan']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [66, 139, 202],
                fontSize: 10,
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: {
                fontSize: 10
            },
            columnStyles: {
                0: { cellWidth: 40 },
                1: { cellWidth: 80 },
                2: { cellWidth: 30, halign: 'right' },
                3: { cellWidth: 30, halign: 'center' }
            }
        });

        // Notes
        const finalY = doc.lastAutoTable.finalY + 10;
        if (transferRecord.description) {
            doc.setFont('helvetica', 'bold');
            doc.text('Keterangan:', 20, finalY);
            doc.setFont('helvetica', 'normal');
            doc.text(transferRecord.description, 20, finalY + 6);
        }

        // Signature section
        const signatureY = transferRecord.description ? finalY + 20 : finalY + 10;

        doc.setFont('helvetica', 'bold');
        doc.text('Yang Menyerahkan:', 30, signatureY);
        doc.text('Yang Menerima:', 130, signatureY);

        // Signature boxes
        doc.rect(25, signatureY + 5, 60, 30);
        doc.rect(125, signatureY + 5, 60, 30);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('(Nama & Tanda Tangan)', 30, signatureY + 42);
        doc.text('(Nama & Tanda Tangan)', 130, signatureY + 42);

        // Footer
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(`Dibuat oleh: ${transferRecord.createdBy}`, 20, 280);
        doc.text(`Waktu cetak: ${transferRecord.createdAt}`, 20, 285);

        // Save/Open PDF
        doc.save(`Mutasi_Gudang_${transferRecord.referenceNumber}.pdf`);
    },

    showAlert(type, message) {
        // Reuse existing alert system from ChartOfAccounts
        if (typeof ChartOfAccounts !== 'undefined') {
            ChartOfAccounts.showAlert(type, message);
        } else {
            alert(message);
        }
    }
};


// Explicitly make SimpleTransaction globally available
window.SimpleTransaction = SimpleTransaction;
