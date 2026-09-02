// ==========================================
// Data Cleanup Module
// Fixes duplicates and consistency issues
// ==========================================

const DataCleanup = {
    /**
     * Fix duplicate journal entries by Reference Number.
     * Keeps the most recently modified/created one, deletes others.
     */
    async fixDuplicateJournals() {
        if (!confirm('Jalankan pembersihan duplikat jurnal? Ini akan menghapus data ganda secara permanen.')) return;

        console.log('🧹 Starting Journal Deduplication...');

        const entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        const uniqueRefs = {};
        const duplicates = [];

        // 1. Identify Duplicates
        entries.forEach(entry => {
            if (!entry.reference) return; // Skip empty refs

            if (!uniqueRefs[entry.reference]) {
                uniqueRefs[entry.reference] = entry;
            } else {
                // Determine which one to keep (keep the newer one by ID or Date)
                const existing = uniqueRefs[entry.reference];

                // Compare IDs (assuming timestamp-based IDs)
                // If current entry is "newer" (larger ID string approx), keep current, discard existing
                if (entry.id > existing.id) {
                    duplicates.push(existing); // Discard old
                    uniqueRefs[entry.reference] = entry; // Keep new
                } else {
                    duplicates.push(entry); // Discard current
                }
            }
        });

        if (duplicates.length === 0) {
            alert('✅ Tidak ditemukan duplikat. Data bersih.');
            return;
        }

        console.log(`⚠️ Found ${duplicates.length} duplicate entries to delete.`);
        console.table(duplicates.map(d => ({ id: d.id, ref: d.reference, amount: d.totalDebit })));

        // 2. Execute Absolute Deletion for Duplicates
        let successCount = 0;
        let failCount = 0;

        // Progress indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.style.position = 'fixed';
        loadingDiv.style.top = '50%';
        loadingDiv.style.left = '50%';
        loadingDiv.style.transform = 'translate(-50%, -50%)';
        loadingDiv.style.background = 'rgba(0,0,0,0.8)';
        loadingDiv.style.color = 'white';
        loadingDiv.style.padding = '20px';
        loadingDiv.style.borderRadius = '8px';
        loadingDiv.style.zIndex = '9999';
        loadingDiv.innerHTML = `<h3>Sedang membersihkan... 0/${duplicates.length}</h3>`;
        document.body.appendChild(loadingDiv);

        for (let i = 0; i < duplicates.length; i++) {
            const entry = duplicates[i];

            try {
                // Main work: Delete from Cloud (Tombstone)
                // DIRECT FIRESTORE CALL to avoid wrapper logic issues
                if (typeof window.db !== 'undefined' && typeof window.firestore !== 'undefined') {
                    const { doc, deleteDoc, setDoc } = window.firestore;

                    // 1. Delete actual doc
                    const docId = String(entry.id).replace(/\//g, '_');
                    const collName = 'journalEntries'; // Hardcoded for safety
                    const docRef = doc(window.db, collName, docId);

                    // 2. Create Tombstone
                    const tombstoneRef = doc(window.db, 'deletedRecords', `${collName}_${docId}`);

                    // Execute with timeout
                    const workPromise = (async () => {
                        await deleteDoc(docRef);
                        await setDoc(tombstoneRef, {
                            collection: collName,
                            docId: docId,
                            deletedAt: new Date().toISOString(),
                            deletedBy: window.auth?.currentUser?.uid || 'unknown',
                            note: 'Deleted via Emergency Cleanup Tool'
                        });
                    })();

                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Operation Timed Out (10s)')), 10000));

                    await Promise.race([workPromise, timeoutPromise]);
                } else {
                    throw new Error('Firestore SDK not initialized on window object');
                }

                successCount++;
            } catch (error) {
                console.error(`❌ Failed to delete duplicate ${entry.id}:`, error);

                // ALERT ON FIRST ERROR only
                if (failCount === 0) {
                    alert(`ERROR PERTAMA: ${error.message}\n\nKode Error: ${error.code || 'N/A'}\n\nMohon laporkan pesan ini.`);
                }

                failCount++;
            }

            loadingDiv.innerHTML = `<h3>Membersihkan... ${i + 1}/${duplicates.length}<br><small style="font-size: 12px">Skipped: ${failCount}</small></h3>`;
        }

        // 3. Update Local Storage with Cleaned List
        const cleanEntries = Object.values(uniqueRefs).sort((a, b) => new Date(b.date) - new Date(a.date));
        await Storage.set(Storage.KEYS.JOURNAL_ENTRIES, cleanEntries);

        document.body.removeChild(loadingDiv);

        const msg = `Selesai! Dihapus: ${successCount} duplikat.\nGagal: ${failCount}.\nTotal tersisa: ${cleanEntries.length}.`;
        alert(msg);
        console.log(msg);

        // Reload page to reflect changes
        window.location.reload();
    },

    /**
     * Hard delete specific stuck IDs from Nov/Dec (based on user report)
     */
    async hardDeleteNovDecGhosts() {
        const startDate = '2025-11-01';
        const endDate = '2025-12-31';

        const entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        const targets = entries.filter(e => e.date >= startDate && e.date <= endDate);

        if (targets.length === 0) {
            alert('Tidak ada jurnal di periode Nov-Dec 2025.');
            return;
        }

        const confirmed = confirm(`Ditemukan ${targets.length} jurnal di Nov-Dec 2025.\n\nAPAKAH ANDA YAKIN INGIN MENGHAPUS SEMUANYA?\nGunanya untuk membersihkan error "data bandel".\n\nData yang valid harus diinput ulang jika Anda pilih YES.`);

        if (!confirmed) return;

        // Execute
        const keepEntries = entries.filter(e => e.date < startDate || e.date > endDate);
        const deleteEntries = targets;

        // Progress
        const loadingDiv = document.createElement('div');
        loadingDiv.style.position = 'fixed';
        loadingDiv.style.top = '50%';
        loadingDiv.style.left = '50%';
        loadingDiv.style.transform = 'translate(-50%, -50%)';
        loadingDiv.style.background = 'rgba(0,0,0,0.8)';
        loadingDiv.style.color = 'white';
        loadingDiv.style.padding = '20px';
        loadingDiv.style.borderRadius = '8px';
        loadingDiv.style.zIndex = '9999';
        loadingDiv.innerHTML = `<h3>Menghapus Hantu Nov/Dec... 0/${deleteEntries.length}</h3>`;
        document.body.appendChild(loadingDiv);

        for (let i = 0; i < deleteEntries.length; i++) {
            const entry = deleteEntries[i];
            if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
                await FirebaseSync.deleteFromCloud(Storage.KEYS.JOURNAL_ENTRIES, entry.id);
            }
            loadingDiv.innerHTML = `<h3>Menghapus Hantu Nov/Dec... ${i + 1}/${deleteEntries.length}</h3>`;
        }

        await Storage.set(Storage.KEYS.JOURNAL_ENTRIES, keepEntries);

        document.body.removeChild(loadingDiv);
        alert('Pembersihan Nov/Dec Selesai. Silakan input ulang saldo awal yang benar.');
        window.location.reload();
    },

    async fixDuplicateProductionOrders() {
        const confirmed = confirm('Fitur ini akan membersihkan duplikat Production Orders secara lokal DAN di Cloud Firebase. Lanjutkan?');
        if (!confirmed) return;
        
        const orders = Storage.get(Storage.KEYS.PRODUCTION_ORDERS) || [];
        const ordersByNumber = {};
        orders.forEach(order => {
            const key = order.orderNumber || order.poNumber;
            if (!key) return;
            if (!ordersByNumber[key]) ordersByNumber[key] = [];
            ordersByNumber[key].push(order);
        });
        
        // Deduplicate lokal + pastikan ada field id
        const keepTargets = Object.values(ordersByNumber).map(group => {
            const best = group[0];
            if (!best.id) best.id = best.orderNumber;
            return best;
        });
        
        // Clean Firebase: HAPUS SEMUA lalu upload ulang yang bersih
        if (typeof window.firestore !== 'undefined' && typeof window.db !== 'undefined') {
            try {
                const { collection, getDocs, writeBatch, doc } = window.firestore;
                const snapshot = await getDocs(collection(window.db, 'productionOrders'));
                
                // Batch delete semua dokumen yang ada di Firebase
                let deleteBatch = writeBatch(window.db);
                let opCount = 0;
                
                for (const d of snapshot.docs) {
                    deleteBatch.delete(doc(window.db, 'productionOrders', d.id));
                    opCount++;
                    if (opCount >= 490) {
                        await deleteBatch.commit();
                        deleteBatch = writeBatch(window.db);
                        opCount = 0;
                    }
                }
                if (opCount > 0) await deleteBatch.commit();
                console.log(`Deleted all ${snapshot.size} old Firebase docs.`);
                
                // Upload ulang hanya data yang unik dengan id=orderNumber
                let uploadBatch = writeBatch(window.db);
                opCount = 0;
                
                for (const order of keepTargets) {
                    const docId = String(order.orderNumber).replace(/\//g, '_');
                    const docRef = doc(window.db, 'productionOrders', docId);
                    uploadBatch.set(docRef, { ...order, _syncedAt: new Date().toISOString() });
                    opCount++;
                    if (opCount >= 490) {
                        await uploadBatch.commit();
                        uploadBatch = writeBatch(window.db);
                        opCount = 0;
                    }
                }
                if (opCount > 0) await uploadBatch.commit();
                console.log(`Re-uploaded ${keepTargets.length} clean Production Orders to Firebase.`);
                
            } catch (err) {
                console.error("Firebase Cleanup Error:", err);
                alert('Terjadi error saat membersihkan Firebase: ' + err.message);
                return;
            }
        }
        
        // Simpan lokal yang sudah bersih
        localStorage.setItem(Storage.KEYS.PRODUCTION_ORDERS, JSON.stringify(keepTargets));
        alert(`✅ Selesai! Tersisa ${keepTargets.length} Production Order unik. Halaman akan dimuat ulang.`);
        window.location.reload();
    }
};

window.DataCleanup = DataCleanup;
