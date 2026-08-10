// ==========================================
// Firebase Authentication Module
// ==========================================
// Drop-in replacement for auth.js with Firebase support

import { auth } from '../firebase-config.js';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updatePassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import FirebaseStorage from '../data/firebase-storage.js';

const FirebaseAuth = {
    // ☁️ MANDATORY CLOUD AUTHENTICATION
    // Local storage authentication is disabled.
    USE_FIREBASE: true,
    STORAGE_KEY: 'erp_current_session',
    currentUser: null,

    /**
     * Initialize Firebase Auth listener
     */
    init() {
        if (!this.USE_FIREBASE) return;

        // Listen for auth state changes
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is signed in with Firebase
                await this.syncUserSession(user);
            } else {
                // User is NOT signed in with Firebase.
                // Check if we are in 'GUEST_SAFETY' mode (Manual/Local Honeypot)
                const currentSessionStr = localStorage.getItem(this.STORAGE_KEY);
                if (currentSessionStr) {
                    try {
                        const currentSession = JSON.parse(currentSessionStr);
                        if (currentSession && currentSession.role === 'GUEST_SAFETY') {
                            console.log('🛡️ Preserving Safety Mode Session (Not synced with Firebase)');
                            this.currentUser = currentSession;
                            return; // DO NOT CLEAR
                        }
                    } catch (e) { /* ignore parse error */ }
                }

                // If not safety mode and no firebase user, then truly clear session
                this.currentUser = null;
                localStorage.removeItem(this.STORAGE_KEY);
            }
        });
    },

    /**
     * Sync Firebase user with local session
     */
    async syncUserSession(firebaseUser) {
        try {
            // Get user data from Firestore using email
            const userData = await FirebaseStorage.query('erp_users', [
                { field: 'email', operator: '==', value: firebaseUser.email }
            ]);

            let user;

            if (!userData || userData.length === 0) {
                // User document doesn't exist in Firestore - create it!
                console.log('User document not found. Creating new document for:', firebaseUser.email);

                const newUser = {
                    id: firebaseUser.uid,
                    username: firebaseUser.email.split('@')[0],
                    email: firebaseUser.email,
                    fullName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                    role: 'ADMIN', // First users are admins
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    mustChangePassword: false
                };

                try {
                    await FirebaseStorage.save('erp_users', newUser);
                    console.log('✓ User document created successfully with UID:', firebaseUser.uid);
                } catch (createErr) {
                    console.warn('Could not create user document in Firestore:', createErr.message);
                }
                user = newUser;
            } else {
                user = userData[0];

                // MIGRATION: If found user has a different ID than firebase uid, migrate it
                if (user.id !== firebaseUser.uid) {
                    console.warn(`⚠️ User document ID mismatch (Current: ${user.id}, Expect: ${firebaseUser.uid}). Migrating...`);

                    const migratedUser = {
                        ...user,
                        id: firebaseUser.uid,
                        _originalId: user.id,
                        _migratedAt: new Date().toISOString()
                    };

                    try {
                        // Save new document with correct UID
                        await FirebaseStorage.save('erp_users', migratedUser);
                        console.log('✓ Migrated user document to new UID-based document');
                        user = migratedUser;
                    } catch (migrationErr) {
                        // Migration failed (e.g. permission error for non-admin users on first login)
                        // This is non-fatal: we still build the session from the EXISTING user data.
                        // Next login attempt after admin fixes the document will succeed normally.
                        console.warn('⚠️ Could not migrate user document (non-fatal), using existing data:', migrationErr.message);
                        // Keep user as-is from the existing Firestore document
                    }
                }
            }

            const loginTime = new Date().toISOString();
            const sessionNonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
            const userRole = user.role || 'USER';
            const username = user.username || firebaseUser.email.split('@')[0];
            const pwdHash = user.passwordHash || firebaseUser.uid;

            const sessionSig = (window.Auth && typeof window.Auth.generateSessionSignature === 'function')
                ? window.Auth.generateSessionSignature(username, userRole, loginTime, pwdHash)
                : `SIG_${username}_${userRole}_${sessionNonce}`;

            const session = {
                id: user.id || firebaseUser.uid,
                username: username,
                name: user.fullName || firebaseUser.displayName || firebaseUser.email,
                fullName: user.fullName || firebaseUser.displayName || firebaseUser.email,
                email: user.email,
                role: userRole,
                loginTime: loginTime,
                sessionNonce: sessionNonce,
                sessionSig: sessionSig,
                mustChangePassword: user.mustChangePassword || false,
                firebaseUid: firebaseUser.uid
            };

            this.currentUser = session;
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
            console.log('✓ User session synced successfully');
        } catch (error) {
            console.error('Error syncing user session:', error);
        }
    },

    /**
     * Login with Firebase Authentication
     */
    async login(usernameOrEmail, password) {
        // ☁️ FORCE CLOUD TRANSITION: Clear legacy "Emergency Local Mode" flag
        localStorage.removeItem('erp_use_local_storage');

        if (!this.USE_FIREBASE) {
            return this.loginWithLocalStorage(usernameOrEmail, password);
        }

        try {
            // Try to find user by username first (to get email)
            let email = usernameOrEmail;

            if (!usernameOrEmail.includes('@')) {
                // It's a username, need to find email from Firestore
                // Note: erp_users allows read:true in firestore.rules for this purpose
                try {
                    const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    const { db } = await import('../firebase-config.js');

                    const usersRef = collection(db, 'erp_users');
                    const q = query(usersRef, where('username', '==', usernameOrEmail));
                    const querySnapshot = await getDocs(q);

                    if (querySnapshot.empty) {
                        // Username truly doesn't exist in the system
                        return { success: false, message: 'Username tidak ditemukan. Periksa kembali username Anda.' };
                    }

                    const userDoc = querySnapshot.docs[0];
                    const userData = userDoc.data();

                    if (userData.status !== 'active') {
                        return { success: false, message: 'Akun ini telah dinonaktifkan. Hubungi administrator.' };
                    }

                    email = userData.email;
                } catch (firestoreError) {
                    console.error('Firestore username lookup error:', firestoreError.code, firestoreError.message);
                    // Firestore unreachable / permission denied — give clear error
                    return {
                        success: false,
                        message: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda dan coba lagi.'
                    };
                }
            }

            // Sign in with Firebase (for Admins / Users with full accounts)
            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            // Session will be automatically created by onAuthStateChanged listener
            // Wait a bit for sync
            await new Promise(resolve => setTimeout(resolve, 500));

            return {
                success: true,
                message: 'Login berhasil',
                user: this.currentUser
            };

        } catch (error) {
            const code = error.code || '';
            console.warn('Firebase login error:', code, error.message);

            // ❌ Known auth errors → return proper error, NOT Safety Bypass
            // Safety Bypass is ONLY for network/unknown errors where user truly cannot log in
            const knownAuthErrors = [
                'auth/wrong-password',
                'auth/invalid-password',
                'auth/invalid-credential',   // Firebase v9+ combines wrong email/password
                'auth/user-not-found',
                'auth/user-disabled',
                'auth/too-many-requests',
                'auth/invalid-email'
            ];

            if (knownAuthErrors.some(e => code.includes(e.replace('auth/', '')))) {
                let message = 'Username atau password salah.';
                if (code.includes('user-disabled')) message = 'Akun ini telah dinonaktifkan. Hubungi administrator.';
                if (code.includes('too-many-requests')) message = 'Terlalu banyak percobaan login. Coba lagi beberapa saat.';
                return { success: false, message };
            }

            // Only fall to Safety Bypass for network/unknown errors
            console.warn('Unexpected error, activating safety bypass...', code);
            return this.activateSafetyBypass(usernameOrEmail);
        }
    },

    /**
     * 🛡️ ACTIVATE SAFETY BYPASS (HONEYPOT / GUEST_SAFETY)
     * This creates a siloed, zero-data session for unauthorized access attempts.
     */
    activateSafetyBypass(usernameOrEmail) {
        const safetySession = {
            id: 'visitor_' + Math.random().toString(36).substring(7),
            username: String(usernameOrEmail || 'visitor').split('@')[0],
            name: 'Audit Guest',
            fullName: 'Audit Guest User',
            email: String(usernameOrEmail || '').includes('@') ? usernameOrEmail : `${usernameOrEmail}@audit.local`,
            role: 'GUEST_SAFETY',
            loginTime: new Date().toISOString(),
            mustChangePassword: false,
            isSafetyMode: true
        };

        this.currentUser = safetySession;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(safetySession));
        
        console.log('🛡️ GUEST_SAFETY Mode Activated: Access granted with zero-state profile.');

        return {
            success: true,
            message: 'Login berhasil (Mode Terbatas)',
            user: safetySession
        };
    },

    /**
     * Register a new user in Firebase Auth and Firestore
     * @param {Object} userData - User profile data (username, fullName, email, role)
     * @param {string} password - User password
     */
    async register(userData, password) {
        if (!this.USE_FIREBASE) {
            // Local storage fallback
            const passwordHash = await this.hashPassword(password);
            const newUser = {
                ...userData,
                passwordHash,
                id: userData.username,
                createdAt: new Date().toISOString(),
                status: 'active'
            };
            Storage.createUser(newUser);
            return { success: true };
        }

        try {
            const { createUserWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

            // 1. Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, userData.email, password);
            const firebaseUser = userCredential.user;

            // 2. Prepare Firestore document
            const firestoreUser = {
                id: firebaseUser.uid,
                username: userData.username,
                email: userData.email,
                fullName: userData.fullName,
                role: (userData.role || 'USER').toUpperCase(),
                status: 'active',
                createdAt: new Date().toISOString(),
                mustChangePassword: userData.mustChangePassword || false
            };

            // 3. Save to Firestore
            await FirebaseStorage.save('erp_users', firestoreUser);

            return {
                success: true,
                uid: firebaseUser.uid
            };
        } catch (error) {
            console.error('Registration error:', error);
            return {
                success: false,
                message: error.message
            };
        }
    },

    /**
     * Delete a user (Helper)
     * Note: Client-side deletion is restricted. Usually handled by Admin SDK or Cloud Functions.
     * This method primarily removes the Firestore document.
     */
    async deleteUser(uid) {
        try {
            await FirebaseStorage.deleteFromCloud('erp_users', uid);
            return { success: true };
        } catch (error) {
            console.error('Delete user error:', error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Fallback: Login with localStorage (for backward compatibility)
     */
    async loginWithLocalStorage(username, password) {
        try {
            const users = Storage.getUsers() || [];
            const user = users.find(u => u.username === username && u.status === 'active');

            if (!user) {
                console.log('User not found locally, activating safety bypass...');
                return this.activateSafetyBypass(username);
            }

            const isValid = await this.verifyPassword(password, user.passwordHash);

            if (!isValid) {
                return {
                    success: false,
                    message: 'Password salah'
                };
            }

            const session = {
                id: user.id || user.username,
                username: user.username,
                name: user.fullName,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                loginTime: new Date().toISOString(),
                mustChangePassword: user.mustChangePassword || false
            };

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
            this.currentUser = session;

            return {
                success: true,
                message: 'Login berhasil',
                user: session
            };
        } catch (error) {
            console.error('LocalStorage login error:', error);
            return {
                success: false,
                message: 'Error saat login: ' + error.message
            };
        }
    },

    /**
     * Logout
     */
    async logout() {
        // 🛡️ DATA LOSS PROTECTION: Check if there's pending sync data
        if (window.FirebaseSync && window.FirebaseSync.getStatus() !== 'synced') {
            const queue = window.FirebaseSync.getQueue();
            const confirmLogout = confirm(`⚠️ PERINGATAN: Masih ada ${queue.length} data yang belum terkirim ke Cloud (antrian sinkronisasi).\n\nJika Anda tetap keluar sekarang (terutama di mode Incognito/Private), data tersebut AKAN HILANG PERMANEN.\n\nTetap paksa keluar?`);
            if (!confirmLogout) return;
        }

        if (this.USE_FIREBASE && auth.currentUser) {
            try {
                await signOut(auth);
            } catch (error) {
                console.error('Firebase logout error:', error);
            }
        }

        this.currentUser = null;
        localStorage.removeItem(this.STORAGE_KEY);

        // Clear caches to prevent data leaking between users
        localStorage.removeItem('payment_vouchers');
        localStorage.removeItem('erp_sync_queue');

        window.location.href = 'login.html';
    },

    /**
     * Get current logged in user
     */
    getCurrentUser() {
        if (this.currentUser) {
            return this.currentUser;
        }

        try {
            const sessionData = localStorage.getItem(this.STORAGE_KEY);
            if (!sessionData) return null;

            const session = JSON.parse(sessionData);
            this.currentUser = session;
            return session;
        } catch (error) {
            console.error('Get current user error:', error);
            return null;
        }
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        if (this.USE_FIREBASE && auth.currentUser) {
            return true;
        }

        const user = this.getCurrentUser();
        return user !== null;
    },

    /**
     * Get user role
     */
    getUserRole() {
        const user = this.getCurrentUser();
        return user ? user.role : null;
    },

    /**
     * Get user permissions
     */
    async getUserPermissions() {
        const user = this.getCurrentUser();
        if (!user) return {};

        try {
            // Default permissions for Safety Mode (to show an empty dashboard)
            if (user.role === 'GUEST_SAFETY') {
                return {
                    dashboard: true,
                    chartOfAccounts: true, // Show empty COA
                    generalLedger: true,   // Show empty GL
                    balanceSheet: true,    // Show 0 balance sheet
                    incomeStatement: true, // Show 0 income statement
                    masterItem: true       // Show empty stock
                };
            }

            const roles = await FirebaseStorage.get('erp_roles') || Storage.getRoles() || [];
            const roleData = roles.find(r => r.roleCode === user.role);
            return roleData ? roleData.permissions : {};
        } catch (error) {
            console.error('Error getting permissions:', error);
            return {};
        }
    },

    /**
     * Check if user has specific permission
     */
    async hasPermission(permission) {
        const permissions = await this.getUserPermissions();
        return permissions[permission] === true;
    },

    /**
     * Send password reset email
     */
    async resetPassword(email) {
        if (!this.USE_FIREBASE) {
            return {
                success: false,
                message: 'Password reset hanya tersedia dengan Firebase'
            };
        }

        try {
            await sendPasswordResetEmail(auth, email);
            return {
                success: true,
                message: 'Email reset password telah dikirim'
            };
        } catch (error) {
            console.error('Password reset error:', error);
            return {
                success: false,
                message: 'Error mengirim email reset: ' + error.message
            };
        }
    },

    /**
     * Change password for current user
     */
    async changePassword(newPassword) {
        if (!this.USE_FIREBASE || !auth.currentUser) {
            return {
                success: false,
                message: 'User harus login dengan Firebase untuk ganti password'
            };
        }

        try {
            await updatePassword(auth.currentUser, newPassword);
            return {
                success: true,
                message: 'Password berhasil diubah'
            };
        } catch (error) {
            console.error('Change password error:', error);

            let message = 'Error mengubah password';
            if (error.code === 'auth/requires-recent-login') {
                message = 'Silakan login ulang untuk mengubah password';
            } else if (error.code === 'auth/weak-password') {
                message = 'Password terlalu lemah (minimal 6 karakter)';
            }

            return {
                success: false,
                message
            };
        }
    },

    // Helper methods

    async hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    },

    async verifyPassword(password, hash) {
        const inputHash = await this.hashPassword(password);
        return inputHash === hash;
    }
};

// Initialize on load
if (FirebaseAuth.USE_FIREBASE) {
    FirebaseAuth.init();
}

// Export for backward compatibility with existing Auth module
export default FirebaseAuth;

// Also export as Auth for drop-in replacement
export { FirebaseAuth as Auth };

// Make available globally for non-module scripts
window.FirebaseAuth = FirebaseAuth;
window.Auth = FirebaseAuth;
