/**
 * SyncDiagnosticUI Module
 * Provides a UI tool to diagnose and fix cloud synchronization issues.
 * Included in index.html to help users like "Bu Novi" fix sync gaps.
 */
const SyncDiagnosticUI = {
    /**
     * Show the diagnostic modal
     */
    show() {
        const modalId = 'sync-diagnostic-modal';
        if (document.getElementById(modalId)) return;

        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        modal.style.zIndex = '10000';
        modal.innerHTML = `
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>🔍 Cloud Sync Diagnostic</h2>
                    <button class="close-btn" onclick="SyncDiagnosticUI.close()">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="sync-diagnostic-status" style="margin-bottom: 20px;">
                        <p>🕒 Harap tunggu, sedang mengecek status...</p>
                    </div>
                    
                    <div id="sync-diagnostic-actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button onclick="SyncDiagnosticUI.runCheck()" class="btn-primary">🔄 Re-Check</button>
                        <button onclick="location.reload()" class="btn-secondary">🔃 Refresh App</button>
                        <button onclick="SyncDiagnosticUI.forceSync()" class="btn-warning">🚀 Force Sync All</button>
                        <button onclick="SyncDiagnosticUI.cleanupBloatedCounterDoc()" class="btn-danger"
                                title="Hapus dokumen erp_transaction_counters yang bengkak di Firestore (fix error 1MB)">
                            🧹 Bersihkan Counter Doc
                        </button>
                        <button onclick="(window.FirebaseAuth || window.Auth).logout()" class="btn-danger">🚩 Re-Login</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.runCheck();
    },

    /**
     * Close the diagnostic modal
     */
    close() {
        const modal = document.getElementById('sync-diagnostic-modal');
        if (modal) modal.remove();
    },

    /**
     * Run the diagnostic check
     */
    async runCheck() {
        const statusDiv = document.getElementById('sync-diagnostic-status');
        if (!statusDiv) return;

        statusDiv.innerHTML = '<p>🔄 Sedang mengecek...</p>';

        const checks = {
            firebaseEnabled: typeof window.db !== 'undefined',
            authActive: window.auth && window.auth.currentUser !== null,
            localSession: localStorage.getItem('erp_current_session') !== null,
            syncQueue: (window.FirebaseSync ? FirebaseSync.getQueue().length : 0),
            internet: navigator.onLine
        };

        const results = [];

        // 1. Internet Connection
        results.push(`
            <div style="margin-bottom: 10px; padding: 10px; border-radius: 4px; background: ${checks.internet ? '#e6ffec' : '#fff0f0'}; color: ${checks.internet ? '#155724' : '#721c24'}">
                <strong>🌐 Internet:</strong> ${checks.internet ? 'Koneksi OK' : 'DISKONEK (Cek internet Anda)'}
            </div>
        `);

        // 2. Firebase Connection
        results.push(`
            <div style="margin-bottom: 10px; padding: 10px; border-radius: 4px; background: ${checks.firebaseEnabled ? '#e6ffec' : '#fff0f0'}; color: ${checks.firebaseEnabled ? '#155724' : '#721c24'}">
                <strong>☁️ Cloud Database:</strong> ${checks.firebaseEnabled ? 'Terhubung (Ready)' : 'GAGAL TERHUBUNG (Blokir oleh Firewall?)'}
            </div>
        `);

        // 3. Auth Status (THE CRITICAL ONE)
        const authStatus = checks.authActive ? 'TERHUBUNG ✅' : (checks.localSession ? 'LOKAL OK, CLOUD GAGAL ❌' : 'BELUM LOGIN');
        const authBg = checks.authActive ? '#e6ffec' : (checks.localSession ? '#fff3cd' : '#fff0f0');
        const authColor = checks.authActive ? '#155724' : (checks.localSession ? '#856404' : '#721c24');

        results.push(`
            <div style="margin-bottom: 10px; padding: 10px; border-radius: 4px; background: ${authBg}; color: ${authColor}">
                <strong>🔑 Cloud Auth:</strong> ${authStatus}
                ${!checks.authActive && checks.localSession ? '<br><small>⚠️ Ini penyebab data Anda tidak muncul di Manager. Silakan klik Logout lalu Login kembali.</small>' : ''}
            </div>
        `);

        // 4. Sync Queue
        results.push(`
            <div style="margin-bottom: 10px; padding: 10px; border-radius: 4px; background: ${checks.syncQueue === 0 ? '#e6ffec' : '#fff3cd'}; color: ${checks.syncQueue === 0 ? '#155724' : '#856404'}">
                <strong>📝 Pending Sync:</strong> ${checks.syncQueue} data tertunda
            </div>
        `);

        // 5. Bloated Counter Document check
        try {
            if (window.db && window.firestore) {
                const { doc, getDoc } = window.firestore;
                const bloatedRef = doc(window.db, 'transactionCounters', 'erp_transaction_counters');
                const bloatedSnap = await getDoc(bloatedRef);
                if (bloatedSnap.exists()) {
                    const raw = JSON.stringify(bloatedSnap.data());
                    const sizeKB = Math.round(raw.length / 1024);
                    results.push(`
                        <div style="margin-bottom:10px;padding:10px;border-radius:4px;background:#fff0f0;color:#721c24;">
                            <strong>⚠️ Dokumen Counter Bengkak Ditemukan!</strong><br>
                            <code>transactionCounters/erp_transaction_counters</code> berukuran ~${sizeKB} KB.
                            Ini menyebabkan error Push Failed 1 MB. Klik tombol <strong>🧹 Bersihkan Counter Doc</strong> untuk memperbaiki.
                        </div>
                    `);
                } else {
                    results.push(`
                        <div style="margin-bottom:10px;padding:10px;border-radius:4px;background:#e6ffec;color:#155724;">
                            <strong>✅ Counter Doc:</strong> Dokumen bengkak tidak ditemukan. Firestore sehat.
                        </div>
                    `);
                }
            }
        } catch(e) {
            results.push(`<div style="margin-bottom:10px;padding:10px;border-radius:4px;background:#fff3cd;color:#856404;"><strong>⚠️ Counter Doc Check:</strong> Tidak dapat dicek (${e.message})</div>`);
        }

        statusDiv.innerHTML = results.join('');
    },

    /**
     * Force sync all data
     */
    async forceSync() {
        if (!confirm('Peringatan: Ini akan mengunggah paksa data lokal ke Cloud. Lanjutkan?')) return;

        const statusDiv = document.getElementById('sync-diagnostic-status');
        statusDiv.innerHTML = '<p>🚀 Memulai Full Sync paksa...</p>';

        try {
            if (window.FirebaseSync) {
                await FirebaseSync.migrateAllToCloud();
                alert('Berhasil: Semua data lokal telah dipaksa sync ke Cloud!');
                this.runCheck();
            }
        } catch (e) {
            alert('Gagal: ' + e.message);
            this.runCheck();
        }
    },

    // ─── Hapus dokumen counter yang bengkak di Firestore ───────────────────────
    async cleanupBloatedCounterDoc() {
        if (!window.db || !window.firestore) {
            alert('❌ Firebase tidak aktif. Tidak dapat membersihkan.'); return;
        }
        if (!confirm(
            'Ini akan menghapus dokumen \"erp_transaction_counters\" yang bengkak di Firestore.\n\n'
            + 'Counter transaksi yang benar (transactionCounters/counters) TIDAK akan terpengaruh.\n\n'
            + 'Lanjutkan?'
        )) return;

        const statusDiv = document.getElementById('sync-diagnostic-status');
        statusDiv.innerHTML = '<p>🧹 Menghapus dokumen bengkak...</p>';

        try {
            const { doc, deleteDoc } = window.firestore;
            // Hapus dokumen bengkak yang dibuat oleh FirebaseSync lama
            await deleteDoc(doc(window.db, 'transactionCounters', 'erp_transaction_counters'));
            // Pastikan tidak ada di sync queue lagi
            if (window.FirebaseSync) {
                FirebaseSync.removeFromQueue('erp_transaction_counters');
            }
            alert('✅ Berhasil! Dokumen bengkak sudah dihapus. Silakan Refresh App.');
        } catch (e) {
            alert('❌ Gagal menghapus: ' + e.message);
        }
        this.runCheck();
    }
};

window.SyncDiagnosticUI = SyncDiagnosticUI;
