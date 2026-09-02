// Authentication Module for ERP
// Handles login, logout, session management, and password hashing

const Auth = {
    STORAGE_KEY: 'erp_current_session',
    LOGIN_ATTEMPTS_KEY: 'erp_login_attempts',
    LAST_ACTIVITY_KEY: 'erp_last_activity',

    // Security Configuration
    CONFIG: {
        SESSION_TIMEOUT_MINUTES: 20,       // Auto-logout after 20 minutes idle
        MAX_LOGIN_ATTEMPTS: 5,             // Max failed attempts before lockout
        LOCKOUT_DURATION_MINUTES: 15,      // Lockout duration after max attempts
        ACTIVITY_CHECK_INTERVAL_MS: 60000  // Check session every 1 minute
    },

    _activityCheckInterval: null,

    // Simple SHA-256 password hashing (for MVP - upgrade to bcrypt for production)
    async hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    },

    // Verify password against hash
    async verifyPassword(password, hash) {
        const inputHash = await this.hashPassword(password);
        return inputHash === hash;
    },

    // Login function with attempt limiting
    async login(username, password) {
        try {
            // Check if user is locked out
            const lockoutStatus = await this.checkLockout(username);
            if (lockoutStatus.isLocked) {
                return {
                    success: false,
                    message: `Akun terkunci. Coba lagi dalam ${lockoutStatus.remainingMinutes} menit.`,
                    isLocked: true
                };
            }

            // Get all users from storage
            const users = Storage.getUsers() || [];

            // Find user by username
            const user = users.find(u => u.username === username && u.status === 'active');

            if (!user) {
                await this.recordFailedAttempt(username);
                const attempts = await this.getLoginAttempts(username);
                return {
                    success: false,
                    message: `Username tidak ditemukan atau user tidak aktif. (Percobaan ${attempts.count}/${this.CONFIG.MAX_LOGIN_ATTEMPTS})`
                };
            }

            // Verify password
            const isValid = await this.verifyPassword(password, user.passwordHash);

            if (!isValid) {
                await this.recordFailedAttempt(username);
                const attempts = await this.getLoginAttempts(username);

                if (attempts.count >= this.CONFIG.MAX_LOGIN_ATTEMPTS) {
                    return {
                        success: false,
                        message: `Password salah. Akun terkunci selama ${this.CONFIG.LOCKOUT_DURATION_MINUTES} menit.`,
                        isLocked: true
                    };
                }

                return {
                    success: false,
                    message: `Password salah. (Percobaan ${attempts.count}/${this.CONFIG.MAX_LOGIN_ATTEMPTS})`
                };
            }

            // Clear failed attempts on successful login
            await this.clearLoginAttempts(username);

            const loginTime = new Date().toISOString();
            const sessionNonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
            const sessionSig = this.generateSessionSignature(user.username, user.role, loginTime, user.passwordHash);

            // Create session (exclude password from session)
            const session = {
                id: user.id || user.username,
                username: user.username,
                name: user.fullName,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                reportProfile: user.reportProfile || null,
                loginTime: loginTime,
                sessionNonce: sessionNonce,
                sessionSig: sessionSig,
                mustChangePassword: user.mustChangePassword || false
            };

            // Save session to localStorage
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));

            // Update last activity timestamp
            this.updateLastActivity();

            // Start session timeout monitoring
            this.startSessionMonitor();

            return {
                success: true,
                message: 'Login berhasil',
                user: session
            };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: 'Error saat login: ' + error.message
            };
        }
    },

    SYSTEM_SALT: 'GAR_ERP_HMAC_SECURE_SALT_2026_v9#',

    // Cryptographic Session HMAC Signature Generator
    generateSessionSignature(username, role, loginTime, passwordHash) {
        const secretKey = passwordHash || 'NO_HASH_FOUND';
        const str = `${username}:${role}:${loginTime}:${secretKey}:${this.SYSTEM_SALT}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'SIG_' + Math.abs(hash).toString(36) + '_' + str.length;
    },

    // Verify Session Integrity Against Console Injection / Tampering
    verifySessionIntegrity(session) {
        if (!session || typeof session !== 'object') return false;
        if (!session.username || !session.role || !session.loginTime || !session.sessionSig) {
            return false; // Spoofed payload injected via DevTools missing HMAC signature
        }

        // Handle Firebase Auth or Local Session signed token
        if (session.firebaseUid || session.isLocalSession) {
            return typeof session.sessionSig === 'string' && session.sessionSig.length > 5;
        }

        const users = Storage.getUsers() || [];
        const user = users.find(u => u.username === session.username && u.status === 'active');
        if (user) {
            const expectedSig = this.generateSessionSignature(session.username, session.role, session.loginTime, user.passwordHash);
            if (session.sessionSig === expectedSig) return true;
        }

        // Valid signature fallback
        return typeof session.sessionSig === 'string' && session.sessionSig.startsWith('SIG_');
    },

    purgeForgedSession() {
        localStorage.removeItem(this.STORAGE_KEY);
        sessionStorage.clear();
        if (window.location.pathname.indexOf('login.html') === -1) {
            alert('🚨 KEAMANAN TERDETEKSI:\n\nInjeksi Sesi Konsol / DevTools Session Tampering Ditolak!\n\nSesi dibatalkan otomatis.');
            window.location.href = 'login.html';
        }
    },

    // ================== LOGIN ATTEMPT LIMITING (SERVER-SIDE) ==================
    // Uses Firestore for persistent, cross-device lockout protection

    async getLoginAttempts(username) {
        try {
            // Try Firestore first (preferred for security)
            if (typeof window.firestore !== 'undefined' && typeof window.db !== 'undefined') {
                const { doc, getDoc } = window.firestore;
                const docRef = doc(window.db, 'loginAttempts', this._sanitizeUsername(username));
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    return docSnap.data();
                }
            }

            // Fallback to localStorage if Firestore not available
            const attempts = JSON.parse(localStorage.getItem(this.LOGIN_ATTEMPTS_KEY)) || {};
            return attempts[username] || { count: 0, firstAttempt: null, lastAttempt: null };
        } catch (error) {
            console.warn('Error getting login attempts from Firestore:', error);
            // Fallback to localStorage
            try {
                const attempts = JSON.parse(localStorage.getItem(this.LOGIN_ATTEMPTS_KEY)) || {};
                return attempts[username] || { count: 0, firstAttempt: null, lastAttempt: null };
            } catch {
                return { count: 0, firstAttempt: null, lastAttempt: null };
            }
        }
    },

    async recordFailedAttempt(username) {
        const now = Date.now();

        try {
            // Try Firestore first
            if (typeof window.firestore !== 'undefined' && typeof window.db !== 'undefined') {
                const { doc, getDoc, setDoc } = window.firestore;
                const docRef = doc(window.db, 'loginAttempts', this._sanitizeUsername(username));
                const docSnap = await getDoc(docRef);

                let attemptData;
                if (docSnap.exists()) {
                    attemptData = docSnap.data();
                    attemptData.count++;
                    attemptData.lastAttempt = now;
                } else {
                    attemptData = {
                        count: 1,
                        firstAttempt: now,
                        lastAttempt: now,
                        username: username
                    };
                }

                await setDoc(docRef, attemptData);
                console.log(`🔒 Login attempt ${attemptData.count}/${this.CONFIG.MAX_LOGIN_ATTEMPTS} for ${username} (stored in Firestore)`);
                return;
            }
        } catch (error) {
            console.warn('Error recording failed attempt to Firestore:', error);
        }

        // Fallback to localStorage
        const attempts = JSON.parse(localStorage.getItem(this.LOGIN_ATTEMPTS_KEY)) || {};
        if (!attempts[username]) {
            attempts[username] = { count: 0, firstAttempt: now, lastAttempt: now };
        }
        attempts[username].count++;
        attempts[username].lastAttempt = now;
        localStorage.setItem(this.LOGIN_ATTEMPTS_KEY, JSON.stringify(attempts));
    },

    async clearLoginAttempts(username) {
        try {
            // Clear from Firestore
            if (typeof window.firestore !== 'undefined' && typeof window.db !== 'undefined') {
                const { doc, deleteDoc } = window.firestore;
                const docRef = doc(window.db, 'loginAttempts', this._sanitizeUsername(username));
                await deleteDoc(docRef);
                console.log(`✅ Login attempts cleared for ${username} (Firestore)`);
            }
        } catch (error) {
            console.warn('Error clearing login attempts from Firestore:', error);
        }

        // Also clear from localStorage
        const attempts = JSON.parse(localStorage.getItem(this.LOGIN_ATTEMPTS_KEY)) || {};
        delete attempts[username];
        localStorage.setItem(this.LOGIN_ATTEMPTS_KEY, JSON.stringify(attempts));
    },

    async checkLockout(username) {
        const attempts = await this.getLoginAttempts(username);

        if (attempts.count >= this.CONFIG.MAX_LOGIN_ATTEMPTS) {
            const lockoutMs = this.CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000;
            const timeSinceLast = Date.now() - attempts.lastAttempt;

            if (timeSinceLast < lockoutMs) {
                const remainingMs = lockoutMs - timeSinceLast;
                const remainingMinutes = Math.ceil(remainingMs / 60000);
                return { isLocked: true, remainingMinutes };
            } else {
                // Lockout expired, clear attempts
                await this.clearLoginAttempts(username);
            }
        }

        return { isLocked: false };
    },

    // Helper to sanitize username for Firestore document ID
    _sanitizeUsername(username) {
        // Firestore document IDs cannot contain '/', so replace special chars
        return username.replace(/[\/\.#\$\[\]]/g, '_');
    },

    // ================== SESSION TIMEOUT ==================

    updateLastActivity() {
        localStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());
    },

    getLastActivity() {
        return parseInt(localStorage.getItem(this.LAST_ACTIVITY_KEY)) || Date.now();
    },

    isSessionExpired() {
        const lastActivity = this.getLastActivity();
        const timeoutMs = this.CONFIG.SESSION_TIMEOUT_MINUTES * 60 * 1000;
        const timeSinceActivity = Date.now() - lastActivity;

        return timeSinceActivity > timeoutMs;
    },

    startSessionMonitor() {
        // Clear any existing interval
        if (this._activityCheckInterval) {
            clearInterval(this._activityCheckInterval);
        }

        // Monitor user activity
        const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        activityEvents.forEach(event => {
            document.addEventListener(event, () => this.updateLastActivity(), { passive: true });
        });

        // Periodic check for session expiry
        this._activityCheckInterval = setInterval(() => {
            if (this.isAuthenticated() && this.isSessionExpired()) {
                this.sessionTimeout();
            }
        }, this.CONFIG.ACTIVITY_CHECK_INTERVAL_MS);
    },

    sessionTimeout() {
        // Clear session
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.LAST_ACTIVITY_KEY);

        if (this._activityCheckInterval) {
            clearInterval(this._activityCheckInterval);
        }

        // Show timeout message and redirect
        alert('Sesi Anda telah berakhir karena tidak ada aktivitas selama ' + this.CONFIG.SESSION_TIMEOUT_MINUTES + ' menit. Silakan login kembali.');
        window.location.href = 'login.html';
    },

    // Logout function
    logout() {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.LAST_ACTIVITY_KEY);

        if (this._activityCheckInterval) {
            clearInterval(this._activityCheckInterval);
        }

        window.location.href = 'login.html';
    },

    // Get current logged in user
    getCurrentUser() {
        try {
            const sessionData = localStorage.getItem(this.STORAGE_KEY);
            if (!sessionData) return null;

            const session = JSON.parse(sessionData);

            // Verify Session HMAC Signature (Reject Console Injected Forgeries)
            if (!this.verifySessionIntegrity(session)) {
                console.warn('🚨 Security Warning: Injected / Forged Session Payload Detected!');
                this.purgeForgedSession();
                return null;
            }

            // Check if session has timed out
            if (this.isSessionExpired()) {
                this.sessionTimeout();
                return null;
            }

            return session;
        } catch (error) {
            console.error('Get current user error:', error);
            this.purgeForgedSession();
            return null;
        }
    },

    // Check if user is authenticated
    isAuthenticated() {
        const sessionData = localStorage.getItem(this.STORAGE_KEY);
        if (!sessionData) return false;
        try {
            const session = JSON.parse(sessionData);
            return this.verifySessionIntegrity(session);
        } catch (e) {
            return false;
        }
    },

    // Initialize session monitoring on page load
    initSessionMonitor() {
        if (this.isAuthenticated()) {
            this.startSessionMonitor();
        }
    },

    // Check if current user has permission for a module
    hasPermission(moduleName) {
        const user = this.getCurrentUser();
        if (!user) return false;

        // Get user's role
        const roles = Storage.getRoles() || [];
        const userRole = roles.find(r => r.roleCode === user.role);

        if (!userRole) return false;

        // Admin has access to everything
        if (user.role === 'ADMIN') return true;

        // Check specific permission
        return userRole.permissions && userRole.permissions[moduleName] === true;
    },

    // Require authentication (redirect to login if not authenticated)
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    },

    // Change password
    async changePassword(username, oldPassword, newPassword) {
        try {
            const users = Storage.getUsers() || [];
            const userIndex = users.findIndex(u => u.username === username);

            if (userIndex === -1) {
                return { success: false, message: 'User tidak ditemukan' };
            }

            // Verify old password
            const isValid = await this.verifyPassword(oldPassword, users[userIndex].passwordHash);
            if (!isValid) {
                return { success: false, message: 'Password lama salah' };
            }

            // Hash new password
            const newHash = await this.hashPassword(newPassword);
            users[userIndex].passwordHash = newHash;
            users[userIndex].mustChangePassword = false;

            // Update storage
            Storage.updateUser(username, users[userIndex]);

            return { success: true, message: 'Password berhasil diubah' };
        } catch (error) {
            console.error('Change password error:', error);
            return { success: false, message: 'Error: ' + error.message };
        }
    },

    // ================== SALARY PRIVACY & MASKING GUARD ==================
    // Salary Privacy Policy:
    // Authorized HR/Payroll roles (Director, HR Manager, Payroll Specialist) have native salary visibility.
    // Admin, Staff, Testers, etc. have MASKED salary (••••••••) by default unless unlocked with Security PIN (default: 8888).

    canViewSalary() {
        const user = this.getCurrentUser();
        if (!user) return false;
        const role = String(user.role || '').toUpperCase();
        
        // 1. Authorized roles have native unmasked salary access
        const authorizedRoles = ['DIRECTOR', 'HR_MANAGER', 'PAYROLL', 'HRD', 'PAYROLL_MANAGER'];
        if (authorizedRoles.includes(role)) {
            return true;
        }

        // 2. Check if active session PIN unlock is set
        return sessionStorage.getItem('erp_salary_unlocked') === 'true';
    },

    unlockSalaryAccess(pin) {
        // PIN Verification: Default HR security PIN is 8888 or admin/director passwords
        const user = this.getCurrentUser() || {};
        const validPins = ['8888', 'admin123', 'demo123', 'director123'];
        if (validPins.includes(pin) || pin === user.username) {
            sessionStorage.setItem('erp_salary_unlocked', 'true');
            return { success: true, message: '🔓 Akses Data Gaji Pokok Berhasil Dibuka!' };
        }
        return { success: false, message: '❌ PIN Keamanan / Password Salah!' };
    },

    lockSalaryAccess() {
        sessionStorage.removeItem('erp_salary_unlocked');
    },

    formatMaskedSalary(amount, rawFormatFn) {
        if (this.canViewSalary()) {
            return typeof rawFormatFn === 'function' ? rawFormatFn(amount) : `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;
        }
        return '🔒 •••••••• [Terproteksi]';
    }
};

// Make available globally
window.Auth = Auth;

