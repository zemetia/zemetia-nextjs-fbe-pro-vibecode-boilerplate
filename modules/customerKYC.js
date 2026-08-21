// ==========================================
// KYC (Know Your Customer) Module
// Customer verification and compliance
// ==========================================

const CustomerKYC = {
    kycRecords: [],
    currentKYC: null,

    statuses: {
        pending: 'Pending',
        submitted: 'Submitted',
        under_review: 'Under Review',
        approved: 'Approved',
        rejected: 'Rejected',
        expired: 'Perlu Pengkinian'
    },

    documentTypes: {
        ktp: 'KTP (ID Card)',
        npwp: 'NPWP (Tax ID)',
        company_registration: 'Company Registration',
        business_license: 'Business License',
        other: 'Other Documents'
    },

    init() {
        this.loadKYCRecords();

        // Register with Agent Orchestrator
        if (typeof AgentOrchestrator !== 'undefined') {
            AgentOrchestrator.registerAgent('KYCAuditor', {
                shouldRun: () => this.kycRecords.some(r => r.status === 'submitted'),
                execute: () => this.runKYCAudit()
            });
        }

        this.render();
    },

    async runKYCAudit() {
        const submitted = this.kycRecords.filter(r => r.status === 'submitted');
        if (submitted.length === 0) return;

        console.log(`🤖 [Agent-KYC] Auditing ${submitted.length} submitted application(s)...`);

        for (const kyc of submitted) {
            AgentOrchestrator.log(`Starting AI Audit for KYC #${kyc.id}...`, 'info');

            // 1. Move to Under Review (Simulate human/AI starting work)
            kyc.status = 'under_review';
            kyc.reviewedBy = 'SYSTEM';
            kyc.reviewedByName = 'AI Auditor Agent (OCR-X1)';
            kyc.reviewedAt = new Date().toISOString();
            kyc.notes = '[AI START] Initializing document consistency and linearity checks.';

            await new Promise(r => setTimeout(r, 2000)); // Simulate AI processing

            // 2. Run Simulated Validation Logic
            let confidenceScore = 100;
            let aiNotes = [];

            // A. Identity Format Check
            if (kyc.advancedData) {
                const data = kyc.advancedData;

                // NIB Validation
                const nib = data.profileType === 'individual' ? data.individual.nib : data.business.nib;
                if (nib && nib.length !== 13) {
                    confidenceScore -= 40;
                    aiNotes.push(`CRITICAL: NIB format invalid (${nib.length} digits, expected 13).`);
                }

                // KBLI Validation
                const kbli = data.profileType === 'individual' ? data.individual.kbli : data.business.kbli;
                if (kbli && kbli.length !== 5) {
                    confidenceScore -= 20;
                    aiNotes.push(`WARNING: KBLI format invalid (${kbli.length} digits, expected 5).`);
                }

                // B. Linearity Check (Name vs Bank Owner)
                const identityName = data.profileType === 'individual' ?
                    (data.individual.nama || '').toUpperCase() :
                    (data.business.namaBU || '').toUpperCase();

                if (data.bankAccounts && data.bankAccounts.length > 0) {
                    const bankOwner = (data.bankAccounts[0].owner || '').toUpperCase();
                    if (identityName && bankOwner && !identityName.includes(bankOwner) && !bankOwner.includes(identityName)) {
                        confidenceScore -= 30;
                        aiNotes.push(`WARNING: Name mismatch detected. Identity: "${identityName}" vs Bank Owner: "${bankOwner}".`);
                    }
                }

                // C. Nationality Requirements
                if (data.nationalityType === 'WNI' && (!kyc.documents || !kyc.documents.npwp)) {
                    confidenceScore -= 50;
                    aiNotes.push('CRITICAL: Missing mandatory NPWP for WNI entity.');
                }
            } else {
                confidenceScore = 0;
                aiNotes.push('CRITICAL: No advanced profiling data found.');
            }

            // 3. Decision
            kyc.notes = `[AI AUDIT REPORT] Confidence Score: ${confidenceScore}%\n\n${aiNotes.length > 0 ? aiNotes.join('\n') : '✅ All automated checks passed.'}`;

            if (confidenceScore >= 95) {
                // AUTO APPROVE
                kyc.status = 'approved';
                kyc.approvedBy = 'SYSTEM';
                kyc.approvedByName = 'AI Auditor Agent (Auto-Approver)';
                kyc.approvedAt = new Date().toISOString();

                // Set expiry (1 year)
                const expiryDate = new Date();
                expiryDate.setFullYear(expiryDate.getFullYear() + 1);
                kyc.expiryDate = expiryDate.toISOString().split('T')[0];

                // Auto-onboarding logic (mirrored from approveKYC)
                if (kyc.advancedData && kyc.advancedData.isNewCustomer) {
                    const newId = `POTENTIAL-ACT-${Date.now()}`;
                    const newCustomer = {
                        id: newId,
                        code: `C-${Math.floor(1000 + Math.random() * 9000)}`,
                        name: kyc.advancedData.potentialName || (kyc.advancedData.profileType === 'individual' ? kyc.advancedData.individual.nama : kyc.advancedData.business.namaBU),
                        phone: kyc.advancedData.potentialPhone || '',
                        customerType: kyc.advancedData.profileType === 'individual' ? 'Perorangan/Pribadi' : 'Perusahaan',
                        address: kyc.advancedData.profileType === 'individual' ? kyc.advancedData.individual.alamat : kyc.advancedData.business.alamatBU,
                        notes: 'AUTO-CREATED BY AI AGENT',
                        createdAt: new Date().toISOString()
                    };
                    Storage.addCustomer(newCustomer);
                    kyc.customerId = newId;
                }

                AgentOrchestrator.log(`KYC #${kyc.id} AUTO-APPROVED (Score: ${confidenceScore}%)`, 'success');
            } else {
                // LEAVE UNDER REVIEW FOR HUMAN
                AgentOrchestrator.log(`KYC #${kyc.id} flagged for human review (Score: ${confidenceScore}%)`, 'warning');
            }
        }

        this.saveKYCRecords();

        // Refresh UI if on KYC page
        if (document.getElementById('kyc-filter')) {
            this.render();
        }
    },

    render() {
        const content = document.getElementById('main-content');
        const customers = Storage.get('erp_customers') || [];

        // Calculate stats
        const pendingReviews = this.getPendingReviews().length;
        const pendingApprovals = this.getPendingApprovals().length;
        const approved = this.getKYCsByStatus('approved').length;
        const expiringSoon = this.getExpiringKYCs(30).length;

        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">🔐 KYC Management</h1>
                <p class="page-description">Customer verification and compliance</p>
            </div>

            <!-- Stats Cards -->
            <div class="grid grid-4 gap-3 mb-4">
                <div class="card bg-info text-white">
                    <div class="card-body text-center">
                        <h3>${pendingReviews}</h3>
                        <p class="mb-0">Perlu Review</p>
                    </div>
                </div>
                <div class="card bg-warning text-white">
                    <div class="card-body text-center">
                        <h3>${pendingApprovals}</h3>
                        <p class="mb-0">Menunggu Approval</p>
                    </div>
                </div>
                <div class="card bg-success text-white">
                    <div class="card-body text-center">
                        <h3>${approved}</h3>
                        <p class="mb-0">Approved</p>
                    </div>
                </div>
                <div class="card bg-danger text-white">
                    <div class="card-body text-center">
                        <h3>${expiringSoon}</h3>
                        <p class="mb-0">Perlu Pengkinian</p>
                    </div>
                </div>
            </div>

            <!-- Action Bar -->
            <div class="card mb-3">
                <div class="card-body">
                    <div class="flex justify-between align-center flex-wrap gap-2">
                        <div class="flex gap-2">
                            <select id="kyc-filter" class="form-select" onchange="CustomerKYC.filterByStatus(this.value)">
                                <option value="all">Semua Status</option>
                                <option value="submitted">Submitted</option>
                                <option value="under_review">Under Review</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="expired">Perlu Pengkinian</option>
                            </select>
                        </div>
                        <button class="btn btn-success" onclick="CustomerKYC.showSubmitModal()">
                            ➕ Submit KYC Baru
                        </button>
                    </div>
                </div>
            </div>

            <!-- KYC List -->
            <div class="card">
                <div class="card-body">
                    ${this.renderKYCList()}
                </div>
            </div>
        `;
    },

    renderKYCList(filter = 'all') {
        let records = this.kycRecords;
        if (filter !== 'all') {
            records = records.filter(k => k.status === filter);
        }

        // Sort by date descending
        records = records.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

        const customers = Storage.get('erp_customers') || [];

        if (records.length === 0) {
            return '<p class="text-center text-gray p-4">Belum ada data KYC.</p>';
        }

        return `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Status</th>
                            <th>Submitted</th>
                            <th>Reviewed</th>
                            <th>Approved</th>
                            <th>Jadwal Pengkinian</th>
                            <th class="text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${records.map(kyc => {
            const customer = customers.find(c => c.id === kyc.customerId || c.code === kyc.customerId);
            const customerName = customer ? customer.name : kyc.customerId;

            return `
                                <tr>
                                    <td>
                                        <strong>${customerName}</strong><br>
                                        <small class="text-gray">ID: ${kyc.customerId}</small>
                                    </td>
                                    <td>
                                        <span class="badge ${this.getStatusBadgeClass(kyc.status)}">
                                            ${this.statuses[kyc.status] || kyc.status}
                                        </span>
                                    </td>
                                    <td>
                                        ${this.formatDate(kyc.submittedAt)}<br>
                                        <small class="text-gray">${kyc.submittedByName || '-'}</small>
                                    </td>
                                    <td>
                                        ${kyc.reviewedAt ? this.formatDate(kyc.reviewedAt) : '-'}<br>
                                        <small class="text-gray">${kyc.reviewedByName || ''}</small>
                                    </td>
                                    <td>
                                        ${kyc.approvedAt ? this.formatDate(kyc.approvedAt) : '-'}<br>
                                        <small class="text-gray">${kyc.approvedByName || ''}</small>
                                    </td>
                                    <td class="${kyc.expiryDate && new Date(kyc.expiryDate) < new Date() ? 'text-danger' : ''}">
                                        ${kyc.expiryDate || '-'}
                                    </td>
                                    <td class="text-center">
                                        <button class="btn btn-sm btn-info" onclick="CustomerKYC.showDetail(${kyc.id})" title="Detail">
                                            👁️
                                        </button>
                                        ${kyc.advancedData ? `<span class="badge badge-primary ml-1" title="Advanced Profile">PRO</span>` : ''}
                                        ${kyc.status === 'submitted' ? `
                                            <button class="btn btn-sm btn-warning" onclick="CustomerKYC.showReviewModal(${kyc.id})" title="Review">
                                                📝
                                            </button>
                                        ` : ''}
                                        ${kyc.status === 'under_review' ? `
                                            <button class="btn btn-sm btn-success" onclick="CustomerKYC.showApproveModal(${kyc.id})" title="Approve/Reject">
                                                ✅
                                            </button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    filterByStatus(status) {
        const content = document.querySelector('.card:last-child .card-body');
        if (content) {
            content.innerHTML = this.renderKYCList(status);
        }
    },

    showSubmitModal() {
        const customers = Storage.get('erp_customers') || [];
        const modalId = 'kyc-submit-modal';
        this.currentSubmitStep = 1;
        this.submitData = {
            submissionPath: '', // 'new' or 'update'
            customerId: '',
            isNewCustomer: false,
            potentialName: '',
            potentialPhone: '',
            nationalityType: 'WNI', // 'WNI', 'WNA', 'PMA'
            profileType: 'individual',
            individual: {
                kbli: '',
                bidangUsaha: '',
                nib: '',
                alamatDomisili: '',
                sourceOfFunds: '',
                sourceOfFundsOther: ''
            },
            business: {
                kbli: '',
                bidangUsaha: '',
                beneficialOwners: [],
                penanggungJawab: []
            },
            bankAccounts: [],
            origins: {
                tambang: { percent: 0, lokasi: '', legalitas: '', volume: '' },
                skrap: { percent: 0 },
                perdagangan: { percent: 0 }
            },
            declarations: {
                agreedToAll: false
            },
            nationalityTypeLabels: {
                WNI: 'WNI / Domestik (Lokal)',
                WNA: 'WNA / Expatriat (Asing)',
                PMA: 'PMA / Entitas Luar (Asing)'
            }
        };

        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-overlay hidden';
            document.body.appendChild(modal);
        }

        this.renderSubmitStep();
        modal.classList.remove('hidden');
    },

    renderSubmitStep() {
        const modal = document.getElementById('kyc-submit-modal');
        const step = this.currentSubmitStep;
        const customers = Storage.get('erp_customers') || [];

        let stepContent = '';
        if (step === 1) {
            stepContent = `
                <h4 class="mb-4 text-center color-primary">Pilih Jenis Pengajuan</h4>
                <div class="grid grid-2 gap-3">
                    <div class="card p-4 cursor-pointer hover-bg-light transition-all flex flex-column align-center text-center ${this.submitData.submissionPath === 'new' ? 'border-primary bg-primary-light' : ''}" 
                         onclick="CustomerKYC.updateSubmitField('submissionPath', 'new'); CustomerKYC.handlePathSelect('new')">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">🆕</div>
                        <h5 class="mb-2">Submit KYC Baru</h5>
                        <p class="font-sm text-gray">Gunakan ini untuk customer yang belum pernah terdaftar di sistem.</p>
                        <div class="mt-3">
                            <input type="radio" name="submissionPath" value="new" ${this.submitData.submissionPath === 'new' ? 'checked' : ''}>
                        </div>
                    </div>
                    <div class="card p-4 cursor-pointer hover-bg-light transition-all flex flex-column align-center text-center ${this.submitData.submissionPath === 'update' ? 'border-primary bg-primary-light' : ''}" 
                         onclick="CustomerKYC.updateSubmitField('submissionPath', 'update'); CustomerKYC.handlePathSelect('update')">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">🔄</div>
                        <h5 class="mb-2">Pengkinian Data</h5>
                        <p class="font-sm text-gray">Gunakan ini untuk memperbarui profil customer yang sudah ada.</p>
                        <div class="mt-3">
                            <input type="radio" name="submissionPath" value="update" ${this.submitData.submissionPath === 'update' ? 'checked' : ''}>
                        </div>
                    </div>
                </div>
            `;
        } else if (step === 2) {
            stepContent = `
                <div class="form-group mb-3">
                    <label class="form-label">Identitas Customer *</label>
                    <select id="kyc-customer" class="form-select mb-2" onchange="CustomerKYC.handleCustomerSelect(this.value)" 
                            ${this.submitData.submissionPath === 'new' ? 'disabled' : ''}>
                        <option value="">-- Pilih Customer --</option>
                        ${this.submitData.submissionPath === 'new' ? `
                            <option value="NEW" selected>[+] DAFTARKAN CALON CUSTOMER BARU</option>
                        ` : `
                            ${customers.map(c => `<option value="${c.id}" ${this.submitData.customerId === c.id ? 'selected' : ''}>${c.code} - ${c.name}</option>`).join('')}
                        `}
                    </select>
                    
                    ${this.submitData.isNewCustomer ? `
                        <div class="card p-3 bg-light border-dashed">
                            <p class="font-sm color-warning mb-2">💡 Customer ini akan didaftarkan sebagai "Calon" (belum masuk Master) sampai KYC disetujui.</p>
                            <div class="grid grid-2 gap-2">
                                <div class="form-group">
                                    <label class="form-label font-sm required">Nama Calon Customer</label>
                                    <input type="text" class="form-input" data-field="potentialName" placeholder="Nama Lengkap / Perusahaan" value="${this.submitData.potentialName || ''}" oninput="CustomerKYC.updateSubmitField('potentialName', this.value)">
                                </div>
                                <div class="form-group">
                                    <label class="form-label font-sm required">No. Telepon / WA (Gunakan Kode Negara)</label>
                                    <input type="text" class="form-input" data-field="potentialPhone" placeholder="+62..." value="${this.submitData.potentialPhone || ''}" oninput="CustomerKYC.updateSubmitField('potentialPhone', this.value)">
                                    <small class="text-gray font-xs">Contoh: +62812345678, +6591234567</small>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="form-group mb-3">
                    <label class="form-label">Kategori Nasionalitas / Entitas *</label>
                    <div class="grid grid-3 gap-2">
                        <div class="card p-3 cursor-pointer text-center hover-bg-light ${this.submitData.nationalityType === 'WNI' ? 'border-primary bg-primary-light' : ''}" 
                             onclick="CustomerKYC.updateSubmitField('nationalityType', 'WNI'); CustomerKYC.renderSubmitStep()">
                            <h6 class="mb-1">🇮🇩 WNI</h6>
                            <small class="text-gray font-xs">Domestik / Lokal</small>
                        </div>
                        <div class="card p-3 cursor-pointer text-center hover-bg-light ${this.submitData.nationalityType === 'WNA' ? 'border-primary bg-primary-light' : ''}" 
                             onclick="CustomerKYC.updateSubmitField('nationalityType', 'WNA'); CustomerKYC.renderSubmitStep()">
                            <h6 class="mb-1">🌐 WNA</h6>
                            <small class="text-gray font-xs">Expatriat</small>
                        </div>
                        <div class="card p-3 cursor-pointer text-center hover-bg-light ${this.submitData.nationalityType === 'PMA' ? 'border-primary bg-primary-light' : ''}" 
                             onclick="CustomerKYC.updateSubmitField('nationalityType', 'PMA'); CustomerKYC.renderSubmitStep()">
                            <h6 class="mb-1">🏢 PMA</h6>
                            <small class="text-gray font-xs">Entitas Luar</small>
                        </div>
                    </div>
                </div>

                <div class="form-group mb-3">
                    <label class="form-label">Tipe Profil</label>
                    <div class="flex gap-4">
                        <label class="flex align-center gap-2 cursor-pointer">
                            <input type="radio" name="profileType" value="individual" ${this.submitData.profileType === 'individual' ? 'checked' : ''} onchange="CustomerKYC.updateSubmitField('profileType', 'individual'); CustomerKYC.renderSubmitStep()"> 
                            Perorangan (Individual)
                        </label>
                        <label class="flex align-center gap-2 cursor-pointer">
                            <input type="radio" name="profileType" value="business" ${this.submitData.profileType === 'business' ? 'checked' : ''} onchange="CustomerKYC.updateSubmitField('profileType', 'business'); CustomerKYC.renderSubmitStep()"> 
                            Badan Usaha (Business Entity)
                        </label>
                    </div>
                </div>
            `;
        } else if (step === 3) {
            if (this.submitData.profileType === 'individual') {
                stepContent = `
            <h4 class="mb-3 color-primary">I.Profile Perorangan</h4>
                <div class="grid grid-2 gap-3">
                    <div class="form-group">
                        <label class="form-label required">Nama Lengkap (KTP)</label>
                        <input type="text" class="form-input" data-field="individual.nama" value="${this.submitData.individual.nama || ''}" oninput="CustomerKYC.updateProfileField('nama', this.value)">
                    </div>
                    <div class="grid grid-2 gap-2">
                        <div class="form-group">
                            <label class="form-label required">Tempat Lahir</label>
                            <input type="text" class="form-input" data-field="individual.tempatLahir" value="${this.submitData.individual.tempatLahir || ''}" oninput="CustomerKYC.updateProfileField('tempatLahir', this.value)">
                        </div>
                        <div class="form-group">
                            <label class="form-label required">Tanggal Lahir</label>
                            <input type="date" class="form-input" data-field="individual.tanggalLahir" value="${this.submitData.individual.tanggalLahir || ''}" oninput="CustomerKYC.updateProfileField('tanggalLahir', this.value)">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label required">${this.submitData.nationalityType === 'WNA' ? 'No. Passport / KITAS' : 'No. KTP'}</label>
                        <input type="text" class="form-input" data-field="individual.ktpNo" value="${this.submitData.individual.ktpNo || ''}" oninput="CustomerKYC.updateProfileField('ktpNo', this.value)">
                    </div>
                    <div class="form-group">
                        <label class="form-label required">Jenis Kelamin</label>
                        <select class="form-select" data-field="individual.gender" onchange="CustomerKYC.updateProfileField('gender', this.value)">
                            <option value="">-- Pilih --</option>
                            <option value="Pria" ${this.submitData.individual.gender === 'Pria' ? 'selected' : ''}>Pria</option>
                            <option value="Wanita" ${this.submitData.individual.gender === 'Wanita' ? 'selected' : ''}>Wanita</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label required">Nasionalitas</label>
                        <input type="text" class="form-input" data-field="individual.nationality" placeholder="Contoh: Indonesia" value="${this.submitData.individual.nationality || ''}" oninput="CustomerKYC.updateProfileField('nationality', this.value)">
                    </div>
                    <div class="form-group">
                        <label class="form-label required">Status Pernikahan</label>
                        <select class="form-select" data-field="individual.maritalStatus" onchange="CustomerKYC.updateProfileField('maritalStatus', this.value)">
                            <option value="">-- Pilih --</option>
                            <option value="Menikah" ${this.submitData.individual.maritalStatus === 'Menikah' ? 'selected' : ''}>Menikah</option>
                            <option value="Belum Menikah" ${this.submitData.individual.maritalStatus === 'Belum Menikah' ? 'selected' : ''}>Tidak/Belum Menikah</option>
                        </select>
                    </div>
                    
                    <div class="form-group"><label class="form-label required">KBLI (Klasifikasi Bisnis)</label><input type="text" class="form-input" data-field="individual.kbli" placeholder="5 digit angka" value="${this.submitData.individual.kbli || ''}" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 5); CustomerKYC.updateProfileField('kbli', this.value)"></div>
                    <div class="form-group"><label class="form-label required">Bidang Usaha</label><input type="text" class="form-input" data-field="individual.bidangUsaha" placeholder="Contoh: Perdagangan Emas" value="${this.submitData.individual.bidangUsaha || ''}" oninput="CustomerKYC.updateProfileField('bidangUsaha', this.value)"></div>
                    <div class="form-group"><label class="form-label required">NIB / Ijin Usaha</label><input type="text" class="form-input" data-field="individual.nib" placeholder="13 digit angka" value="${this.submitData.individual.nib || ''}" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 13); CustomerKYC.updateProfileField('nib', this.value)"></div>

                    <div class="form-group">
                        <label class="form-label required">Omzet Per Tahun</label>
                        <select class="form-select" data-field="individual.omzet" onchange="CustomerKYC.updateProfileField('omzet', this.value)">
                            <option value="">-- Pilih --</option>
                            <option value="< 5M" ${this.submitData.individual.omzet === '< 5M' ? 'selected' : ''}>Dibawah 5M</option>
                            <option value="> 5M" ${this.submitData.individual.omzet === '> 5M' ? 'selected' : ''}>Diatas 5M</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label required">Sumber Dana</label>
                        <select class="form-select" data-field="individual.sourceOfFunds" onchange="CustomerKYC.updateProfileField('sourceOfFunds', this.value)">
                            <option value="">-- Pilih --</option>
                            <option value="Keuntungan Bisnis" ${this.submitData.individual.sourceOfFunds === 'Keuntungan Bisnis' ? 'selected' : ''}>Keuntungan Bisnis</option>
                            <option value="Hasil Investasi" ${this.submitData.individual.sourceOfFunds === 'Hasil Investasi' ? 'selected' : ''}>Hasil Investasi</option>
                            <option value="Bunga Simpanan" ${this.submitData.individual.sourceOfFunds === 'Bunga Simpanan' ? 'selected' : ''}>Bunga Simpanan</option>
                            <option value="Lainnya" ${this.submitData.individual.sourceOfFunds === 'Lainnya' ? 'selected' : ''}>Lainnya, sebutkan:</option>
                        </select>
                        ${this.submitData.individual.sourceOfFunds === 'Lainnya' ? `
                            <input type="text" class="form-input mt-2" data-field="individual.sourceOfFundsOther" placeholder="Sebutkan sumber dana lainnya..." value="${this.submitData.individual.sourceOfFundsOther || ''}" oninput="CustomerKYC.updateProfileField('sourceOfFundsOther', this.value)">
                        ` : ''}
                    </div>

                    <div class="form-group grid-col-2">
                        <label class="form-label required">Alamat Sesuai KTP</label>
                        <textarea class="form-input" data-field="individual.alamat" oninput="CustomerKYC.updateProfileField('alamat', this.value)">${this.submitData.individual.alamat || ''}</textarea>
                    </div>

                    <div class="form-group grid-col-2">
                        <label class="form-label">Alamat Domisili / Sementara (Opsional)</label>
                        <textarea class="form-input" placeholder="Isi jika berbeda dengan KTP atau untuk Ekspatriat..." oninput="CustomerKYC.updateProfileField('alamatDomisili', this.value)">${this.submitData.individual.alamatDomisili || ''}</textarea>
                        <small class="text-gray font-xs">Kosongkan jika sama dengan alamat KTP</small>
                    </div>
                </div>
        `;
            } else {
                stepContent = `
            <h4 class="mb-3 color-primary">II.Data Badan Usaha</h4>
                    <div class="grid grid-2 gap-3">
                        <div class="form-group"><label class="form-label required">Nama Badan Usaha</label><input type="text" class="form-input" data-field="business.namaBU" value="${this.submitData.business.namaBU || ''}" oninput="CustomerKYC.updateBusinessField('namaBU', this.value)"></div>
                        <div class="form-group"><label class="form-label ${this.submitData.nationalityType === 'PMA' ? '' : 'required'}">Tax ID / NPWP ${this.submitData.nationalityType === 'PMA' ? '(Opsional)' : ''}</label><input type="text" class="form-input" data-field="business.npwpBU" placeholder="${this.submitData.nationalityType === 'PMA' ? 'Tax ID Number' : '16 digit angka'}" value="${this.submitData.business.npwpBU || ''}" oninput="if(CustomerKYC.submitData.nationalityType !== 'PMA') this.value = this.value.replace(/[^0-9]/g, '').slice(0, 16); CustomerKYC.updateBusinessField('npwpBU', this.value)"></div>
                        <div class="form-group grid-col-2"><label class="form-label required">Alamat Badan Usaha</label><textarea class="form-input" data-field="business.alamatBU" oninput="CustomerKYC.updateBusinessField('alamatBU', this.value)">${this.submitData.business.alamatBU || ''}</textarea></div>
                        <div class="form-group"><label class="form-label required">NIB RBA</label><input type="text" class="form-input" data-field="business.nib" placeholder="13 digit angka" value="${this.submitData.business.nib || ''}" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 13); CustomerKYC.updateBusinessField('nib', this.value)"></div>
                        <div class="form-group"><label class="form-label required">KBLI</label><input type="text" class="form-input" data-field="business.kbli" placeholder="5 digit angka" value="${this.submitData.business.kbli || ''}" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 5); CustomerKYC.updateBusinessField('kbli', this.value)"></div>
                        <div class="form-group"><label class="form-label required">Bidang Usaha</label><input type="text" class="form-input" data-field="business.bidangUsaha" value="${this.submitData.business.bidangUsaha || ''}" oninput="CustomerKYC.updateBusinessField('bidangUsaha', this.value)"></div>
                        <div class="form-group"><label class="form-label required">Email Kantor</label><input type="email" class="form-input" data-field="business.email" value="${this.submitData.business.email || ''}" oninput="CustomerKYC.updateBusinessField('email', this.value)"></div>
                        <div class="form-group grid-col-2"><label class="form-label required">Pemegang Saham Utama (% Saham)</label><input type="text" class="form-input" data-field="business.sahamUtama" value="${this.submitData.business.sahamUtama || ''}" oninput="CustomerKYC.updateBusinessField('sahamUtama', this.value)"></div>
                    </div>
                    
                    <h5 class="mt-4 mb-2">Beneficial Owners (>10%)</h5>
                    <table class="table table-sm">
                        <thead><tr><th>Holding (%)</th><th>Nama</th><th>Alamat</th><th>Aksi</th></tr></thead>
                        <tbody>
                            ${(this.submitData.business.beneficialOwners || []).map((bo, i) => `
                                <tr>
                                    <td><input type="number" class="form-input form-input-sm" value="${bo.holding || ''}" oninput="CustomerKYC.updateBusinessListItem('beneficialOwners', ${i}, 'holding', this.value)"></td>
                                    <td><input type="text" class="form-input form-input-sm" value="${bo.nama || ''}" oninput="CustomerKYC.updateBusinessListItem('beneficialOwners', ${i}, 'nama', this.value)"></td>
                                    <td><input type="text" class="form-input form-input-sm" value="${bo.alamat || ''}" oninput="CustomerKYC.updateBusinessListItem('beneficialOwners', ${i}, 'alamat', this.value)"></td>
                                    <td><button class="btn btn-sm btn-danger" onclick="CustomerKYC.removeBusinessListItem('beneficialOwners', ${i})">×</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <button class="btn btn-sm btn-outline mt-2" onclick="CustomerKYC.addBusinessListItem('beneficialOwners', {holding:0, nama:'', alamat:''})">+ Tambah Owner</button>
        `;
            }
        } else if (step === 4) {
            stepContent = `
            <h4 class="mb-3 color-primary">III.Penanggung Jawab & Rekening</h4>
                <div class="mb-4">
                    <label class="form-label">Penanggung Jawab (Pemilik)</label>
                    <table class="table table-sm">
                        <thead><tr><th>Posisi</th><th>Nama</th><th>Email</th><th>Aksi</th></tr></thead>
                        <tbody>
                            ${(this.submitData.business.penanggungJawab || []).map((pj, i) => `
                                <tr>
                                    <td><input type="text" class="form-input form-input-sm" value="${pj.posisi || ''}" oninput="CustomerKYC.updateBusinessListItem('penanggungJawab', ${i}, 'posisi', this.value)"></td>
                                    <td><input type="text" class="form-input form-input-sm" value="${pj.nama || ''}" oninput="CustomerKYC.updateBusinessListItem('penanggungJawab', ${i}, 'nama', this.value)"></td>
                                    <td><input type="text" class="form-input form-input-sm" value="${pj.email || ''}" oninput="CustomerKYC.updateBusinessListItem('penanggungJawab', ${i}, 'email', this.value)"></td>
                                    <td><button class="btn btn-sm btn-danger" onclick="CustomerKYC.removeBusinessListItem('penanggungJawab', ${i})">×</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <button class="btn btn-sm btn-outline mt-2" onclick="CustomerKYC.addBusinessListItem('penanggungJawab', {posisi:'', nama:'', email:''})">+ Tambah Penanggung Jawab</button>
                </div>
                
                <div class="mb-4">
                    <label class="form-label">Rekening Bank Yang Digunakan</label>
                    <div class="bg-warning-light p-2 mb-2 border-warning rounded font-xs">
                        <strong>⚠️ Penting:</strong> Nama Pemilik Rekening harus <strong>Linier</strong> dengan pengisi KYC / Perusahaan. Apabila berbeda, wajib melampirkan Surat Pernyataan atau permintaan tertulis.
                    </div>
                    <table class="table table-sm" id="kyc-bank-table">
                        <thead><tr><th>No. Rekening</th><th>Bank</th><th>Swift Code</th><th>Pemilik</th><th>Aksi</th></tr></thead>
                        <tbody>
                            ${this.submitData.bankAccounts.map((b, i) => `
                                <tr>
                                    <td><input type="text" class="form-input form-input-sm" value="${b.no || ''}" oninput="this.value = this.value.replace(/[^0-9]/g, ''); CustomerKYC.updateListItem('bankAccounts', ${i}, 'no', this.value)"></td>
                                    <td><input type="text" class="form-input form-input-sm" value="${b.bank || ''}" oninput="CustomerKYC.updateListItem('bankAccounts', ${i}, 'bank', this.value)"></td>
                                    <td><input type="text" class="form-input form-input-sm" value="${b.swift || ''}" placeholder="Opsional" oninput="CustomerKYC.updateListItem('bankAccounts', ${i}, 'swift', this.value)"></td>
                                    <td><input type="text" class="form-input form-input-sm" value="${b.owner || ''}" placeholder="Nama di Buku Tabungan" oninput="CustomerKYC.updateListItem('bankAccounts', ${i}, 'owner', this.value)"></td>
                                    <td><button class="btn btn-sm btn-danger" onclick="CustomerKYC.removeListItem('bankAccounts', ${i})">×</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <button class="btn btn-sm btn-outline mt-2" onclick="CustomerKYC.addListItem('bankAccounts', {no:'', bank:'', swift:'', owner:''})">+ Tambah Rekening</button>
                </div>
        `;
        } else if (step === 5) {
            stepContent = `
            <h4 class="mb-3 color-primary">VI.Asal-Usul Barang</h4>
                <div class="grid grid-2 gap-3 mb-4">
                    <div class="form-group"><label class="form-label">Tambang (%)</label><input type="number" class="form-input" data-field="origins.tambang.percent" value="${this.submitData.origins.tambang.percent}" oninput="CustomerKYC.updateOriginField('tambang', 'percent', this.value)"></div>
                    <div class="form-group"><label class="form-label">Lokasi Tambang</label><input type="text" class="form-input" data-field="origins.tambang.lokasi" value="${this.submitData.origins.tambang.lokasi}" oninput="CustomerKYC.updateOriginField('tambang', 'lokasi', this.value)"></div>
                    <div class="form-group"><label class="form-label">Legalitas Sumber <span class="text-danger">*</span></label><input type="text" class="form-input" data-field="origins.tambang.legalitas" value="${this.submitData.origins.tambang.legalitas}" oninput="CustomerKYC.updateOriginField('tambang', 'legalitas', this.value)"></div>
                    <div class="form-group"><label class="form-label">Volume / Bulan</label><input type="text" class="form-input" data-field="origins.tambang.volume" value="${this.submitData.origins.tambang.volume}" oninput="CustomerKYC.updateOriginField('tambang', 'volume', this.value)"></div>
                    <div class="form-group"><label class="form-label">Skrap (%)</label><input type="number" class="form-input" data-field="origins.skrap.percent" value="${this.submitData.origins.skrap.percent}" oninput="CustomerKYC.updateOriginField('skrap', 'percent', this.value)"></div>
                    <div class="form-group"><label class="form-label">Trading (%)</label><input type="number" class="form-input" data-field="origins.perdagangan.percent" value="${this.submitData.origins.perdagangan.percent}" oninput="CustomerKYC.updateOriginField('perdagangan', 'percent', this.value)"></div>
                </div>
                <div class="card p-3 bg-light">
                    <h5 class="mb-2">V. Pernyataan & Kepatuhan</h5>
                    <div class="grid grid-1 gap-2">
                        <div class="p-3 border rounded mb-3" style="max-height: 250px; overflow-y: auto; font-size: 0.75rem; line-height: 1.4; color: #ffffff; text-align: justify; background: rgba(0,0,0,0.2);">
                            <p class="mb-2"><strong>Bersama ini saya memberikan pernyataan yang tidak dapat dilakukan pencabutan atas persetujuan pihak yang menerima pernyataan yaitu PT. Golden Alura Refineri, bahwa Logam Mulia maupun, sebagai berikut:</strong></p>
                            <ol class="pl-3 m-0">
                                <li class="mb-1">Dana yang saya miliki dan selanjutnya berkaitan dengan transaksi adalah uang yang sah menurut peraturan perundang-undangan yang berlaku di Republik Indonesia dan bukan berasal maupun terafiliasi atau terkait dengan Tindak Pidana Pencucian Uang (TPPU), Tindak Pidana Pendanaan Terorisme (TPPT), dan/atau tindakan pidana apapun lainnya serta bersedia untuk dilakukan verifikasi;</li>
                                <li class="mb-1">Kemudian membebaskan PT. Golden Alura Refineri beserta Direksi, Komisaris, Pemegang Saham maupun Karyawan yang berhubungan terkait transaksi ini dalam hal terdapat tuntutan akibat data palsu, sumber emas ilegal, dan pelanggaran hukum apapun;</li>
                                <li class="mb-1">Selanjutnya, memberikan persetujuan tidak bersyarat kepada PT. Golden Alura Refineri terkait Audit PPATK & OJK:
                                    <ul class="pl-3 mt-1" style="list-style-type: circle;">
                                        <li>Melakukan pelaporan, klarifikasi, dan kerja sama dengan PPATK, OJK, Aparat Penegak Hukum maupun Instansi baik Pemerintah maupun Swasta lainnya;</li>
                                        <li>Mengungkapkan data/dokumen untuk STR, LTKM dan Audit;</li>
                                        <li>Membuka akses audit apabila diperlukan, apabila terjadi penolakan audit atau terdapat dugaan/indikasi pelanggaran maka memberikan hak kepada PT. Golden Alura Refineri untuk melakukan pemutusan kerja sama sepihak tanpa adanya kompensasi;</li>
                                        <li>Supplier melepaskan seluruh hak gugatan atas tindakan tersebut.</li>
                                    </ul>
                                </li>
                                <li class="mb-1">Saya memberikan jaminan dan siap bertanggungjawab sepenuhnya atas seluruh data yang saya berikan kepada PT. Golden Alura Refineri, apabila di kemudian hari terdapat keterangan, identitas, data yang tidak benar, tidak akurat terhadap data tersebut di atas, Bersama ini saya membebaskan PT. Golden Alura Refineri dari segala bentuk tuntutan dan/atau gugatan dari pihak manapun.</li>
                                <li class="mb-1">Dengan ini saya menjamin dan membebaskan PT. Golden Alura Refineri dari setiap dan seluruh akibat yang timbul sehubungan dengan Penerimaan atau Pembayaran dari atau ke Rekening yang tercantum di atas.</li>
                                <li class="mb-1">Saya akan memberikan dan/atau menginformasikan segala perubahan data terkait apabila dikemudian hari terdapat perubahan dan/atau pemutakhiran dikemudian hari.</li>
                                <li>Saya menyatakan bukan merupakan Orang yang Populer secara Politik (Politically Exposed Person).</li>
                            </ol>
                        </div>
                        <label id="declaration-label" class="flex align-start gap-2 mb-2 p-3 bg-warning-light border-warning rounded cursor-pointer transition-all" style="border-width: 2px;">
                            <input type="checkbox" id="kyc-agree-checkbox" data-field="declarations.agreedToAll" ${this.submitData.declarations.agreedToAll ? 'checked' : ''} onchange="CustomerKYC.updateDeclaration('agreedToAll', this.checked)" style="width: 24px; height: 24px; cursor: pointer;">
                            <span class="font-bold" style="font-size: 1rem; color: #ffd166;">Saya menyatakan telah membaca, memahami, dan menyetujui seluruh Pernyataan & Kepatuhan di atas secara sadar dan tanpa paksaan.</span>
                        </label>
                    </div>
                </div>
        `;
        } else if (step === 6) {
            stepContent = `
            <h4 class="mb-3 color-primary">IV.Persyaratan Dokumen</h4>
                <div class="grid grid-1 gap-2">
                    <div class="form-group">
                        <label class="form-label">${this.submitData.nationalityType === 'WNA' ? 'Passport / KITAS (Asing)' : 'KTP/Paspor (Perorangan/Toko)'} *</label>
                        ${this.submitData.documents && this.submitData.documents.ktp ?
                    `<div class="flex align-center gap-2 mb-2 p-2 bg-light border rounded">
                                <span class="text-success">✅ File Terupload</span>
                                <button class="btn btn-sm btn-outline-danger" onclick="CustomerKYC.removeDocument('ktp')">Hapus</button>
                             </div>` :
                    `<input type="file" class="form-input" onchange="CustomerKYC.handleFileSelection('ktp', this)">`
                }
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.submitData.nationalityType === 'WNI' ? 'NPWP (Tax ID) *' : 'NPWP / Tax ID (Opsional)'}</label>
                        ${this.submitData.documents && this.submitData.documents.npwp ?
                    `<div class="flex align-center gap-2 mb-2 p-2 bg-light border rounded">
                                <span class="text-success">✅ File Terupload</span>
                                <button class="btn btn-sm btn-outline-danger" onclick="CustomerKYC.removeDocument('npwp')">Hapus</button>
                             </div>` :
                    `<input type="file" class="form-input" onchange="CustomerKYC.handleFileSelection('npwp', this)">`
                }
                    </div>
                    <div class="form-group">
                        <label class="form-label">NIB / Ijin Usaha</label>
                        ${this.submitData.documents && this.submitData.documents.nib ?
                    `<div class="flex align-center gap-2 mb-2 p-2 bg-light border rounded">
                                <span class="text-success">✅ File Terupload</span>
                                <button class="btn btn-sm btn-outline-danger" onclick="CustomerKYC.removeDocument('nib')">Hapus</button>
                             </div>` :
                    `<input type="file" class="form-input" onchange="CustomerKYC.handleFileSelection('nib', this)">`
                }
                    </div>
                    ${this.submitData.profileType === 'business' ? `
                        <div class="form-group">
                            <label class="form-label">Akte Pendirian</label>
                            ${this.submitData.documents && this.submitData.documents.akte ?
                        `<div class="flex align-center gap-2 mb-2 p-2 bg-light border rounded">
                                    <span class="text-success">✅ File Terupload</span>
                                    <button class="btn btn-sm btn-outline-danger" onclick="CustomerKYC.removeDocument('akte')">Hapus</button>
                                 </div>` :
                        `<input type="file" class="form-input" onchange="CustomerKYC.handleFileSelection('akte', this)">`
                    }
                        </div>
                    ` : ''}
                </div>
        `;
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 95%; width: 100%;">
                <div class="modal-header">
                    <h3 class="modal-title">🔐 KYC Advanced Profile</h3>
                    <button class="modal-close" onclick="CustomerKYC.closeModal('kyc-submit-modal')">×</button>
                </div>
                <div class="modal-body">
                    <!-- Progress Bar -->
                    <div class="flex justify-between mb-4 px-4 relative">
                        <div style="position:absolute; top:15px; left:10%; right:10%; height:2px; background:#e2e8f0; z-index:0;"></div>
                        <div style="position:absolute; top:15px; left:10%; width:${(step - 1) * 20}%; height:2px; background:#3b82f6; z-index:1; transition: width 0.3s;"></div>
                        ${[1, 2, 3, 4, 5, 6].map(i => `
                            <div class="relative z-2 bg-white flex align-center justify-center" style="width:30px; height:30px; border-radius:50%; border:2px solid ${step >= i ? '#3b82f6' : '#e2e8f0'}; color: ${step >= i ? '#3b82f6' : '#94a3b8'}; font-weight:700;">${i}</div>
                        `).join('')}
                    </div>
                    
                    <div id="step-content-container" style="min-height: 300px;">
                        ${stepContent}
                    </div>
                </div>
                <div class="modal-footer flex justify-between">
                    <button class="btn btn-secondary" onclick="CustomerKYC.prevStep()" ${step === 1 ? 'disabled' : ''}>Kembali</button>
                    ${step < 6 ? `
                        <button class="btn btn-primary" onclick="CustomerKYC.nextStep()">Lanjut</button>
                    ` : `
                        <button class="btn btn-success" onclick="CustomerKYC.finishSubmission()">Submit Data Profil</button>
                    `}
                </div>
            </div >
    `;
    },

    handleCustomerSelect(val) {
        if (val === 'NEW') {
            this.submitData.isNewCustomer = true;
            this.submitData.customerId = '';
        } else {
            this.submitData.isNewCustomer = false;
            this.submitData.customerId = val;
        }
        this.renderSubmitStep();
    },

    handlePathSelect(path) {
        this.submitData.submissionPath = path;
        if (path === 'new') {
            this.submitData.isNewCustomer = true;
            this.submitData.customerId = 'NEW';
        } else {
            this.submitData.isNewCustomer = false;
            this.submitData.customerId = ''; // Reset to force selection
        }
        this.renderSubmitStep();
    },

    updateSubmitField(field, value) {
        this.submitData[field] = value;
        const el = document.querySelector(`[data-field="${field}"]`);
        if (el) el.classList.remove('invalid');
    },
    updateProfileField(field, value) {
        this.submitData.individual[field] = value;
        const el = document.querySelector(`[data-field="individual.${field}"]`);
        if (el) el.classList.remove('invalid');
        if (field === 'sourceOfFunds') this.renderSubmitStep();
    },
    updateBusinessField(field, value) {
        this.submitData.business[field] = value;
        const el = document.querySelector(`[data-field="business.${field}"]`);
        if (el) el.classList.remove('invalid');
    },
    updateOriginField(type, field, value) {
        this.submitData.origins[type][field] = value;
        const el = document.querySelector(`[data-field="origins.${type}.${field}"]`);
        if (el) el.classList.remove('invalid');
    },
    updateDeclaration(field, value) {
        this.submitData.declarations[field] = value;
        const el = document.querySelector(`[data-field="declarations.${field}"]`);
        if (el) el.classList.remove('invalid');
    },

    addListItem(list, item) { this.submitData[list].push(item); this.renderSubmitStep(); },
    removeListItem(list, idx) { this.submitData[list].splice(idx, 1); this.renderSubmitStep(); },
    updateListItem(list, idx, field, value) { this.submitData[list][idx][field] = value; },

    updateBusinessListItem(list, idx, field, value) { this.submitData.business[list][idx][field] = value; },
    addBusinessListItem(list, item) { this.submitData.business[list].push(item); this.renderSubmitStep(); },
    removeBusinessListItem(list, idx) { this.submitData.business[list].splice(idx, 1); this.renderSubmitStep(); },

    async handleFileSelection(type, input) {
        if (input.files[0]) {
            if (!this.submitData.documents) this.submitData.documents = {};
            this.submitData.documents[type] = await this.fileToBase64(input.files[0]);
            this.renderSubmitStep(); // Re-render to show success status
        }
    },

    removeDocument(type) {
        if (this.submitData.documents && this.submitData.documents[type]) {
            delete this.submitData.documents[type];
            this.renderSubmitStep();
        }
    },

    validateStep(step) {
        let isValid = true;
        const requiredFields = [];

        if (step === 1) {
            if (!this.submitData.submissionPath) isValid = false;
        } else if (step === 2) {
            if (this.submitData.submissionPath === 'update' && !this.submitData.customerId) isValid = false;
            if (this.submitData.submissionPath === 'new') {
                if (!this.submitData.potentialName) { isValid = false; requiredFields.push('potentialName'); }
                if (!this.submitData.potentialPhone) { isValid = false; requiredFields.push('potentialPhone'); }
            }
        } else if (step === 3) {
            if (this.submitData.profileType === 'individual') {
                const fields = ['nama', 'tempatLahir', 'tanggalLahir', 'ktpNo', 'gender', 'nationality', 'maritalStatus', 'kbli', 'bidangUsaha', 'nib', 'omzet', 'sourceOfFunds', 'alamat'];
                fields.forEach(f => {
                    // NPWP is optional if not WNI, but nib is actually required in the previous list.
                    // Let's refine based on nationality:
                    if (!this.submitData.individual[f]) {
                        isValid = false;
                        requiredFields.push(`individual.${f}`);
                    }
                });
                if (this.submitData.individual.sourceOfFunds === 'Lainnya' && !this.submitData.individual.sourceOfFundsOther) {
                    isValid = false;
                    requiredFields.push('individual.sourceOfFundsOther');
                }

                // Length Validations for Individual
                if (this.submitData.individual.kbli && this.submitData.individual.kbli.length !== 5) {
                    isValid = false;
                    requiredFields.push('individual.kbli');
                    alert('KBLI harus berjumlah 5 digit angka.');
                }
                if (this.submitData.individual.nib && this.submitData.individual.nib.length !== 13) {
                    isValid = false;
                    requiredFields.push('individual.nib');
                    alert('NIB harus berjumlah 13 digit angka.');
                }
            } else {
                const fields = ['namaBU', 'npwpBU', 'alamatBU', 'nib', 'kbli', 'bidangUsaha', 'email', 'sahamUtama'];
                fields.forEach(f => {
                    if (f === 'npwpBU' && this.submitData.nationalityType === 'PMA') return; // NPWP optional for PMA
                    if (!this.submitData.business[f]) {
                        isValid = false;
                        requiredFields.push(`business.${f}`);
                    }
                });

                // Length Validations
                if (this.submitData.nationalityType !== 'PMA' && this.submitData.business.npwpBU && this.submitData.business.npwpBU.length !== 16) {
                    isValid = false;
                    requiredFields.push('business.npwpBU');
                    alert('NPWP harus berjumlah 16 digit angka.');
                }
                if (this.submitData.business.nib && this.submitData.business.nib.length !== 13) {
                    isValid = false;
                    requiredFields.push('business.nib');
                    alert('NIB harus berjumlah 13 digit angka.');
                }
                if (this.submitData.business.kbli && this.submitData.business.kbli.length !== 5) {
                    isValid = false;
                    requiredFields.push('business.kbli');
                    alert('KBLI harus berjumlah 5 digit angka.');
                }
            }
        } else if (step === 4) {
            if (this.submitData.profileType === 'business' && this.submitData.business.penanggungJawab.length === 0) isValid = false;
            if (this.submitData.bankAccounts.length === 0) isValid = false;
        } else if (step === 5) {
            const { tambang, skrap, perdagangan } = this.submitData.origins;
            const total = (Number(tambang.percent) || 0) + (Number(skrap.percent) || 0) + (Number(perdagangan.percent) || 0);
            if (total !== 100) {
                alert('Total persentase asal-usul barang harus 100%!');
                return false;
            }
            if (tambang.percent > 0 && (!tambang.lokasi || !tambang.legalitas || !tambang.volume)) isValid = false;
            if (!this.submitData.declarations.agreedToAll) {
                isValid = false;
                requiredFields.push('declarations.agreedToAll');
            }
        }

        // Visual feedback
        requiredFields.forEach(f => {
            const el = document.querySelector(`[data-field="${f}"]`);
            if (el) {
                el.classList.add('invalid');
                if (f === 'declarations.agreedToAll') {
                    const label = document.getElementById('declaration-label');
                    if (label) {
                        label.style.borderColor = '#dc3545';
                        label.style.backgroundColor = '#fff5f5';
                        label.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }
        });

        if (!isValid) {
            alert('Mohon lengkapi semua kolom wajib isi (bertanda merah).');
        }

        return isValid;
    },

    nextStep() {
        if (!this.validateStep(this.currentSubmitStep)) return;

        if (this.currentSubmitStep < 6) {
            this.currentSubmitStep++;
            this.renderSubmitStep();
        }
    },

    prevStep() {
        if (this.currentSubmitStep > 1) {
            this.currentSubmitStep--;
            this.renderSubmitStep();
        }
    },

    async finishSubmission() {
        if (!this.submitData.isNewCustomer && !this.submitData.customerId) return alert('Silakan pilih customer');
        if (this.submitData.isNewCustomer && !this.submitData.potentialName) return alert('Nama calon customer wajib diisi');
        if (!this.submitData.documents || !this.submitData.documents.ktp) return alert('Identitas utama (KTP/Passport) wajib diunggah');

        // NPWP required only for WNI
        if (this.submitData.nationalityType === 'WNI' && (!this.submitData.documents || !this.submitData.documents.npwp)) {
            return alert('NPWP wajib diunggah untuk WNI / Entitas Lokal.');
        }

        // Professional Compliance: All declarations must be accepted
        const allDeclared = Object.values(this.submitData.declarations).every(val => val === true);
        if (!allDeclared) {
            return alert('Harap setujui seluruh Pernyataan & Kepatuhan hukum untuk melanjutkan.');
        }

        const customerId = this.submitData.isNewCustomer ? `POTENTIAL - ${Date.now()}` : this.submitData.customerId;

        // Pass a copy of submitData as advancedData (excluding documents which are stored separately)
        const advancedData = JSON.parse(JSON.stringify(this.submitData));
        delete advancedData.documents;

        // Visual loading
        if (window.showLoading) window.showLoading('Menyimpan data KYC & Dokumen...');

        try {
            const result = await this.createKYC(customerId, this.submitData.documents, this.submitData.nationalityType, advancedData);

            if (result.success) {
                if (window.hideLoading) window.hideLoading();
                
                // Check if sync failed in background (SyncGuard)
                if (Storage.SyncGuard && Storage.SyncGuard.pendingCount() > 0) {
                    alert('KYC Berhasil disubmit secara lokal, namun GAGAL sinkron ke Cloud (Firebase). \n\nHal ini biasanya karena ukuran file dokumen terlalu besar (>1MB) atau Firebase belum aktif. Data tetap tersimpan di browser ini, silakan hubungi IT untuk pendaftaran Firebase agar data aman (Contingency).');
                } else {
                    alert(this.submitData.isNewCustomer ?
                        'KYC Berhasil disubmit! Customer akan resmi terdaftar setelah diapprove.' :
                        'KYC Advanced Profile berhasil di-submit!');
                }

                this.closeModal('kyc-submit-modal');
                this.loadKYCRecords();
                this.render();
            } else {
                if (window.hideLoading) window.hideLoading();
                alert('Error: ' + (result.errors ? Object.values(result.errors).join(', ') : 'Unknown error'));
            }
        } catch (error) {
            if (window.hideLoading) window.hideLoading();
            console.error('KYC submission error:', error);
            alert('Gagal submit KYC: ' + error.message);
        }
    },

    async submitKYC(event) {
        // Fallback for old simple form
        event.preventDefault();
        // ... previous simple logic ...
    },

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                // Return non-image files as is (e.g. PDFs)
                if (!file.type.startsWith('image/')) {
                    resolve(e.target.result);
                    return;
                }

                // Compress images to avoid Firestore 1MB limits
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Max dimensions
                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 1200;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = Math.floor(width);
                    canvas.height = Math.floor(height);

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG with 0.7 quality
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl);
                };
                img.onerror = () => resolve(e.target.result); // Fallback to original on error
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    showDetail(kycId) {
        const kyc = this.getKYC(kycId);
        if (!kyc) return;

        const customers = Storage.get('erp_customers') || [];
        const customer = customers.find(c => c.id === kyc.customerId || c.code === kyc.customerId);
        const customerName = customer ? customer.name : kyc.customerId;

        const modalId = 'kyc-detail-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-overlay hidden';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3 class="modal-title">📋 Detail KYC - ${customerName}</h3>
                    <button class="modal-close" onclick="CustomerKYC.closeModal('${modalId}')">×</button>
                </div>
                <div class="modal-body">
                    <div class="grid grid-2 gap-3 mb-3">
                        <div>
                            <strong>Status:</strong>
                            <span class="badge ${this.getStatusBadgeClass(kyc.status)}">${this.statuses[kyc.status]}</span>
                        </div>
                        <div><strong>Kategori:</strong> ${kyc.advancedData ? (kyc.advancedData.nationalityTypeLabels ? kyc.advancedData.nationalityTypeLabels[kyc.advancedData.nationalityType] : kyc.advancedData.nationalityType) : 'WNI (Default)'}</div>
                        <div><strong>Jadwal Pengkinian:</strong> ${kyc.expiryDate || '-'}</div>
                    </div>

                    ${kyc.advancedData ? `
                        <div class="advanced-kyc-detail card p-3 bg-light mb-3">
                            <h4 class="color-primary border-bottom pb-1 mb-2">📜 Advanced Profile Record</h4>
                            <div class="grid grid-2 gap-2 font-sm">
                                <div><strong>Nationality:</strong> ${kyc.advancedData.nationalityTypeLabels ? kyc.advancedData.nationalityTypeLabels[kyc.advancedData.nationalityType] : kyc.advancedData.nationalityType}</div>
                                <div><strong>Profile Type:</strong> ${kyc.advancedData.profileType === 'individual' ? 'Perorangan' : 'Badan Usaha'}</div>
                                ${kyc.advancedData.profileType === 'individual' ? `
                                    <div><strong>Nama:</strong> ${kyc.advancedData.individual.nama || '-'}</div>
                                    <div><strong>TTL:</strong> ${kyc.advancedData.individual.tempatLahir || '-'}, ${this.formatDate(kyc.advancedData.individual.tanggalLahir)}</div>
                                    <div><strong>${kyc.advancedData.nationalityType === 'WNA' ? 'Passport/KITAS' : 'KTP/Paspor'}:</strong> ${kyc.advancedData.individual.ktpNo || '-'}</div>
                                    <div><strong>KBLI/Ijin:</strong> ${kyc.advancedData.individual.kbli || '-'} / ${kyc.advancedData.individual.nib || '-'}</div>
                                    <div><strong>Bidang:</strong> ${kyc.advancedData.individual.bidangUsaha || '-'} (${kyc.advancedData.individual.jabatan || '-'})</div>
                                ` : `
                                    <div><strong>Nama BU:</strong> ${kyc.advancedData.business.namaBU || '-'}</div>
                                    <div><strong>Tax ID / NPWP:</strong> ${kyc.advancedData.business.npwpBU || '-'}</div>
                                    <div><strong>NIB/KBLI:</strong> ${kyc.advancedData.business.nib || '-'} / ${kyc.advancedData.business.kbli || '-'}</div>
                                    <div><strong>Bidang:</strong> ${kyc.advancedData.business.bidangUsaha || '-'}</div>
                                `}
                            </div>
                            
                            <h5 class="mt-3 mb-1 font-sm color-primary">📍 Origins of Goods</h5>
                            <ul class="font-sm m-0 pl-3">
                                ${kyc.advancedData.origins ? `
                                    ${kyc.advancedData.origins.tambang && kyc.advancedData.origins.tambang.percent > 0 ? `<li>Tambang: ${kyc.advancedData.origins.tambang.percent}% (${kyc.advancedData.origins.tambang.lokasi})</li>` : ''}
                                    ${kyc.advancedData.origins.skrap && kyc.advancedData.origins.skrap.percent > 0 ? `<li>Skrap: ${kyc.advancedData.origins.skrap.percent}%</li>` : ''}
                                    ${kyc.advancedData.origins.perdagangan && kyc.advancedData.origins.perdagangan.percent > 0 ? `<li>Trading: ${kyc.advancedData.origins.perdagangan.percent}%</li>` : ''}
                                ` : '<li>(Data tidak tersedia)</li>'}
                            </ul>

                            <div class="mt-3 p-2 bg-light border rounded font-sm">
                                <strong>Status Pernyataan:</strong> 
                                ${kyc.advancedData.declarations && kyc.advancedData.declarations.agreedToAll ?
                    '<span class="text-success">✅ Menyetujui Seluruh Pernyataan & Kepatuhan</span>' :
                    '<span class="text-danger">❌ Belum Menyetujui</span>'}
                            </div>
                            
                            <h5 class="mt-3 mb-1 font-sm color-primary">🏦 Bank Accounts</h5>
                            <div class="font-sm">
                                ${kyc.advancedData.bankAccounts ? kyc.advancedData.bankAccounts.map(b => `• ${b.bank} - ${b.no} ${b.swift ? `(Swift: ${b.swift})` : ''} (${b.owner})`).join('<br>') : '(Data tidak tersedia)'}
                            </div>
                        </div>
                    ` : ''}
                    
                    <h4 class="mb-2">📅 Timeline</h4>
                    <div class="card bg-light p-3 mb-3">
                        <p><strong>Submitted:</strong> ${this.formatDate(kyc.submittedAt)} oleh ${kyc.submittedByName || '-'}</p>
                        ${kyc.reviewedAt ? `<p><strong>Reviewed:</strong> ${this.formatDate(kyc.reviewedAt)} oleh ${kyc.reviewedByName}</p>` : ''}
                        ${kyc.approvedAt ? `<p><strong>${kyc.status === 'approved' ? 'Approved' : 'Rejected'}:</strong> ${this.formatDate(kyc.approvedAt)} oleh ${kyc.approvedByName}</p>` : ''}
                        ${kyc.rejectionReason ? `<p class="text-danger"><strong>Alasan Penolakan:</strong> ${kyc.rejectionReason}</p>` : ''}
                        ${kyc.notes ? `<p><strong>Catatan:</strong> ${kyc.notes}</p>` : ''}
                    </div>
                    
                    <h4 class="mb-2">📎 Dokumen</h4>
                    <div class="grid grid-2 gap-2">
                        ${kyc.documents.ktp ? `
                            <div class="card p-2">
                                <strong>KTP</strong><br>
                                <button type="button" class="btn btn-sm btn-info mt-1" onclick="CustomerKYC.viewDocumentById(${kyc.id}, 'ktp')">Lihat Dokumen</button>
                            </div>
                        ` : ''}
                        ${kyc.documents.npwp ? `
                            <div class="card p-2">
                                <strong>NPWP</strong><br>
                                <button type="button" class="btn btn-sm btn-info mt-1" onclick="CustomerKYC.viewDocumentById(${kyc.id}, 'npwp')">Lihat Dokumen</button>
                            </div>
                        ` : ''}
                        ${kyc.documents.business_license ? `
                            <div class="card p-2">
                                <strong>Surat Izin Usaha</strong><br>
                                <button type="button" class="btn btn-sm btn-info mt-1" onclick="CustomerKYC.viewDocumentById(${kyc.id}, 'business_license')">Lihat Dokumen</button>
                            </div>
                        ` : ''}
                        ${kyc.documents.other ? `
                            <div class="card p-2">
                                <strong>Dokumen Lain</strong><br>
                                <button type="button" class="btn btn-sm btn-info mt-1" onclick="CustomerKYC.viewDocumentById(${kyc.id}, 'other')">Lihat Dokumen</button>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="flex justify-end mt-4">
                        <button class="btn btn-secondary" onclick="CustomerKYC.closeModal('${modalId}')">Tutup</button>
                    </div>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    },

    showReviewModal(kycId) {
        const kyc = this.getKYC(kycId);
        if (!kyc) return;

        const modalId = 'kyc-review-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-overlay hidden';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="modal-title">📝 Review KYC</h3>
                    <button class="modal-close" onclick="CustomerKYC.closeModal('${modalId}')">×</button>
                </div>
                <div class="modal-body">
                    <p>Review KYC untuk customer ID: <strong>${kyc.customerId}</strong></p>
                    
                    <div class="form-group mb-3">
                        <label class="form-label">Catatan Review</label>
                        <textarea id="review-notes" class="form-input" rows="3" placeholder="Catatan untuk reviewer/approver..."></textarea>
                    </div>
                    
                    <div class="flex justify-end gap-2">
                        <button class="btn btn-secondary" onclick="CustomerKYC.closeModal('${modalId}')">Batal</button>
                        <button class="btn btn-primary" onclick="CustomerKYC.confirmReview(${kycId})">Tandai Under Review</button>
                    </div>
                </div>
            </div>
    `;

        modal.classList.remove('hidden');
    },

    confirmReview(kycId) {
        const notes = document.getElementById('review-notes')?.value || '';
        const result = this.reviewKYC(kycId, notes);

        if (result.success) {
            this.closeModal('kyc-review-modal');
            this.render();
            alert('KYC berhasil di-review!');
        } else {
            alert('Error: ' + Object.values(result.errors).join(', '));
        }
    },

    showApproveModal(kycId) {
        const kyc = this.getKYC(kycId);
        if (!kyc) return;

        const modalId = 'kyc-approve-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-overlay hidden';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="modal-title">✅ Approve/Reject KYC</h3>
                    <button class="modal-close" onclick="CustomerKYC.closeModal('${modalId}')">×</button>
                </div>
                <div class="modal-body">
                    <p>Keputusan untuk KYC customer: <strong>${kyc.customerId}</strong></p>
                    ${kyc.notes ? `<p class="text-gray"><em>Catatan Review: ${kyc.notes}</em></p>` : ''}
                    
                    <div class="form-group mb-3">
                        <label class="form-label">Alasan (wajib jika reject)</label>
                        <textarea id="approve-reason" class="form-input" rows="2" placeholder="Alasan approval/rejection..."></textarea>
                    </div>
                    
                    <div class="flex justify-end gap-2">
                        <button class="btn btn-secondary" onclick="CustomerKYC.closeModal('${modalId}')">Batal</button>
                        <button class="btn btn-danger" onclick="CustomerKYC.confirmApprove(${kycId}, false)">❌ Reject</button>
                        <button class="btn btn-success" onclick="CustomerKYC.confirmApprove(${kycId}, true)">✅ Approve</button>
                    </div>
                </div>
            </div>
    `;

        modal.classList.remove('hidden');
    },

    confirmApprove(kycId, approved) {
        const reason = document.getElementById('approve-reason')?.value || '';

        if (!approved && !reason) {
            alert('Alasan wajib diisi jika reject');
            return;
        }

        const result = this.approveKYC(kycId, approved, reason);

        if (result.success) {
            this.closeModal('kyc-approve-modal');
            this.render();
            alert(approved ? 'KYC berhasil di-approve!' : 'KYC di-reject.');
        } else {
            alert('Error: ' + Object.values(result.errors).join(', '));
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
    },

    loadKYCRecords() {
        this.kycRecords = Storage.getKYCRecords();
    },

    saveKYCRecords() {
        Storage.saveKYCRecords(this.kycRecords);
    },

    async createKYC(customerId, documents, nationalityType = 'WNI', advancedData = null) {
        // Check if customer already has KYC
        const existing = this.getKYCByCustomer(customerId);
        if (existing && existing.status !== 'rejected' && existing.status !== 'expired') {
            return {
                success: false,
                errors: { kyc: 'Customer already has active KYC record' }
            };
        }

        // Validate required documents
        // Identitas (KTP/Passport) is always required
        if (!documents.ktp) {
            return {
                success: false,
                errors: { documents: 'Identity document (KTP/Passport) is required' }
            };
        }

        // Check for total size estimate (Firestore limitation)
        let totalSize = 0;
        Object.values(documents).forEach(doc => {
            if (typeof doc === 'string') totalSize += doc.length;
        });

        // 1.3 million chars is roughly 1MB of Base64
        if (totalSize > 1300000) {
            const proceed = confirm(`⚠️ Perhatian: Total ukuran dokumen cukup besar (${(totalSize / 1024 / 1024).toFixed(1)} MB). \n\nCloud Firestore memiliki limit 1MB per record. Jika Anda melanjutkan, data mungkin hanya tersimpan secara lokal di komputer ini dan GAGAL sinkron ke server. \n\nSangat disarankan untuk mengecilkan ukuran foto/PDF sebelum upload. Lanjutkan?`);
            if (!proceed) return { success: false, errors: { size: 'Ukuran file terlalu besar' } };
        }

        const kyc = {
            id: Date.now(),
            customerId: customerId,
            status: 'submitted',
            nationalityType: nationalityType,

            // Documents (store as base64 or file paths)
            documents: documents,

            // Advanced Profiling Data
            advancedData: advancedData,

            // Workflow
            submittedAt: new Date().toISOString(),
            submittedBy: (typeof Auth !== 'undefined' && Auth.getCurrentUser()) ? Auth.getCurrentUser().id : 'SYSTEM',
            submittedByName: (typeof Auth !== 'undefined' && Auth.getCurrentUser()) ? Auth.getCurrentUser().name : 'System User',

            reviewedBy: null,
            reviewedByName: null,
            reviewedAt: null,

            approvedBy: null,
            approvedByName: null,
            approvedAt: null,

            // Expiry (1 year from approval)
            expiryDate: null,

            notes: '',
            rejectionReason: ''
        };

        this.kycRecords.push(kyc);
        
        // Return result of storage attempt
        const storageResult = await this.saveKYCRecords();
        
        AuditLog.log('create', 'kyc', kyc.id,
            `KYC submitted for customer ${customerId}`);

        return { success: true, kyc };
    },

    reviewKYC(kycId, notes) {
        const kyc = this.getKYC(kycId);
        if (!kyc) {
            return { success: false, errors: { kyc: 'KYC record not found' } };
        }

        if (kyc.status !== 'submitted') {
            return { success: false, errors: { status: 'Can only review submitted KYC' } };
        }

        // Check permission (marketing role, director, or admin)
        const user = Auth.getCurrentUser();
        const userRole = (user && user.role ? user.role : '').toLowerCase();
        if (userRole !== 'marketing' && userRole !== 'director' && userRole !== 'admin') {
            return { success: false, errors: { permission: 'Only marketing, director, or admin can review KYC' } };
        }

        kyc.status = 'under_review';
        kyc.reviewedBy = user ? user.id : 'SYSTEM';
        kyc.reviewedByName = user ? user.name : 'System User';
        kyc.reviewedAt = new Date().toISOString();
        kyc.notes = notes || '';

        this.saveKYCRecords();
        AuditLog.log('update', 'kyc', kycId, 'KYC under review');

        return { success: true, kyc };
    },

    approveKYC(kycId, approved, reason) {
        const kyc = this.getKYC(kycId);
        if (!kyc) {
            return { success: false, errors: { kyc: 'KYC record not found' } };
        }

        if (kyc.status !== 'under_review') {
            return { success: false, errors: { status: 'KYC must be under review' } };
        }

        // Check permission (director or admin)
        const user = Auth.getCurrentUser();
        const userRole = (user && user.role ? user.role : '').toLowerCase();
        if (userRole !== 'director' && userRole !== 'admin') {
            return { success: false, errors: { permission: 'Only director or admin can approve KYC' } };
        }

        kyc.approvedBy = user ? user.id : 'SYSTEM';
        kyc.approvedByName = user ? user.name : 'System User';
        kyc.approvedAt = new Date().toISOString();

        if (approved) {
            kyc.status = 'approved';

            // AUTO-ONBOARDING: Create Master Customer if this was a potential customer
            if (kyc.advancedData && kyc.advancedData.isNewCustomer) {
                const newId = `CUST-${Date.now()}`;
                const newCustomer = {
                    id: newId,
                    code: `C-${Math.floor(1000 + Math.random() * 9000)}`,
                    name: kyc.advancedData.potentialName || (kyc.advancedData.profileType === 'individual' ? kyc.advancedData.individual.nama : kyc.advancedData.business.namaBU),
                    phone: kyc.advancedData.potentialPhone || '',
                    customerType: kyc.advancedData.profileType === 'individual' ? 'Perorangan/Pribadi' : 'Perusahaan',
                    address: kyc.advancedData.profileType === 'individual' ? kyc.advancedData.individual.alamat : kyc.advancedData.business.alamatBU,
                    notes: 'Auto-created from KYC Approval',
                    createdAt: new Date().toISOString()
                };
                Storage.addCustomer(newCustomer);
                kyc.customerId = newId; // Update KYC link to the real ID
            }

            // Set expiry date (1 year from now)
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            kyc.expiryDate = expiryDate.toISOString().split('T')[0];
        } else {
            kyc.status = 'rejected';
            kyc.rejectionReason = reason || 'Not specified';
        }

        this.saveKYCRecords();

        const action = approved ? 'approved' : 'rejected';
        AuditLog.log('update', 'kyc', kycId, `KYC ${action} by director`);

        return { success: true, kyc };
    },

    checkKYCStatus(customerId) {
        const kyc = this.getKYCByCustomer(customerId);

        if (!kyc) {
            return { approved: false, status: 'unregistered', reason: 'No KYC record found' };
        }

        if (kyc.status !== 'approved') {
            return { approved: false, reason: `KYC status: ${kyc.status} ` };
        }

        // Check if expired
        if (kyc.expiryDate) {
            const expiry = new Date(kyc.expiryDate);
            const today = new Date();

            if (expiry < today) {
                kyc.status = 'expired';
                this.saveKYCRecords();
                return { approved: false, reason: 'KYC perlu pengkinian' };
            }
        }

        return { approved: true, kyc: kyc };
    },

    canCustomerOrder(customerId) {
        const check = this.checkKYCStatus(customerId);
        return check.approved;
    },

    getKYC(id) {
        return this.kycRecords.find(k => k.id === id);
    },

    getKYCByCustomer(customerId) {
        if (!customerId) return null;
        const searchId = String(customerId).trim();

        // Get the most recent KYC for this customer (trim stored IDs too for safety)
        const records = this.kycRecords
            .filter(k => String(k.customerId).trim() === searchId)
            .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

        return records[0] || null;
    },

    getKYCsByStatus(status) {
        return this.kycRecords.filter(k => k.status === status);
    },

    getPendingReviews() {
        return this.kycRecords.filter(k => k.status === 'submitted');
    },

    getPendingApprovals() {
        return this.kycRecords.filter(k => k.status === 'under_review');
    },

    getExpiringKYCs(daysAhead = 30) {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + daysAhead);

        return this.kycRecords.filter(k => {
            if (k.status !== 'approved' || !k.expiryDate) return false;

            const expiry = new Date(k.expiryDate);
            return expiry >= today && expiry <= futureDate;
        });
    },

    updateKYCDocuments(kycId, documents) {
        const kyc = this.getKYC(kycId);
        if (!kyc) {
            return { success: false, errors: { kyc: 'KYC record not found' } };
        }

        // Can only update if not approved
        if (kyc.status === 'approved') {
            return { success: false, errors: { status: 'Cannot update approved KYC' } };
        }

        kyc.documents = { ...kyc.documents, ...documents };
        kyc.updatedAt = new Date().toISOString();

        this.saveKYCRecords();
        AuditLog.log('update', 'kyc', kycId, 'Documents updated');

        return { success: true, kyc };
    },

    deleteKYC(id) {
        const kyc = this.getKYC(id);
        if (!kyc) {
            return { success: false, errors: { kyc: 'KYC record not found' } };
        }

        // Can only delete pending or rejected KYC
        if (kyc.status !== 'pending' && kyc.status !== 'rejected') {
            return { success: false, errors: { status: 'Can only delete pending or rejected KYC' } };
        }

        this.kycRecords = this.kycRecords.filter(k => k.id !== id);
        this.saveKYCRecords();
        AuditLog.log('delete', 'kyc', id, 'KYC record deleted');

        return { success: true };
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
            pending: 'badge-secondary',
            submitted: 'badge-info',
            under_review: 'badge-warning',
            approved: 'badge-success',
            rejected: 'badge-danger',
            expired: 'badge-dark'
        };
        return classes[status] || 'badge-secondary';
    },

    /**
     * Helper to view documents that are stored in a KYC record.
     * Uses the record ID to avoid passing massive strings in HTML attributes.
     */
    viewDocumentById(kycId, type) {
        const kyc = this.getKYC(Number(kycId));
        if (!kyc || !kyc.documents || !kyc.documents[type]) {
            console.error('Document data missing for ID:', kycId, 'Type:', type);
            alert('File dokumen tidak ditemukan atau belum berhasil disinkronisasi ke cloud (Base64 mungkin melebihi limit 1MB). Mohon hubungi IT.');
            return;
        }

        this.viewDocument(kyc.documents[type]);
    },

    /**
     * Helper to view documents that are stored as Base64 Data URLs.
     * Browsers often block opening large Data URLs in a new tab for security reasons,
     * so we convert them to a Blob URL first.
     */
    viewDocument(dataUrl) {
        if (!dataUrl || dataUrl === 'undefined' || dataUrl === 'null') {
            alert('Data dokumen kosong atau tidak valid.');
            return;
        }

        try {
            // Check if it's already a regular URL (e.g. from a cloud source) or not a data URL
            if (!dataUrl.startsWith('data:')) {
                // If it's a relative path or garbage, this might still open about:blank, 
                // but at least we caught 'undefined' above.
                window.open(dataUrl, '_blank');
                return;
            }

            // Parse the data URL components
            const parts = dataUrl.split(';base64,');
            if (parts.length < 2) {
                window.open(dataUrl, '_blank');
                return;
            }

            const contentType = parts[0].split(':')[1].split(';')[0]; // Extract clean MIME type
            const base64Data = parts[1];

            // Convert Base64 string to binary data (ArrayBuffer)
            // Using atob helper pattern
            const sliceSize = 1024; // Increased slice size for better performance
            const byteCharacters = atob(base64Data);
            const byteArrays = [];

            for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
                const slice = byteCharacters.slice(offset, offset + sliceSize);
                const byteNumbers = new Array(slice.length);
                for (let i = 0; i < slice.length; i++) {
                    byteNumbers[i] = slice.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                byteArrays.push(byteArray);
            }

            // Create a Blob from the binary data
            const blob = new Blob(byteArrays, { type: contentType });

            // Create a URL for the Blob and open it in a new window/tab
            const blobUrl = URL.createObjectURL(blob);
            const newWindow = window.open(blobUrl, '_blank');
            
            if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
                alert('Popup blocker aktif! Mohon izinkan popup untuk melihat dokumen.');
            }

            // Note: We don't revoke the URL immediately because the browser
            // needs it to render the new page.
        } catch (error) {
            console.error('Error opening document:', error);
            alert('Gagal membuka dokumen (Mungkin file korup atau terlalu besar).');
        }
    }
};

// Explicitly make CustomerKYC globally available
window.CustomerKYC = CustomerKYC;
