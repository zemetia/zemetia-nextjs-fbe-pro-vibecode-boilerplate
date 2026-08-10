// ==========================================
// WhatsApp AI Bot Simulator Module
// Simulates member interaction flow
// ==========================================

const WhatsAppBot = {
    messages: [],
    activeUser: null,

    init() {
        // Start with systemic initial messages
        this.messages = [
            { id: 1, sender: 'system', text: '🔒 Messages are end-to-end encrypted.', time: '09:00' }
        ];
    },

    render() {
        const mainContent = document.getElementById('main-content');
        
        // Load current customer data for testing context
        const customers = Storage.get(Storage.KEYS.CUSTOMERS) || [];
        
        // Check styles - inject Whatsapp simulator specific CSS if not exists
        if (!document.getElementById('wa-simulator-styles')) {
            const style = document.createElement('style');
            style.id = 'wa-simulator-styles';
            style.innerHTML = `
                .wa-container {
                    max-width: 900px;
                    height: calc(100vh - 150px);
                    margin: 0 auto;
                    background: #0b141a;
                    border-radius: 12px;
                    display: grid;
                    grid-template-columns: 300px 1fr;
                    overflow: hidden;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }
                .wa-sidebar {
                    background: #111b21;
                    border-right: 1px solid #222d34;
                    display: flex;
                    flex-direction: column;
                }
                .wa-chat-area {
                    background: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png');
                    background-color: #0b141a;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                }
                .wa-header {
                    background: #202c33;
                    padding: 10px 16px;
                    display: flex;
                    align-items: center;
                    height: 60px;
                }
                .wa-messages-container {
                    flex-grow: 1;
                    padding: 20px 5%;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .wa-bubble {
                    max-width: 65%;
                    padding: 6px 12px 8px 12px;
                    border-radius: 8px;
                    font-size: 14.2px;
                    color: #e9edef;
                    position: relative;
                    word-wrap: break-word;
                    line-height: 1.4;
                }
                .wa-bubble.received {
                    align-self: flex-start;
                    background: #202c33;
                }
                .wa-bubble.sent {
                    align-self: flex-end;
                    background: #005c4b;
                }
                .wa-bubble.system {
                    align-self: center;
                    background: #182229;
                    font-size: 12.5px;
                    color: #ffd279;
                    border-radius: 8px;
                    padding: 5px 12px;
                    text-align: center;
                    margin: 12px 0;
                }
                .wa-time {
                    font-size: 11px;
                    color: #8696a0;
                    float: right;
                    margin-top: 4px;
                    margin-left: 8px;
                }
                .wa-input-area {
                    background: #202c33;
                    padding: 10px 16px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .wa-input {
                    flex-grow: 1;
                    background: #2a3942;
                    border: none;
                    border-radius: 8px;
                    color: #d1d7db;
                    padding: 9px 12px;
                    font-size: 15px;
                }
                .wa-input:focus { outline: none; }
                .wa-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: #6a7175;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    color: white;
                    font-weight: bold;
                    margin-right: 15px;
                }
                .wa-user-item {
                    padding: 12px 15px;
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    border-bottom: 1px solid #222d34;
                    color: #e9edef;
                    transition: background 0.2s;
                }
                .wa-user-item:hover, .wa-user-item.active {
                    background: #2a3942;
                }
            `;
            document.head.appendChild(style);
        }

        mainContent.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">🤖 WhatsApp AI Simulator</h1>
                <p class="page-subtitle">Lakukan simulasi bot AI melayani kebutuhan Customer/Member.</p>
            </div>

            <div class="wa-container">
                <!-- SIDEBAR SELECT CUSTOMER -->
                <div class="wa-sidebar">
                    <div class="wa-header" style="justify-content: space-between;">
                        <strong style="color: #d1d7db;">Daftar Member (KYC)</strong>
                    </div>
                    <div style="padding: 10px; background: #111b21;">
                        <input type="text" placeholder="Cari customer..." class="wa-input" style="width: 100%;">
                    </div>
                    <div style="overflow-y: auto; flex-grow: 1;">
                        ${customers.length === 0 ? '<div style="color: #8696a0; padding: 20px; text-align: center;">Belum ada customer.</div>' : 
                          customers.map(c => `
                            <div class="wa-user-item ${this.activeUser?.id === c.id ? 'active' : ''}" onclick="WhatsAppBot.selectUser('${c.id}')">
                                <div class="wa-avatar" style="background: hsl(${Math.random() * 360}, 60%, 45%);">${c.name.charAt(0)}</div>
                                <div>
                                    <div style="font-weight: 500;">${c.name}</div>
                                    <div style="font-size: 13px; color: #8696a0;">${c.code}</div>
                                </div>
                            </div>
                          `).join('')
                        }
                    </div>
                </div>

                <!-- CHAT AREA -->
                <div class="wa-chat-area">
                    ${!this.activeUser ? `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #8696a0;">
                            <div style="font-size: 64px; margin-bottom: 10px;">🤖</div>
                            <h3>AI Bot WhatsApp Simulator</h3>
                            <p>Pilih member di kolom kiri untuk memulai obrolan AI.</p>
                        </div>
                    ` : `
                        <div class="wa-header">
                            <div class="wa-avatar" style="background: #005c4b;">🤖</div>
                            <div>
                                <div style="font-weight: 500; color: #e9edef;">AI Assistant Golden Alura</div>
                                <div style="font-size: 12px; color: #8696a0;">Online - Simulasi Member: <b>${this.activeUser.name}</b></div>
                            </div>
                        </div>
                        
                        <div class="wa-messages-container" id="wa-msg-box">
                            ${this.messages.map(m => {
                                if (m.sender === 'system') {
                                    return `<div class="wa-bubble system">${m.text}</div>`;
                                }
                                return `
                                    <div class="wa-bubble ${m.sender === 'user' ? 'sent' : 'received'}">
                                        ${m.text.replace(/\n/g, '<br>')}
                                        <div class="wa-time">${m.time} ${m.sender === 'user' ? '✓✓' : ''}</div>
                                    </div>
                                `;
                            }).join('')}
                            <div id="wa-typing" style="display: none;" class="wa-bubble received">
                                <div class="typing-dot" style="color:#8696a0; font-style: italic; font-size: 12px;">AI sedang mengetik...</div>
                            </div>
                        </div>

                        <div class="wa-input-area">
                            <button style="background: none; border: none; font-size: 20px; cursor: pointer;">😊</button>
                            <button style="background: none; border: none; font-size: 20px; cursor: pointer;">📎</button>
                            <input type="text" id="wa-chat-input" class="wa-input" placeholder="Ketik pesan Anda sebagai member..." onkeypress="if(event.key === 'Enter') WhatsAppBot.sendMessage()">
                            <button onclick="WhatsAppBot.sendMessage()" style="background: #00a884; border: none; border-radius: 50%; width: 40px; height: 40px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path></svg>
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;
        
        this.scrollToBottom();
    },

    selectUser(userId) {
        const customers = Storage.get(Storage.KEYS.CUSTOMERS) || [];
        this.activeUser = customers.find(c => c.id === userId);
        
        // Reset chat upon user switch for simulation
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
        
        this.messages = [
            { sender: 'system', text: `🔒 Anda sekarang menyamar sebagai ${this.activeUser.name}` },
            { sender: 'bot', text: `Halo ${this.activeUser.name}! Saya AI Assistant Anda. Ada yang bisa saya bantu terkait investasi emas Anda hari ini?\n\nAnda bisa bertanya: "Berapa saldo saya?", "Harga emas sekarang?", atau "Cara deposit?"`, time: timeStr }
        ];
        
        this.render();
    },

    async sendMessage() {
        const input = document.getElementById('wa-chat-input');
        const text = input.value.trim();
        if (!text) return;

        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');

        // Add user message
        this.messages.push({
            sender: 'user',
            text: text,
            time: timeStr
        });

        input.value = '';
        this.render();
        
        // Show typing
        const typing = document.getElementById('wa-typing');
        if (typing) typing.style.display = 'block';
        this.scrollToBottom();

        // Simulate AI Processing Time
        setTimeout(() => {
            this.processAIResponse(text);
        }, 1500);
    },

    processAIResponse(inputText) {
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
        
        let response = "Maaf, saya kurang mengerti. Bisa diulangi?";
        const query = inputText.toLowerCase();

        // 1. Fetch User Context from real DB
        const goldBal = (typeof GoldSavings !== 'undefined') ? GoldSavings.getBalance(this.activeUser.id) : 0;
        const liveGold = (window.LivePriceService) ? window.LivePriceService.getGoldPrice() : 1500000;
        
        // Simple RAG logic (Keyword Based for demo)
        if (query.includes('saldo') || query.includes('tabungan')) {
            response = `Berdasarkan data akun Anda (${this.activeUser.code}), total saldo tabungan emas Anda saat ini adalah:\n\n🌟 *${goldBal.toFixed(3)} Gram*\n\nEstimasi nilai jika dicairkan hari ini: *Rp ${(goldBal * liveGold).toLocaleString('id-ID')}*.\nAda lagi yang ingin ditanyakan?`;
        }
        else if (query.includes('harga') || query.includes('price') || query.includes('emas')) {
            response = `Update harga Emas (XAU/IDR) real-time kami saat ini adalah:\n\n💰 *Rp ${liveGold.toLocaleString('id-ID')} / Gram*\n\nHarga berfluktuasi mengikuti pasar internasional.`;
        }
        else if (query.includes('deposit') || query.includes('kraken') || query.includes('binance')) {
            // Simulating contextual response from screenshot!
            response = `Untuk deposit menggunakan Binance atau Kraken, pastikan akun exchange Anda sudah diverifikasi penuh ya Pak.\n\nSetelah diverifikasi, limit transaksi akan sangat besar. Rekening penampung Golden Alura adalah:\n*BCA: 1234567890*\nA/N: PT Golden Alura Refinery.\n\nKirim bukti transfer ke sini jika sudah ya.`;
        }
        else if (query.includes('kyc') || query.includes('verifikasi')) {
            response = `Status data member Anda saat ini:\n\n✅ *TERVERIFIKASI (KYC APPROVED)*\n\nAnda memiliki akses penuh ke semua fitur transaksi kami tanpa limit terbatas.`;
        }
        else {
            response = `Terima kasih pertanyaannya Pak/Bu ${this.activeUser.name}. Saya adalah AI Golden Alura.\n\nAnda bisa ketik:\n- *Saldo* untuk cek saldo emas\n- *Harga* untuk cek kurs live\n- *Deposit* untuk cara setor dana`;
        }

        this.messages.push({
            sender: 'bot',
            text: response,
            time: timeStr
        });

        this.render();
    },

    scrollToBottom() {
        setTimeout(() => {
            const box = document.getElementById('wa-msg-box');
            if (box) {
                box.scrollTop = box.scrollHeight;
            }
        }, 50);
    }
};

window.WhatsAppBot = WhatsAppBot;
