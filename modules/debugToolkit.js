// ==========================================
// EMERGENCY DEBUG TOOLKIT
// ==========================================
// This script is designed to run independently of the main app logic
// to provide emergency fixes when the main UI is stuck or cached.

(function () {
    console.log('🚑 Emergency Debug Toolkit Loaded');

    // 1. Force Export DataCleanup to Global Window
    if (typeof DataCleanup === 'undefined') {
        console.error('❌ DataCleanup module not loaded yet.');
    } else {
        console.log('✅ DataCleanup module is available.');
    }

    // 2. Create Floating Action Button (FAB)
    function createEmergencyButton() {
        // Remove existing if any
        const existing = document.getElementById('emergency-fix-btn');
        if (existing) existing.remove();

        const btn = document.createElement('button');
        btn.id = 'emergency-fix-btn';
        btn.innerHTML = '🧹 FIX DATA (Klik Sini)';
        btn.style.position = 'fixed';
        btn.style.bottom = '20px';
        btn.style.right = '20px';
        btn.style.zIndex = '999999';
        btn.style.padding = '15px 25px';
        btn.style.background = '#dc2626'; // Red warning color
        btn.style.color = 'white';
        btn.style.border = '4px solid white';
        btn.style.borderRadius = '50px';
        btn.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
        btn.style.fontWeight = 'bold';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '16px';
        btn.style.animation = 'pulse 2s infinite';

        // Add pulse animation style
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);

        btn.onclick = async function () {
            if (typeof DataCleanup !== 'undefined') {
                const action = prompt("Pilih Aksi:\n1. Bersihkan Duplikat Jurnal (Ketik '1')\n2. Hapus Hantu Nov/Dec (Ketik '2')\n3. Bersihkan Duplikat Production Orders (Ketik '3')");

                if (action === '1') {
                    await DataCleanup.fixDuplicateJournals();
                } else if (action === '2') {
                    await DataCleanup.hardDeleteNovDecGhosts();
                } else if (action === '3') {
                    await DataCleanup.fixDuplicateProductionOrders();
                } else {
                    alert('Batal.');
                }
            } else {
                alert('Modul DataCleanup belum dimuat. Coba refresh halaman.');
            }
        };

        document.body.appendChild(btn);
        console.log('✅ Emergency Button Injected');
    }

    // 3. Inject immediately and also on window load to be sure
    createEmergencyButton();
    window.addEventListener('load', createEmergencyButton);

    // 4. Auto-check for duplicates and warn in console
    setTimeout(() => {
        if (typeof Storage !== 'undefined' && Storage.get) {
            const entries = Storage.get('erp_journal_entries') || [];
            console.log(`📊 Total Journal Entries in Memory: ${entries.length}`);
        }
    }, 2000);

})();
