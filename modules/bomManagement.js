// ==========================================
// BOM (Bill of Materials) Management
// Manage product BOMs linked to Master Items
// ==========================================

const BOMManagement = {
    boms: [],

    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.loadData();
        this.render();
    },

    async loadData() {
        this.boms = Storage.get(Storage.KEYS.BOMS) || this.getDefaultBOMs();
        // Save default if empty
        if (!Storage.get(Storage.KEYS.BOMS)) {
            await Storage.set(Storage.KEYS.BOMS, this.boms);
        }
    },

    getDefaultBOMs() {
        // Pre-configured BOMs for common gold products
        // These link to items in Master Item
        return [
            {
                bomId: 'BOM-GOLDBAR-100G',
                productCode: 'GOLD-BAR-100G',
                productName: 'Gold Bar 100g (99.99%)',
                outputQuantity: 100, // grams
                materials: [
                    { itemCode: 'GOLD-RAW-001', itemName: 'Emas Mentah Scrap', quantity: 105, unit: 'g', costPerUnit: 950000 },
                    { itemCode: 'CHEM-BORAX', itemName: 'Borax (Flux)', quantity: 10, unit: 'g', costPerUnit: 50 },
                    { itemCode: 'CONS-CRUCIBLE', itemName: 'Graphite Crucible', quantity: 0.1, unit: 'pcs', costPerUnit: 250000 }
                ],
                labor: [
                    { role: 'Melting Operator', hours: 0.5, ratePerHour: 50000 },
                    { role: 'Assay Technician', hours: 1, ratePerHour: 75000 },
                    { role: 'Refining Engineer', hours: 2, ratePerHour: 100000 },
                    { role: 'Casting Operator', hours: 0.5, ratePerHour: 50000 },
                    { role: 'QC Inspector', hours: 0.5, ratePerHour: 75000 }
                ],
                overheadRate: 0.30, // 30% of direct costs
                standardYield: 95.24, // 100/105 = 95.24%
                stages: ['MELTING', 'ASSAY', 'REFINING', 'CASTING', 'QC'],
                isActive: true
            },
            {
                bomId: 'BOM-GRAIN-1KG',
                productCode: 'GOLD-GRAIN-1KG',
                productName: 'Gold Grain 1kg (99.9%)',
                outputQuantity: 1000,
                materials: [
                    { itemCode: 'GOLD-RAW-001', itemName: 'Emas Mentah Scrap', quantity: 1050, unit: 'g', costPerUnit: 950000 },
                    { itemCode: 'CHEM-BORAX', itemName: 'Borax (Flux)', quantity: 100, unit: 'g', costPerUnit: 50 },
                    { itemCode: 'CONS-CRUCIBLE', itemName: 'Graphite Crucible', quantity: 1, unit: 'pcs', costPerUnit: 250000 }
                ],
                labor: [
                    { role: 'Melting Operator', hours: 2, ratePerHour: 50000 },
                    { role: 'Assay Technician', hours: 3, ratePerHour: 75000 },
                    { role: 'Refining Engineer', hours: 8, ratePerHour: 100000 }
                ],
                overheadRate: 0.30,
                standardYield: 95.24,
                stages: ['MELTING', 'ASSAY', 'REFINING', 'GRANULATION', 'QC'],
                isActive: true
            }
        ];
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">📋 Bill of Materials (BOM)</h1>
                <p class="page-description">Manage production BOMs linked to finished goods</p>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">BOMs (${this.boms.length})</h2>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="BOMManagement.showCreateForm()">
                            ➕ New BOM
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    ${this.renderBOMList()}
                </div>
            </div>

            <div id="bom-form-modal" style="display: none;">
                <!-- Form will be rendered here -->
            </div>
        `;
    },

    renderBOMList() {
        if (this.boms.length === 0) {
            return '<p class="text-center text-gray">No BOMs configured yet</p>';
        }

        return `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th class="text-center">Output Qty</th>
                            <th class="text-center">Materials</th>
                            <th class="text-center">Labor Steps</th>
                            <th class="text-center">Stages</th>
                            <th class="text-right">Est. Cost</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.boms.map(bom => {
            const estCost = this.calculateEstimatedCost(bom);
            return `
                                <tr>
                                    <td><strong>${bom.productName}</strong></td>
                                    <td class="text-center">${bom.outputQuantity}g</td>
                                    <td class="text-center">${bom.materials.length}</td>
                                    <td class="text-center">${bom.labor.length}</td>
                                    <td class="text-center">${bom.stages.length}</td>
                                    <td class="text-right">${this.formatCurrency(estCost.total)}</td>
                                    <td>
                                        <span class="badge ${bom.isActive ? 'badge-success' : 'badge-secondary'}">
                                            ${bom.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <button class="btn btn-sm btn-secondary" onclick="BOMManagement.viewDetail('${bom.bomId}')">
                                            👁️ View
                                        </button>
                                        <button class="btn btn-sm btn-primary" onclick="BOMManagement.editBOM('${bom.bomId}')" style="margin-left: 8px;">
                                            ✏️ Edit
                                        </button>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    calculateEstimatedCost(bom) {
        const materialCost = bom.materials.reduce((sum, m) => sum + (m.quantity * m.costPerUnit), 0);
        const laborCost = bom.labor.reduce((sum, l) => sum + (l.hours * l.ratePerHour), 0);
        const overheadCost = (materialCost + laborCost) * bom.overheadRate;
        return {
            material: materialCost,
            labor: laborCost,
            overhead: overheadCost,
            total: materialCost + laborCost + overheadCost
        };
    },

    viewDetail(bomId) {
        const bom = this.boms.find(b => b.bomId === bomId);
        if (!bom) return;

        const cost = this.calculateEstimatedCost(bom);

        const modal = document.getElementById('bom-form-modal');
        modal.style.display = 'block';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1000; overflow-y: auto;">
                <div style="max-width: 900px; margin: 50px auto; background: var(--bg-secondary); border-radius: 8px; padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <h2>BOM Detail: ${bom.productName}</h2>
                        <button class="btn btn-secondary" onclick="BOMManagement.closeForm()">✖ Close</button>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
                        <div>
                            <strong>Product Code:</strong><br>
                            ${bom.productCode}
                        </div>
                        <div>
                            <strong>Output Quantity:</strong><br>
                            ${bom.outputQuantity}g
                        </div>
                        <div>
                            <strong>Standard Yield:</strong><br>
                            ${bom.standardYield}%
                        </div>
                    </div>

                    <h3 style="margin: 24px 0 12px 0;">Materials Required</h3>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th class="text-right">Quantity</th>
                                <th class="text-right">Cost/Unit</th>
                                <th class="text-right">Total Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${bom.materials.map(m => `
                                <tr>
                                    <td>${m.itemName}</td>
                                    <td class="text-right">${m.quantity}${m.unit}</td>
                                    <td class="text-right">${this.formatCurrency(m.costPerUnit)}</td>
                                    <td class="text-right">${this.formatCurrency(m.quantity * m.costPerUnit)}</td>
                                </tr>
                            `).join('')}
                            <tr style="background: var(--bg-tertiary); font-weight: bold;">
                                <td colspan="3" class="text-right">Material Subtotal:</td>
                                <td class="text-right">${this.formatCurrency(cost.material)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <h3 style="margin: 24px 0 12px 0;">Labor Required</h3>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Role</th>
                                <th class="text-right">Hours</th>
                                <th class="text-right">Rate/Hour</th>
                                <th class="text-right">Total Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${bom.labor.map(l => `
                                <tr>
                                    <td>${l.role}</td>
                                    <td class="text-right">${l.hours}</td>
                                    <td class="text-right">${this.formatCurrency(l.ratePerHour)}</td>
                                    <td class="text-right">${this.formatCurrency(l.hours * l.ratePerHour)}</td>
                                </tr>
                            `).join('')}
                            <tr style="background: var(--bg-tertiary); font-weight: bold;">
                                <td colspan="3" class="text-right">Labor Subtotal:</td>
                                <td class="text-right">${this.formatCurrency(cost.labor)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <h3 style="margin: 24px 0 12px 0;">Production Stages</h3>
                    <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 4px;">
                        ${bom.stages.join(' → ')}
                    </div>

                    <h3 style="margin: 24px 0 12px 0;">Cost Summary</h3>
                    <table class="table">
                        <tbody>
                            <tr>
                                <td><strong>Material Cost:</strong></td>
                                <td class="text-right">${this.formatCurrency(cost.material)}</td>
                            </tr>
                            <tr>
                                <td><strong>Labor Cost:</strong></td>
                                <td class="text-right">${this.formatCurrency(cost.labor)}</td>
                            </tr>
                            <tr>
                                <td><strong>Overhead (${(bom.overheadRate * 100)}%):</strong></td>
                                <td class="text-right">${this.formatCurrency(cost.overhead)}</td>
                            </tr>
                            <tr style="background: var(--bg-tertiary); font-weight: bold; font-size: 16px;">
                                <td><strong>TOTAL COST:</strong></td>
                                <td class="text-right">${this.formatCurrency(cost.total)}</td>
                            </tr>
                            <tr style="background: var(--bg-tertiary);">
                                <td><strong>Cost per Gram:</strong></td>
                                <td class="text-right">${this.formatCurrency(cost.total / bom.outputQuantity)}/g</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    editBOM(bomId) {
        const bom = this.boms.find(b => b.bomId === bomId);
        if (!bom) return;

        const modal = document.getElementById('bom-form-modal');
        modal.style.display = 'block';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1000; overflow-y: auto;">
                <div style="max-width: 900px; margin: 50px auto; background: var(--bg-secondary); border-radius: 8px; padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <h2>✏️ Edit BOM: ${bom.productName}</h2>
                        <button class="btn btn-secondary" onclick="BOMManagement.closeForm()">✖ Cancel</button>
                    </div>

                    <form id="edit-bom-form" onsubmit="BOMManagement.saveBOMEdit(event, '${bomId}')">
                        <h3 style="margin: 24px 0 12px 0;">Materials Required</h3>
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th class="text-right">Quantity</th>
                                    <th class="text-right">Cost/Unit</th>
                                    <th class="text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${bom.materials.map((m, idx) => `
                                    <tr>
                                        <td>${m.itemName}</td>
                                        <td class="text-right">
                                            <input type="number" 
                                                   name="material_qty_${idx}" 
                                                   value="${m.quantity}" 
                                                   step="0.01" 
                                                   min="0" 
                                                   style="width: 100px; text-align: right;" 
                                                   class="form-input"
                                                   required>
                                            ${m.unit}
                                        </td>
                                        <td class="text-right">
                                            <input type="number" 
                                                   name="material_cost_${idx}" 
                                                   value="${m.costPerUnit}" 
                                                   step="1" 
                                                   min="0" 
                                                   style="width: 120px; text-align: right;" 
                                                   class="form-input"
                                                   required>
                                        </td>
                                        <td class="text-right" id="material_total_${idx}">-</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <h3 style="margin: 24px 0 12px 0;">Labor Required</h3>
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Role</th>
                                    <th class="text-right">Hours</th>
                                    <th class="text-right">Rate/Hour</th>
                                    <th class="text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${bom.labor.map((l, idx) => `
                                    <tr>
                                        <td>${l.role}</td>
                                        <td class="text-right">
                                            <input type="number" 
                                                   name="labor_hours_${idx}" 
                                                   value="${l.hours}" 
                                                   step="0.1" 
                                                   min="0" 
                                                   style="width: 100px; text-align: right;" 
                                                   class="form-input"
                                                   required>
                                        </td>
                                        <td class="text-right">
                                            <input type="number" 
                                                   name="labor_rate_${idx}" 
                                                   value="${l.ratePerHour}" 
                                                   step="1000" 
                                                   min="0" 
                                                   style="width: 120px; text-align: right;" 
                                                   class="form-input"
                                                   required>
                                        </td>
                                        <td class="text-right" id="labor_total_${idx}">-</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <div style="margin-top: 24px; text-align: right;">
                            <button type="button" class="btn btn-secondary" onclick="BOMManagement.closeForm()" style="margin-right: 8px;">Cancel</button>
                            <button type="submit" class="btn btn-primary">💾 Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    async saveBOMEdit(event, bomId) {
        event.preventDefault();
        const formData = new FormData(event.target);

        const bomIndex = this.boms.findIndex(b => b.bomId === bomId);
        if (bomIndex === -1) return;

        const bom = this.boms[bomIndex];

        // Update material quantities and costs
        bom.materials.forEach((m, idx) => {
            m.quantity = parseFloat(formData.get(`material_qty_${idx}`));
            m.costPerUnit = parseFloat(formData.get(`material_cost_${idx}`));
        });

        // Update labor hours and rates
        bom.labor.forEach((l, idx) => {
            l.hours = parseFloat(formData.get(`labor_hours_${idx}`));
            l.ratePerHour = parseFloat(formData.get(`labor_rate_${idx}`));
        });

        // Save to storage
        await Storage.set(Storage.KEYS.BOMS, this.boms);

        // Show success message
        console.log(`✅ BOM updated: ${bom.productName}`);

        // Close form and refresh list
        this.closeForm();
        this.render();
    },

    showCreateForm() {
        const items = Storage.get(Storage.KEYS.ITEMS) || [];

        const modal = document.getElementById('bom-form-modal');
        modal.style.display = 'block';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1000; overflow-y: auto;">
                <div style="max-width: 900px; margin: 50px auto; background: var(--bg-secondary); border-radius: 8px; padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <h2>➕ Create New BOM</h2>
                        <button class="btn btn-secondary" onclick="BOMManagement.closeForm()">✖ Cancel</button>
                    </div>

                    <form id="create-bom-form" onsubmit="BOMManagement.saveNewBOM(event)">
                        <h3>Product Information</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
                            <div>
                                <label class="form-label">Product Code *</label>
                                <input type="text" name="productCode" class="form-input" required placeholder="e.g. GOLD-BAR-50G">
                            </div>
                            <div>
                                <label class="form-label">Product Name *</label>
                                <input type="text" name="productName" class="form-input" required placeholder="e.g. Gold Bar 50g">
                            </div>
                            <div>
                                <label class="form-label">Output Quantity (g) *</label>
                                <input type="number" name="outputQuantity" class="form-input" required min="1" step="0.01" value="100">
                            </div>
                            <div>
                                <label class="form-label">Standard Yield (%) *</label>
                                <input type="number" name="standardYield" class="form-input" required min="1" max="100" step="0.01" value="95">
                            </div>
                            <div>
                                <label class="form-label">Overhead Rate (%) *</label>
                                <input type="number" name="overheadRate" class="form-input" required min="0" max="100" step="1" value="30">
                            </div>
                        </div>

                        <h3>Materials Required</h3>
                        <div id="materials-section">
                            <div class="material-row" style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 8px; margin-bottom: 8px;">
                                <select name="material_item_0" class="form-input" required>
                                    <option value="">Select Item...</option>
                                    ${items.map(item => `<option value="${item.code}">${item.code} - ${item.name}</option>`).join('')}
                                </select>
                                <input type="number" name="material_qty_0" class="form-input" placeholder="Quantity" required min="0" step="0.01">
                                <input type="number" name="material_cost_0" class="form-input" placeholder="Cost/Unit" required min="0">
                                <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">🗑️</button>
                            </div>
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="BOMManagement.addMaterialRow()" style="margin-top: 8px;">
                            ➕ Add Material
                        </button>

                        <h3 style="margin-top: 24px;">Labor Required</h3>
                        <div id="labor-section">
                            <div class="labor-row" style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 8px; margin-bottom: 8px;">
                                <input type="text" name="labor_role_0" class="form-input" placeholder="Role" required>
                                <input type="number" name="labor_hours_0" class="form-input" placeholder="Hours" required min="0" step="0.1">
                                <input type="number" name="labor_rate_0" class="form-input" placeholder="Rate/Hour" required min="0">
                                <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">🗑️</button>
                            </div>
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="BOMManagement.addLaborRow()" style="margin-top: 8px;">
                            ➕ Add Labor
                        </button>

                        <h3 style="margin-top: 24px;">Production Stages</h3>
                        <input type="text" name="stages" class="form-input" placeholder="Enter stages separated by comma (e.g. MELTING, ASSAY, REFINING)" required value="MELTING, ASSAY, REFINING, CASTING, QC">

                        <div style="margin-top: 24px; text-align: right;">
                            <button type="button" class="btn btn-secondary" onclick="BOMManagement.closeForm()" style="margin-right: 8px;">Cancel</button>
                            <button type="submit" class="btn btn-primary">💾 Create BOM</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    addMaterialRow() {
        const items = Storage.get(Storage.KEYS.ITEMS) || [];
        const section = document.getElementById('materials-section');
        const index = section.children.length;

        const row = document.createElement('div');
        row.className = 'material-row';
        row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 8px; margin-bottom: 8px;';
        row.innerHTML = `
            <select name="material_item_${index}" class="form-input" required>
                <option value="">Select Item...</option>
                ${items.map(item => `<option value="${item.code}">${item.code} - ${item.name}</option>`).join('')}
            </select>
            <input type="number" name="material_qty_${index}" class="form-input" placeholder="Quantity" required min="0" step="0.01">
            <input type="number" name="material_cost_${index}" class="form-input" placeholder="Cost/Unit" required min="0">
            <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">🗑️</button>
        `;
        section.appendChild(row);
    },

    addLaborRow() {
        const section = document.getElementById('labor-section');
        const index = section.children.length;

        const row = document.createElement('div');
        row.className = 'labor-row';
        row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 8px; margin-bottom: 8px;';
        row.innerHTML = `
            <input type="text" name="labor_role_${index}" class="form-input" placeholder="Role" required>
            <input type="number" name="labor_hours_${index}" class="form-input" placeholder="Hours" required min="0" step="0.1">
            <input type="number" name="labor_rate_${index}" class="form-input" placeholder="Rate/Hour" required min="0">
            <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">🗑️</button>
        `;
        section.appendChild(row);
    },

    async saveNewBOM(event) {
        event.preventDefault();
        const formData = new FormData(event.target);

        // Build materials array
        const materials = [];
        const items = Storage.get(Storage.KEYS.ITEMS) || [];
        let materialIndex = 0;
        while (formData.has(`material_item_${materialIndex}`)) {
            const itemCode = formData.get(`material_item_${materialIndex}`);
            const item = items.find(i => i.code === itemCode);
            materials.push({
                itemCode: itemCode,
                itemName: item ? item.name : itemCode,
                quantity: parseFloat(formData.get(`material_qty_${materialIndex}`)),
                unit: item ? item.uom : 'g',
                costPerUnit: parseFloat(formData.get(`material_cost_${materialIndex}`))
            });
            materialIndex++;
        }

        // Build labor array
        const labor = [];
        let laborIndex = 0;
        while (formData.has(`labor_role_${laborIndex}`)) {
            labor.push({
                role: formData.get(`labor_role_${laborIndex}`),
                hours: parseFloat(formData.get(`labor_hours_${laborIndex}`)),
                ratePerHour: parseFloat(formData.get(`labor_rate_${laborIndex}`))
            });
            laborIndex++;
        }

        // Build stages array
        const stagesStr = formData.get('stages');
        const stages = stagesStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

        // Create new BOM
        const productCode = formData.get('productCode');
        const newBOM = {
            bomId: `BOM-${productCode}`,
            productCode: productCode,
            productName: formData.get('productName'),
            outputQuantity: parseFloat(formData.get('outputQuantity')),
            materials: materials,
            labor: labor,
            overheadRate: parseFloat(formData.get('overheadRate')) / 100,
            standardYield: parseFloat(formData.get('standardYield')),
            stages: stages,
            isActive: true
        };

        // Save to storage
        this.boms.push(newBOM);
        await Storage.set(Storage.KEYS.BOMS, this.boms);

        // Auto-create finished goods item in Master Items if not exists
        // (reusing items variable from line 547)
        const existingItem = items.find(i => i.code === productCode);

        if (!existingItem) {
            // Calculate estimated cost from BOM
            const materialCost = materials.reduce((sum, m) => sum + (m.quantity * m.costPerUnit), 0);
            const laborCost = labor.reduce((sum, l) => sum + (l.hours * l.ratePerHour), 0);
            const overheadCost = (materialCost + laborCost) * newBOM.overheadRate;
            const totalCost = materialCost + laborCost + overheadCost;
            const costPerGram = totalCost / newBOM.outputQuantity;

            const newItem = {
                code: productCode,
                name: formData.get('productName'),
                category: 'FINISHED_GOODS',
                uom: 'gram',
                standardCost: Math.round(costPerGram),
                sellingPrice: Math.round(costPerGram * 1.1), // 10% markup default
                trackStock: true,
                description: `Finished goods from BOM ${newBOM.bomId}`
            };

            items.push(newItem);
            await Storage.set(Storage.KEYS.ITEMS, items);
            console.log('✅ Auto-created item in Master Items:', productCode);
        }

        console.log('✅ BOM created:', newBOM.bomId);

        // Close and refresh
        this.closeForm();
        this.render();
    },

    closeForm() {
        document.getElementById('bom-form-modal').style.display = 'none';
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    // Static method for other modules to use
    getAllBOMs() {
        return Storage.get(Storage.KEYS.BOMS) || this.getDefaultBOMs();
    },

    getBOMByProduct(productCode) {
        const boms = this.getAllBOMs();
        return boms.find(b => b.productCode === productCode && b.isActive);
    }
};
