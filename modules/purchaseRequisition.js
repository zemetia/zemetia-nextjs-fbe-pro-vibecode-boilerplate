// ==========================================
// Purchase Requisition (PRF) Module
// Multi-level approval workflow for purchase requests
// ==========================================

const PurchaseRequisition = {
    requisitions: [],
    currentPRF: null,
    _editMode: false,
    _editingId: null,
    _conversionLocks: new Set(),

    statuses: {
        draft: 'Draft',
        submitted: 'Submitted',
        dept_approved: 'Dept Head Approved', // NEW Generic Status
        warehouse_approved: 'Warehouse Approved', // Legacy (kept for backward compatibility)
        finance_approved: 'Finance Approved', // Legacy
        purchasing_reviewed: 'Purchasing Reviewed',
        purchasing_approved: 'Purchasing Approved',
        finance_verified: 'Finance Verified', // Controller Check (> 2M)
        director_approved: 'Director Approved',
        converted_to_po: 'Converted to PO',
        rejected: 'Rejected'
    },

    // Approval limits (in Rupiah)
    approvalLimits: {
        WAREHOUSE_STAFF: { canCreate: true, canApprove: false, maxAmount: 0 },
        WAREHOUSE_HEAD: { canCreate: false, canApprove: true, maxAmount: 10000000 },
        MANAGER_FINANCE: { canCreate: true, canApprove: true, maxAmount: 100000000 },
        PURCHASING_STAFF: { canCreate: false, canApprove: false, maxAmount: 0 },
        PURCHASING_HEAD: { canCreate: false, canApprove: true, maxAmount: 100000000 }, // Max 100M Final Approval (User Request)
        DIRECTOR: { canCreate: false, canApprove: true, maxAmount: Infinity },
        PRODUCTION: { canCreate: true, canApprove: false, maxAmount: 0 },
        PRODUCTION_HEAD: { canCreate: false, canApprove: true, maxAmount: 10000000 },
        ADMIN: { canCreate: true, canApprove: true, maxAmount: Infinity }
    },

    async init() {
        await this.loadRequisitions();
        this.render();
        // Auto-repair orphaned PRFs (if any were converted during the async bug)
        setTimeout(() => this.repairOrphanedPRFs(), 3000);
    },

    async repairOrphanedPRFs() {
        // Only run once per session to avoid repeated background cloud reads
        if (sessionStorage.getItem('_prf_repair_done')) return;
        sessionStorage.setItem('_prf_repair_done', '1');

        const prfs = Storage.get(Storage.KEYS.PURCHASE_REQUISITIONS) || [];
        const pos = Storage.get(Storage.KEYS.PURCHASE_ORDERS) || [];
        let repaired = 0;

        for (const prf of prfs) {
            if (prf.status === 'director_approved' || prf.status === 'purchasing_approved') {
                const matchingPo = pos.find(po => po.notes && po.notes.includes(prf.prfNumber));
                if (matchingPo) {
                    prf.status = 'converted_to_po';
                    prf.poId = matchingPo.id;
                    prf.poNumber = matchingPo.poNumber;
                    prf.convertedAt = matchingPo.createdAt;
                    
                    if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
                        FirebaseSync.saveToCloud(Storage.KEYS.PURCHASE_REQUISITIONS, prf);
                    }
                    repaired++;
                }
            }
        }

        if (repaired > 0) {
            console.log(`🔧 [Auto-Repair] Fixed ${repaired} orphaned PRFs.`);
            Storage.set(Storage.KEYS.PURCHASE_REQUISITIONS, prfs);
            this.requisitions = prfs;
            
            const content = document.getElementById('main-content');
            if (content && content.innerHTML.includes('Purchase Requisition (PRF)')) {
                this.render();
            }
        }
    },

    async loadRequisitions() {
        this.requisitions = Storage.get(Storage.KEYS.PURCHASE_REQUISITIONS) || [];
    },

    async saveRequisitions(specificRequisition = null) {
        return await Storage.set(Storage.KEYS.PURCHASE_REQUISITIONS, this.requisitions, false, specificRequisition);
    },

    getAllPRFs() {
        return this.requisitions || [];
    },

    getPRF(id) {
        return this.requisitions.find(p => p.id === id);
    },

    getPRFsByStatus(status) {
        return this.requisitions.filter(p => p.status === status);
    },

    async createPRF(data) {
        // ☁️ Use Atomic Cloud Sequencer
        const prfNumber = await Storage.getNextReferenceNumber('PRF');

        const prf = {
            id: Date.now(),
            prfNumber: prfNumber || `PRF-${Date.now()}`,
            date: data.date || new Date().toISOString().split('T')[0],
            department: data.department || '',
            requestedBy: Auth.getCurrentUser().id,
            requestedByName: Auth.getCurrentUser().name,
            createdBy: Auth.getCurrentUser().id, // REQUIRED for Firestore Rules
            creatorName: Auth.getCurrentUser().name,
            purpose: data.purpose || '',
            priority: data.priority || 'Normal',
            deadline: data.deadline || null,

            items: data.items || [],
            totalEstimated: data.items.reduce((sum, item) => sum + (item.quantity * item.estimatedPrice), 0),

            status: 'draft',
            createdAt: new Date().toISOString(),
            approvalHistory: [],
            notes: data.notes || ''
        };

        this.requisitions.push(prf);
        await this.saveRequisitions();

        // Audit Log
        AuditLog.log('create', 'purchase_requisition', prf.id, `Created PRF ${prf.prfNumber}`);

        return { success: true, prf };
    },

    async submitPRF(prfId) {
        const prf = this.getPRF(prfId);
        if (!prf) return { success: false, errors: { prf: 'PRF not found' } };

        if (!prf.items || prf.items.length === 0) {
            return { success: false, errors: { items: 'PRF must have at least one item' } };
        }

        prf.status = 'submitted';
        prf.submittedAt = new Date().toISOString();

        await this.saveRequisitions();
        AuditLog.log('update', 'purchase_requisition', prfId, 'Submitted PRF for approval');

        return { success: true, prf };
    },

    async approvePRF(prfId, approved, notes) {
        const prf = this.getPRF(prfId);
        if (!prf) {
            return { success: false, errors: { prf: 'PRF not found' } };
        }

        const user = Auth.getCurrentUser();
        const userRole = user ? String(user.role).toUpperCase() : '';

        // Check permission
        if (!this.approvalLimits[userRole]?.canApprove) {
            return { success: false, errors: { permission: 'You do not have permission to approve' } };
        }

        // Check approval limit
        if (prf.totalEstimated > this.approvalLimits[userRole].maxAmount) {
            return {
                success: false,
                errors: { limit: `Amount exceeds your approval limit of ${this.formatCurrency(this.approvalLimits[userRole].maxAmount)}` }
            };
        }

        // HIERARCHY VALIDATION
        const isPurchasingHead = userRole === 'PURCHASING_HEAD';

        // Step 1: Dept Head Approval
        if (prf.status === 'submitted') {
            // Check if user matches Department?
            // Purchasing Head can't approve Step 1 for other depts
            if (isPurchasingHead && prf.department !== 'Purchasing') {
                return { success: false, errors: { status: 'PRF must be approved by Department Head first' } };
            }
        }
        // Director can bypass and approve any non-final PRF at any time
        if (userRole === 'DIRECTOR') {
            const isFinal = ['director_approved', 'converted_to_po', 'rejected'].includes(prf.status);
            if (isFinal) {
                return { success: false, errors: { status: `PRF is already in final state: ${prf.status}` } };
            }
        }
        else if (prf.status === 'dept_approved' || prf.status === 'warehouse_approved' || prf.status === 'finance_approved') {
            // Step 2: Purchasing Review
            if (!isPurchasingHead) {
                return { success: false, errors: { permission: 'Waiting for Purchasing Head review' } };
            }
        }

        // Record approval
        prf.approvalHistory.push({
            role: userRole,
            action: approved ? 'approved' : 'rejected',
            userId: Auth.getCurrentUser().id,
            userName: Auth.getCurrentUser().name,
            timestamp: new Date().toISOString(),
            notes: notes || ''
        });

        if (!approved) {
            prf.status = 'rejected';
            prf.rejectionReason = notes;
            await this.saveRequisitions(prf);
            AuditLog.log('update', 'purchase_requisition', prfId, 'PRF rejected');
            return { success: true, prf };
        }

        // UPDATE STATUS BASED ON ROLE (HIERARCHY STEP UP)

        // GENERIC DEPT HEAD LOGIC (Step 1)
        if (prf.status === 'submitted' && (userRole === 'WAREHOUSE_HEAD' || userRole === 'PRODUCTION_HEAD' || userRole === 'ADMIN')) {
            // If Purchasing Head approving for Purchasing Dept, logic continues to Step 2 check below?
            // No, easiest is to set to 'dept_approved'.
            // If User IS Purchasing Head AND Dept is Purchasing, we could auto-advance, but let's manual.

            prf.status = 'dept_approved';
            prf.deptApprovedBy = Auth.getCurrentUser().id;
            prf.deptApprovedByName = Auth.getCurrentUser().name;
            prf.deptApprovedAt = new Date().toISOString();

            // PURCHASING HEAD LOGIC (Step 2)
        } else if (prf.status === 'dept_approved' && (userRole === 'PURCHASING_HEAD' || userRole === 'ADMIN')) {
            // Logic: < 100M -> Final. > 100M -> Next.
            if (prf.totalEstimated <= 100000000) {
                prf.status = 'director_approved'; // FINAL (Skip Finance/Director)
                prf.purchasingApprovedBy = Auth.getCurrentUser().id;
                prf.purchasingApprovedByName = Auth.getCurrentUser().name;
                prf.financeVerifiedBy = 'AUTO-SKIP';
                prf.directorApprovedBy = 'AUTO-SKIP';
            } else {
                prf.status = 'purchasing_approved';
                prf.purchasingApprovedBy = Auth.getCurrentUser().id;
                prf.purchasingApprovedByName = Auth.getCurrentUser().name;
            }
            prf.purchasingApprovedAt = new Date().toISOString();

        } else if (userRole === 'MANAGER_FINANCE' || (userRole === 'ADMIN' && prf.status === 'purchasing_approved')) {

            // If acting as Step 3 (Controller)
            if (prf.status === 'purchasing_approved') {
                if (prf.totalEstimated <= 100000000) { // Limit 100M (User Request)
                    prf.status = 'director_approved'; // FINAL
                    prf.financeVerifiedBy = Auth.getCurrentUser().id;
                    prf.directorApprovedBy = 'AUTO-SKIP';
                } else {
                    prf.status = 'finance_verified';
                    prf.financeVerifiedBy = Auth.getCurrentUser().id;
                }
                prf.financeVerifiedByName = Auth.getCurrentUser().name;
                prf.financeVerifiedAt = new Date().toISOString();

            } else if (prf.status === 'submitted') {
                // If acting as Dept Head for Finance Dept
                prf.status = 'dept_approved';
                prf.deptApprovedBy = Auth.getCurrentUser().id;
                prf.deptApprovedByName = Auth.getCurrentUser().name;
                prf.deptApprovedAt = new Date().toISOString();
            }

            // DIRECTOR LOGIC (Step 4)
        } else if (userRole === 'DIRECTOR' || (userRole === 'ADMIN' && prf.status === 'finance_verified')) {
            prf.status = 'director_approved';
            prf.directorApprovedBy = Auth.getCurrentUser().id;
            prf.directorApprovedByName = Auth.getCurrentUser().name;
            prf.directorApprovedAt = new Date().toISOString();
        }

        await this.saveRequisitions(prf);
        AuditLog.log('update', 'purchase_requisition', prfId, `Approved by ${userRole}`);
        return { success: true, prf };
    },

    getPendingApprovals() {
        const user = Auth.getCurrentUser();
        const userRole = user ? String(user.role).toUpperCase() : '';

        // 1. Finance Manager (Dept Head OR Controller)
        if (userRole === 'MANAGER_FINANCE') {
            return this.requisitions.filter(p =>
                (p.status === 'submitted' && p.department === 'Finance') ||
                (p.status === 'purchasing_approved' && p.totalEstimated > 2000000)
            );
        }

        // 2. Purchasing Head (Dept Head OR Purchasing Reviewer)
        if (userRole === 'PURCHASING_HEAD') {
            return this.requisitions.filter(p =>
                p.status === 'dept_approved' ||
                p.status === 'warehouse_approved' ||
                p.status === 'finance_approved' ||
                (p.department === 'Purchasing' && p.status === 'submitted')
            );
        }

        // 3. Director
        if (userRole === 'DIRECTOR') {
            return this.requisitions.filter(p =>
                p.status === 'finance_verified' &&
                p.totalEstimated > 100000000
            );
        }

        // 4. Generic Dept Head (Warehouse, Sales, Production, etc.)
        if (this.approvalLimits[userRole]?.canApprove) {
            let targetDept = null;
            if (userRole.includes('_head')) {
                const raw = userRole.replace('_head', '');
                targetDept = raw.charAt(0).toUpperCase() + raw.slice(1);
            }
            if (userRole === 'warehouse_head') targetDept = 'Warehouse';

            if (targetDept) {
                return this.requisitions.filter(p => p.status === 'submitted' && p.department === targetDept);
            }
        }

        return [];
    },

    getReadyToConvert() {
        return this.requisitions.filter(p =>
            (p.status === 'purchasing_approved' || p.status === 'director_approved') &&
            !p.poId
        );
    },

    async updatePRF(prfId, data) {
        const prf = this.getPRF(prfId);
        if (!prf) {
            return { success: false, errors: { prf: 'PRF not found' } };
        }

        if (prf.status !== 'draft') {
            return { success: false, errors: { status: 'Can only update draft PRF' } };
        }

        if (data.items) {
            prf.items = data.items;
            prf.totalEstimated = data.items.reduce((sum, item) => {
                return sum + (item.quantity * item.estimatedPrice);
            }, 0);
        }
        if (data.department !== undefined) prf.department = data.department || '';
        if (data.purpose !== undefined) prf.purpose = data.purpose || '';
        if (data.notes !== undefined) prf.notes = data.notes || '';
        if (data.deadline !== undefined) prf.deadline = data.deadline || null;
        if (data.priority !== undefined) prf.priority = data.priority || 'Normal';

        prf.updatedAt = new Date().toISOString();

        await this.saveRequisitions();
        AuditLog.log('update', 'purchase_requisition', prfId, 'PRF updated');

        return { success: true, prf };
    },

    async deletePRF(id) {
        const prf = this.getPRF(id);
        if (!prf) {
            return { success: false, errors: { prf: 'PRF not found' } };
        }

        if (prf.status !== 'draft' && prf.status !== 'rejected') {
            return { success: false, errors: { status: 'Can only delete draft or rejected PRF' } };
        }

        // Delete from cloud first (tombstone) to prevent restore on next login
        try {
            if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
                await FirebaseSync.deleteFromCloud(Storage.KEYS.PURCHASE_REQUISITIONS, id);
            }
        } catch (e) { console.warn('Cloud delete failed for PRF:', e); }

        this.requisitions = this.requisitions.filter(p => p.id !== id);
        if (typeof Storage !== 'undefined' && Storage.trackDeletion) {
            Storage.trackDeletion(id);
        }
        await this.saveRequisitions();
        AuditLog.log('delete', 'purchase_requisition', id, `Deleted ${prf.prfNumber}`);

        return { success: true };
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
            submitted: 'badge-info',
            dept_approved: 'badge-primary', // Generic
            warehouse_approved: 'badge-primary',
            finance_approved: 'badge-primary',
            purchasing_reviewed: 'badge-info',
            purchasing_approved: 'badge-primary',
            director_approved: 'badge-success',
            converted_to_po: 'badge-success',
            rejected: 'badge-danger'
        };
        return classes[status] || 'badge-secondary';
    },

    render() {
        const content = document.getElementById('main-content');
        if (!content) return;

        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">📝 Purchase Requisition (PRF)</h1>
                <p class="page-description">Purchase requisition with multi-level approval workflow</p>
            </div>

            ${this.renderFilterTabs()}
            ${this.renderPRFList()}
            ${this.renderCreateModal()}
            ${this.renderViewModal()}
            ${this.renderConvertModal()}
        `;

        this.attachEventListeners();
    },

    renderFilterTabs() {
        const currentUser = Auth.getCurrentUser();
        const allPRFs = this.getAllPRFs();
        const myRequests = allPRFs.filter(p => p.requestedBy === currentUser.id);
        const pendingApprovals = this.getPendingApprovals();
        const readyToConvert = this.getReadyToConvert();
        const rejected = this.getPRFsByStatus('rejected');

        return `
            <div class="card">
                <div class="card-header">
                    <div class="btn-group" role="tablist" id="prf-tabs">
                        <button class="btn btn-sm active" data-tab="all">
                            All PRFs (${allPRFs.length})
                        </button>
                        <button class="btn btn-sm" data-tab="my-requests">
                            My Requests (${myRequests.length})
                        </button>
                        <button class="btn btn-sm" data-tab="pending-approval">
                            Pending My Approval (${pendingApprovals.length})
                        </button>
                        <button class="btn btn-sm" data-tab="ready-convert">
                            Ready to Convert (${readyToConvert.length})
                        </button>
                        <button class="btn btn-sm" data-tab="rejected">
                            Rejected (${rejected.length})
                        </button>
                    </div>
                    <button class="btn btn-primary" onclick="PurchaseRequisition.showCreateModal()">
                        ➕ New PRF
                    </button>
                </div>
            </div>
        `;
    },

    renderPRFList() {
        return `
            <div class="card">
                <div class="card-body">
                    <div class="table-container">
                        <table class="table" id="prf-table">
                            <thead>
                                <tr>
                                    <th>PRF Number</th>
                                    <th>Date</th>
                                    <th>Department</th>
                                    <th>Requested By</th>
                                    <th class="text-right">Total Estimated</th>
                                    <th>Status</th>
                                    <th class="text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="prf-table-body">
                                ${this.renderPRFRows('all')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    renderPRFRows(filter) {
        let prfs = [];
        const currentUser = Auth.getCurrentUser();

        switch (filter) {
            case 'all':
                prfs = this.getAllPRFs();
                break;
            case 'my-requests':
                prfs = this.getAllPRFs().filter(p => p.requestedBy === currentUser.id);
                break;
            case 'pending-approval':
                prfs = this.getPendingApprovals();
                break;
            case 'ready-convert':
                prfs = this.getReadyToConvert();
                break;
            case 'rejected':
                prfs = this.getPRFsByStatus('rejected');
                break;
        }

        if (prfs.length === 0) {
            return `
                <tr>
                    <td colspan="7" class="text-center" style="padding: 40px; color: var(--text-secondary);">
                        No PRFs found
                    </td>
                </tr>
            `;
        }

        return prfs.map(prf => {
            const userRole = Auth.getCurrentUser() ? String(Auth.getCurrentUser().role).toUpperCase() : '';
            const canEdit = prf.status === 'draft' && prf.requestedBy === currentUser.id;
            const canDelete = prf.status === 'draft' && prf.requestedBy === currentUser.id;
            const canApprove = this.canUserApprove(prf);
            const isPurchasing = userRole === 'PURCHASING_HEAD' || userRole === 'PURCHASING_STAFF';
            // READY TO CONVERT: Either director approved, or purchasing head approved (for < 100M bypass)
            const isApproved = prf.status === 'director_approved' || prf.status === 'purchasing_approved';
            const canConvert = isApproved && !prf.poId && (isPurchasing || this.approvalLimits[userRole]?.canCreate);

            return `
                <tr>
                    <td><strong>${prf.prfNumber}</strong></td>
                    <td>${this.formatDate(prf.date)}</td>
                    <td>${prf.department}</td>
                    <td>${prf.requestedByName}</td>
                    <td class="text-right">${this.formatCurrency(prf.totalEstimated)}</td>
                    <td>
                        <span class="badge ${this.getStatusBadgeClass(prf.status)}">
                            ${this.getStatusLabel(prf.status)}
                        </span>
                        ${prf.poNumber ? `<br><span class="badge badge-success" style="margin-top: 4px; display: inline-block; font-size: 0.85em; padding: 2px 6px;">🛒 PO: ${prf.poNumber}</span>` : ''}
                    </td>
                    <td class="text-center">
                        <div class="btn-group">
                            <button class="btn btn-sm btn-secondary" onclick="PurchaseRequisition.showViewModal(${prf.id})" title="View Details">
                                👁️
                            </button>
                            ${canEdit ? `
                                <button class="btn btn-sm btn-secondary" onclick="PurchaseRequisition.showEditModal(${prf.id})" title="Edit">
                                    ✏️
                                </button>
                            ` : ''}
                            ${canApprove ? `
                                <button class="btn btn-sm btn-success" onclick="PurchaseRequisition.showApproveModal(${prf.id})" title="Approve/Reject">
                                    ✅
                                </button>
                            ` : ''}
                            ${canConvert ? `
                                <button class="btn btn-sm btn-primary" onclick="PurchaseRequisition.showConvertModal(${prf.id})" title="Convert to PO">
                                    🔄
                                </button>
                            ` : ''}
                            ${canDelete ? `
                                <button class="btn btn-sm btn-danger" onclick="PurchaseRequisition.confirmDelete(${prf.id})" title="Delete">
                                    🗑️
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    renderCreateModal() {
        return `
            <div id="create-prf-modal" class="modal-overlay hidden">
                <div class="modal" style="max-width: 1100px;">
                    <div class="modal-header">
                        <h3 class="modal-title" id="modal-title">Create New PRF</h3>
                        <button class="modal-close" onclick="PurchaseRequisition.closeCreateModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="prf-form">
                            <input type="hidden" id="prf-id" value="">
                            
                            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label class="form-label">PRF Number</label>
                                    <input type="text" id="prf-number" class="form-input" readonly style="background: var(--bg-tertiary);">
                                </div>
                                <div class="form-group">
                                    <label class="form-label required">Date</label>
                                    <input type="date" id="prf-date" class="form-input" required>
                                </div>
                            </div>

                            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label class="form-label required">Department</label>
                                    <select id="prf-department" class="form-select" required>
                                        <option value="">Select Department</option>
                                        <option value="Production">Production</option>
                                        <option value="Warehouse">Warehouse</option>
                                        <option value="Purchasing">Purchasing</option>
                                        <option value="Finance">Finance</option>
                                        <option value="IT">IT</option>
                                        <option value="HR">HR</option>
                                        <option value="Marketing">Marketing</option>
                                        <option value="Sales">Sales</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Requested By</label>
                                    <input type="text" id="prf-requester" class="form-input" readonly style="background: var(--bg-tertiary);">
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Purpose</label>
                                <textarea id="prf-purpose" class="form-input" rows="2" placeholder="Describe the purpose of this requisition"></textarea>
                            </div>

                            <div class="form-group">
                                <label class="form-label required">Items</label>
                                <div class="table-container">
                                    <table class="table" id="prf-items-table" style="table-layout: fixed; width: 100%; border-collapse: separate; border-spacing: 0;">
                                        <style>
                                            #prf-items-table th, #prf-items-table td { padding: 8px 4px !important; }
                                            #prf-items-table .form-input, #prf-items-table .form-select { padding: 8px 6px !important; }
                                        </style>
                                        <thead>
                                            <tr>
                                                <th style="width: 20%;">Item</th>
                                                <th style="width: 15%;">Qty</th>
                                                <th style="width: 10%;">Unit</th>
                                                <th style="width: 23%;">Est. Price</th>
                                                <th style="width: 23%;">Subtotal</th>
                                                <th style="width: 9%;"></th>
                                            </tr>
                                        </thead>
                                        <tbody id="prf-items-body">
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colspan="4" class="text-right"><strong>Total Estimated:</strong></td>
                                                <td><strong id="prf-total">Rp 0</strong></td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                <button type="button" class="btn btn-sm btn-secondary" onclick="PurchaseRequisition.addItemRow()">
                                    ➕ Add Item
                                </button>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Notes</label>
                                <textarea id="prf-notes" class="form-input" rows="2" placeholder="Additional notes"></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="PurchaseRequisition.closeCreateModal()">
                            Cancel
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="PurchaseRequisition.saveDraft()">
                            Save as Draft
                        </button>
                        <button type="button" class="btn btn-primary" onclick="PurchaseRequisition.submitPRFForm()">
                            Submit for Approval
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    renderViewModal() {
        return `
            <div id="view-prf-modal" class="modal-overlay hidden">
                <div class="modal" style="max-width: 1100px;">
                    <div class="modal-header">
                        <h3 class="modal-title">PRF Details</h3>
                        <button class="modal-close" onclick="PurchaseRequisition.closeViewModal()">&times;</button>
                    </div>
                    <div class="modal-body" id="view-prf-content">
                    </div>
                    <div class="modal-footer" id="view-prf-footer">
                        <button type="button" class="btn btn-secondary" onclick="PurchaseRequisition.closeViewModal()">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // UI Helper Functions
    attachEventListeners() {
        // Tab switching
        document.querySelectorAll('#prf-tabs button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active state
                document.querySelectorAll('#prf-tabs button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // Update table
                const filter = e.target.dataset.tab;
                document.getElementById('prf-table-body').innerHTML = this.renderPRFRows(filter);
            });
        });
    },

    showCreateModal() {
        const modal = document.getElementById('create-prf-modal');
        document.getElementById('modal-title').textContent = 'Create New PRF';
        document.getElementById('prf-id').value = '';
        document.getElementById('prf-number').value = 'Auto-generated';
        document.getElementById('prf-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('prf-department').value = '';
        document.getElementById('prf-requester').value = Auth.getCurrentUser().name;
        document.getElementById('prf-purpose').value = '';
        document.getElementById('prf-notes').value = '';
        document.getElementById('prf-items-body').innerHTML = '';

        // Add one empty row
        this.addItemRow();

        modal.classList.remove('hidden');
    },

    showEditModal(prfId) {
        const prf = this.getPRF(prfId);
        if (!prf) return;

        const modal = document.getElementById('create-prf-modal');
        document.getElementById('modal-title').textContent = 'Edit PRF';
        document.getElementById('prf-id').value = prf.id;
        document.getElementById('prf-number').value = prf.prfNumber;
        document.getElementById('prf-date').value = prf.date;
        document.getElementById('prf-department').value = prf.department;
        document.getElementById('prf-requester').value = prf.requestedByName;
        document.getElementById('prf-purpose').value = prf.purpose || '';
        document.getElementById('prf-notes').value = prf.notes || '';

        // Load items
        document.getElementById('prf-items-body').innerHTML = '';
        prf.items.forEach(item => {
            this.addItemRow(item);
        });

        this.calculateTotal();
        modal.classList.remove('hidden');
    },

    closeCreateModal() {
        document.getElementById('create-prf-modal').classList.add('hidden');
    },

    addItemRow(itemData = null) {
        const tbody = document.getElementById('prf-items-body');
        const rowIndex = tbody.children.length;

        const items = Storage.get(Storage.KEYS.ITEMS) || [];
        const itemOptions = items.map(item =>
            `<option value="${item.id}" data-code="${item.code}" data-name="${item.name}" data-unit="${item.uom || item.unit || 'pcs'}">
                ${item.code} - ${item.name}
            </option>`
        ).join('');

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <select class="form-select item-select" data-row="${rowIndex}" onchange="PurchaseRequisition.onItemSelect(${rowIndex})">
                    <option value="">Select Item</option>
                    ${itemOptions}
                </select>
            </td>
            <td>
                <input type="number" class="form-input item-quantity" data-row="${rowIndex}" 
                    min="0.01" step="0.01" placeholder="0" 
                    onchange="PurchaseRequisition.calculateTotal()">
            </td>
            <td>
                <input type="text" class="form-input item-unit" data-row="${rowIndex}" readonly 
                    style="background: var(--bg-tertiary);">
            </td>
            <td>
                <input type="number" class="form-input item-price" data-row="${rowIndex}" 
                    min="0" step="1000" placeholder="0" 
                    onchange="PurchaseRequisition.calculateTotal()">
            </td>
            <td>
                <input type="text" class="form-input item-subtotal" data-row="${rowIndex}" readonly 
                    style="background: var(--bg-tertiary);">
            </td>
            <td class="text-center">
                <button type="button" class="btn btn-sm btn-danger" onclick="PurchaseRequisition.removeItemRow(this)">
                    🗑️
                </button>
            </td>
        `;

        tbody.appendChild(row);

        // Populate if editing
        if (itemData) {
            const select = row.querySelector('.item-select');
            select.value = itemData.itemId;
            row.querySelector('.item-quantity').value = itemData.quantity;
            row.querySelector('.item-unit').value = itemData.unit;
            row.querySelector('.item-price').value = itemData.estimatedPrice;
            this.calculateTotal();
        }
    },

    removeItemRow(btn) {
        btn.closest('tr').remove();
        this.calculateTotal();
    },

    onItemSelect(rowIndex) {
        const select = document.querySelector(`.item-select[data-row="${rowIndex}"]`);
        const selectedOption = select.options[select.selectedIndex];

        if (selectedOption.value) {
            const unit = selectedOption.dataset.unit;
            document.querySelector(`.item-unit[data-row="${rowIndex}"]`).value = unit;
        }
    },

    calculateTotal() {
        const rows = document.querySelectorAll('#prf-items-body tr');
        let total = 0;

        rows.forEach((row, index) => {
            const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
            const price = parseFloat(row.querySelector('.item-price').value) || 0;
            const subtotal = quantity * price;

            row.querySelector('.item-subtotal').value = this.formatCurrency(subtotal);
            total += subtotal;
        });

        document.getElementById('prf-total').textContent = this.formatCurrency(total);
    },

    async saveDraft() {
        await this.savePRF(false);
    },

    async submitPRFForm() {
        await this.savePRF(true);
    },

    async savePRF(submit = false) {
        const prfId = document.getElementById('prf-id').value;
        const department = document.getElementById('prf-department').value;
        const purpose = document.getElementById('prf-purpose').value;
        const notes = document.getElementById('prf-notes').value;
        const date = document.getElementById('prf-date').value;

        // Collect items
        const items = [];
        const rows = document.querySelectorAll('#prf-items-body tr');

        rows.forEach(row => {
            const select = row.querySelector('.item-select');
            const selectedOption = select.options[select.selectedIndex];
            const quantity = parseFloat(row.querySelector('.item-quantity').value);
            const price = parseFloat(row.querySelector('.item-price').value);

            if (selectedOption.value && quantity > 0 && price >= 0) {
                items.push({
                    itemId: selectedOption.value,
                    itemCode: selectedOption.dataset.code,
                    itemName: selectedOption.dataset.name,
                    quantity: quantity,
                    unit: selectedOption.dataset.unit,
                    estimatedPrice: price
                });
            }
        });

        // Validation
        if (!department) {
            alert('Please select a department');
            return;
        }

        if (items.length === 0) {
            alert('Please add at least one item');
            return;
        }

        const data = {
            date,
            department,
            purpose,
            notes,
            items
        };

        let result;
        if (prfId) {
            // Update existing
            result = await this.updatePRF(parseInt(prfId), data);
        } else {
            // Create new
            result = await this.createPRF(data);
        }

        if (result.success) {
            if (submit) {
                const submitResult = await this.submitPRF(result.prf.id);
                if (submitResult.success) {
                    this.showAlert('success', 'PRF submitted for approval successfully');
                } else {
                    this.showAlert('error', submitResult.errors ? Object.values(submitResult.errors)[0] : 'Failed to submit');
                }
            } else {
                this.showAlert('success', prfId ? 'PRF updated successfully' : 'PRF saved as draft');
            }

            this.closeCreateModal();
            this.render();
        } else {
            this.showAlert('error', result.errors ? Object.values(result.errors)[0] : 'Failed to save PRF');
        }
    },

    showViewModal(prfId) {
        const prf = this.getPRF(prfId);
        if (!prf) return;

        const content = document.getElementById('view-prf-content');
        const footer = document.getElementById('view-prf-footer');

        // Build items table
        const itemsTable = `
            <table class="table" style="table-layout: fixed; width: 100%; border-collapse: separate; border-spacing: 0;">
                <style>
                    .prf-view-table th, .prf-view-table td { padding: 8px 4px !important; }
                </style>
                <thead>
                    <tr>
                        <th style="width: 12%;">Item Code</th>
                        <th style="width: 20%;">Item Name</th>
                        <th style="width: 12%;" class="text-right">Qty</th>
                        <th style="width: 10%;">Unit</th>
                        <th style="width: 23%;" class="text-right">Est. Price</th>
                        <th style="width: 23%;" class="text-right">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${prf.items.map(item => `
                        <tr>
                            <td>${item.itemCode}</td>
                            <td>${item.itemName}</td>
                            <td class="text-right">${item.quantity}</td>
                            <td>${item.unit || item.uom || 'pcs'}</td>
                            <td class="text-right">${this.formatCurrency(item.estimatedPrice)}</td>
                            <td class="text-right">${this.formatCurrency(item.quantity * item.estimatedPrice)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="5" class="text-right"><strong>Total Estimated:</strong></td>
                        <td class="text-right"><strong>${this.formatCurrency(prf.totalEstimated)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        `;

        // Build approval timeline
        const timeline = prf.approvalHistory.length > 0 ? `
            <div class="form-group">
                <label class="form-label">Approval History</label>
                <div style="border-left: 3px solid var(--primary); padding-left: 1rem;">
                    ${prf.approvalHistory.map(approval => `
                        <div style="margin-bottom: 1rem;">
                            <div style="display: flex; justify-content: space-between;">
                                <strong>${approval.action === 'approved' ? '✅' : '❌'} ${approval.userName}</strong>
                                <span style="color: var(--text-secondary); font-size: 0.9em;">
                                    ${this.formatDate(approval.timestamp)}
                                </span>
                            </div>
                            <div style="color: var(--text-secondary); font-size: 0.9em;">
                                ${approval.role} - ${approval.action}
                            </div>
                            ${approval.notes ? `<div style="margin-top: 0.5rem;">${approval.notes}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '';

        content.innerHTML = `
            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label class="form-label">PRF Number</label>
                    <div><strong>${prf.prfNumber}</strong></div>
                </div>
                <div class="form-group">
                    <label class="form-label">Date</label>
                    <div>${this.formatDate(prf.date)}</div>
                </div>
            </div>

            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label class="form-label">Department</label>
                    <div>${prf.department}</div>
                </div>
                <div class="form-group">
                    <label class="form-label">Requested By</label>
                    <div>${prf.requestedByName}</div>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Status</label>
                <div>
                    <span class="badge ${this.getStatusBadgeClass(prf.status)}">
                        ${this.getStatusLabel(prf.status)}
                    </span>
                    ${prf.poNumber ? `<span class="badge badge-success">Converted to PO: ${prf.poNumber}</span>` : ''}
                </div>
            </div>

            ${prf.purpose ? `
                <div class="form-group">
                    <label class="form-label">Purpose</label>
                    <div>${prf.purpose}</div>
                </div>
            ` : ''}

            <div class="form-group">
                <label class="form-label">Items</label>
                ${itemsTable}
            </div>

            ${prf.notes ? `
                <div class="form-group">
                    <label class="form-label">Notes</label>
                    <div>${prf.notes}</div>
                </div>
            ` : ''}

            ${timeline}

            ${prf.status === 'rejected' && prf.rejectionReason ? `
                <div class="form-group">
                    <label class="form-label">Rejection Reason</label>
                    <div class="alert alert-error">${prf.rejectionReason}</div>
                </div>
            ` : ''}
        `;

        // Update footer buttons based on permissions
        const canApprove = this.canUserApprove(prf);
        const canConvert = prf.status === 'director_approved';

        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" onclick="PurchaseRequisition.closeViewModal()">
                Close
            </button>
            ${canApprove ? `
                <button type="button" class="btn btn-danger" onclick="PurchaseRequisition.rejectPRF(${prf.id})">
                    ❌ Reject
                </button>
                <button type="button" class="btn btn-success" onclick="PurchaseRequisition.approvePRFAction(${prf.id})">
                    ✅ Approve
                </button>
            ` : ''}
            ${canConvert ? `
                <button type="button" class="btn btn-primary" onclick="PurchaseRequisition.showConvertModal(${prf.id})">
                    🔄 Convert to PO
                </button>
            ` : ''}
        `;

        document.getElementById('view-prf-modal').classList.remove('hidden');
    },

    closeViewModal() {
        document.getElementById('view-prf-modal').classList.add('hidden');
    },

    showApproveModal(prfId) {
        this.showViewModal(prfId);
    },

    async approvePRFAction(prfId) {
        const notes = prompt('Approval notes (optional):');
        if (notes === null) return; // User cancelled

        const result = await this.approvePRF(prfId, true, notes);

        if (result.success) {
            this.showAlert('success', 'PRF approved successfully');
            this.closeViewModal();
            this.render();
        } else {
            this.showAlert('error', result.errors ? Object.values(result.errors)[0] : 'Failed to approve');
        }
    },

    async rejectPRF(prfId) {
        const reason = prompt('Rejection reason (required):');
        if (!reason) {
            alert('Rejection reason is required');
            return;
        }

        const result = await this.approvePRF(prfId, false, reason);

        if (result.success) {
            this.showAlert('success', 'PRF rejected');
            this.closeViewModal();
            this.render();
        } else {
            this.showAlert('error', result.errors ? Object.values(result.errors)[0] : 'Failed to reject');
        }
    },

    async convertToPO(prfId, supplierInfo, selectedItems = []) {
        const prf = this.getPRF(prfId);
        if (!prf) {
            return { success: false, errors: { prf: 'PRF not found' } };
        }

        if (this._conversionLocks.has(prfId)) {
            return { success: false, errors: { status: 'PRF conversion is already in progress' } };
        }

        if (prf.status === 'converted_to_po') {
            return { success: false, errors: { status: 'PRF has already been fully converted' } };
        }

        if (prf.status !== 'director_approved' && prf.status !== 'purchasing_approved' && prf.status !== 'partially_converted') {
            return { success: false, errors: { status: 'PRF must be approved before conversion' } };
        }

        this._conversionLocks.add(prfId);

        try {
            // Filter and map selected items
            const itemsToConvert = selectedItems.length > 0 ? selectedItems : (prf.items || []).map(item => ({
                itemId: item.itemId,
                itemCode: item.itemCode,
                itemName: item.itemName,
                quantity: item.quantity - (item.orderedQty || 0),
                unit: item.unit,
                unitPrice: item.estimatedPrice || 0
            }));

            if (itemsToConvert.length === 0 || itemsToConvert.every(i => i.quantity <= 0)) {
                return { success: false, errors: { items: 'No valid items/quantities selected for conversion' } };
            }

            const poItems = itemsToConvert.map(item => {
                const origItem = (prf.items || []).find(i => (i.itemId && i.itemId === item.itemId) || i.itemCode === item.itemCode || i.itemName === item.itemName) || item;
                return {
                    itemId: item.itemId || origItem.itemId,
                    itemCode: item.itemCode || origItem.itemCode || '',
                    itemName: item.itemName || origItem.itemName || '',
                    quantity: parseFloat(item.quantity),
                    unit: item.unit || origItem.unit || 'pcs',
                    unitPrice: parseFloat(item.unitPrice || origItem.estimatedPrice || 0)
                };
            });

            // Create PO via PurchaseOrder module
            if (typeof PurchaseOrder === 'undefined') {
                return { success: false, errors: { module: 'PurchaseOrder module not available' } };
            }

            const orderData = {
                supplier: supplierInfo.supplierId,
                supplierName: supplierInfo.supplierName,
                orderDate: new Date().toISOString().split('T')[0],
                expectedDate: prf.deadline || null,
                items: poItems,
                taxRate: 0,
                prfId: prf.id,
                prfNumber: prf.prfNumber,
                notes: `Converted from PRF ${prf.prfNumber}. Purpose: ${prf.purpose || '-'}`
            };

            const result = await PurchaseOrder.createOrder(orderData);

            if (result.success) {
                // Update ordered quantities on PRF items
                poItems.forEach(poItem => {
                    const prfItem = (prf.items || []).find(i => (i.itemId && i.itemId === poItem.itemId) || i.itemCode === poItem.itemCode || i.itemName === poItem.itemName);
                    if (prfItem) {
                        prfItem.orderedQty = (parseFloat(prfItem.orderedQty) || 0) + parseFloat(poItem.quantity);
                    }
                });

                // Check if all items are fully ordered
                const isFullyOrdered = (prf.items || []).every(item => {
                    const ordered = parseFloat(item.orderedQty) || 0;
                    return ordered >= parseFloat(item.quantity);
                });

                prf.status = isFullyOrdered ? 'converted_to_po' : 'partially_converted';
                prf.poNumbers = prf.poNumbers || [];
                if (!prf.poNumbers.includes(result.order.poNumber)) {
                    prf.poNumbers.push(result.order.poNumber);
                }
                prf.poId = result.order.id;
                prf.poNumber = result.order.poNumber;
                prf.convertedAt = new Date().toISOString();
                prf.convertedBy = Auth?.getCurrentUser?.()?.id || 'system';

                await this.saveRequisitions();
                if (typeof AuditLog !== 'undefined') {
                    AuditLog.log('update', 'purchase_requisition', prfId, `Converted to PO ${result.order.poNumber} (${prf.status})`);
                }

                return { success: true, po: result.order };
            } else {
                return { success: false, errors: result.errors || { general: 'Failed to create PO' } };
            }
        } finally {
            this._conversionLocks.delete(prfId);
        }
    },

    renderConvertModal() {
        return `
            <div id="convert-prf-modal" class="modal-overlay hidden">
                <div class="modal" style="max-width: 650px;">
                    <div class="modal-header">
                        <h3 class="modal-title">Convert PRF to PO</h3>
                        <button class="modal-close" onclick="PurchaseRequisition.closeConvertModal()">&times;</button>
                    </div>
                    <form onsubmit="PurchaseRequisition.submitConvert(event)">
                        <div class="modal-body">
                            <input type="hidden" id="convert-prf-id" value="">
                            <p style="margin-bottom: 1rem; color: var(--text-secondary);">
                                Converting PRF <strong id="convert-prf-number"></strong> (Select Items & Supplier for PO)
                            </p>
                            <div class="form-group" style="margin-bottom: 1rem;">
                                <label class="form-label">Select Supplier *</label>
                                <select id="convert-supplier-select" class="form-input" required style="width: 100%;">
                                    <!-- Options injected by JS -->
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Select Items & Quantities for this PO *</label>
                                <div id="convert-items-list-container" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border-color, #cbd5e1); border-radius: 6px; padding: 10px;">
                                    <!-- Item rows injected by JS -->
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="PurchaseRequisition.closeConvertModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">Generate PO</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    showConvertModal(prfId) {
        const prf = this.getPRF(prfId);
        if (!prf || (prf.status !== 'director_approved' && prf.status !== 'purchasing_approved' && prf.status !== 'partially_converted')) {
            alert('PRF must be approved and have remaining un-ordered items');
            return;
        }

        const suppliers = MasterSupplier.getAllSuppliers();
        if (suppliers.length === 0) {
            alert('No suppliers available. Please add a supplier first.');
            return;
        }

        const select = document.getElementById('convert-supplier-select');
        if (!select) return;

        select.innerHTML = '<option value="">Select Supplier</option>' +
            suppliers.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('');

        document.getElementById('convert-prf-id').value = prfId;
        document.getElementById('convert-prf-number').textContent = prf.prfNumber;

        const container = document.getElementById('convert-items-list-container');
        if (container) {
            let html = '<table class="table" style="width: 100%; font-size: 0.88em;"><thead><tr><th><input type="checkbox" onchange="PurchaseRequisition.toggleAllConvertItems(this)"></th><th>Item Name</th><th>Req Qty</th><th>Ordered</th><th>Qty for PO</th></tr></thead><tbody>';
            (prf.items || []).forEach((item, idx) => {
                const ordered = parseFloat(item.orderedQty) || 0;
                const remaining = Math.max(0, parseFloat(item.quantity) - ordered);
                const isDisabled = remaining <= 0;
                html += `
                    <tr style="${isDisabled ? 'opacity: 0.5; background: #f8fafc;' : ''}">
                        <td class="text-center">
                            <input type="checkbox" class="convert-item-checkbox" data-index="${idx}" ${isDisabled ? 'disabled' : 'checked'}>
                        </td>
                        <td><strong>${item.itemName}</strong><br><small>${item.itemCode || ''}</small></td>
                        <td>${item.quantity} ${item.unit || 'pcs'}</td>
                        <td>${ordered}</td>
                        <td>
                            <input type="number" class="form-input convert-item-qty" data-index="${idx}" min="0.01" max="${remaining}" step="any" value="${remaining}" ${isDisabled ? 'disabled' : ''} style="width: 90px; padding: 4px;">
                        </td>
                    </tr>
                `;
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        }

        const modal = document.getElementById('convert-prf-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.zIndex = '1100';
        }
    },

    toggleAllConvertItems(masterCb) {
        const checkboxes = document.querySelectorAll('.convert-item-checkbox:not([disabled])');
        checkboxes.forEach(cb => cb.checked = masterCb.checked);
    },

    closeConvertModal() {
        const modal = document.getElementById('convert-prf-modal');
        if (modal) modal.classList.add('hidden');
        document.getElementById('convert-supplier-select').value = '';
    },

    async submitConvert(speakerEvt) {
        if (speakerEvt && speakerEvt.preventDefault) speakerEvt.preventDefault();

        const prfId = parseInt(document.getElementById('convert-prf-id').value);
        const supplierId = document.getElementById('convert-supplier-select').value;

        if (!supplierId) {
            alert('Please select a supplier');
            return;
        }

        const supplier = MasterSupplier.getSupplier(supplierId);
        if (!supplier) {
            alert('Invalid supplier');
            return;
        }

        const prf = this.getPRF(prfId);
        if (!prf) return;

        const checkboxes = document.querySelectorAll('.convert-item-checkbox:checked');
        if (checkboxes.length === 0) {
            alert('Please select at least one item to convert into this PO');
            return;
        }

        const selectedItems = [];
        checkboxes.forEach(cb => {
            const idx = parseInt(cb.getAttribute('data-index'));
            const origItem = prf.items[idx];
            const qtyInput = document.querySelector(`.convert-item-qty[data-index="${idx}"]`);
            const qtyToOrder = parseFloat(qtyInput?.value || 0);

            if (qtyToOrder > 0) {
                selectedItems.push({
                    itemId: origItem.itemId,
                    itemCode: origItem.itemCode,
                    itemName: origItem.itemName,
                    quantity: qtyToOrder,
                    unit: origItem.unit,
                    unitPrice: origItem.estimatedPrice || 0
                });
            }
        });

        if (selectedItems.length === 0) {
            alert('Valid quantity is required for selected items');
            return;
        }

        if (!confirm(`Convert selected ${selectedItems.length} item(s) from PRF ${prf.prfNumber} into a new PO for ${supplier.name}?`)) {
            return;
        }

        const result = await this.convertToPO(prfId, {
            supplierId: supplier.id,
            supplierCode: supplier.code,
            supplierName: supplier.name
        }, selectedItems);

        if (result.success) {
            this.showAlert('success', `PO ${result.po.poNumber} created successfully! (PRF Status: ${prf.status})`);
            this.closeConvertModal();
            this.closeViewModal();
            this.render();
        } else {
            this.showAlert('error', result.errors ? Object.values(result.errors)[0] : 'Failed to convert');
        }
    },

    async confirmDelete(prfId) {
        const prf = this.getPRF(prfId);
        if (!prf) return;

        if (confirm(`Delete PRF ${prf.prfNumber}?\n\nThis action cannot be undone.`)) {
            const result = await this.deletePRF(prfId);
            if (result.success) {
                this.showAlert('success', 'PRF deleted successfully');
                this.render();
            } else {
                this.showAlert('error', result.errors ? Object.values(result.errors)[0] : 'Failed to delete');
            }
        }
    },

    canUserApprove(prf) {
        const userRole = String(Auth.getCurrentUser().role).toUpperCase();

        if (!this.approvalLimits[userRole]?.canApprove) return false;
        if (prf.totalEstimated > this.approvalLimits[userRole].maxAmount) return false;

        // Generic Dept Head Logic (Step 1)
        if (prf.status === 'submitted') {
            // Purchasing Head special case for own dept
            if (userRole === 'PURCHASING_HEAD' && prf.department === 'Purchasing') return true;

            // Other Heads
            if (userRole !== 'PURCHASING_HEAD' && userRole !== 'DIRECTOR' && userRole !== 'MANAGER_FINANCE') {
                // Check if role matches dept
                let targetDept = null;
                if (userRole.includes('_HEAD')) {
                    const raw = userRole.replace('_HEAD', '');
                    targetDept = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
                }
                if (userRole === 'WAREHOUSE_HEAD') targetDept = 'Warehouse';
                // Add others if needed

                if (targetDept && prf.department === targetDept) return true;
            }
        }

        // Manager Finance (Finance Dept Head + Controller)
        if (userRole === 'MANAGER_FINANCE') {
            if (prf.status === 'submitted' && prf.department === 'Finance') return true;
            if (prf.status === 'purchasing_approved' && prf.totalEstimated > 2000000) return true;
        }

        // Purchasing Head (Step 2 or own dept)
        if (userRole === 'PURCHASING_HEAD') {
            // Can approve if it passed Dept Head
            if (prf.status === 'dept_approved' || prf.status === 'warehouse_approved' || prf.status === 'finance_approved') return true;
            // Or if they are the Dept Head (already handled? No, logic above returned. But double check)
            if (prf.department === 'Purchasing' && prf.status === 'submitted') return true;
        }

        if (userRole === 'DIRECTOR') {
            // Director can override and approve ANY non-final PRF
            const isFinal = ['director_approved', 'converted_to_po', 'rejected'].includes(prf.status);
            return !isFinal;
        }

        return false;
    },

    getStatusLabel(status) {
        const labels = {
            'draft': 'Draft',
            'submitted': 'Submitted',
            'dept_approved': 'Dept Head Approved',
            'warehouse_approved': 'Warehouse Approved',
            'finance_approved': 'Finance Approved',
            'purchasing_approved': 'Purchasing Approved',
            'director_approved': 'Director Approved',
            'rejected': 'Rejected',
            'converted': 'Converted to PO',
            'converted_to_po': 'Converted to PO'
        };
        return labels[status] || status;
    },

    showAlert(type, message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        alertDiv.style.position = 'fixed';
        alertDiv.style.top = '20px';
        alertDiv.style.right = '20px';
        alertDiv.style.zIndex = '9999';
        alertDiv.style.minWidth = '300px';

        document.body.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            alertDiv.style.transition = 'opacity 0.3s';
            setTimeout(() => alertDiv.remove(), 300);
        }, 3000);
    }
};


// Explicitly make PurchaseRequisition globally available
window.PurchaseRequisition = PurchaseRequisition;
