// ==========================================
// Frontdesk Receipt Module
// Handle quick customer gold/scrap receiving
// ==========================================

const Frontdesk = {
    documents: [],
    currentReceipt: null,

    init() {
        this.loadDocuments();
        this.checkAuth();
        this.setupForm();
        this.populateCustomerDatalist();
        this.renderHistory();
    },

    loadDocuments() {
        if (typeof Storage !== 'undefined') {
            this.documents = Storage.getTTBs() || [];
        }
    },

    saveDocuments() {
        if (typeof Storage !== 'undefined') {
            Storage.saveTTBs(this.documents);
        }
    },

    checkAuth() {
        // Enforce login
        const authModule = window.FirebaseAuth || window.Auth;
        if (authModule && !authModule.isAuthenticated()) {
            window.location.href = 'login.html';
        }
    },

    async generateTTBNumber() {
        if (typeof Storage !== 'undefined') {
            const nextRef = await Storage.getNextReferenceNumber('TTB');
            if (nextRef) return nextRef;
        }

        const now = new Date();
        const year = String(now.getFullYear()).slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, '0');

        // Let's search inside documents of frontdesk (or standard storage)
        const ttbs = (typeof Storage !== 'undefined' ? (Storage.getTTBs() || []) : []).filter(t =>
            t.ttbNumber && (t.ttbNumber.includes(`GAR-TTB-${year}-${month}`) || t.ttbNumber.includes(`${year}${month}`))
        );

        const nextNum = String(ttbs.length + 1).padStart(4, '0');
        return `GAR-TTB-${year}-${month}-${nextNum}`;
    },

    populateCustomerDatalist() {
        const datalist = document.getElementById('customer-list');
        if (!datalist) return;
        
        datalist.innerHTML = '';
        const customers = Storage.getCustomers() || [];
        customers.forEach(cust => {
            const option = document.createElement('option');
            option.value = cust.name;
            datalist.appendChild(option);
        });
    },

    setupForm() {
        const form = document.getElementById('frontdesk-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleSubmit();
            });
        }

        // Set default date to today
        const dateInput = document.getElementById('receipt-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // Toggle KYC section and auto-fill phone
        const nameInput = document.getElementById('customer-name');
        if (nameInput) {
            nameInput.addEventListener('input', () => {
                const name = nameInput.value.trim();
                const customers = Storage.getCustomers() || [];
                const matched = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
                
                const kycSection = document.getElementById('kyc-section');
                if (matched) {
                    // Hide KYC for existing customer
                    if (kycSection) kycSection.style.display = 'none';
                    const phoneInput = document.getElementById('customer-phone');
                    if (phoneInput) phoneInput.value = matched.phone || '';
                    const addrInput = document.getElementById('customer-address');
                    if (addrInput) addrInput.value = matched.address || '';
                } else {
                    // Show KYC for new customer
                    if (kycSection && name.length > 0) {
                        kycSection.style.display = 'block';
                    } else if (kycSection) {
                        kycSection.style.display = 'none';
                    }
                }
            });
        }

        // Convert KTP file to base64
        const fileInput = document.getElementById('kyc-file');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        document.getElementById('kyc-file-base64').value = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    },

    async handleSubmit() {
        const customerName = document.getElementById('customer-name').value.trim();
        const customerPhone = document.getElementById('customer-phone').value.trim();
        const customerAddress = document.getElementById('customer-address').value.trim();
        const itemDesc = document.getElementById('item-desc').value.trim();
        const grossWeight = parseFloat(document.getElementById('gross-weight').value);
        const notes = document.getElementById('notes').value.trim();

        if (!customerName || !itemDesc || isNaN(grossWeight) || grossWeight <= 0) {
            alert('Mohon isi semua data wajib dengan benar.');
            return;
        }

        // Add user-friendly confirmation dialog to review data before saving
        const dateVal = document.getElementById('receipt-date')?.value || new Date().toISOString().split('T')[0];
        const confirmMsg = `⚠️ KONFIRMASI PENERIMAAN BARANG\n\n` +
            `Harap periksa kembali detail data berikut:\n` +
            `-----------------------------------------------\n` +
            `• Pelanggan   : ${customerName}\n` +
            `• No. Telepon : ${customerPhone || '-'}\n` +
            `• Alamat      : ${customerAddress || '-'}\n` +
            `• Tanggal     : ${dateVal}\n` +
            `• Barang      : ${itemDesc}\n` +
            `• Berat Kotor : ${grossWeight.toFixed(2)} gram  <-- PASTIKAN BERAT BENAR!\n` +
            `• Catatan     : ${notes || '-'}\n` +
            `-----------------------------------------------\n\n` +
            `Apakah Anda yakin data di atas sudah benar dan siap disimpan & dicetak?`;

        if (!confirm(confirmMsg)) {
            return;
        }

        const authModule = window.FirebaseAuth || window.Auth;
        const currentUser = authModule ? authModule.getCurrentUser() : null;

        // Connect customer database
        const customers = Storage.getCustomers() || [];
        let matchedCustomer = customers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
        
        let finalCustomerId = '';
        let isNewCust = false;

        if (matchedCustomer) {
            finalCustomerId = matchedCustomer.id || matchedCustomer.code;
            // Update phone if it was empty but filled now
            let updates = {};
            if (customerPhone && !matchedCustomer.phone) updates.phone = customerPhone;
            if (customerAddress && !matchedCustomer.address) updates.address = customerAddress;
            
            if (Object.keys(updates).length > 0) {
                Storage.updateCustomer(finalCustomerId, updates);
            }
        } else {
            isNewCust = true;
            
            // Validate KYC fields for new customer
            const kycIdNumber = document.getElementById('kyc-id-number').value.trim();
            const kycFileBase64 = document.getElementById('kyc-file-base64').value;
            const kycNationality = document.getElementById('kyc-nationality').value;

            if (!kycIdNumber || !kycFileBase64) {
                alert('⚠️ Pelanggan baru WAJIB mengisi data KYC (No. Identitas & Upload KTP/Paspor).');
                return;
            }

            // Register new customer in database (marked with pending KYC)
            finalCustomerId = 'CUST-' + Date.now();
            const newCust = {
                id: finalCustomerId,
                code: finalCustomerId,
                name: customerName,
                phone: customerPhone,
                contactPerson: customerName,
                address: customerAddress,
                paymentTerms: 'COD',
                creditLimit: 0,
                kycStatus: 'submitted',
                description: 'Pelanggan Baru (Walk-in Frontdesk)'
            };
            Storage.addCustomer(newCust);

            // Generate and save KYC record
            const kycRecords = Storage.getKYCRecords() || [];
            const newKYC = {
                id: Date.now(),
                customerId: finalCustomerId,
                status: 'submitted',
                nationalityType: kycNationality,
                documents: {
                    ktp: kycFileBase64,
                    ktpNumber: kycIdNumber
                },
                advancedData: {
                    profileType: 'individual',
                    isNewCustomer: false,
                    individual: {
                        nama: customerName,
                        alamat: customerAddress,
                        noIdentitas: kycIdNumber
                    }
                },
                submittedAt: new Date().toISOString(),
                submittedBy: currentUser ? currentUser.id : 'SYSTEM',
                submittedByName: currentUser ? (currentUser.name || currentUser.fullName) : 'System User',
                notes: 'Submitted automatically via Frontdesk portal'
            };
            kycRecords.push(newKYC);
            Storage.saveKYCRecords(kycRecords);

            this.populateCustomerDatalist(); // refresh datalist
            
            // Hide kyc-section
            document.getElementById('kyc-section').style.display = 'none';
        }

        const newTTB = {
            id: Date.now(),
            ttbNumber: await this.generateTTBNumber(),
            grId: null,
            grNumber: 'FRONTDESK-DIRECT',
            poId: null,
            poNumber: '-',
            supplierId: finalCustomerId,
            supplierName: customerName,
            supplierPhone: customerPhone,
            date: document.getElementById('receipt-date').value || new Date().toISOString().split('T')[0],
            
            // Item structure mapping to standard ERP TTB
            items: [{
                itemId: 'SCRAP-GOLD',
                itemCode: 'SCRAP-GOLD',
                itemName: itemDesc,
                orderedQty: 0,
                receivedQty: grossWeight,
                acceptedQty: grossWeight,
                rejectedQty: 0,
                unit: 'gr',
                unitPrice: 0,
                notes: notes || 'Penerimaan awal timbangan frontdesk'
            }],

            status: 'draft', // Saved as draft so Gudang/Lab can approve
            approvalHistory: [],
            postedToInventory: false,
            notes: notes || '',
            createdBy: currentUser ? currentUser.id : 'System',
            createdByName: currentUser ? (currentUser.name || currentUser.fullName) : 'System',
            createdAt: new Date().toISOString()
        };

        this.documents.push(newTTB);
        this.saveDocuments();

        if (typeof AuditLog !== 'undefined') {
            AuditLog.log('create', 'ttb', newTTB.id, 
                `Frontdesk created TTB ${newTTB.ttbNumber} for Customer: ${customerName} (${grossWeight} gr)` + 
                (isNewCust ? ' [KYC SUBMITTED]' : ''));
        }

        this.currentReceipt = newTTB;
        this.renderReceipt(newTTB);
        this.renderHistory();
        
        const form = document.getElementById('frontdesk-form');
        if (form) form.reset();

        // Clear hidden file input
        document.getElementById('kyc-file-base64').value = '';

        // Show print area
        document.getElementById('receipt-preview-container').style.display = 'block';
    },

    renderReceipt(ttb) {
        document.getElementById('r-number').textContent = ttb.ttbNumber;
        
        // Format Date: D/M/YYYY (remove time)
        const dateObj = new Date(ttb.createdAt || ttb.date || Date.now());
        const dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
        document.getElementById('r-date').textContent = dateStr;
        
        document.getElementById('r-customer').textContent = ttb.supplierName;
        document.getElementById('r-phone').textContent = ttb.supplierPhone || '-';
        document.getElementById('r-item').textContent = ttb.items[0].itemName || ttb.items[0].name || '-';
        document.getElementById('r-weight').textContent = ttb.items[0].receivedQty.toFixed(2) + ' gr';
        document.getElementById('r-notes').textContent = ttb.notes || '-';
        
        // Dynamic operator name
        const currentUser = (typeof Auth !== 'undefined' && Auth.getCurrentUser) ? Auth.getCurrentUser() : null;
        const officerName = currentUser ? (currentUser.name || currentUser.fullName || currentUser.username || 'admin') : (ttb.createdByName || 'admin');
        document.getElementById('r-operator').textContent = officerName;

        // Load logo and company info
        const config = (typeof Storage !== 'undefined' ? Storage.get(Storage.KEYS.CONFIG) : JSON.parse(localStorage.getItem('erp_config'))) || {};
        const logoImg = document.getElementById('r-logo');
        if (logoImg) {
            logoImg.src = config.logo || 'https://raw.githubusercontent.com/GoldenAlura/logo/main/gr_logo_gold.png';
            logoImg.style.display = 'block';
        }

        const companyNameEl = document.getElementById('r-company-name');
        if (companyNameEl && config.companyName) companyNameEl.textContent = config.companyName;
        
        const companyAddrEl = document.getElementById('r-company-address');
        if (companyAddrEl && config.address) companyAddrEl.textContent = config.address;
        
        const companyEmailEl = document.getElementById('r-company-email');
        if (companyEmailEl && config.email) companyEmailEl.textContent = config.email;
    },

    printReceipt() {
        window.print();
    },

    renderHistory() {
        const list = document.getElementById('history-list');
        if (!list) return;

        list.innerHTML = '';
        const recentDocs = [...this.documents]
            .filter(doc => doc.grNumber === 'FRONTDESK-DIRECT')
            .sort((a, b) => b.id - a.id)
            .slice(0, 5);

        if (recentDocs.length === 0) {
            list.innerHTML = `<div style="text-align: center; color: var(--color-gray-500); padding: var(--spacing-md);">Belum ada penerimaan hari ini.</div>`;
            return;
        }

        recentDocs.forEach(doc => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                background: var(--bg-tertiary);
                border: 1px solid var(--border-glass);
                border-radius: var(--radius-md);
                margin-bottom: 8px;
            `;

            div.innerHTML = `
                <div>
                    <strong style="color: var(--color-primary);">${doc.ttbNumber}</strong><br>
                    <span style="font-size: 12px; color: var(--color-gray-100);">${doc.supplierName} - ${doc.items[0].receivedQty} gr</span>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="Frontdesk.loadAndPrint(${doc.id})">Cetak Ulang</button>
            `;
            list.appendChild(div);
        });
    },

    loadAndPrint(id) {
        const doc = this.documents.find(d => d.id === id);
        if (doc) {
            this.currentReceipt = doc;
            this.renderReceipt(doc);
            document.getElementById('receipt-preview-container').style.display = 'block';
            this.printReceipt();
        }
    }
};

window.Frontdesk = Frontdesk;
