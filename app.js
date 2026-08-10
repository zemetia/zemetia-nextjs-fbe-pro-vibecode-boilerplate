// ==========================================
// ERP - Main Application
// ==========================================

// Toggle submenu function for collapsible navigation
function toggleSubmenu(event, submenuId) {
  event.preventDefault();
  event.stopPropagation();

  const submenu = document.getElementById(submenuId);
  const arrow = event.currentTarget.querySelector('.nav-arrow');

  if (submenu.style.display === 'none' || submenu.style.display === '') {
    // Close all other submenus (accordion behavior)
    document.querySelectorAll('.nav-submenu').forEach(menu => {
      if (menu.id !== submenuId) {
        menu.style.display = 'none';
        const parentLink = document.querySelector(`[onclick*="${menu.id}"]`);
        const otherArrow = parentLink?.querySelector('.nav-arrow');
        if (otherArrow) otherArrow.classList.remove('expanded');
      }
    });

    // Open this submenu
    submenu.style.display = 'block';
    arrow.classList.add('expanded');
  } else {
    // Close this submenu
    submenu.style.display = 'none';
    arrow.classList.remove('expanded');
  }
}


const App = {
  currentPage: 'dashboard',
  isSyncing: false,

  // Helper to get the correct auth module (FirebaseAuth if available, otherwise Auth)
  getAuthModule() {
    return window.FirebaseAuth || window.Auth;
  },

  async init() {
    // 🛡️ Initialize Error Handler as early as possible
    if (typeof ErrorHandler !== 'undefined') {
      ErrorHandler.init();
    }

    // ☁️ FORCE CLOUD TRANSITION: Clear legacy "Emergency Local Mode" flag
    localStorage.removeItem('erp_use_local_storage');

    // 🧹 ONE-TIME STARTUP CLEANUP: Remove corrupt/bloated localStorage collections
    // Uses a version key so it only runs once after this deployment
    const CLEANUP_VERSION = 'cleanup_v2_20260511';
    if (!sessionStorage.getItem(CLEANUP_VERSION)) {
      sessionStorage.setItem(CLEANUP_VERSION, '1');
      const keysToCheck = [
        'BOMS',                    // Storage.KEYS.BOMS
        'LEAVE_BALANCES',          // Storage.KEYS.LEAVE_BALANCES
        'erp_production_orders',   // Storage.KEYS.PRODUCTION_ORDERS
        'erp_bug_reports',         // Storage.KEYS.BUG_REPORTS
        'erp_audit_log',           // Storage.KEYS.AUDIT_LOG
      ];
      let cleaned = 0;
      keysToCheck.forEach(key => {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const data = JSON.parse(raw);
            if (Array.isArray(data) && data.length > 200) {
              localStorage.removeItem(key);
              cleaned++;
              console.log(`🧹 [Startup Cleanup] Removed bloated key '${key}' (${data.length} items)`);
            }
          }
        } catch(e) { /* ignore parse errors */ }
      });
      if (cleaned > 0) console.log(`🧹 [Startup Cleanup] Cleared ${cleaned} bloated collections. Will reload fresh from cloud.`);
    }

    // Wait for FirebaseAuth module to load
    let authModule = window.Auth;

    // If FirebaseAuth is available (from module import), use it
    if (typeof window.FirebaseAuth !== 'undefined') {
      authModule = window.FirebaseAuth;
    }

    // Check if user is authenticated
    const auth = this.getAuthModule();
    if (!auth.isAuthenticated()) {
      window.location.href = 'login.html';
      return;
    }

    const currentUser = auth.getCurrentUser();
    this.enforceSensitiveLocalDataAccess();

    // Cloud sync is handled by syncInBackground() below

    // Initialize session security monitoring (timeout + activity tracking)
    if (typeof Auth !== 'undefined' && Auth.initSessionMonitor) {
      Auth.initSessionMonitor();
    }

    // Display user info in sidebar
    this.displayUserInfo();

    // Filter sidebar based on permissions
    this.filterSidebarByPermissions();

    // ⚡ PERFORMANCE FIX: Load UI IMMEDIATELY from localStorage first
    ChartOfAccounts.loadAccounts();
    console.log(`📊 Quick load: ${ChartOfAccounts.accounts.length} accounts from localStorage`);

    // Render dashboard IMMEDIATELY (don't wait for sync)
    const userRole = currentUser ? currentUser.role : null;
    if (userRole === 'EMPLOYEE') {
      this.navigateTo('staff-dashboard');
    } else {
      this.renderDashboard();
    }

    // Setup navigation
    this.setupNavigation();

    // Initialize Support module globally for floating bug button
    if (typeof Support !== 'undefined') {
      Support.init();
    }

    // 🤖 Initialize Agent Orchestrator (Autonomous Engine)
    if (typeof AgentOrchestrator !== 'undefined') {
      AgentOrchestrator.init();
    }

    // 🔄 Sync Status Management
    this.initSyncStatus();

    // 🔄 NOW sync and WAIT (blocking for reliability)
    await this.syncInBackground(currentUser);
  },

  enforceSensitiveLocalDataAccess() {
    if (typeof Storage === 'undefined' || typeof Storage.canCurrentUserReadKey !== 'function') return;

    [Storage.KEYS.PAYROLL, Storage.KEYS.EMPLOYEES].forEach((key) => {
      if (!Storage.canCurrentUserReadKey(key)) {
        localStorage.removeItem(key);
        if (Storage.SyncGuard && Storage.SyncGuard._queue?.[key]) {
          Storage.SyncGuard.remove(key);
        }
      }
    });
  },

  initSyncStatus() {
    const updateUI = () => {
      const indicator = document.getElementById('sync-indicator');
      const icon = document.getElementById('sync-icon');
      if (!indicator || !icon) return;

      const status = window.FirebaseSync ? window.FirebaseSync.getStatus() : 'synced';

      switch (status) {
        case 'synced':
          icon.textContent = '✅';
          indicator.title = 'All data synced to cloud';
          indicator.style.opacity = '0.7';
          icon.style.animation = 'none';
          break;
        case 'syncing':
          icon.textContent = '🔄';
          indicator.title = 'Syncing to cloud...';
          indicator.style.opacity = '1';
          icon.style.display = 'inline-block';
          icon.style.animation = 'spin 1s linear infinite';
          break;
        case 'pending':
          icon.textContent = '⚠️';
          const queue = FirebaseSync.getQueue();
          indicator.title = `Cloud sync pending (${queue.length} items). Click to retry.`;
          indicator.style.opacity = '1';
          icon.style.animation = 'pulse 1s ease-in-out infinite';
          break;
      }
    };

    window.addEventListener('erp-sync-status-changed', updateUI);
    updateUI();

    // Periodically process queue every 30 seconds
    // Only if NOT using Cloud Storage (Legacy Mode)
    if (typeof Storage !== 'undefined' && !Storage.USE_CLOUD_STORAGE) {
      setInterval(() => {
        if (window.FirebaseSync) FirebaseSync.processQueue();
      }, 30000);
    }
  },

  async syncInBackground(currentUser) {
    if (this.isSyncing) return;
    
    // Using Real-time onSnapshot listeners now, so we just need to initialize them once.
    // The listeners will stay active in the background.

    this.isSyncing = true;
    if (this.currentPage === 'dashboard') this.renderDashboard();

    try {
      // Wait for Firebase Auth to properly restore session
      // This is more reliable than a fixed timeout
      let firebaseUser = null;

      if (typeof window.db !== 'undefined' && typeof window.firestore !== 'undefined' && typeof window.auth !== 'undefined') {
        // Wait for Firebase Auth state to be determined (max 3 seconds)
        firebaseUser = await new Promise((resolve) => {
          const auth = window.auth;

          // Check if already authenticated
          if (auth.currentUser) {
            console.log('✅ Firebase Auth: User already authenticated');
            resolve(auth.currentUser);
            return;
          }

          // Set up observer to wait for auth state
          const timeout = setTimeout(() => {
            console.warn('⏱️ Firebase Auth: Timeout waiting for auth state (3s)');
            resolve(null);
          }, 3000);

          // Use onAuthStateChanged to properly wait for session restoration
          const { onAuthStateChanged } = window.firestore.constructor ? {} : {};

          // Direct check with retry
          let retryCount = 0;
          const checkAuth = () => {
            if (auth.currentUser) {
              clearTimeout(timeout);
              console.log('✅ Firebase Auth: Session restored after', retryCount * 200, 'ms');
              resolve(auth.currentUser);
            } else if (retryCount < 15) { // Max 3 seconds (15 * 200ms)
              retryCount++;
              setTimeout(checkAuth, 200);
            } else {
              clearTimeout(timeout);
              console.warn('⚠️ Firebase Auth: No user after retries');
              resolve(null);
            }
          };

          // Start checking after initial delay
          setTimeout(checkAuth, 200);
        });

        if (!firebaseUser) {
          console.warn('⚠️ Firebase user not authenticated. Skipping Firestore sync, using localStorage.');
          console.warn('💡 If you see this message, try logging out and back in.');

          // ☁️ SHOW DISCONNECTED BANNER (Only for real users)
          const banner = document.getElementById('cloud-status-banner');
          const isSafety = currentUser && currentUser.role === 'GUEST_SAFETY';
          
          if (banner && !isSafety) {
            banner.style.display = 'block';
            banner.innerHTML = `⚠️ CLOUD DISCONNECTED: Your data is NOT syncing to the Cloud. <button onclick="location.reload()" style="margin-left: 10px; padding: 2px 8px; cursor: pointer; background: white; color: #ff4d4d; border: none; border-radius: 4px; font-weight: bold;">Reconnect Now</button>`;
          }

          // Set up a background check to hide the banner if they eventually re-authed
          const reauthCheck = setInterval(() => {
            if (window.auth && window.auth.currentUser) {
              if (banner) banner.style.display = 'none';
              clearInterval(reauthCheck);
              console.log('✅ [Sync] Cloud connection restored. Hiding warning banner.');
              // Trigger a background sync now that we have auth
              this.syncInBackground(currentUser);
            }
          }, 5000);

        } else {
          console.log('🔄 Syncing Firestore data before rendering dashboard...');
          console.log(`👤 Authenticated as: ${firebaseUser.email || firebaseUser.uid}`);

          // Hide banner if it was showing
          const banner = document.getElementById('cloud-status-banner');
          if (banner) banner.style.display = 'none';
        }

        const { collection, getDocs } = window.firestore;
        const db = window.db;

        // ☁️ NEW: Cloud Master Strategy with Tombstone Protection (Total Deletion)
        const syncCollection = async (collName, storageKey) => {
          if (typeof Storage.canCurrentUserReadKey === 'function' && !Storage.canCurrentUserReadKey(storageKey)) {
            localStorage.removeItem(storageKey);
            console.log(`  [Security] ${collName}: Skipping protected sync for this role`);
            return [];
          }

          // 🛡️ PERMISSION GUARD: Skip sensitive collections for non-admins
          const sensitiveCollections = ['users', 'roles', 'erp_users', 'erp_roles'];
          const userRole = currentUser ? String(currentUser.role).toUpperCase() : null;
          const isAdmin = (userRole === 'ADMIN');

          if (sensitiveCollections.includes(collName) && !isAdmin) {
            console.log(`  🛡️ ${collName}: Skipping sync (Admin only)`);
            const local = localStorage.getItem(storageKey);
            return local ? JSON.parse(local) : [];
          }

          try {
            // A. Fetch Tombstones (Records of absolute deletion) - Note: tombstones could also use onSnapshot, but getDocs is small here
            const tombstoneSnapshot = await getDocs(collection(db, 'deletedRecords'));
            const tombstones = new Set();
            tombstoneSnapshot.forEach(d => {
              const t = d.data();
              if (t.collection === collName) tombstones.add(t.docId);
            });

            // B. Fetch from Cloud using onSnapshot (REAL-TIME + CACHE = 99% QUOTA SAVINGS)
            return await new Promise((resolve, reject) => {
              if (!window._erpListeners) window._erpListeners = {};
              
              if (window._erpListeners[collName]) {
                 // Already listening, just resolve from local
                 const local = localStorage.getItem(storageKey);
                 resolve(local ? JSON.parse(local) : []);
                 return;
              }

              const unsubscribe = window.firestore.onSnapshot(collection(db, collName), 
                async (snapshot) => {
                  try {
                    const cloudData = [];
                    const zombieIds = [];

                    snapshot.forEach(doc => {
                      if (tombstones.has(doc.id)) {
                        zombieIds.push(doc.id);
                        return;
                      }
                      const item = doc.data();
                      delete item._syncedAt;
                      cloudData.push(item);
                    });

            // C. Cleanup Zombies (Delete survivors from Cloud collection permanently)
            if (zombieIds.length > 0) {
              const { writeBatch, doc: firestoreDoc } = window.firestore;
              const batch = writeBatch(db);
              zombieIds.forEach(id => batch.delete(firestoreDoc(db, collName, id)));
              await batch.commit();
              console.log(`  🧹 ${collName}: Cleaned up ${zombieIds.length} zombie records.`);
            }

            // D. Intelligent Merge (Prevent destructive overwrite)
            // Strategy: 
            // 1. Trust Cloud for items that exist there.
            // 2. Preserve Local items that are NOT in Cloud and NOT tombstones (unsynced).

            const isObject = (storageKey === Storage.KEYS.CONFIG ||
              storageKey === Storage.KEYS.ACCOUNT_MAPPING ||
              storageKey === Storage.KEYS.TRANSACTION_COUNTERS ||
              storageKey === Storage.KEYS.WAREHOUSE_STOCK);

            let localData = localStorage.getItem(storageKey);
            try {
              localData = localData ? JSON.parse(localData) : (isObject ? {} : []);
            } catch (e) {
              localData = isObject ? {} : [];
            }

            if (isObject) {
              // For objects (Config/Mapping), we generally trust cloud if it has data
              if (cloudData.length > 0) {
                const finalData = cloudData[0].value !== undefined ? cloudData[0].value : cloudData[0];
                localStorage.setItem(storageKey, JSON.stringify(finalData));
                console.log(`  ✅ ${collName}: Cloud -> Local Sync (Object)`);
                return finalData;
              }
              return localData;
            }

            // 🛡️ CORRUPTION DEFENSE: If we expect an array but got an object, reset to empty array
            // This prevents "localData.forEach is not a function" errors
            if (!Array.isArray(localData)) {
              console.warn(`🚨 [CORRUPTION-FIX] ${collName}: Local data was NOT an array. Resetting to [].`);
              localData = [];
            }

            // For arrays (Transactions, Master Data)
            // Firebase Firestore with persistentLocalCache already includes offline data
            // in the cloudData snapshot. So we treat Cloud as the single source of truth.
            const finalData = cloudData;

            try {
              localStorage.setItem(storageKey, JSON.stringify(finalData));
            } catch (e) {
              if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.warn(`  ⚠️ ${collName}: Quota exceeded, skipping local cache (${finalData.length} items).`);
              } else {
                throw e;
              }
            }

            console.log(`  ✅ ${collName}: Cloud Authoritative Sync (${finalData.length} items)`);
            
            // Resolve the promise on the first snapshot so App can finish booting
            if (!window._erpListeners[collName].resolved) {
                window._erpListeners[collName].resolved = true;
                resolve(finalData);
            } else {
                // For real-time updates after boot, refresh UI
                window.dispatchEvent(new CustomEvent('erp-sync-status-changed'));
            }

          } catch (err) {
             reject(err);
          }
        }, (err) => reject(err));
        
        window._erpListeners[collName] = { unsubscribe, resolved: false };
      });

          } catch (err) {
            if (err.message && err.message.includes('Missing or insufficient permissions')) {
              console.error(`  ⛔ PERMISSION DENIED: Failed to sync '${collName}'. Check Firestore Rules.`);
            } else if (err.name === 'QuotaExceededError' || err.code === 22 || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || (err.message && err.message.includes('quota'))) {
              console.warn(`  ⚠️ Could not sync ${collName} (Quota Exceeded):`, err.message);
              if (window.showToast && !window._quotaWarned) {
                window.showToast('Memori lokal penuh! Sebagian data terbaru mungkin tidak tampil.', 'warning');
                window._quotaWarned = true; // prevent spamming toast
              }
            } else {
              console.warn(`  ⚠️ Could not sync ${collName}:`, err.message);
            }
            const local = localStorage.getItem(storageKey);
            return local ? JSON.parse(local) : [];
          }
        };

        // Sync ALL critical data with sorting to ensure UI consistency
        const syncAndSort = async (collName, storageKey, sortKey = 'code') => {
          const data = await syncCollection(collName, storageKey);
          if (data && Array.isArray(data) && data.length > 0) {
            
            // 🔥 AUTO-HEAL: Aggressive Deduplication for Production Orders
            // Cleans up memory arrays locally if they somehow got duplicated by sync ghosts
            if (storageKey === 'erp_production_orders') {
                const uniqueOrders = new Map();
                data.forEach(order => {
                    const key = order.orderNumber;
                    if (key) {
                        uniqueOrders.set(key, order);
                    }
                });
                if (uniqueOrders.size < data.length) {
                    const deduplicatedData = Array.from(uniqueOrders.values());
                    data.length = 0;
                    data.push(...deduplicatedData);
                    console.log(`🧹 Fixed duplicates in ${collName}. Unique items: ${data.length}`);
                }
            }

            data.sort((a, b) => {
              const valA = String(a[sortKey] || '').toLowerCase();
              const valB = String(b[sortKey] || '').toLowerCase();
              return valA.localeCompare(valB, undefined, { numeric: true });
            });
            localStorage.setItem(storageKey, JSON.stringify(data));
          }
          return data;
        };

        // Only attempt sync if Firebase user is authenticated
        if (firebaseUser) {
          console.log('🔄 Starting parallel Firestore sync...');
          const syncStart = Date.now();
          const syncPromise = Promise.all([
            syncAndSort('chartOfAccounts', Storage.KEYS.CHART_OF_ACCOUNTS, 'code'),
            syncAndSort('journalEntries', Storage.KEYS.JOURNAL_ENTRIES, 'date'),
            syncAndSort('suppliers', Storage.KEYS.SUPPLIERS, 'name'),
            syncAndSort('customers', Storage.KEYS.CUSTOMERS, 'name'),
            syncAndSort('bankAccounts', Storage.KEYS.BANK_ACCOUNTS, 'bankName'),
            syncAndSort('items', Storage.KEYS.ITEMS, 'code'),
            syncAndSort('warehouses', Storage.KEYS.WAREHOUSES, 'code'),
            syncAndSort('taxes', Storage.KEYS.TAXES, 'code'),
            syncAndSort('productionBatches', Storage.KEYS.PRODUCTION_BATCHES, 'createdAt'),
            syncAndSort('paymentVouchers', Storage.KEYS.PAYMENT_VOUCHERS, 'voucherNumber'),
            syncAndSort('receiptVouchers', Storage.KEYS.RECEIPT_VOUCHERS, 'voucherNumber'),
            syncAndSort('purchaseRequisitions', Storage.KEYS.PURCHASE_REQUISITIONS, 'prNumber'),
            syncAndSort('purchaseOrders', Storage.KEYS.PURCHASE_ORDERS, 'poNumber'),
            syncAndSort('salesOrders', Storage.KEYS.SALES_ORDERS, 'soNumber'),
            syncAndSort('quotations', Storage.KEYS.QUOTATIONS, 'quotationNumber'),
            syncAndSort('goodsReceipts', Storage.KEYS.GOODS_RECEIPTS, 'grNumber'),
            syncAndSort('ttbDocuments', Storage.KEYS.TTB_DOCUMENTS, 'ttbNumber'),
            syncAndSort('supplierInvoices', Storage.KEYS.SUPPLIER_INVOICES, 'invoiceNumber'),
            syncAndSort('goldDustRecovery', Storage.KEYS.GOLD_DUST_RECOVERY, 'date'),
            syncAndSort('goldTransactions', Storage.KEYS.GOLD_TRANSACTIONS, 'date'),
            syncAndSort('users', Storage.KEYS.USERS, 'username'),
            syncAndSort('roles', Storage.KEYS.ROLES, 'roleCode'),
            Storage.canCurrentUserReadKey(Storage.KEYS.EMPLOYEES) ? syncAndSort('employees', Storage.KEYS.EMPLOYEES, 'id') : Promise.resolve([]),
            syncAndSort('attendance', Storage.KEYS.ATTENDANCE, 'date'),
            Storage.canCurrentUserReadKey(Storage.KEYS.PAYROLL) ? syncAndSort('payroll', Storage.KEYS.PAYROLL, 'period') : Promise.resolve([]),
            Storage.canCurrentUserReadKey(Storage.KEYS.PAYROLL) ? syncAndSort('payrollWorkdays', Storage.KEYS.PAYROLL_WORKDAYS, 'period') : Promise.resolve([]),
            Storage.canCurrentUserReadKey(Storage.KEYS.PAYROLL) ? syncAndSort('payrollWorkdaysAudit', Storage.KEYS.PAYROLL_WORKDAYS_AUDIT, 'timestamp') : Promise.resolve([]),
            syncAndSort('directSwaps', Storage.KEYS.DIRECT_SWAPS, 'date'),
            syncAndSort('kycRecords', Storage.KEYS.KYC_RECORDS, 'id'),
            syncAndSort('paymentTerms', Storage.KEYS.PAYMENT_TERMS, 'code'),
            syncAndSort('departments', Storage.KEYS.DEPARTMENTS, 'code'),
            syncAndSort('productionOrders', Storage.KEYS.PRODUCTION_ORDERS, 'orderNumber'),
            syncAndSort('fixedAssets', Storage.KEYS.FIXED_ASSETS, 'name'),
            syncAndSort('checksGiro', Storage.KEYS.CHECKS_GIRO, 'id'),
            syncAndSort('paymentSchedules', Storage.KEYS.PAYMENT_SCHEDULES, 'id'),
            syncAndSort('labTests', Storage.KEYS.LAB_TESTS, 'id'),
            syncAndSort('supplierReturns', Storage.KEYS.SUPPLIER_RETURNS, 'id'),
            syncAndSort('stockCards', Storage.KEYS.STOCK_CARDS, 'id'),
            syncAndSort('warehouseStock', Storage.KEYS.WAREHOUSE_STOCK, 'id'),
            syncAndSort('warehouseStockMovements', Storage.KEYS.WAREHOUSE_STOCK_MOVEMENTS, 'id'),
            // auditLog excluded from startup sync (grows large, not needed for UI render)
            syncAndSort('jobOrders', Storage.KEYS.JOB_ORDERS, 'id'),
            // Note: auditLog & bug_reports excluded from startup sync (large, non-critical for UI)
            syncAndSort('boms', Storage.KEYS.BOMS, 'id'),
            syncAndSort('electrolysisLogs', Storage.KEYS.ELECTROLYSIS_LOGS, 'id'),
            syncAndSort('qcLogs', Storage.KEYS.QC_LOGS, 'id'),
            syncAndSort('leaveRequests', Storage.KEYS.LEAVE_REQUESTS, 'id'),
            syncAndSort('leaveBalances', Storage.KEYS.LEAVE_BALANCES, 'id'),
            syncAndSort('packaging', Storage.KEYS.PACKAGING, 'id'),
            syncAndSort('serializedItems', Storage.KEYS.SERIALIZED_ITEMS, 'id'),
            syncCollection('accountMapping', Storage.KEYS.ACCOUNT_MAPPING),
            syncCollection('config', Storage.KEYS.CONFIG),
            syncCollection('config', Storage.KEYS.TRANSACTION_COUNTERS),
            syncCollection('bug_reports', Storage.KEYS.BUG_REPORTS),
            syncCollection('erp_master_shifts', Storage.KEYS.MASTER_SHIFTS),
            syncCollection('erp_work_calendar', Storage.KEYS.WORK_CALENDAR)
          ]);

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Sync timeout')), 10000)
          );

          await Promise.race([syncPromise, timeoutPromise]);

          console.log(`✅ Firestore sync completed in ${Date.now() - syncStart}ms`);
          sessionStorage.setItem('erp_last_bg_sync', Date.now().toString());
          
          // 🔧 SELF-HEALING: Repair transaction counters using synced data
          console.log('🔧 Verifying and repairing transaction counters...');
          await Storage.recalculateCounters(true); // true = sync to cloud if local found drift
          console.log('✅ Counter verification complete.');
        } else {
          console.log('⏭️  Skipped Firestore sync - using localStorage data');
        }
      } else {
        console.warn('⚠️ Firebase not loaded, skipping sync. Using localStorage data.');
      }
    } catch (error) {
      console.warn('⚠️ Firestore sync error:', error.message);
      console.warn('💡 Application will continue using localStorage data.');
      console.warn('💡 If you continue to see sync errors, try:');
      console.warn('   1. Logging out and back in');
      console.warn('   2. Clearing browser cache');
      console.warn('   3. Checking your internet connection');
    } finally {
      this.isSyncing = false;
    }

    // Initialize Core Modules
    if (typeof GoldSavings !== 'undefined') GoldSavings.init();
    if (typeof MasterPurity !== 'undefined') MasterPurity.init();
    if (typeof MasterRefiningRules !== 'undefined') MasterRefiningRules.init();
    if (typeof LivePriceService !== 'undefined') LivePriceService.init();

    // **IMPORTANT: Load chart of accounts AFTER sync completes**
    ChartOfAccounts.loadAccounts();

    // 🔄 REFRESH CURRENT MODULE: Ensure UI updates with fresh cloud data
    this.refreshCurrentModule();

    // 🧹 AUTO-CLEANUP: Permanent purge of dummy supplier SUPP-006 requested by user
    (async () => {
      try {
        if (typeof Storage !== 'undefined' &&
            typeof Storage.getSuppliers === 'function' &&
            (!Storage.canCurrentUserWriteKey || Storage.canCurrentUserWriteKey(Storage.KEYS.SUPPLIERS))) {
          const allSupps = Storage.getSuppliers() || [];
          const dummySupp = allSupps.find(s => s.code === 'SUPP-006' || s.id === 'SUPP-006');
          if (dummySupp) {
            console.log('🧹 SYSTEM CLEANUP: Removing dummy supplier SUPP-006...');
            await Storage.deleteSupplier(dummySupp.id);
          }
        }
      } catch (e) { /* silent */ }
    })();

    // 🧹 AUTO-CLEANUP: Remove specific unused/duplicate POs requested by user
    (async () => {
      try {
        if (typeof Storage !== 'undefined' && Storage.KEYS && Storage.KEYS.PURCHASE_ORDERS) {
          const posToDelete = ['PO-202605-0002', 'PO-202605-0004', 'PO-202605-0005', 'PO-202606-0004', 'PO-202606-0005', 'PO-202606-0006', 'PO-202606-0007'];
          let allPos = Storage.get(Storage.KEYS.PURCHASE_ORDERS) || [];
          let changed = false;
          
          for (const id of posToDelete) {
            const exists = allPos.some(po => po.id === id || po.poNumber === id);
            if (exists) {
              allPos = allPos.filter(po => po.id !== id && po.poNumber !== id);
              changed = true;
              console.log(`🧹 SYSTEM CLEANUP: Removing PO ${id}...`);
              if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
                await FirebaseSync.deleteFromCloud(Storage.KEYS.PURCHASE_ORDERS, id);
              }
            }
          }
          if (changed) {
            await Storage.set(Storage.KEYS.PURCHASE_ORDERS, allPos);
          }
        }
      } catch (e) { console.error('Error cleaning up POs:', e); }
    })();

    // Global Migration Helper (for manual triggering)
    window.migrateData = async () => {
      if (typeof FirebaseSync === 'undefined' || !FirebaseSync.isEnabled()) {
        console.error('Firebase not available');
        return;
      }

      console.log('🚀 Starting Manual Data Migration to Cloud...');

      if (confirm('Start migration? This will upload local data to Cloud.')) {
        await FirebaseSync.migrateAllToCloud();
        alert('✅ Data migration completed!');
        location.reload();
      }
    };

    // Global Cloud Pull Helper (Cloud -> Local)
    window.pullCloudData = async () => {
      if (typeof FirebaseSync === 'undefined' || !FirebaseSync.isEnabled()) {
        console.error('Firebase not available');
        return;
      }

      console.log('🚀 Starting Data Pull (Cloud -> Local)...');

      if (confirm('⚠️ WARNING: This will OVERWRITE your local data with data from Cloud.\nAre you sure you want to proceed?')) {
        await FirebaseSync.pullAllFromCloud();
        alert('✅ Data pull completed! Page will reload.');
        location.reload();
      }
    };
    // Helper to check Cloud Stats
    window.checkCloudData = async () => {
      if (typeof FirebaseSync !== 'undefined') {
        const stats = await FirebaseSync.getCloudStats();
        console.table(stats);
        alert('📊 Cloud Check Complete! See console for details.');
      }
    };

    // **CRITICAL FIX: Recalculate counters AFTER Cloud Sync**
    // This ensures we scan the newly fetched journals to prevent JRN-000003 issue
    if (typeof Storage.recalculateCounters === 'function') {
      console.log('🔄 Post-Sync: Recalculating transaction counters...');
      Storage.recalculateCounters();
    }

    // Reload accounts after sync
    ChartOfAccounts.loadAccounts();
    console.log(`📊 Post-sync: Loaded ${ChartOfAccounts.accounts.length} accounts`);

    // **NEW: Initialize Notifications for Director**
    if (currentUser && (currentUser.role === 'DIRECTOR' || currentUser.role === 'director')) {
      console.log('🔔 Initializing notifications for Director...');

      // Initialize notification service
      if (typeof NotificationService !== 'undefined') {
        const notifEnabled = await NotificationService.init();

        if (notifEnabled) {
          console.log('✅ Notification service initialized');

          // Start risk monitoring
          if (typeof RiskMonitor !== 'undefined') {
            RiskMonitor.start();
            console.log('✅ Risk monitoring started');
          }
        } else {
          console.log('⚠️ Notifications not enabled (permission not granted or browser not supported)');
        }
      }
    }
  },

  displayUserInfo() {
    const user = this.getAuthModule().getCurrentUser();
    if (!user) return;

    const userInfoDiv = document.getElementById('user-info');
    const userNameDiv = document.getElementById('user-name');
    const userRoleDiv = document.getElementById('user-role');

    if (userInfoDiv && userNameDiv && userRoleDiv) {
      userNameDiv.textContent = user.fullName;
      userRoleDiv.textContent = `Role: ${user.role}`;
      userInfoDiv.style.display = 'block';
    }
  },

  filterSidebarByPermissions() {
    const user = this.getAuthModule().getCurrentUser();
    if (!user) return;

    // Show/hide Master User and Master Role (admin only)
    if (user.role === 'ADMIN') {
      const navUser = document.getElementById('nav-master-user');
      const navRole = document.getElementById('nav-master-role');
      if (navUser) navUser.style.display = 'block';
      if (navRole) navRole.style.display = 'block';
    }

    // For EMPLOYEE role: Hide almost everything except the essentials
    if (user.role === 'EMPLOYEE') {
      // Hide all nav sections first
      document.querySelectorAll('.nav-section').forEach(section => {
        section.style.display = 'none';
      });

      // Show the first nav section (which contains Staff Home)
      const firstSection = document.querySelector('.nav-section');
      if (firstSection) {
        firstSection.style.display = 'block';

        // Hide standard items in first section
        const navDashboard = document.getElementById('nav-dashboard');
        if (navDashboard) navDashboard.style.display = 'none';

        // Show Staff Home
        const navStaffHome = document.getElementById('nav-staff-home');
        if (navStaffHome) navStaffHome.style.display = 'block';
      }

      const userInfo = document.getElementById('user-info');
      if (userInfo) userInfo.style.display = 'block';

      return; // Exit early as we don't need the other filter logic
    }

    // Get nav elements (these were undefined before - now properly defined)
    const navCash = document.getElementById('nav-purchase-cash');
    const navCredit = document.getElementById('nav-purchase-credit');

    // Default to hidden
    if (navCash) navCash.style.display = 'none';
    if (navCredit) navCredit.style.display = 'none';

    // Allow for specific roles
    const allowedRoles = ['ADMIN', 'director', 'manager_finance', 'finance', 'FINANCE', 'purchasing_head', 'purchasing_staff'];
    if (allowedRoles.includes(user.role)) {
      if (navCash) navCash.style.display = 'block';
      if (navCredit) navCredit.style.display = 'block';
    }
    // Show/hide Pemurnian Express & Jasa Makloon based on Role
    const navDirectSwap = document.getElementById('nav-direct-swap');
    const navMakloonService = document.getElementById('nav-makloon-service');
    
    if (navDirectSwap) {
      const allowedDirectSwap = ['ADMIN', 'OWNER', 'DIRECTOR', 'DIREKTUR', 'MANAGER_FINANCE'];
      navDirectSwap.style.display = allowedDirectSwap.includes(user.role?.toUpperCase()) ? 'block' : 'none';
    }
    
    if (navMakloonService) {
      const allowedMakloon = ['ADMIN', 'OWNER', 'DIRECTOR', 'DIREKTUR', 'MANAGER_FINANCE', 'FINANCE', 'PURCHASING_HEAD', 'PURCHASING_STAFF'];
      navMakloonService.style.display = allowedMakloon.includes(user.role?.toUpperCase()) ? 'block' : 'none';
    }
    // Show Inventory vs Custody for ADMIN, DIRECTOR, and PRODUCTION roles
    const navCustody = document.getElementById('nav-inventory-custody');
    if (navCustody) {
      if (['ADMIN', 'DIRECTOR', 'PRODUCTION', 'PRODUCTION_HEAD', 'MANAGER_FINANCE'].includes(user.role)) {
        navCustody.style.display = 'block';
      } else {
        navCustody.style.display = 'none';
      }
    }

    // Role-based visibility for Lab modules
    const navLabQuality = document.getElementById('nav-lab-quality-test');
    const navYieldAnalysis = document.getElementById('nav-yield-analysis');

    // Lab Quality Test: Visible to ADMIN, OWNER, DIREKTUR, PRODUCTION, and LAB
    if (navLabQuality) {
      const allowedLabQuality = ['ADMIN', 'OWNER', 'DIREKTUR', 'PRODUCTION', 'PRODUCTION_HEAD', 'LAB', 'LAB_TECH'];
      navLabQuality.style.display = allowedLabQuality.includes(user.role?.toUpperCase()) ? 'block' : 'none';
    }

    // Yield Analysis: STRICTLY OWNER, DIREKTUR, and ADMIN only
    if (navYieldAnalysis) {
      const allowedYieldAnalysis = ['ADMIN', 'OWNER', 'DIREKTUR'];
      navYieldAnalysis.style.display = allowedYieldAnalysis.includes(user.role?.toUpperCase()) ? 'block' : 'none';
    }

    // Role-based visibility for Payroll (Gaji) & Simulasi Payroll
    const navPayroll = document.getElementById('nav-payroll');
    const navPayrollSim = document.getElementById('nav-payroll-simulation');
    const canAccessPayroll = typeof Storage !== 'undefined' && typeof Storage.canCurrentUserReadKey === 'function' && Storage.canCurrentUserReadKey('erp_payroll');
    
    if (navPayroll) navPayroll.style.display = canAccessPayroll ? 'block' : 'none';
    if (navPayrollSim) navPayrollSim.style.display = canAccessPayroll ? 'block' : 'none';
  },

  setupNavigation() {
    // Add click listeners to nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = e.currentTarget.dataset.page;
        const template = e.currentTarget.dataset.template; // Get template if exists
        this.navigateTo(page, template);
      });
    });
  },

  navigateTo(page, template = null) {
    // Update active nav item
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    
    if (template) {
        document.querySelector(`[data-page="${page}"][data-template="${template}"]`)?.classList.add('active');
    } else {
        document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
    }

    this.currentPage = page;

    // Route to appropriate module
    switch (page) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'client-requests':
        ClientRequests.render();
        break;
      case 'inventory-custody':
        InventoryCustodyReport.init();
        break;
      case 'simple-transaction':
        SimpleTransaction.init(template); // Pass template parameter
        break;
      case 'chart-of-accounts':
        ChartOfAccounts.init();
        break;
      case 'journal-entry':
        JournalEntry.init();
        break;
      case 'journal-report':
        JournalReport.init();
        break;
      case 'general-ledger':
        GeneralLedger.init();
        break;
      case 'balance-sheet':
        BalanceSheet.init();
        break;
      case 'income-statement':
        IncomeStatement.init();
        break;
      case 'cash-flow':
        CashFlow.init();
        break;
      case 'master-supplier':
        MasterSupplier.init();
        break;
      case 'master-customer':
        MasterCustomer.init();
        break;
      case 'master-warehouse':
        MasterWarehouse.init();
        break;
      case 'master-item':
        MasterItem.init();
        break;
      case 'master-tax':
        MasterTax.init();
        break;
      case 'master-karat':
        MasterKaratUI.init();
        break;
      case 'master-bank':
        MasterBank.init();
        break;
      case 'master-payment-terms':
        MasterPaymentTerms.init();
        break;
      case 'master-department':
        MasterDepartment.init();
        break;
      case 'master-user':
        MasterUser.init();
        break;
      case 'master-role':
        MasterRole.init();
        break;
      case 'master-employee':
        MasterEmployee.init();
        break;
      case 'master-shift':
        MasterShift.init();
        break;
      case 'work-calendar':
        WorkCalendar.init();
        break;
      case 'attendance':
        Attendance.init();
        break;

      case 'payroll':
        Payroll.init();
        break;
      case 'payroll-simulation':
        PayrollSimulation.init();
        break;
      case 'leave-management':
        LeaveManagement.render();
        break;
      case 'production-log':
        ProductionLog.init();
        break;
      case 'change-password':
        ChangePassword.init();
        break;
      case 'reports-menu':
        ReportsMenu.init();
        break;
      case 'receiving-report':
        ReceivingReport.init();
        break;
      case 'stock-card':
        StockCard.init();
        break;
      case 'stock-position':
        StockPosition.init();
        break;
      case 'gold-balance-report':
        GoldBalanceReport.init();
        break;
      case 'ar-aging':
        ARAging.init();
        break;
      case 'ap-aging':
        APAging.init();
        break;
      case 'sales-register':
        SalesRegister.init();
        break;
      case 'purchase-register':
        PurchaseRegister.init();
        break;
      case 'lab-test-register':
        LabTestRegister.init();
        break;
      case 'inventory-valuation':
        InventoryValuation.init();
        break;
      case 'customer-balance':
        CustomerBalance.init();
        break;
      case 'supplier-balance':
        SupplierBalance.init();
        break;
      case 'production-wip':
        ProductionWIP.init();
        break;
      case 'sales-by-customer':
        SalesByCustomer.init();
        break;
      case 'purchase-by-supplier':
        PurchaseBySupplier.init();
        break;
      case 'bank-reconciliation':
        BankReconciliation.init();
        break;
      case 'stock-movement':
        StockMovementSummary.init();
        break;
      case 'sales-by-item':
        SalesByItem.init();
        break;
      case 'purchase-by-item':
        PurchaseByItem.init();
        break;
      case 'cash-book':
        CashBook.init();
        break;
      case 'bank-book':
        BankBook.init();
        break;
      case 'slow-moving-items':
        SlowMovingItems.init();
        break;
      case 'stock-in-report':
        StockInReport.init();
        break;
      case 'stock-out-report':
        StockOutReport.init();
        break;
      case 'production-order':
        ProductionOrder.init();
        break;
      case 'job-orders':
        JobOrder.render();
        break;
      case 'production-batches':
        ProductionBatch.render();
        break;
      case 'bom-management':
        BOMManagement.init();
        break;
      case 'production-detail':
        // Will be called from ProductionOrder.viewDetail()
        break;
      case 'gold-dust-recovery':
        GoldDustRecovery.init();
        break;
      case 'refinery-kpi':
        RefineryKPI.init();
        break;
      case 'refinery-forms':
        RefineryForms.init();
        break;
      case 'stock-opening-balance':
        StockOpeningBalance.init();
        break;
      case 'production-orders-report':
        ProductionOrdersReport.init();
        break;
      case 'production-yield-report':
        ProductionYieldReport.init();
        break;
      case 'production-cost-report':
        ProductionCostReport.init();
        break;
      case 'ai-advisor':
        AIAdvisor.init();
        break;
      case 'whatsapp-bot':
        if (typeof WhatsAppBot !== 'undefined') {
          WhatsAppBot.init();
          WhatsAppBot.render();
        }
        break;
      case 'purchase-order':
        PurchaseOrder.init();
        document.getElementById('main-content').innerHTML = PurchaseOrder.render();
        break;
      case 'sales-order':
        SalesOrder.init();
        document.getElementById('main-content').innerHTML = SalesOrder.render();
        break;
      case 'packaging':
        if (typeof Packaging !== 'undefined') {
          Packaging.render();
        }
        break;
      case 'quotation':
        Quotation.init();
        document.getElementById('main-content').innerHTML = Quotation.render();
        break;
      case 'fixed-assets':
        FixedAssets.init();
        document.getElementById('main-content').innerHTML = FixedAssets.render();
        break;
      case 'audit-log':
        AuditLog.init();
        document.getElementById('main-content').innerHTML = AuditLog.render();
        break;
      case 'payment-voucher':
        PaymentVoucher.init();
        break;
      case 'receipt-voucher':
        ReceiptVoucher.init();
        break;
      case 'customer-kyc':
        CustomerKYC.init();
        break;
      case 'kyc-assessment':
        KYCAssessment.init();
        break;
      case 'purchase-requisition':
        PurchaseRequisition.init();
        break;
      case 'goods-receipt':
        GoodsReceipt.init();
        GoodsReceipt.render();
        break;
      case 'ttb':
        TTB.init();
        TTB.render();
        break;
      case 'direct-swap':
        DirectSwap.init();
        DirectSwap.render();
        break;
      case 'makloon-service':
        if (typeof MakloonService !== 'undefined') {
          MakloonService.init();
          MakloonService.render();
        }
        break;
      case 'lab-quality-test':
        LabQualityTest.init();
        LabQualityTest.render();
        break;
      case 'yield-analysis':
        YieldAnalysis.init();
        YieldAnalysis.render();
        break;
      case 'client-calculator':
        ClientCalculator.init();
        break;
      case 'swap-analysis':
        SwapAnalysis.init();
        break;
      case 'reorder-system':
        ReorderSystem.init();
        break;
      case 'settings':
        Settings.init();
        break;
      case 'support':
        Support.init();
        Support.render();
        break;
      case 'staff-dashboard':
        StaffDashboard.init();
        break;
      case 'crm-prospect':
        CRMProspect.init();
        break;
      case 'crm-sales-target':
        CRMSalesTarget.init();
        break;
      default:
        // Default based on role
        const currentUser = this.getAuthModule().getCurrentUser();
        if (currentUser && currentUser.role === 'EMPLOYEE') {
          StaffDashboard.init();
        } else {
          this.renderDashboard();
        }
    }
  },

  refreshCurrentModule() {
    if (!this.currentPage) return;
    console.log(`🔄 Post-sync refresh for: ${this.currentPage}`);

    // Modules that need explicit, special handling
    if (this.currentPage === 'dashboard') {
      this.renderDashboard();
      return;
    }

    // Generic auto-refresh for standard modules
    // Convert kebab-case (page name) to PascalCase (module object name)
    const moduleName = this.currentPage.split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');

    const activeModule = window[moduleName];

    if (activeModule && typeof activeModule.init === 'function') {
      console.log(`  └─ Re-initializing active module: ${moduleName}`);
      activeModule.init();

      // Some modules double-render in init, some don't.
      // If they have an explicit render function and aren't exception cases, call it.
      if (typeof activeModule.render === 'function' &&
        !['purchase-order', 'sales-order', 'chart-of-accounts'].includes(this.currentPage)) {
        activeModule.render();
      }
    } else {
      console.warn(`  ⚠️ No active module found for refresh: ${this.currentPage} (expected ${moduleName})`);
    }
  },

  renderDashboard() {
    const content = document.getElementById('main-content');
    const user = this.getAuthModule().getCurrentUser();
    let entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
    const accounts = ChartOfAccounts.accounts || [];
    const config = Storage.get(Storage.KEYS.CONFIG) || {};

    // Filter entries for refinery only profile
    if (user?.reportProfile === 'refinery_only') {
      const refineryAccountPrefixes = ['412', '1172', '2112', '11301', '2142', '1163'];
      entries = entries.filter(entry => 
        entry.lines.some(line => 
          refineryAccountPrefixes.some(prefix => line.accountCode.startsWith(prefix)) ||
          (line.accountName && (line.accountName.toLowerCase().includes('refin') || line.accountName.toLowerCase().includes('jasa')))
        )
      );
    }

    console.log(`📊 renderDashboard: Using ${accounts.length} accounts`);

    // Define dates for calculation
    const today = new Date();
    const currentYear = today.getFullYear();
    const todayStr = today.toISOString().split('T')[0];
    const startOfYear = `${currentYear}-01-01`;
    const startOfTime = '2000-01-01'; // Adequate for this system

    // 1. Calculate Lifetime Stats (For Assets/Balance Sheet items)
    // We basically want "As of Today"
    let lifetimeStats = { aset: { total: 0 } };
    try {
      if (typeof BalanceSheet !== 'undefined') {
        lifetimeStats = BalanceSheet.calculateBalances(startOfTime, todayStr);
      }
    } catch (e) {
      console.error('Error calculating lifetime stats:', e);
    }

    // 2. Calculate YTD Stats (For P&L items: Revenue, Expenses)
    let ytdStats = { totalRevenue: 0, totalExpenses: 0, netIncome: 0 };
    try {
      if (typeof BalanceSheet !== 'undefined') {
        ytdStats = BalanceSheet.calculateBalances(startOfYear, todayStr);
      }
    } catch (e) {
      console.error('Error calculating YTD stats:', e);
    }

    // Assign values
    const totalAssets = lifetimeStats.aset.total || 0;

    // For P&L, we default to YTD (Year to Date) as it's standard for dashboards
    const totalRevenue = ytdStats.totalRevenue || 0;
    const totalExpenses = ytdStats.totalExpenses || 0;
    const profitLoss = ytdStats.netIncome || 0;

    console.log(`💰 Dashboard Totals (Dynamic): Assets=${totalAssets}, Revenue=${totalRevenue} (YTD), Expenses=${totalExpenses} (YTD)`);

    // Get recent transactions
    const recentTransactions = entries.slice(-5).reverse();

    content.innerHTML = `
      <div class="dashboard-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
        <div>
          <h1 class="page-title" style="margin-bottom: 8px;">
            Welcome back, ${user ? user.fullName : 'User'}! 👋
          </h1>
          <p class="page-description">${config.companyName || 'PT. Golden Alura Refineri'} - Here's your business overview today.</p>
        </div>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-secondary" onclick="window.location.reload()">
            🔄 Refresh
          </button>
          <button class="btn btn-primary" onclick="App.navigateTo('simple-transaction')">
            ➕ New Transaction
          </button>
        </div>
      </div>

      <!-- Key Metrics Grid -->
      <div class="stats-grid" style="margin-bottom: 32px;">
        <div class="stat-card" style="border-left: 4px solid #667eea;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div class="stat-label">
                Total Assets
                ${this.isSyncing ? '<span class="sync-badge">🔄 Syncing...</span>' : ''}
              </div>
              <div class="stat-value" style="${this.isSyncing ? 'opacity: 0.5;' : ''}">${this.formatCurrency(totalAssets)}</div>
              <div class="stat-change text-primary">📊 Current Position</div>
            </div>
            <div style="font-size: 2.5rem; opacity: 0.2;">💰</div>
          </div>
        </div>

        <div class="stat-card" style="border-left: 4px solid #4facfe;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div class="stat-label">
                Revenue
                ${this.isSyncing ? '<span class="sync-badge">🔄 Syncing...</span>' : ''}
              </div>
              <div class="stat-value" style="${this.isSyncing ? 'opacity: 0.5;' : ''}">${this.formatCurrency(totalRevenue)}</div>
              <div class="stat-change positive">📈 Income</div>
            </div>
            <div style="font-size: 2.5rem; opacity: 0.2;">📊</div>
          </div>
        </div>

        <div class="stat-card" style="border-left: 4px solid #f093fb;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div class="stat-label">
                Expenses
                ${this.isSyncing ? '<span class="sync-badge">🔄 Syncing...</span>' : ''}
              </div>
              <div class="stat-value" style="${this.isSyncing ? 'opacity: 0.5;' : ''}">${this.formatCurrency(totalExpenses)}</div>
              <div class="stat-change">💸 Costs</div>
            </div>
            <div style="font-size: 2.5rem; opacity: 0.2;">💸</div>
          </div>
        </div>

        <div class="stat-card" style="border-left: 4px solid ${profitLoss >= 0 ? '#43e97b' : '#f5576c'};">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div class="stat-label">Net Profit/Loss</div>
              <div class="stat-value ${profitLoss >= 0 ? 'text-success' : 'text-error'}">${this.formatCurrency(Math.abs(profitLoss))}</div>
              <div class="stat-change ${profitLoss >= 0 ? 'positive' : 'negative'}">
                ${profitLoss >= 0 ? '🟢 Profit' : '🔴 Loss'}
              </div>
            </div>
            <div style="font-size: 2.5rem; opacity: 0.2;">${profitLoss >= 0 ? '📈' : '📉'}</div>
          </div>
        </div>
      </div>

      <!-- AI Insights Widget -->
      ${typeof AIAdvisor !== 'undefined' && user?.role !== 'GUEST_SAFETY' ? AIAdvisor.renderDashboardWidget() : ''}

      <!-- Risk Assessment Dashboard (Director Only) -->
      ${typeof RiskAssessment !== 'undefined' ? RiskAssessment.renderRiskGraph(user) : ''}




      <!-- System Info -->
      <div class="card" style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);">
        <div class="card-body" style="text-align: center; padding: 24px;">
          <div style="display: inline-flex; align-items: center; gap: 16px;">
            <span style="font-size: 2rem;">⚜️</span>
            <div style="text-align: left;">
              <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 4px;">
                SAK EMKM Compliant Gold Refinery ERP
              </div>
              <div class="text-gray" style="font-size: 0.9rem;">
                Powered by ERP  |  ${entries.length} Transactions  |  Last login: ${new Date().toLocaleString('id-ID')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Initialize Risk Graph if user is Director
    if (user && (user.role === 'DIRECTOR' || user.role === 'director')) {
      setTimeout(() => {
        if (typeof RiskAssessment !== 'undefined') {
          RiskAssessment.initializeRiskGraph();
        }
      }, 100);
    }
  },

  renderRecentTransactions(entries) {
    if (entries.length === 0) {
      return `
  < div class="text-center text-gray" style = "padding: var(--spacing-2xl);" >
          <div style="font-size: 3rem; margin-bottom: var(--spacing-lg);">📝</div>
          <p style="font-size: var(--font-size-lg); margin-bottom: var(--spacing-sm);">
            Belum ada transaksi
          </p>
          <p style="margin-bottom: var(--spacing-lg);">
            Mulai dengan membuat jurnal umum pertama Anda
          </p>
          <button class="btn btn-primary" onclick="App.navigateTo('journal-entry')">
            Buat Jurnal Pertama
          </button>
        </div >
  `;
    }

    const recent = entries.slice(0, 5);
    return `
  < div class="table-container" >
    <table class="table">
      <thead>
        <tr>
          <th>Tanggal</th>
          <th>Ref</th>
          <th>Keterangan</th>
          <th class="text-right">Jumlah</th>
        </tr>
      </thead>
      <tbody>
        ${recent.map((entry, index) => `
              <tr style="cursor: pointer;" onclick="App.toggleJournalDetail('journal-${index}')" title="Click untuk lihat detail">
                <td>${this.formatDate(entry.date)}</td>
                <td><span class="badge badge-primary">${entry.reference || '-'}</span></td>
                <td>${entry.description}</td>
                <td class="text-right">${this.formatCurrency(entry.totalDebit)}</td>
              </tr>
              <tr id="journal-${index}" style="display: none;" class="detail-row">
                <td colspan="4" style="background-color: var(--color-gray-900); padding: var(--spacing-lg);">
                  <table class="table" style="margin: 0;">
                    <thead>
                      <tr>
                        <th>Akun</th>
                        <th class="text-right">Debit</th>
                        <th class="text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${entry.lines.map(line => `
                        <tr>
                          <td>${line.accountCode} - ${line.accountName}</td>
                          <td class="text-right">${line.debit > 0 ? this.formatCurrency(line.debit) : '-'}</td>
                          <td class="text-right">${line.credit > 0 ? this.formatCurrency(line.credit) : '-'}</td>
                        </tr>
                      `).join('')}
                      <tr style="font-weight: bold; border-top: 2px solid var(--color-gray-700);">
                        <td>TOTAL</td>
                        <td class="text-right">${this.formatCurrency(entry.totalDebit)}</td>
                        <td class="text-right">${this.formatCurrency(entry.totalCredit)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div style="margin-top: var(--spacing-md);">
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); App.navigateTo('journal-entry'); setTimeout(() => JournalEntry.editEntry('${entry.id}'), 100);">
                      ✏️ Edit Jurnal
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
      </tbody>
    </table>
      </div >
  ${entries.length > 5 ? `
        <div class="text-center mt-2">
          <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('journal-entry')">
            Lihat Semua Jurnal →
          </button>
        </div>
      ` : ''
      }
`;
  },

  toggleJournalDetail(id) {
    const detailRow = document.getElementById(id);
    if (detailRow) {
      const isVisible = detailRow.style.display !== 'none';
      detailRow.style.display = isVisible ? 'none' : 'table-row';
    }
  },

  renderSettings() {
    const content = document.getElementById('main-content');
    const config = Storage.get(Storage.KEYS.CONFIG) || {};

    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">⚙️ Pengaturan</h1>
        <p class="page-description">Konfigurasi sistem dan manajemen data</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">🏢 Informasi Perusahaan</h2>
        </div>
        <div class="card-body">
          <form id="settings-form" onsubmit="App.saveSettings(event)">
            <div class="form-group">
              <label class="form-label">Nama Perusahaan</label>
              <input type="text" name="companyName" class="form-input" value="${config.companyName || ''}" required>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Awal Tahun Fiskal</label>
                <input type="text" name="fiscalYearStart" class="form-input" value="${config.fiscalYearStart || '01-01'}" pattern="[0-9]{2}-[0-9]{2}" placeholder="MM-DD">
              </div>
              
              <div class="form-group">
                <label class="form-label">Mata Uang</label>
                <select name="currency" class="form-select">
                  <option value="IDR" ${config.currency === 'IDR' ? 'selected' : ''}>IDR - Rupiah Indonesia</option>
                  <option value="USD" ${config.currency === 'USD' ? 'selected' : ''}>USD - US Dollar</option>
                </select>
              </div>
            </div>

            <button type="submit" class="btn btn-primary">
              💾 Simpan Pengaturan
            </button>
          </form>
        </div>
      </div>

      <!-- Tax Configuration Section -->
      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">💰 Pengaturan Pajak</h2>
        </div>
        <div class="card-body">
          <form id="tax-settings-form" onsubmit="App.saveTaxSettings(event)">
            
            <!-- Default Tax Settings -->
            <div style="background: var(--bg-tertiary); padding: var(--spacing-lg); border-radius: var(--radius-md); margin-bottom: var(--spacing-lg);">
              <h3 style="margin-bottom: var(--spacing-md);">Default Tax Rates</h3>
              
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">PPN (Pajak Pertambahan Nilai)</label>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="number" name="ppnRate" class="form-input" 
                           value="${config.taxSettings?.ppnRate || 11}" 
                           min="0" max="100" step="0.1" 
                           style="width: 100px;">
                    <span>%</span>
                  </div>
                </div>
                
                <div class="form-group">
                  <label class="form-label">PPh (Pajak Penghasilan)</label>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="number" name="pphRate" class="form-input" 
                           value="${config.taxSettings?.pphRate || 2}" 
                           min="0" max="100" step="0.1" 
                           style="width: 100px;">
                    <span>%</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Auto-Apply Tax for Purchases -->
            <div style="background: var(--bg-tertiary); padding: var(--spacing-lg); border-radius: var(--radius-md); margin-bottom: var(--spacing-lg);">
              <h3 style="margin-bottom: var(--spacing-md);">🛒 Pembelian (Purchase)</h3>
              
              <div class="form-group">
                <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                  <input type="checkbox" name="purchaseAutoApplyPPN" 
                         ${config.taxSettings?.purchaseAutoApplyPPN ? 'checked' : ''}
                         style="width: 20px; height: 20px; cursor: pointer;">
                  <div>
                    <strong>Auto-apply PPN untuk Pembelian</strong>
                    <p class="text-gray" style="margin: 4px 0 0 0; font-size: 0.9rem;">
                      PPN akan otomatis ditambahkan ke semua transaksi pembelian
                    </p>
                  </div>
                </label>
              </div>

              <div class="form-group">
                <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                  <input type="checkbox" name="purchaseAutoApplyPPh" 
                         ${config.taxSettings?.purchaseAutoApplyPPh ? 'checked' : ''}
                         style="width: 20px; height: 20px; cursor: pointer;">
                  <div>
                    <strong>Auto-apply PPh untuk Pembelian</strong>
                    <p class="text-gray" style="margin: 4px 0 0 0; font-size: 0.9rem;">
                      PPh dipotong otomatis dari transaksi pembelian (withholding tax)
                    </p>
                  </div>
                </label>
              </div>

              <div class="form-group">
                <label class="form-label">Default Tax Account - PPN Pembelian</label>
                <select name="purchasePPNAccount" class="form-select">
                  <option value="">-- Pilih Account --</option>
                  ${ChartOfAccounts.accounts.filter(a => a.type === 'detail').map(acc => `
                    <option value="${acc.code}" ${config.taxSettings?.purchasePPNAccount === acc.code ? 'selected' : ''}>
                      ${acc.code} - ${acc.name}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>

            <!-- Auto-Apply Tax for Sales -->
            <div style="background: var(--bg-tertiary); padding: var(--spacing-lg); border-radius: var(--radius-md); margin-bottom: var(--spacing-lg);">
              <h3 style="margin-bottom: var(--spacing-md);">💰 Penjualan (Sales)</h3>
              
              <div class="form-group">
                <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                  <input type="checkbox" name="salesAutoApplyPPN" 
                         ${config.taxSettings?.salesAutoApplyPPN ? 'checked' : ''}
                         style="width: 20px; height: 20px; cursor: pointer;">
                  <div>
                    <strong>Auto-apply PPN untuk Penjualan</strong>
                    <p class="text-gray" style="margin: 4px 0 0 0; font-size: 0.9rem;">
                      PPN akan otomatis ditambahkan ke semua transaksi penjualan
                    </p>
                  </div>
                </label>
              </div>

              <div class="form-group">
                <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                  <input type="checkbox" name="salesAutoApplyPPh" 
                         ${config.taxSettings?.salesAutoApplyPPh ? 'checked' : ''}
                         style="width: 20px; height: 20px; cursor: pointer;">
                  <div>
                    <strong>Auto-apply PPh untuk Penjualan</strong>
                    <p class="text-gray" style="margin: 4px 0 0 0; font-size: 0.9rem;">
                      PPh dipotong otomatis dari transaksi penjualan (withholding tax)
                    </p>
                  </div>
                </label>
              </div>

              <div class="form-group">
                <label class="form-label">Default Tax Account - PPN Penjualan</label>
                <select name="salesPPNAccount" class="form-select">
                  <option value="">-- Pilih Account --</option>
                  ${ChartOfAccounts.accounts.filter(a => a.type === 'detail').map(acc => `
                    <option value="${acc.code}" ${config.taxSettings?.salesPPNAccount === acc.code ? 'selected' : ''}>
                      ${acc.code} - ${acc.name}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>

            <!-- Tax Calculation Method -->
            <div style="background: var(--bg-tertiary); padding: var(--spacing-lg); border-radius: var(--radius-md); margin-bottom: var(--spacing-lg);">
              <h3 style="margin-bottom: var(--spacing-md);">⚙️ Metode Perhitungan</h3>
              
              <div class="form-group">
                <label class="form-label">Tax Calculation Method</label>
                <select name="taxCalculationMethod" class="form-select">
                  <option value="exclusive" ${config.taxSettings?.taxCalculationMethod === 'exclusive' ? 'selected' : ''}>
                    Exclusive (Pajak ditambahkan ke harga)
                  </option>
                  <option value="inclusive" ${config.taxSettings?.taxCalculationMethod === 'inclusive' ? 'selected' : ''}>
                    Inclusive (Pajak sudah termasuk dalam harga)
                  </option>
                </select>
                <p class="text-gray" style="margin-top: 8px; font-size: 0.9rem;">
                  <strong>Exclusive:</strong> Harga 100rb + PPN 11% = Total 111rb<br>
                  <strong>Inclusive:</strong> Total 100rb (sudah termasuk PPN)
                </p>
              </div>
            </div>

            <div class="alert alert-info" style="margin-bottom: var(--spacing-lg);">
              <strong>ℹ️ Catatan:</strong><br>
              - Pengaturan ini akan diterapkan secara default pada transaksi baru<br>
              - User masih bisa mengubah manual saat input transaksi<br>
              - Perubahan tidak mempengaruhi transaksi yang sudah ada
            </div>

            <button type="submit" class="btn btn-primary">
              💾 Simpan Pengaturan Pajak
            </button>
          </form>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">💾 Backup & Restore</h2>
        </div>
        <div class="card-body">
          <p class="text-gray mb-2">
            Export dan import data untuk backup atau transfer ke perangkat lain.
          </p>
          
          <div class="btn-group">
            <button class="btn btn-success" onclick="Storage.exportData()">
              📥 Export Data
            </button>
            <button class="btn btn-secondary" onclick="document.getElementById('import-file').click()">
              📤 Import Data
            </button>
          </div>
          
          <input type="file" id="import-file" accept=".json" style="display: none;" onchange="App.handleImport(event)">
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title text-error">⚠️ Danger Zone</h2>
        </div>
        <div class="card-body">
          <p class="text-gray mb-2">
            ⚠️ Tindakan ini akan menghapus semua data dan tidak dapat dibatalkan.
          </p>
          
          <button class="btn btn-danger" onclick="App.clearAllData()">
            🗑️ Hapus Semua Data
          </button>
        </div>
      </div>
`;
  },

  saveSettings(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    const config = Storage.get(Storage.KEYS.CONFIG) || {};

    config.companyName = formData.get('companyName');
    config.fiscalYearStart = formData.get('fiscalYearStart');
    config.currency = formData.get('currency');

    Storage.set(Storage.KEYS.CONFIG, config);
    this.showAlert('success', 'Pengaturan berhasil disimpan');

    // Refresh dashboard
    setTimeout(() => this.navigateTo('dashboard'), 1000);
  },

  saveTaxSettings(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    const config = Storage.get(Storage.KEYS.CONFIG) || {};

    config.taxSettings = {
      // Tax Rates
      ppnRate: parseFloat(formData.get('ppnRate')) || 11,
      pphRate: parseFloat(formData.get('pphRate')) || 2,

      // Purchase Auto-Apply
      purchaseAutoApplyPPN: formData.get('purchaseAutoApplyPPN') === 'on',
      purchaseAutoApplyPPh: formData.get('purchaseAutoApplyPPh') === 'on',
      purchasePPNAccount: formData.get('purchasePPNAccount') || '',

      // Sales AutoApply
      salesAutoApplyPPN: formData.get('salesAutoApplyPPN') === 'on',
      salesAutoApplyPPh: formData.get('salesAutoApplyPPh') === 'on',
      salesPPNAccount: formData.get('salesPPNAccount') || '',

      // Calculation Method
      taxCalculationMethod: formData.get('taxCalculationMethod') || 'exclusive'
    };

    Storage.set(Storage.KEYS.CONFIG, config);

    this.showAlert('success', 'Pengaturan pajak berhasil disimpan');
    this.renderSettings();
  },

  async handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const success = await Storage.importData(file);
      if (success) {
        this.showAlert('success', 'Data berhasil diimport');
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (error) {
      this.showAlert('error', 'Error: ' + error.message);
    }

    // Reset file input
    event.target.value = '';
  },

  clearAllData() {
    const success = Storage.clearAll();
    if (success) {
      this.showAlert('success', 'Semua data telah dihapus');
      setTimeout(() => window.location.reload(), 1500);
    }
  },

  showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert - ${type} `;
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
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  },

  canViewSalary() {
    if (typeof Auth !== 'undefined' && typeof Auth.canViewSalary === 'function') {
      return Auth.canViewSalary();
    }
    return false;
  },

  formatSalary(amount) {
    if (!this.canViewSalary()) {
      return '🔒 •••••••• [Terproteksi]';
    }
    return this.formatCurrency(amount);
  },

  promptSalaryUnlock() {
    if (this.canViewSalary()) {
      if (confirm('🔒 Kunci kembali akses data Gaji Pokok untuk sesi ini?')) {
        if (typeof Auth !== 'undefined' && typeof Auth.lockSalaryAccess === 'function') {
          Auth.lockSalaryAccess();
        } else {
          sessionStorage.removeItem('erp_salary_unlocked');
        }
        this.showToast('🔒 Akses Gaji Pokok Dikunci Kembali.', 'info');
        this.reloadCurrentModuleView();
      }
      return;
    }

    const pin = prompt('🔐 VERIFIKASI KEAMANAN GAJI\n\nMasukkan PIN Keamanan HRD / Password Admin untuk Membuka Akses Gaji Pokok:\n(Default PIN HRD: 8888)');
    if (!pin) return;

    let res = { success: false, message: 'PIN Salah' };
    if (typeof Auth !== 'undefined' && typeof Auth.unlockSalaryAccess === 'function') {
      res = Auth.unlockSalaryAccess(pin);
    } else {
      if (['8888', 'admin123', 'demo123', 'director123'].includes(pin)) {
        sessionStorage.setItem('erp_salary_unlocked', 'true');
        res = { success: true, message: '🔓 Akses Data Gaji Pokok Berhasil Dibuka!' };
      }
    }

    if (res.success) {
      this.showToast(res.message, 'success');
      this.reloadCurrentModuleView();
    } else {
      this.showToast(res.message, 'danger');
    }
  },

  reloadCurrentModuleView() {
    if (this.currentPage === 'payroll' && window.Payroll && typeof Payroll.render === 'function') {
      Payroll.render();
    } else if (this.currentPage === 'masterEmployee' && window.MasterEmployee && typeof MasterEmployee.render === 'function') {
      MasterEmployee.render();
    } else if (this.currentPage === 'staffDashboard' && window.StaffDashboard && typeof StaffDashboard.render === 'function') {
      StaffDashboard.render();
    } else {
      window.location.reload();
    }
  },

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  },

  // Mobile sidebar toggle
  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.classList.toggle('active');
    }
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
