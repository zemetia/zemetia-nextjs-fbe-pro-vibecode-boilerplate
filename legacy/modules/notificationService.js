// ==========================================
// Notification Service Module
// Firebase Cloud Messaging (FCM) integration
// ==========================================

const NotificationService = {
    messaging: null,
    fcmToken: null,
    isInitialized: false,

    async init() {
        // Check browser support
        if (!('Notification' in window)) {
            console.warn('❌ Browser does not support notifications');
            return false;
        }

        if (!('serviceWorker' in navigator)) {
            console.warn('❌ Browser does not support service workers');
            return false;
        }

        try {
            // Auto-request permission FIRST (even before Firebase setup)
            if (Notification.permission === 'default') {
                console.log('🔔 Requesting notification permission...');
                const permission = await Notification.requestPermission();
                console.log('📋 Permission result:', permission);

                if (permission !== 'granted') {
                    console.log('⚠️ Notification permission not granted');
                    if (permission === 'denied') {
                        this.showPermissionDeniedMessage();
                    }
                    return false;
                }
            }

            // Initialize Firebase Messaging (only if permission granted)
            if (Notification.permission === 'granted') {
                console.log('✅ Permission granted, initializing Firebase Messaging...');

                if (typeof firebase === 'undefined' || !firebase.messaging) {
                    console.warn('⚠️ Firebase Messaging not available, using basic notifications');
                    this.isInitialized = true;
                    return true;
                }

                this.messaging = firebase.messaging();

                // Register service worker
                try {
                    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                    console.log('✅ Service Worker registered:', registration.scope);
                } catch (swError) {
                    console.warn('⚠️ Service Worker registration failed:', swError.message);
                    // Continue anyway - basic notifications will still work
                }

                // Try to get FCM token
                await this.getToken();
                this.setupForegroundHandler();
                this.showSuccessMessage();
            }

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('❌ Notification init error:', error);
            return false;
        }
    },

    showPermissionPrompt() {
        // Show in-app prompt explaining why we need permission
        const promptHTML = `
      <div id="notification-prompt" style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 350px;
        animation: slideIn 0.3s ease;
      ">
        <h3 style="margin: 0 0 12px 0; font-size: 16px;">🔔 Aktifkan Notifikasi</h3>
        <p style="margin: 0 0 16px 0; font-size: 14px; opacity: 0.9;">
          Terima notifikasi untuk approval yang pending, risk alerts, dan low stock warnings.
        </p>
        <div style="display: flex; gap: 8px;">
          <button onclick="NotificationService.requestPermission()" style="
            flex: 1;
            padding: 10px;
            background: white;
            color: #667eea;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
          ">Aktifkan</button>
          <button onclick="document.getElementById('notification-prompt').remove()" style="
            padding: 10px 16px;
            background: rgba(255,255,255,0.2);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
          ">Nanti</button>
        </div>
      </div>
    `;

        document.body.insertAdjacentHTML('beforeend', promptHTML);
    },

    async requestPermission() {
        try {
            const permission = await Notification.requestPermission();

            if (permission === 'granted') {
                console.log('✅ Notification permission granted');
                await this.getToken();
                this.setupForegroundHandler();
                this.showSuccessMessage();
                return true;
            } else if (permission === 'denied') {
                console.log('❌ Notification permission denied');
                this.showPermissionDeniedMessage();
                return false;
            } else {
                console.log('⚠️ Notification permission dismissed');
                return false;
            }
        } catch (error) {
            console.error('Error requesting permission:', error);
            return false;
        }
    },

    async getToken() {
        try {
            // Note: You need to generate VAPID key in Firebase Console
            // Project Settings → Cloud Messaging → Web Push certificates
            const token = await this.messaging.getToken({
                vapidKey: 'YOUR_VAPID_KEY_HERE' // TODO: Replace with actual VAPID key
            });

            if (token) {
                console.log('✅ FCM Token obtained');
                this.fcmToken = token;
                await this.saveTokenToUser(token);
                return token;
            } else {
                console.log('⚠️ No registration token available');
                return null;
            }
        } catch (error) {
            console.error('Error getting FCM token:', error);

            // If VAPID key not set, show helpful message
            if (error.code === 'messaging/unsupported-browser') {
                console.warn('This browser does not support FCM');
            } else if (error.message.includes('VAPID')) {
                console.warn('VAPID key not configured. Please set in Firebase Console.');
            }

            return null;
        }
    },

    async saveTokenToUser(token) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        try {
            // Save to Firestore
            if (window.db && window.firestore) {
                const { doc, setDoc } = window.firestore;
                const userRef = doc(window.db, 'users', user.email);

                await setDoc(userRef, {
                    fcmToken: token,
                    fcmTokenUpdatedAt: new Date().toISOString(),
                    notificationsEnabled: true
                }, { merge: true });

                console.log('✅ FCM token saved to user profile');
            }

            // Also save to localStorage as backup
            const config = Storage.get(Storage.KEYS.CONFIG) || {};
            config.fcmToken = token;
            config.fcmTokenUpdatedAt = new Date().toISOString();
            await Storage.set(Storage.KEYS.CONFIG, config);

        } catch (error) {
            console.error('Error saving FCM token:', error);
        }
    },

    setupForegroundHandler() {
        // Handle messages when app is in foreground
        this.messaging.onMessage((payload) => {
            console.log('📨 Foreground notification received:', payload);
            this.showForegroundNotification(payload);
        });
    },

    showForegroundNotification(payload) {
        const { title, body, icon } = payload.notification || {};
        const data = payload.data || {};

        // Show browser notification
        if (Notification.permission === 'granted') {
            const notification = new Notification(title || 'ERP', {
                body: body || '',
                icon: icon || '/favicon.ico',
                badge: '/favicon.ico',
                tag: data.type || 'general',
                requireInteraction: data.priority === 'urgent',
                data: data
            });

            notification.onclick = () => {
                window.focus();
                notification.close();

                // Navigate based on notification type
                if (data.type === 'pending_approvals') {
                    App.navigate('payment-voucher');
                } else if (data.type === 'risk_alert' || data.type === 'critical_risk') {
                    App.navigate('dashboard');
                } else if (data.type === 'low_stock') {
                    App.navigate('reorder-system');
                }
            };
        }

        // Also show in-app notification banner
        this.showInAppBanner(title, body, data);
    },

    showInAppBanner(title, body, data) {
        const banner = document.createElement('div');
        banner.className = 'notification-banner';
        banner.innerHTML = `
      <div class="notification-content">
        <strong>${title || 'Notification'}</strong>
        <p>${body || ''}</p>
      </div>
      <button onclick="this.parentElement.remove()" style="
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      ">✕</button>
    `;

        document.body.appendChild(banner);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (banner.parentElement) {
                banner.remove();
            }
        }, 10000);
    },

    showSuccessMessage() {
        this.showInAppBanner(
            '✅ Notifikasi Aktif',
            'Anda akan menerima notifikasi untuk approval, risk alerts, dan low stock warnings.',
            {}
        );
    },

    showPermissionDeniedMessage() {
        const message = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 350px;
      ">
        <h3 style="margin: 0 0 12px 0; font-size: 16px;">❌ Notifikasi Diblokir</h3>
        <p style="margin: 0 0 12px 0; font-size: 14px;">
          Untuk mengaktifkan notifikasi:
        </p>
        <ol style="margin: 0; padding-left: 20px; font-size: 13px;">
          <li>Klik ikon gembok di address bar</li>
          <li>Pilih "Site Settings"</li>
          <li>Ubah "Notifications" menjadi "Allow"</li>
          <li>Refresh halaman</li>
        </ol>
        <button onclick="this.parentElement.remove()" style="
          margin-top: 12px;
          padding: 8px 16px;
          background: rgba(255,255,255,0.2);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          width: 100%;
        ">Tutup</button>
      </div>
    `;

        document.body.insertAdjacentHTML('beforeend', message);
    },

    // Test notification (for debugging)
    async sendTestNotification() {
        if (Notification.permission === 'granted') {
            new Notification('🧪 Test Notification', {
                body: 'Push notifications are working correctly!',
                icon: '/favicon.ico',
                badge: '/favicon.ico'
            });

            console.log('✅ Test notification sent');
            return true;
        } else {
            console.warn('⚠️ Notification permission not granted');
            return false;
        }
    },

    // Check if notifications are supported and enabled
    isSupported() {
        return 'Notification' in window && 'serviceWorker' in navigator;
    },

    isEnabled() {
        return Notification.permission === 'granted';
    },

    getPermissionStatus() {
        if (!this.isSupported()) return 'unsupported';
        return Notification.permission; // 'default', 'granted', or 'denied'
    },

    // --- Helper Methods ---
    success(message) {
        this.showInAppBanner('✅ Success', message, { type: 'success' });
    },
    error(message) {
        this.showInAppBanner('❌ Error', message, { type: 'error' });
    },
    info(message) {
        this.showInAppBanner('ℹ️ Info', message, { type: 'info' });
    }
};


// Explicitly make NotificationService globally available
window.NotificationService = NotificationService;
