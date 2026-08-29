// ==========================================
// Production Order Module
// Create and manage production batches
// ==========================================

const ProductionOrder = {
    orders: [],
    boms: [],
    currentOrder: null,

    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.loadData();
        this.render();
    },

    loadData() {
        const raw = Storage.getProductionOrders();

        // 🔥 DEDUP + MIGRASI: Pastikan setiap order punya id=orderNumber
        // dan tidak ada duplikat (penyebab bug 56 records)
        const uniqueMap = new Map();
        (raw || []).forEach(order => {
            const key = order.orderNumber || order.id;
            if (!key) return;
            // Tambahkan field id jika belum ada (migrasi data lama)
            if (!order.id) order.id = order.orderNumber;
            // Gunakan yang terbaru jika ada duplikat
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, order);
            }
        });
        this.orders = Array.from(uniqueMap.values());

        // Jika ada perubahan (ada duplikat yang dihapus), update localStorage
        if (this.orders.length !== (raw || []).length) {
            console.log(`🧹 [ProductionOrder] Removed ${(raw||[]).length - this.orders.length} duplicate(s) on load.`);
            try {
                localStorage.setItem(Storage.KEYS.PRODUCTION_ORDERS, JSON.stringify(this.orders));
            } catch(e) {}
        }

        // Load BOMs from storage instead of hardcoded
        this.boms = BOMManagement.getAllBOMs();
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">🏭 Production Orders</h1>
                <p class="page-description">Manage production batches and track progress</p>
            </div>

            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">Production Orders (${this.orders.length})</h2>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="ProductionOrder.showCreateForm()">
                            ➕ New Production Order
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    ${this.renderOrdersList()}
                </div>
            </div>

            <div id="production-form-modal" style="display: none;">
                <!-- Form will be rendered here -->
            </div>
        `;
    },

    renderOrdersList() {
        if (this.orders.length === 0) {
            return '<p class="text-center text-gray">No production orders yet. Create your first batch!</p>';
        }

        const statusColors = {
            'DRAFT': 'secondary',
            'IN_PROGRESS': 'primary',
            'COMPLETED': 'success',
            'CANCELLED': 'danger'
        };

        return `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Order #</th>
                            <th>Batch #</th>
                            <th>Product</th>
                            <th class="text-center">Quantity</th>
                            <th>Current Stage</th>
                            <th>Status</th>
                            <th>Start Date</th>
                            <th>Target Date</th>
                            <th class="text-right">Total Cost</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.orders.map(order => `
                            <tr>
                                <td><strong>${order.orderNumber}</strong></td>
                                <td><span class="badge badge-info">${order.batchNumber}</span></td>
                                <td>${order.productName}</td>
                                <td class="text-center">${order.quantity}g</td>
                                <td><span class="badge badge-secondary">${order.currentStage || 'NOT STARTED'}</span></td>
                                <td><span class="badge badge-${statusColors[order.status]}">${order.status}</span></td>
                                <td>${new Date(order.startDate).toLocaleDateString('id-ID')}</td>
                                <td>${new Date(order.targetCompletionDate).toLocaleDateString('id-ID')}</td>
                                <td class="text-right">${this.formatCurrency(order.totalCost || 0)}</td>
                                <td>
                                    <button class="btn btn-sm btn-secondary" onclick="ProductionOrder.viewDetail('${order.orderNumber}')">
                                        View
                                    </button>
                                    ${order.status === 'DRAFT' ? `
                                        <button class="btn btn-sm btn-danger" onclick="ProductionOrder.deleteOrder('${order.orderNumber}')">
                                            Delete
                                        </button>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    showCreateForm() {
        const modal = document.getElementById('production-form-modal');
        modal.style.display = 'block';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1000; overflow-y: auto;">
                <div style="max-width: 800px; margin: 50px auto; background: var(--bg-secondary); border-radius: 8px; padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <h2>Create Production Order</h2>
                        <button class="btn btn-secondary" onclick="ProductionOrder.closeForm()">✖ Close</button>
                    </div>

                    <form id="production-order-form" onsubmit="ProductionOrder.saveOrder(event)">
                        <div class="form-group">
                            <label class="form-label">Product *</label>
                            <select class="form-select" name="bomId" required onchange="ProductionOrder.updateBOMPreview(this.value)">
                                <option value="">-- Select Product --</option>
                                ${this.boms.map(bom => `
                                    <option value="${bom.bomId}">${bom.productName}</option>
                                `).join('')}
                            </select>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Quantity to Produce (g) *</label>
                                <input type="number" class="form-input" name="quantity" required min="1" 
                                       onchange="ProductionOrder.updateCostEstimate()">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Target Completion Date *</label>
                                <input type="date" class="form-input" name="targetDate" required>
                            </div>
                        </div>

                        <div id="bom-preview" style="margin: 16px 0; padding: 16px; background: var(--bg-tertiary); border-radius: 8px; display: none;">
                            <!-- BOM details will appear here -->
                        </div>

                        <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
                            <button type="button" class="btn btn-secondary" onclick="ProductionOrder.closeForm()">
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                Create Production Order
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    updateBOMPreview(bomId) {
        const preview = document.getElementById('bom-preview');
        if (!bomId) {
            preview.style.display = 'none';
            return;
        }

        const bom = this.boms.find(b => b.bomId === bomId);
        if (!bom) return;

        preview.style.display = 'block';
        preview.innerHTML = `
            <h3 style="margin: 0 0 12px 0;">Bill of Materials - ${bom.productName}</h3>
            
            <div style="margin-bottom: 16px;">
                <strong>Materials Required:</strong>
                <ul style="margin: 8px 0;">
                    ${bom.materials.map(m => `
                        <li>${m.itemName}: ${m.quantity}${m.unit} @ ${this.formatCurrency(m.costPerUnit)}/${m.unit}</li>
                    `).join('')}
                </ul>
            </div>

            <div style="margin-bottom: 16px;">
                <strong>Labor Required:</strong>
                <ul style="margin: 8px 0;">
                    ${bom.labor.map(l => `
                        <li>${l.role}: ${l.hours} hours @ ${this.formatCurrency(l.ratePerHour)}/hour</li>
                    `).join('')}
                </ul>
            </div>

            <div>
                <strong>Production Stages:</strong> ${bom.stages.join(' → ')}
            </div>

            <div style="margin-top: 12px;">
                <strong>Standard Yield:</strong> ${bom.standardYield}%
                <span style="color: #666; font-size: 13px;">(Expected output: ${bom.outputQuantity}g from ${bom.materials[0].quantity}g input)</span>
            </div>
        `;

        this.updateCostEstimate();
    },

    updateCostEstimate() {
        const form = document.getElementById('production-order-form');
        const bomId = form.bomId.value;
        const quantity = parseFloat(form.quantity.value) || 0;

        if (!bomId || quantity === 0) return;

        const bom = this.boms.find(b => b.bomId === bomId);
        if (!bom) return;

        const multiplier = quantity / bom.outputQuantity;

        const materialCost = bom.materials.reduce((sum, m) =>
            sum + (m.quantity * m.costPerUnit * multiplier), 0);

        const laborCost = bom.labor.reduce((sum, l) =>
            sum + (l.hours * l.ratePerHour * multiplier), 0);

        const overheadCost = (materialCost + laborCost) * bom.overheadRate;
        const totalCost = materialCost + laborCost + overheadCost;

        const preview = document.getElementById('bom-preview');
        const existingEstimate = preview.querySelector('#cost-estimate');

        const estimateHTML = `
            <div id="cost-estimate" style="margin-top: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: 4px;">
                <strong>Estimated Cost for ${quantity}g:</strong><br>
                <div style="margin: 8px 0 0 16px; font-size: 14px;">
                    Material: ${this.formatCurrency(materialCost)}<br>
                    Labor: ${this.formatCurrency(laborCost)}<br>
                    Overhead (30%): ${this.formatCurrency(overheadCost)}<br>
                    <strong>TOTAL: ${this.formatCurrency(totalCost)}</strong>
                    <span style="color: #666;">(${this.formatCurrency(totalCost / quantity)}/g)</span>
                </div>
            </div>
        `;

        if (existingEstimate) {
            existingEstimate.outerHTML = estimateHTML;
        } else {
            preview.insertAdjacentHTML('beforeend', estimateHTML);
        }
    },

    saveOrder(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);

        const bom = this.boms.find(b => b.bomId === formData.get('bomId'));
        if (!bom) {
            alert('Please select a product');
            return;
        }

        const orderNumber = this.generateOrderNumber();
        const batchNumber = this.generateBatchNumber();

        const newOrder = {
            id: orderNumber,           // ✅ CRITICAL: id = orderNumber agar sync key konsisten
            orderNumber: orderNumber,
            batchNumber: batchNumber,
            productCode: bom.productCode,
            productName: bom.productName,
            quantity: parseFloat(formData.get('quantity')),
            bomId: bom.bomId,
            status: 'DRAFT',
            currentStage: null,
            startDate: new Date().toISOString().split('T')[0],
            targetCompletionDate: formData.get('targetDate'),
            actualCompletionDate: null,
            totalCost: 0,
            movements: [],
            createdBy: Auth.getCurrentUser()?.username || 'system',
            createdAt: new Date().toISOString()
        };

        this.orders.push(newOrder);
        Storage.saveProductionOrders(this.orders);

        alert(`✅ Production Order ${orderNumber} created successfully!\nBatch: ${batchNumber}`);
        this.closeForm();
        this.init();
    },

    generateOrderNumber() {
        const count = this.orders.length + 1;
        return `PRD-${String(count).padStart(4, '0')}`;
    },

    generateBatchNumber() {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
        const count = this.orders.filter(o => o.batchNumber.startsWith(`BATCH-${dateStr}`)).length + 1;
        return `BATCH-${dateStr}-${String(count).padStart(3, '0')}`;
    },

    viewDetail(orderNumber) {
        const order = this.orders.find(o => o.orderNumber === orderNumber);
        if (!order) return;

        // Navigate to production detail view
        App.navigateTo('production-detail');
        ProductionDetail.init(order);
    },

    async deleteOrder(orderNumber) {
        if (!confirm(`Delete production order ${orderNumber}?`)) return;

        try {
            // 1. Hapus dari Firebase Cloud + buat tombstone
            //    Tombstone mencegah data muncul kembali saat sync/refresh
            if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
                await FirebaseSync.deleteFromCloud(Storage.KEYS.PRODUCTION_ORDERS, orderNumber);
            }
        } catch (e) { 
            console.warn('Cloud delete failed for ProductionOrder:', e);
            // Lanjut hapus lokal meskipun cloud gagal
        }

        // 2. Filter dari array lokal
        this.orders = this.orders.filter(o => o.orderNumber !== orderNumber);
        
        // 3. Simpan langsung ke localStorage TANPA memanggil syncToFirestore
        //    (syncToFirestore bersifat additive-only dan tidak akan menghapus Cloud)
        //    Tombstone sudah dibuat di langkah 1 sehingga item tidak akan restore.
        try {
            localStorage.setItem(Storage.KEYS.PRODUCTION_ORDERS, JSON.stringify(this.orders));
        } catch(e) {
            console.warn('localStorage save failed:', e);
        }
        
        // 4. Re-render UI
        this.render();
    },

    closeForm() {
        document.getElementById('production-form-modal').style.display = 'none';
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }
};


// Explicitly make ProductionOrder globally available
window.ProductionOrder = ProductionOrder;
