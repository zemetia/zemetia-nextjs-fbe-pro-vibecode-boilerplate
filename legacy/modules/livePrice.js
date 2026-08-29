// ==========================================
// Live Gold & Silver Price Ticker Module
// GLOBAL MARKET FEED VERSION
// ==========================================

const LivePriceService = {
    baseGold: 2600000, // Default fallback IDR / gram
    baseSilver: 30000,
    currentGold: 2600000,
    currentSilver: 30000,
    updateInterval: null,
    apiRefreshInterval: null,
    exchangeRate: 15800, // Default fallback USDIDR

    init() {
        this.loadFromCache();
        this.injectTickerContainer();
        
        // 1. Start immediate fetch sequence
        this.refreshFromGlobalMarket();
        
        // 2. Set update interval for Visual Simulation (Flashing) every 5s
        this.startSimulation();

        // 3. Set refresh interval from REAL GLOBAL API every 1 Hour (3,600,000 ms)
        this.apiRefreshInterval = setInterval(() => {
            this.refreshFromGlobalMarket();
        }, 3600000); 
    },

    loadFromCache() {
        const cached = localStorage.getItem('erp_live_prices');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                this.currentGold = parsed.gold || this.currentGold;
                this.currentSilver = parsed.silver || this.currentSilver;
                this.exchangeRate = parsed.exchangeRate || this.exchangeRate;
            } catch(e) {}
        }
    },

    async refreshFromGlobalMarket() {
        console.log('📡 [LivePrice] Connecting to Global Market Feed...');
        try {
            // STEP 1: Get USD to IDR Exchange Rate
            const rateRes = await fetch('https://open.er-api.com/v6/latest/USD');
            const rateData = await rateRes.json();
            if (rateData && rateData.rates && rateData.rates.IDR) {
                this.exchangeRate = rateData.rates.IDR;
            }

            // STEP 2: Get Gold (XAU) Price in USD per Ounce
            const goldRes = await fetch('https://api.gold-api.com/price/XAU');
            const goldData = await goldRes.json();
            
            // STEP 3: Get Silver (XAG) Price in USD per Ounce
            const silverRes = await fetch('https://api.gold-api.com/price/XAG');
            const silverData = await silverRes.json();

            // CONVERSION FORMULA
            // Price per Troy Ounce / 31.1035 = Price per Gram (USD)
            // Price per Gram (USD) * Rate(IDR) = Price per Gram (IDR)
            const gramsPerOunce = 31.1035;

            if (goldData && goldData.price) {
                const usdPerGram = parseFloat(goldData.price) / gramsPerOunce;
                this.currentGold = usdPerGram * this.exchangeRate;
            }

            if (silverData && silverData.price) {
                const usdPerGram = parseFloat(silverData.price) / gramsPerOunce;
                this.currentSilver = usdPerGram * this.exchangeRate;
            }

            // Cache them
            localStorage.setItem('erp_live_prices', JSON.stringify({
                gold: this.currentGold,
                silver: this.currentSilver,
                exchangeRate: this.exchangeRate,
                updatedAt: new Date().toISOString()
            }));

            console.log('✅ [LivePrice] Synced with Market:', {
                gold: this.currentGold,
                silver: this.currentSilver,
                rate: this.exchangeRate
            });

            // Immediately visually update without waiting for simulator tick
            this.renderItem('gold-price-display', '🥇 Gold (XAU/IDR)', this.currentGold, this.currentGold);
            this.renderItem('silver-price-display', '🥈 Silver (XAG/IDR)', this.currentSilver, this.currentSilver);

        } catch (error) {
            console.error('❌ [LivePrice] Failed to fetch market data:', error);
        }
    },

    injectTickerContainer() {
        if (document.getElementById('live-price-ticker')) return;

        const appContainer = document.querySelector('.app-container');
        if (!appContainer) return;

        const ticker = document.createElement('div');
        ticker.id = 'live-price-ticker';
        ticker.style = `
            position: fixed;
            top: 0; left: 0; right: 0;
            height: 45px;
            background: #0f172a;
            color: #f8fafc;
            z-index: 9999;
            display: flex;
            align-items: center;
            padding: 0 24px;
            font-size: 15px;
            font-weight: 600;
            border-bottom: 2px solid #3b82f6;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;

        ticker.innerHTML = `
            <div style="display: flex; gap: 6px; align-items: center; margin-right: 25px;">
                <span style="background: #dc2626; padding: 2px 6px; border-radius: 4px; font-size: 11px; letter-spacing: 0.5px; animation: pulse 2s infinite;">LIVE</span>
            </div>
            <div style="display: flex; gap: 35px; flex-grow: 1;" id="ticker-items">
                <div id="gold-price-display">
                    🥇 Gold: <span style="color:#ffffff">Connecting...</span>
                </div>
                <div id="silver-price-display">
                    🥈 Silver: <span style="color:#ffffff">Connecting...</span>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="font-size: 11px; color: #94a3b8; font-weight: 400;" id="ticker-source">🌐 Source: Global Market</div>
                <button onclick="LivePriceService.refreshFromGlobalMarket()" style="background: none; border: 1px solid #475569; color: #94a3b8; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer;" title="Force Refresh">🔄</button>
            </div>
        `;

        document.body.appendChild(ticker);

        const styleSheet = document.createElement("style");
        styleSheet.innerText = `@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }`;
        document.head.appendChild(styleSheet);

        document.body.style.paddingTop = '45px';
    },

    startSimulation() {
        this.updatePrices();
        // Fine-tuned fluctuation to not deviate much from Global Market
        this.updateInterval = setInterval(() => this.updatePrices(), 5000);
    },

    updatePrices() {
        // Light visually simulated jitter to keep the dashboard "alive" (0.001%)
        const goldJitter = (Math.random() - 0.5) * 50; 
        const silverJitter = (Math.random() - 0.5) * 1;

        const oldGold = this.currentGold;
        this.currentGold = this.currentGold + goldJitter;
        this.currentSilver = this.currentSilver + silverJitter;

        this.renderItem('gold-price-display', '🥇 Gold (XAU/IDR)', this.currentGold, oldGold);
        this.renderItem('silver-price-display', '🥈 Silver (XAG/IDR)', this.currentSilver, oldGold);
    },

    renderItem(elementId, label, value, oldValue) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const isUp = value >= oldValue;
        const color = isUp ? '#10b981' : '#ef4444';
        const icon = isUp ? '▲' : '▼';

        el.innerHTML = `
            ${label}: 
            <span style="color: ${color}; font-size: 18px; font-weight: 800; transition: all 0.3s ease; font-family: 'Courier New', monospace; margin-left: 8px;">
                ${this.formatCurrency(value)}
                <span style="font-size: 12px; margin-left: 4px;">${icon}</span>
            </span>
        `;
        
        el.style.opacity = '0.5';
        setTimeout(() => el.style.opacity = '1', 200);
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    },
    
    getGoldPrice() {
        return this.currentGold;
    }
};

window.LivePriceService = LivePriceService;
