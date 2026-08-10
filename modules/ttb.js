// ==========================================
// TTB (Tanda Terima Barang) Module
// Multi-level approval for goods receipt
// ==========================================

const TTB = {
    documents: [],
    currentTTB: null,

    statuses: {
        draft: 'Draft',
        gudang_approved: 'Gudang Approved',
        pembelian_approved: 'Pembelian Approved',
        accounting_approved: 'Accounting Approved',
        posted: 'Posted to Inventory'
    },

    approvalLevels: {
        gudang: { role: 'warehouse_head', sequence: 1 },
        pembelian: { role: 'purchasing_head', sequence: 2 },
        accounting: { role: 'accounting_head', sequence: 3 }
    },

    init() {
        this.loadDocuments();
    },

    loadDocuments() {
        this.documents = Storage.getTTBs();
    },

    saveDocuments() {
        Storage.saveTTBs(this.documents);
    },

    async generateTTBNumber() {
        // ☁️ Use Atomic Cloud Sequencer
        const nextRef = await Storage.getNextReferenceNumber('TTB');
        if (nextRef) return nextRef;

        const now = new Date();
        const year = String(now.getFullYear()).slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, '0');

        const ttbs = this.documents.filter(t =>
            t.ttbNumber && (t.ttbNumber.includes(`GAR-TTB-${year}-${month}`) || t.ttbNumber.includes(`${year}${month}`))
        );

        const nextNum = String(ttbs.length + 1).padStart(4, '0');
        return `GAR-TTB-${year}-${month}-${nextNum}`;
    },

    async createTTB(grId) {
        // Get GR details
        const gr = GoodsReceipt.getGR(grId);
        if (!gr) {
            return { success: false, errors: { gr: 'Goods Receipt not found' } };
        }

        if (gr.ttbId) {
            return { success: false, errors: { ttb: 'TTB already created for this GR' } };
        }

        const ttb = {
            id: Date.now(),
            ttbNumber: await this.generateTTBNumber(),
            grId: gr.id,
            grNumber: gr.grNumber,
            poId: gr.poId,
            poNumber: gr.poNumber,
            supplierId: gr.supplierId,
            supplierName: gr.supplierName,
            date: new Date().toISOString().split('T')[0],

            items: gr.items.map(item => ({
                ...item,
                acceptedQty: item.receivedQty,
                rejectedQty: 0,
                notes: ''
            })),

            status: 'draft',

            approvalHistory: [],

            // Approval tracking
            gudangApprovedBy: null,
            gudangApprovedAt: null,
            pembelianApprovedBy: null,
            pembelianApprovedAt: null,
            accountingApprovedBy: null,
            accountingApprovedAt: null,

            // Posting
            postedToInventory: false,
            postedAt: null,
            journalEntryId: null,

            notes: '',
            createdBy: Auth.getCurrentUser().id,
            createdByName: Auth.getCurrentUser().name || Auth.getCurrentUser().fullName,
            createdAt: new Date().toISOString()
        };

        this.documents.push(ttb);
        this.saveDocuments();

        // Update GR
        gr.ttbId = ttb.id;
        gr.ttbNumber = ttb.ttbNumber;
        GoodsReceipt.saveReceipts();

        AuditLog.log('create', 'ttb', ttb.id,
            `Created TTB ${ttb.ttbNumber} from GR ${gr.grNumber}`);

        return { success: true, ttb };
    },

    approveTTB(ttbId, approved, notes) {
        const ttb = this.getTTB(ttbId);
        if (!ttb) {
            return { success: false, errors: { ttb: 'TTB not found' } };
        }

        const currentUser = Auth.getCurrentUser();
        if (!currentUser) return { success: false, errors: { permission: 'You must be logged in' } };
        const userRole = currentUser.role;

        // Determine approval level
        let approvalLevel = null;
        if (userRole === 'warehouse_head' || userRole === 'admin') {
            approvalLevel = 'gudang';
        } else if (userRole === 'purchasing_head' || userRole === 'admin') {
            approvalLevel = 'pembelian';
        } else if (userRole === 'accounting_head' || userRole === 'admin') {
            approvalLevel = 'accounting';
        } else {
            return { success: false, errors: { permission: 'You do not have permission to approve TTB' } };
        }

        // Check approval sequence
        if (approvalLevel === 'pembelian' && ttb.status !== 'gudang_approved') {
            return { success: false, errors: { sequence: 'TTB must be approved by Gudang first' } };
        }
        if (approvalLevel === 'accounting' && ttb.status !== 'pembelian_approved') {
            return { success: false, errors: { sequence: 'TTB must be approved by Pembelian first' } };
        }

        // Record approval
        ttb.approvalHistory.push({
            level: approvalLevel,
            userId: Auth.getCurrentUser().id,
            userName: Auth.getCurrentUser().name || Auth.getCurrentUser().fullName,
            approved: approved,
            timestamp: new Date().toISOString(),
            notes: notes || ''
        });

        if (!approved) {
            ttb.status = 'rejected';
            ttb.rejectionReason = notes;
            this.saveDocuments();

            AuditLog.log('update', 'ttb', ttbId, `TTB rejected by ${approvalLevel}`);
            return { success: true, ttb };
        }

        // Update approval fields
        if (approvalLevel === 'gudang') {
            ttb.status = 'gudang_approved';
            ttb.gudangApprovedBy = Auth.getCurrentUser().id;
            ttb.gudangApprovedAt = new Date().toISOString();
        } else if (approvalLevel === 'pembelian') {
            ttb.status = 'pembelian_approved';
            ttb.pembelianApprovedBy = Auth.getCurrentUser().id;
            ttb.pembelianApprovedAt = new Date().toISOString();
        } else if (approvalLevel === 'accounting') {
            ttb.status = 'accounting_approved';
            ttb.accountingApprovedBy = Auth.getCurrentUser().id;
            ttb.accountingApprovedAt = new Date().toISOString();

            // Auto-post to inventory
            this.postToInventory(ttbId);
        }

        this.saveDocuments();

        AuditLog.log('update', 'ttb', ttbId, `TTB approved by ${approvalLevel}`);

        return { success: true, ttb };
    },

    async postToInventory(ttbId) {
        const ttb = this.getTTB(ttbId);
        if (!ttb) {
            return { success: false, errors: { ttb: 'TTB not found' } };
        }

        if (ttb.status !== 'accounting_approved') {
            return { success: false, errors: { status: 'TTB must be accounting approved first' } };
        }

        if (ttb.postedToInventory) {
            return { success: false, errors: { posted: 'TTB already posted to inventory' } };
        }

        // Get related documents
        const gr = GoodsReceipt.getGR(ttb.grId);
        const po = PurchaseOrder.getOrder(ttb.poId);

        // Calculate actual values from TTB items (after lab test adjustment)
        const actualSubtotal = ttb.items.reduce((sum, item) => {
            const qty = item.acceptedQty || item.receivedQty || 0;
            const price = item.unitPrice || 0;
            return sum + (qty * price);
        }, 0);

        // Use PO tax rate or default 11%
        const taxRate = po ? (po.taxAmount / po.subtotal) : 0.11;
        const actualTaxAmount = actualSubtotal * taxRate;
        const actualTotal = actualSubtotal + actualTaxAmount;

        // Create journal entry - THIS IS THE ONLY PLACE WHERE JOURNAL IS CREATED
        if (typeof JournalEntry !== 'undefined') {
            const journalEntry = {
                date: ttb.date,
                description: `Purchase approved after lab test - TTB ${ttb.ttbNumber}`,
                reference: `${ttb.ttbNumber} / ${gr.grNumber} / ${po.poNumber}`,
                lines: [
                    {
                        accountCode: '1151', // Emas Mentah (approved inventory)
                        accountName: 'Emas Mentah',
                        debit: actualSubtotal,
                        credit: 0,
                        description: `Inventory from ${ttb.supplierName} (lab approved)`
                    },
                    {
                        accountCode: '1150', // Input Tax (PPN Masukan)
                        accountName: 'PPN Masukan',
                        debit: actualTaxAmount,
                        credit: 0,
                        description: 'Input tax'
                    },
                    {
                        accountCode: '2110', // Accounts Payable
                        accountName: 'Hutang Usaha',
                        debit: 0,
                        credit: actualTotal,
                        description: `Payable to ${ttb.supplierName}`
                    }
                ]
            };

            try {
                const entry = await JournalEntry.createEntry(journalEntry);
                ttb.journalEntryId = entry.id;
                ttb.actualSubtotal = actualSubtotal;
                ttb.actualTaxAmount = actualTaxAmount;
                ttb.actualTotal = actualTotal;

                // Update stock cards to mark journal as posted
                const stockCards = Storage.get(Storage.KEYS.STOCK_CARDS) || [];
                stockCards.forEach(card => {
                    if (card.reference === gr.grNumber && !card.journalPosted) {
                        card.journalPosted = true;
                        card.journalEntryId = entry.id;
                        card.postedAt = new Date().toISOString();
                    }
                });
                await Storage.set(Storage.KEYS.STOCK_CARDS, stockCards);
            } catch (err) {
                console.error('Failed to create journal for TTB:', err);
            }
        }

        // Mark as posted
        ttb.postedToInventory = true;
        ttb.postedAt = new Date().toISOString();
        ttb.status = 'posted';

        // Update GR
        if (gr) {
            gr.status = 'completed';
            gr.journalPosted = true;
            gr.journalEntryId = ttb.journalEntryId;
            GoodsReceipt.saveReceipts();
        }

        this.saveDocuments();

        AuditLog.log('update', 'ttb', ttbId, 'TTB posted to inventory');

        return { success: true, ttb };
    },

    getTTB(id) {
        return this.documents.find(t => t.id === id);
    },

    getTTBByGR(grId) {
        return this.documents.find(t => t.grId === grId);
    },

    getTTBsByStatus(status) {
        return this.documents.filter(t => t.status === status);
    },

    getPendingApprovals() {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) return [];
        const userRole = currentUser.role;

        if (userRole === 'warehouse_head' || userRole === 'admin') {
            return this.documents.filter(t => t.status === 'draft');
        } else if (userRole === 'purchasing_head' || userRole === 'admin') {
            return this.documents.filter(t => t.status === 'gudang_approved');
        } else if (userRole === 'accounting_head' || userRole === 'admin') {
            return this.documents.filter(t => t.status === 'pembelian_approved');
        }

        return [];
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    getStatusBadgeClass(status) {
        const classes = {
            draft: 'badge-secondary',
            gudang_approved: 'badge-info',
            pembelian_approved: 'badge-primary',
            accounting_approved: 'badge-success',
            posted: 'badge-success',
            rejected: 'badge-danger'
        };
        return classes[status] || 'badge-secondary';
    },

    render() {
        const content = document.getElementById('main-content');
        if (!content) return;

        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">🚚 Tanda Terima Barang (TTB)</h1>
                <p class="page-description">Pemeriksaan dan persetujuan akhir penerimaan barang</p>
            </div>

            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">Daftar Dokumen TTB</h2>
                </div>
                <div class="card-body">
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>TTB Number</th>
                                    <th>GR Number</th>
                                    <th>Supplier</th>
                                    <th>Tanggal</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="ttb-list-body">
                                ${this.renderTTBRows()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    renderTTBRows() {
        if (this.documents.length === 0) {
            return '<tr><td colspan="6" class="text-center">Belum ada data TTB</td></tr>';
        }

        return this.documents.sort((a, b) => b.id - a.id).map(ttb => `
            <tr>
                <td><strong>${ttb.ttbNumber}</strong></td>
                <td>${ttb.grNumber}</td>
                <td>${ttb.supplierName}</td>
                <td>${this.formatDate(ttb.date)}</td>
                <td><span class="badge ${this.getStatusBadgeClass(ttb.status)}">${ttb.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="TTB.viewDetail(${ttb.id})">👁️ Detail</button>
                    <button class="btn btn-sm btn-info" onclick="TTB.printTTB(${ttb.id})">📄 Print PDF</button>
                    ${this.canApprove(ttb) ? `<button class="btn btn-sm btn-success" onclick="TTB.viewDetail(${ttb.id})">✅ Approve</button>` : ''}
                </td>
            </tr>
        `).join('');
    },

    canApprove(ttb) {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) return false;
        const userRole = currentUser.role;
        if (userRole === 'admin') return true;

        if (userRole === 'warehouse_head' && ttb.status === 'draft') return true;
        if (userRole === 'purchasing_head' && ttb.status === 'gudang_approved') return true;
        if (userRole === 'accounting_head' && ttb.status === 'pembelian_approved') return true;

        return false;
    },

    viewDetail(id) {
        const ttb = this.getTTB(id);
        if (!ttb) return;

        // Custom modal detail or redirect
        alert(`Detail TTB: ${ttb.ttbNumber}\nStatus: ${ttb.status}\nItems: ${ttb.items.length}`);
    },

    /**
     * Create a TTB document from a Direct Swap transaction
     * @param {Object} swapTrx - Direct Swap transaction data
     */
    async createTTBFromSwap(swapTrx) {
        const ttbNumber = await this.generateTTBNumber();
        const ttb = {
            id: Date.now(),
            ttbNumber: ttbNumber,
            grId: null, // No linked GR
            grNumber: 'SWAP',
            poId: null,
            poNumber: swapTrx.id, // Link to Swap ID
            supplierId: swapTrx.customerId,
            supplierName: swapTrx.customer.name,
            date: swapTrx.date,

            items: [
                {
                    code: swapTrx.itemIn.code,
                    name: swapTrx.itemIn.name,
                    receivedQty: swapTrx.itemIn.weight,
                    acceptedQty: swapTrx.itemIn.weight,
                    rejectedQty: 0,
                    unitPrice: swapTrx.itemIn.price,
                    uom: 'gram'
                }
            ],

            status: 'posted', // Mark as posted immediately
            approvalHistory: [
                {
                    level: 'system',
                    userId: 'system',
                    userName: 'System (Direct Swap)',
                    approved: true,
                    timestamp: new Date().toISOString(),
                    notes: 'Automatically generated from Direct Swap'
                }
            ],

            postedToInventory: true,
            postedAt: new Date().toISOString(),
            journalEntryId: null, // Swap module handles its own journal

            notes: `Generated from Direct Swap ${swapTrx.id}. ${swapTrx.notes || ''}`,
            createdBy: Auth.getCurrentUser().id,
            createdByName: Auth.getCurrentUser().name || Auth.getCurrentUser().fullName,
            createdAt: new Date().toISOString()
        };

        this.documents.push(ttb);
        this.saveDocuments();

        AuditLog.log('create', 'ttb', ttb.id,
            `Created TTB ${ttb.ttbNumber} from Direct Swap ${swapTrx.id}`);

        return ttb;
    }
};
