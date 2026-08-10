// ==========================================
// CRM - KYC Assessment Module
// ==========================================

const KYCAssessment = {
    SECTIONS: [
        {
            id: "customer_identity",
            title: "A. Identitas & Legalitas Customer",
            weight: 25,
            questions: [
                {
                    id: "c1", text: "Status badan usaha customer",
                    options: [
                        { label: "PT/CV terdaftar aktif + NPWP aktif + SIUP emas/komoditas", score: 0 },
                        { label: "PT/CV terdaftar tapi SIUP tidak spesifik komoditas emas", score: 10 },
                        { label: "Perorangan dengan NPWP", score: 20 },
                        { label: "Tidak ada dokumen usaha", score: 40 },
                    ]
                },
                {
                    id: "c2", text: "Lama operasional bisnis customer",
                    options: [
                        { label: "> 5 tahun dengan track record jelas", score: 0 },
                        { label: "2–5 tahun", score: 10 },
                        { label: "< 2 tahun", score: 20 },
                        { label: "Baru berdiri / tidak diketahui", score: 35 },
                    ]
                },
                {
                    id: "c3", text: "Apakah customer pernah bertransaksi dengan pemurnian resmi sebelumnya?",
                    options: [
                        { label: "Ya, bisa diverifikasi (referensi, dokumen)", score: 0 },
                        { label: "Ya, tapi tidak bisa diverifikasi", score: 15 },
                        { label: "Tidak pernah", score: 25 },
                    ]
                }
            ]
        },
        {
            id: "gold_source",
            title: "B. Asal Usul Emas",
            weight: 35,
            questions: [
                {
                    id: "g1", text: "Dokumentasi asal emas yang dapat diberikan",
                    options: [
                        { label: "Invoice dari trader/toko emas terdaftar + nama supplier jelas", score: 0 },
                        { label: "Invoice ada tapi nama supplier tidak mau disebutkan", score: 30 },
                        { label: "Kwitansi informal / nota tangan", score: 45 },
                        { label: "Tidak ada dokumen apapun", score: 60 },
                    ]
                },
                {
                    id: "g2", text: "Kondisi fisik emas yang diserahkan",
                    options: [
                        { label: "Bermerek (Antam, LM, UBS, dll) dengan sertifikat", score: 0 },
                        { label: "Bermerek tapi tanpa sertifikat", score: 15 },
                        { label: "Tidak bermerek tapi bentuk standar (bar/granul bersih)", score: 25 },
                        { label: "Tidak bermerek, bentuk tidak standar / campuran", score: 45 },
                    ]
                },
                {
                    id: "g3", text: "Apakah customer bisa menjelaskan dari mana emas ini berasal secara lisan?",
                    options: [
                        { label: "Ya, penjelasan logis dan konsisten dengan skala bisnisnya", score: 0 },
                        { label: "Ya, tapi penjelasan tidak konsisten atau samar", score: 20 },
                        { label: "Menolak menjelaskan", score: 40 },
                    ]
                },
                {
                    id: "g4", text: "Harga jual emas customer ke PT GAR dibanding harga pasar",
                    options: [
                        { label: "Sesuai harga pasar wajar (±2%)", score: 0 },
                        { label: "Sedikit di bawah pasar (3–8%)", score: 20 },
                        { label: "Jauh di bawah pasar (>8%)", score: 50 },
                    ]
                }
            ]
        },
        {
            id: "transaction_pattern",
            title: "C. Pola Transaksi",
            weight: 25,
            questions: [
                {
                    id: "t1", text: "Volume emas yang dibawa per transaksi",
                    options: [
                        { label: "Konsisten dan sesuai skala bisnis customer", score: 0 },
                        { label: "Besar tapi masih bisa dijelaskan", score: 15 },
                        { label: "Volume tidak wajar untuk skala usaha yang diklaim", score: 35 },
                    ]
                },
                {
                    id: "t2", text: "Frekuensi dan pola transaksi",
                    options: [
                        { label: "Reguler dan dapat diprediksi", score: 0 },
                        { label: "Sporadis tapi ada penjelasan logis", score: 15 },
                        { label: "Tidak beraturan, volume fluktuatif ekstrem", score: 30 },
                    ]
                },
                {
                    id: "t3", text: "Metode pembayaran yang diminta customer",
                    options: [
                        { label: "Transfer bank rekening atas nama perusahaan", score: 0 },
                        { label: "Transfer bank rekening pribadi", score: 20 },
                        { label: "Tunai atau metode tidak tercatat", score: 50 },
                    ]
                }
            ]
        },
        {
            id: "behavior",
            title: "D. Perilaku & Red Flag Umum",
            weight: 15,
            questions: [
                {
                    id: "b1", text: "Sikap customer terhadap proses KYC / due diligence PT GAR",
                    options: [
                        { label: "Kooperatif, bersedia memberikan dokumen yang diminta", score: 0 },
                        { label: "Kooperatif sebagian, ada dokumen yang tidak mau diberikan", score: 20 },
                        { label: "Menolak proses KYC / tidak sabar / intimidatif", score: 50 },
                    ]
                },
                {
                    id: "b2", text: "Apakah customer menyebut bahwa mereka ingin ‘menutupi keuntungan’ atau alasan pajak?",
                    options: [
                        { label: "Tidak disebutkan", score: 0 },
                        { label: "Disebutkan secara implisit / samar", score: 30 },
                        { label: "Disebutkan secara eksplisit", score: 60 },
                    ]
                }
            ]
        }
    ],

    RISK_LEVELS: [
        { max: 20, label: "RISIKO RENDAH", color: "#16a34a", bg: "#f0fdf4", border: "#86efac", action: "Dapat diterima dengan dokumentasi standar. Laporkan ke PPATK jika >Rp 500 juta.", emoji: "✓" },
        { max: 45, label: "RISIKO SEDANG", color: "#d97706", bg: "#fffbeb", border: "#fcd34d", action: "Enhanced Due Diligence wajib. Minta surat pernyataan bermaterai + verifikasi tambahan sebelum terima. Pertimbangkan laporan PPATK.", emoji: "⚠" },
        { max: 70, label: "RISIKO TINGGI", color: "#dc2626", bg: "#fef2f2", border: "#fca5a5", action: "Konsultasi legal sebelum menerima. Pertimbangkan menolak atau minta remediation lengkap. Wajib lapor PPATK jika dilanjutkan.", emoji: "✗" },
        { max: 100, label: "TOLAK", color: "#7c3aed", bg: "#faf5ff", border: "#c4b5fd", action: "JANGAN TERIMA. Risiko pidana TPPU dan Minerba terlalu tinggi. Simpan catatan penolakan sebagai bukti due diligence.", emoji: "⛔" }
    ],

    state: {
        customerId: '',
        customerName: '',
        assessorName: '',
        assessDate: new Date().toISOString().split('T')[0],
        answers: {},
        printed: false
    },

    init() {
        const auth = window.FirebaseAuth || window.Auth;
        const currentUser = auth ? auth.getCurrentUser() : null;
        this.state.assessorName = currentUser ? (currentUser.name || currentUser.username) : '';
        this.state.answers = {};
        this.state.customerId = '';
        this.state.customerName = '';
        this.state.printed = false;
        
        // Inject Print CSS if not exists
        if (!document.getElementById('kyc-print-css')) {
            const style = document.createElement('style');
            style.id = 'kyc-print-css';
            style.innerHTML = `
                @media print { 
                    body > * { display: none !important; } 
                    #gar-print { display: block !important; font-family: Arial, sans-serif; font-size: 9.5pt; color: #1e293b; background: white; } 
                    @page { margin: 15mm 14mm; size: A4; } 
                } 
                #gar-print { display: none; } 
                #gar-print .ph { background: #1e3a5f; color: white; padding: 13px 18px; border-radius: 7px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; } 
                #gar-print .ph-brand { font-size: 7.5pt; color: #f7d300; letter-spacing: 1.5px; font-weight: 700; text-transform: uppercase; } 
                #gar-print .ph-title { font-size: 14pt; font-weight: 900; margin: 2px 0 0; } 
                #gar-print .ph-sub { font-size: 7.5pt; color: #94a3b8; } 
                #gar-print .ph-right { text-align: right; font-size: 7.5pt; color: #94a3b8; } 
                #gar-print .ph-right strong { color: white; font-size: 9pt; display: block; } 
                #gar-print .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 7px; margin-bottom: 12px; } 
                #gar-print .info-cell { border: 1px solid #e2e8f0; border-radius: 5px; padding: 7px 11px; background: #f8fafc; } 
                #gar-print .info-cell .lbl { font-size: 7pt; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; } 
                #gar-print .info-cell .val { font-size: 9.5pt; font-weight: 700; color: #1e3a5f; margin-top: 2px; } 
                #gar-print .result-box { border-radius: 8px; padding: 13px 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 14px; border: 2px solid; } 
                #gar-print .badge { width: 50px; height: 50px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 20pt; color: white; flex-shrink: 0; } 
                #gar-print .res-label { font-size: 7pt; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; } 
                #gar-print .res-title { font-size: 16pt; font-weight: 900; } 
                #gar-print .res-score { font-size: 8pt; color: #64748b; margin-top: 2px; } 
                #gar-print .bar-bg { background: #e5e7eb; border-radius: 99px; height: 6px; overflow: hidden; margin-top: 5px; } 
                #gar-print .bar-fill { height: 100%; border-radius: 99px; } 
                #gar-print .action-box { border: 1px solid; border-radius: 5px; padding: 9px 13px; margin-top: 9px; background: white; } 
                #gar-print .action-box .lbl { font-size: 7pt; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 3px; } 
                #gar-print .action-box .val { font-size: 9pt; color: #334155; line-height: 1.5; } 
                #gar-print .breakdown { margin: 12px 0; } 
                #gar-print .bk-title { font-size: 7pt; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 7px; } 
                #gar-print .brow { margin-bottom: 6px; } 
                #gar-print .brow-head { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 8pt; } 
                #gar-print .section-block { border: 1px solid #e2e8f0; border-radius: 7px; margin-bottom: 8px; overflow: hidden; page-break-inside: avoid; } 
                #gar-print .sec-head { background: #f1f5f9; padding: 7px 13px; display: flex; justify-content: space-between; } 
                #gar-print .sec-head .t { font-size: 9pt; font-weight: 800; color: #1e3a5f; } 
                #gar-print .sec-head .b { font-size: 7.5pt; font-weight: 700; color: #64748b; } 
                #gar-print .qblock { padding: 7px 13px; border-top: 1px solid #f1f5f9; } 
                #gar-print .qtext { font-size: 8.5pt; font-weight: 600; color: #334155; margin-bottom: 5px; } 
                #gar-print .opt { padding: 4px 9px; border-radius: 4px; border: 1.1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 8pt; margin-bottom: 3px; background: #f8fafc; color: #64748b; } 
                #gar-print .opt.sel { border-width: 1.7px; font-weight: 700; } 
                #gar-print .sc { font-size: 7.5pt; font-weight: 800; padding: 1px 6px; border-radius: 99px; } 
                #gar-print .warning { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 5px; padding: 9px 13px; font-size: 8.5pt; color: #92400e; margin-bottom: 12px; line-height: 1.5; } 
                #gar-print .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 12px; } 
                #gar-print .sig-box { border: 1px solid #e2e8f0; border-radius: 5px; padding: 9px 13px; } 
                #gar-print .sig-box .lbl { font-size: 7pt; color: #64748b; font-weight: 700; margin-bottom: 26px; } 
                #gar-print .sig-box .line { border-top: 1px solid #cbd5e1; padding-top: 4px; font-size: 7.5pt; color: #475569; } 
                #gar-print .footer { text-align: center; font-size: 7pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
            `;
            document.head.appendChild(style);
        }

        // Setup Print Container
        if (!document.getElementById('gar-print')) {
            const printContainer = document.createElement('div');
            printContainer.id = 'gar-print';
            document.body.appendChild(printContainer);
        }

        this.render();
    },

    getRiskLevel(score) {
        return this.RISK_LEVELS.find(r => score <= r.max) || this.RISK_LEVELS[this.RISK_LEVELS.length - 1];
    },

    computeScore() {
        let weightedTotal = 0;
        for (const section of this.SECTIONS) {
            let sectionRaw = 0, sectionMax = 0;
            for (const q of section.questions) {
                const maxOption = Math.max(...q.options.map(o => o.score));
                sectionMax += maxOption;
                if (this.state.answers[q.id] !== undefined) sectionRaw += this.state.answers[q.id];
            }
            const sectionPct = sectionMax > 0 ? (sectionRaw / sectionMax) : 0;
            weightedTotal += sectionPct * section.weight;
        }
        return Math.round(weightedTotal);
    },

    setAnswer(qId, score) {
        this.state.answers[qId] = score;
        this.render();
    },

    handleCustomerChange(customerId) {
        this.state.customerId = customerId;
        const customers = Storage.getCustomers();
        const cust = customers.find(c => c.id === customerId);
        if (cust) {
            this.state.customerName = cust.name;
        } else {
            this.state.customerName = '';
        }
        this.render();
    },

    async handleSave() {
        if (!this.state.customerId) {
            alert("Pilih customer terlebih dahulu sebelum menyimpan!");
            return;
        }

        const score = this.computeScore();
        const risk = this.getRiskLevel(score);

        const recordId = `KYC-${Date.now()}`;
        const record = {
            id: recordId,
            customerId: this.state.customerId,
            customerName: this.state.customerName,
            assessorName: this.state.assessorName,
            date: this.state.assessDate,
            score: score,
            riskLevel: risk.label,
            answers: this.state.answers,
            createdAt: new Date().toISOString()
        };

        const records = Storage.getKYCRecords();
        records.push(record);
        await Storage.saveKYCRecords(records);

        // Update Customer Status
        const customers = Storage.getCustomers();
        const custIndex = customers.findIndex(c => c.id === this.state.customerId);
        if (custIndex !== -1) {
            customers[custIndex].kycStatus = risk.label === 'TOLAK' ? 'Rejected' : 'Approved';
            customers[custIndex].kycScore = score;
            customers[custIndex].kycLastUpdate = this.state.assessDate;
            await Storage.saveCustomers(customers);
        }

        AuditLog.log('kyc', 'create', recordId, { customerId: this.state.customerId, score, risk: risk.label });
        
        if (window.showToast) window.showToast("Penilaian KYC berhasil disimpan", "success");
        this.render(); // Re-render to show completion state
    },

    handlePrint() {
        this.renderPrintDOM();
        const el = document.getElementById("gar-print");
        if (el) {
            el.style.display = "block";
            window.print();
            setTimeout(() => { 
                el.style.display = "none"; 
                this.state.printed = true;
                this.render();
            }, 800);
        }
    },

    renderPrintDOM() {
        const score = this.computeScore();
        const risk = this.getRiskLevel(score);
        const now = new Date().toLocaleString("id-ID");
        const container = document.getElementById('gar-print');

        let breakdownHtml = '';
        this.SECTIONS.forEach(section => {
            let raw = 0, max = 0;
            for (const q of section.questions) {
                max += Math.max(...q.options.map(o => o.score));
                if (this.state.answers[q.id] !== undefined) raw += this.state.answers[q.id];
            }
            const pct = max > 0 ? Math.round((raw / max) * 100) : 0;
            const contrib = Math.round((raw / max) * section.weight);
            const c = pct <= 20 ? "#16a34a" : pct <= 45 ? "#d97706" : "#dc2626";
            
            breakdownHtml += `
                <div class="brow">
                    <div class="brow-head">
                        <span style="color: #475569">${section.title}</span>
                        <span style="color: ${c}; font-weight: 700">${contrib}/${section.weight} pts</span>
                    </div>
                    <div class="bar-bg"><div class="bar-fill" style="width: ${pct}%; background: ${c}"></div></div>
                </div>
            `;
        });

        let sectionsHtml = '';
        this.SECTIONS.forEach(section => {
            let questionsHtml = '';
            section.questions.forEach(q => {
                const sel = this.state.answers[q.id];
                let optsHtml = '';
                q.options.forEach(opt => {
                    const isSelected = sel === opt.score;
                    const sc = opt.score === 0 ? "#16a34a" : opt.score <= 20 ? "#65a30d" : opt.score <= 35 ? "#d97706" : "#dc2626";
                    optsHtml += `
                        <div class="opt ${isSelected ? 'sel' : ''}" style="${isSelected ? `border-color: ${sc}; background: ${sc}12; color: ${sc}` : ''}">
                            <span>${isSelected ? "▶️ " : ""}${opt.label}</span>
                            <span class="sc" style="color: ${sc}; background: ${sc}15">+${opt.score}</span>
                        </div>
                    `;
                });
                questionsHtml += `
                    <div class="qblock">
                        <div class="qtext">${q.text}</div>
                        ${optsHtml}
                    </div>
                `;
            });

            sectionsHtml += `
                <div class="section-block">
                    <div class="sec-head">
                        <span class="t">${section.title}</span>
                        <span class="b">Bobot: ${section.weight}%</span>
                    </div>
                    ${questionsHtml}
                </div>
            `;
        });

        container.innerHTML = `
            <div class="ph">
                <div>
                    <div class="ph-brand">PT Golden Alura Refineri</div>
                    <div class="ph-title">Risk Scoring Matrix</div>
                    <div class="ph-sub">Penilaian Risiko Penerimaan Emas — AML/CFT Compliance</div>
                </div>
                <div class="ph-right">
                    <strong>Dok: GAR-RSM-${this.state.assessDate}</strong>
                    Dicetak: ${now}
                </div>
            </div>

            <div class="info-grid">
                <div class="info-cell"><div class="lbl">Customer</div><div class="val">${this.state.customerName || "—"}</div></div>
                <div class="info-cell"><div class="lbl">Assessor</div><div class="val">${this.state.assessorName || "—"}</div></div>
                <div class="info-cell"><div class="lbl">Tanggal</div><div class="val">${this.state.assessDate}</div></div>
            </div>

            <div class="result-box" style="background: ${risk.bg}; border-color: ${risk.border}">
                <div class="badge" style="background: ${risk.color}">${risk.emoji}</div>
                <div style="flex: 1">
                    <div class="res-label" style="color: ${risk.color}">Hasil Penilaian Risiko</div>
                    <div class="res-title" style="color: ${risk.color}">${risk.label}</div>
                    <div class="res-score">Skor Total: <strong>${score}</strong>/100</div>
                    <div class="bar-bg"><div class="bar-fill" style="width: ${score}%; background: ${risk.color}"></div></div>
                </div>
            </div>

            <div class="action-box" style="border-color: ${risk.border}">
                <div class="lbl">Tindakan yang Direkomendasikan</div>
                <div class="val">${risk.action}</div>
            </div>

            <div class="breakdown">
                <div class="bk-title">Breakdown Skor per Kategori</div>
                ${breakdownHtml}
            </div>

            ${sectionsHtml}

            <div class="warning">
                <strong>⚠ Catatan Wajib Kepatuhan:</strong> Setiap transaksi emas ≥ Rp 500 juta atau transaksi yang mencurigakan
                wajib dilaporkan ke PPATK melalui LTKM. Dokumen ini wajib disimpan minimal 5 tahun
                sesuai UU No. 8 Tahun 2010 tentang Pencegahan dan Pemberantasan TPPU.
            </div>

            <div class="sig-grid">
                <div class="sig-box">
                    <div class="lbl">Tanda Tangan Assessor</div>
                    <div class="line">${this.state.assessorName || "________________________________"}</div>
                </div>
                <div class="sig-box">
                    <div class="lbl">Diketahui oleh (Compliance Officer)</div>
                    <div class="line">________________________________</div>
                </div>
            </div>

            <div class="footer">
                PT Golden Alura Refineri · Internal Compliance Tool · AML/CFT Risk Assessment · DOKUMEN RAHASIA — HANYA UNTUK PENGGUNAAN INTERNAL
            </div>
        `;
    },

    render() {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        const totalQuestions = this.SECTIONS.reduce((acc, s) => acc + s.questions.length, 0);
        const answered = Object.keys(this.state.answers).length;
        const progress = Math.round((answered / totalQuestions) * 100);
        const allAnswered = answered === totalQuestions;
        
        const score = this.computeScore();
        const risk = this.getRiskLevel(score);

        const customers = Storage.getCustomers();

        let sectionsHtml = '';
        this.SECTIONS.forEach(section => {
            const sectionAnswered = section.questions.filter(q => this.state.answers[q.id] !== undefined).length;
            
            let questionsHtml = '';
            section.questions.forEach((q, qi) => {
                let optionsHtml = '';
                q.options.forEach(opt => {
                    const selected = this.state.answers[q.id] === opt.score;
                    const scoreColor = opt.score === 0 ? "#16a34a" : opt.score <= 20 ? "#65a30d" : opt.score <= 35 ? "#d97706" : "#dc2626";
                    
                    optionsHtml += `
                        <button onclick="KYCAssessment.setAnswer('${q.id}', ${opt.score})"
                            style="text-align: left; padding: 10px 14px; border-radius: 8px; 
                                   border: ${selected ? `2px solid ${scoreColor}` : "1px solid #e2e8f0"}; 
                                   background: ${selected ? `${scoreColor}10` : "#f8fafc"}; 
                                   cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; transition: all 0.15s ease;">
                            <span style="font-size: 0.85rem; color: ${selected ? scoreColor : "#475569"}; font-weight: ${selected ? 600 : 400}; flex: 1;">${opt.label}</span>
                            <span style="font-size: 0.75rem; font-weight: 800; color: ${scoreColor}; background: ${scoreColor}15; padding: 2px 8px; border-radius: 99px; white-space: nowrap;">+${opt.score}</span>
                        </button>
                    `;
                });

                questionsHtml += `
                    <div style="margin-bottom: ${qi < section.questions.length - 1 ? 20 : 0}px; padding-bottom: ${qi < section.questions.length - 1 ? 20 : 0}px; border-bottom: ${qi < section.questions.length - 1 ? "1px solid #f1f5f9" : "none"};">
                        <div style="font-size: 0.9rem; font-weight: 600; color: #334155; margin-bottom: 10px;">${q.text}</div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${optionsHtml}
                        </div>
                    </div>
                `;
            });

            sectionsHtml += `
                <div style="background: white; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                        <div>
                            <div style="font-size: 1rem; font-weight: 800; color: #1e3a5f;">${section.title}</div>
                            <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px;">Bobot: ${section.weight}% dari total skor</div>
                        </div>
                        <div style="background: ${sectionAnswered === section.questions.length ? "#f0fdf4" : "#f1f5f9"}; color: ${sectionAnswered === section.questions.length ? "#16a34a" : "#64748b"}; border-radius: 99px; padding: 4px 12px; font-size: 0.75rem; font-weight: 700;">
                            ${sectionAnswered}/${section.questions.length}
                        </div>
                    </div>
                    ${questionsHtml}
                </div>
            `;
        });

        let resultsHtml = '';
        if (allAnswered) {
            let breakdownBarsHtml = '';
            this.SECTIONS.forEach(section => {
                let sectionRaw = 0, sectionMax = 0;
                section.questions.forEach(q => {
                    sectionMax += Math.max(...q.options.map(o => o.score));
                    if (this.state.answers[q.id] !== undefined) sectionRaw += this.state.answers[q.id];
                });
                const pct = sectionMax > 0 ? Math.round((sectionRaw / sectionMax) * 100) : 0;
                const contribution = Math.round((sectionRaw / sectionMax) * section.weight);
                const cat = pct <= 20 ? "#16a34a" : pct <= 45 ? "#d97706" : "#dc2626";
                
                breakdownBarsHtml += `
                    <div style="margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span style="font-size: 0.8rem; color: #475569; font-weight: 500;">${section.title.split(". ")[1]}</span>
                            <span style="font-size: 0.8rem; color: ${cat}; font-weight: 700;">${contribution}/${section.weight} pts</span>
                        </div>
                        <div style="background: #e5e7eb; border-radius: 99px; height: 10px; overflow: hidden; margin-top: 4px;">
                            <div style="width: ${Math.min(pct, 100)}%; height: 100%; background: ${cat}; border-radius: 99px; transition: width 0.6s cubic-bezier(.4,0,.2,1);"></div>
                        </div>
                    </div>
                `;
            });

            resultsHtml = `
                <div style="background: ${risk.bg}; border: 2px solid ${risk.border}; border-radius: 16px; padding: 28px 32px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: flex-start; gap: 20px; margin-bottom: 20px;">
                        <div style="width: 72px; height: 72px; background: ${risk.color}; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: white; flex-shrink: 0;">${risk.emoji}</div>
                        <div style="flex: 1;">
                            <div style="font-size: 0.75rem; font-weight: 700; color: ${risk.color}; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px;">Hasil Penilaian</div>
                            <div style="font-size: 1.6rem; font-weight: 900; color: ${risk.color}; margin-bottom: 4px;">${risk.label}</div>
                            <div style="font-size: 0.85rem; color: #64748b;">Skor: <strong>${score}</strong>/100 &nbsp;·&nbsp; ${this.state.customerName || "Customer"} &nbsp;·&nbsp; ${this.state.assessDate}</div>
                        </div>
                    </div>
                    
                    <div style="background: #e5e7eb; border-radius: 99px; height: 10px; overflow: hidden; margin-top: 4px;">
                        <div style="width: ${Math.min(score, 100)}%; height: 100%; background: ${risk.color}; border-radius: 99px; transition: width 0.6s cubic-bezier(.4,0,.2,1);"></div>
                    </div>

                    <div style="margin-top: 20px; padding: 16px 20px; background: white; border-radius: 10px; border: 1px solid ${risk.border};">
                        <div style="font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Tindakan yang Direkomendasikan</div>
                        <div style="font-size: 0.85rem; color: #334155; line-height: 1.6;">${risk.action}</div>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <div style="font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Breakdown per Kategori</div>
                        ${breakdownBarsHtml}
                    </div>
                    
                    <div style="margin-top: 20px; padding: 12px 16px; background: #fef3c7; border-radius: 8px; border: 1px solid #fcd34d; font-size: 0.8rem; color: #92400e; line-height: 1.5;">
                        <strong>⚠ Catatan Wajib:</strong> Setiap transaksi emas ≥ Rp 500 juta atau transaksi yang mencurigakan wajib dilaporkan ke PPATK. Simpan semua dokumen penilaian ini minimal 5 tahun.
                    </div>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button onclick="KYCAssessment.handleSave()" style="flex: 1; padding: 15px; background: #16a34a; border: none; border-radius: 10px; font-size: 0.9rem; color: white; cursor: pointer; font-weight: 700; margin-bottom: 12px; box-shadow: 0 4px 14px rgba(22,163,74,0.25);">
                        💾 Simpan ke Database ERP
                    </button>
                    <button onclick="KYCAssessment.handlePrint()" style="flex: 1; padding: 15px; background: linear-gradient(135deg, #1e3a5f, #0f2847); border: none; border-radius: 10px; font-size: 0.9rem; color: white; cursor: pointer; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 4px 14px rgba(30,58,95,0.25);">
                        🖨 Export / Cetak PDF
                        ${this.state.printed ? '<span style="font-size: 0.7rem; opacity: 0.65; font-weight: 400;">— siap disimpan sebagai PDF</span>' : ''}
                    </button>
                </div>
            `;
        }

        const scoreColor = score <= 20 ? "#16a34a" : score <= 45 ? "#d97706" : score <= 70 ? "#dc2626" : "#7c3aed";

        mainContent.innerHTML = `
            <div style="font-family: 'Segoe UI', system-ui, sans-serif; background: #f8fafc; min-height: 100vh; padding: 24px 16px;">
                <div style="max-width: 720px; margin: 0 auto;">
                    
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f2847 100%); border-radius: 16px; padding: 28px 32px; margin-bottom: 24px; color: white; position: relative; overflow: hidden;">
                        <div style="position: absolute; top: -20px; right: -20px; width: 120px; height: 120px; background: rgba(247,211,0,0.08); border-radius: 50%;"></div>
                        <div style="font-size: 0.75rem; letter-spacing: 2px; color: #f7d300; font-weight: 700; margin-bottom: 6px; text-transform: uppercase;">PT Golden Alura Refineri</div>
                        <div style="font-size: 1.5rem; font-weight: 800; margin-bottom: 4px;">Risk Scoring Matrix</div>
                        <div style="font-size: 0.85rem; color: #94a3b8;">Penilaian Risiko Penerimaan Emas — AML/CFT Compliance</div>
                    </div>

                    <!-- Customer Info -->
                    <div style="background: white; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                        <div style="font-size: 0.8rem; font-weight: 700; color: #64748b; letter-spacing: 1px; margin-bottom: 14px; text-transform: uppercase;">Informasi Penilaian</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div style="grid-column: span 2;">
                                <label style="font-size: 0.75rem; color: #64748b; font-weight: 600; display: block; margin-bottom: 4px;">Pilih Customer</label>
                                <select class="form-select" style="width: 100%;" onchange="KYCAssessment.handleCustomerChange(this.value)">
                                    <option value="">-- Pilih Customer --</option>
                                    ${customers.map(c => `<option value="${c.id}" ${this.state.customerId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label style="font-size: 0.75rem; color: #64748b; font-weight: 600; display: block; margin-bottom: 4px;">Nama Assessor</label>
                                <input type="text" value="${this.state.assessorName}" onchange="KYCAssessment.state.assessorName = this.value" placeholder="Nama staff"
                                    style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none; box-sizing: border-box; background: #f8fafc;" />
                            </div>
                            <div>
                                <label style="font-size: 0.75rem; color: #64748b; font-weight: 600; display: block; margin-bottom: 4px;">Tanggal Penilaian</label>
                                <input type="date" value="${this.state.assessDate}" onchange="KYCAssessment.state.assessDate = this.value"
                                    style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none; box-sizing: border-box; background: #f8fafc;" />
                            </div>
                        </div>
                    </div>

                    <!-- Progress -->
                    <div style="background: white; border-radius: 12px; padding: 14px 24px; margin-bottom: 20px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 16px;">
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">Progress Penilaian</span>
                                <span style="font-size: 0.8rem; color: #1e3a5f; font-weight: 700;">${answered}/${totalQuestions} pertanyaan</span>
                            </div>
                            <div style="background: #e5e7eb; border-radius: 99px; height: 8px; overflow: hidden;">
                                <div style="width: ${progress}%; height: 100%; background: linear-gradient(90deg, #1e3a5f, #006aff); border-radius: 99px; transition: width 0.4s ease;"></div>
                            </div>
                        </div>
                        ${allAnswered ? `
                            <div style="background: ${risk.color}; color: white; border-radius: 99px; padding: 6px 14px; font-size: 0.85rem; font-weight: 800; white-space: nowrap;">
                                ${risk.emoji} ${score}/100
                            </div>
                        ` : ''}
                    </div>

                    <!-- Sections -->
                    ${sectionsHtml}

                    <!-- Result -->
                    ${resultsHtml}

                    <!-- Reset -->
                    ${answered > 0 ? `
                        <button onclick="KYCAssessment.init()"
                            style="width: 100%; padding: 13px; background: white; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 0.85rem; color: #64748b; cursor: pointer; font-weight: 600; margin-bottom: 32px;">
                            Reset Penilaian
                        </button>
                    ` : ''}

                    <div style="text-align: center; font-size: 0.75rem; color: #94a3b8; padding-bottom: 24px;">
                        PT Golden Alura Refineri · Internal Compliance Tool · AML/CFT Risk Assessment
                    </div>
                </div>
            </div>
        `;
    }
};

window.KYCAssessment = KYCAssessment;
