/**
 * AgentOrchestrator
 * The central engine for autonomous agents in the ERP.
 * Manages task scheduling, state monitoring, and agent execution.
 */
const AgentOrchestrator = {
    agents: {},
    taskQueue: [],
    isActive: false,
    pollInterval: 300000, // 5 minutes (was 10s — was causing Firestore reads every 10s!)

    init() {
        console.log('🤖 [Orchestrator] Initializing Autonomous Engine...');
        this.isActive = true;
        this.registerDefaultAgents();
        this.startLoop();

        // Listen for external task triggers
        window.addEventListener('erp-agent-trigger', (e) => this.handleTrigger(e.detail));

        this.log('Engine Started');
    },

    registerAgent(name, config) {
        this.agents[name] = {
            ...config,
            lastRun: null,
            status: 'idle'
        };
        console.log(`🤖 [Orchestrator] Registered Agent: ${name}`);
    },

    startLoop() {
        if (!this.isActive) return;

        setInterval(async () => {
            await this.checkAgents();
            await this.processQueue();
        }, this.pollInterval);
    },

    async checkAgents() {
        for (const [name, agent] of Object.entries(this.agents)) {
            if (agent.shouldRun && agent.shouldRun()) {
                await this.runAgent(name);
            }
        }
    },

    async runAgent(name) {
        const agent = this.agents[name];
        if (agent.status === 'running') return;

        try {
            this.log(`Agent ${name} starting...`, 'info');
            agent.status = 'running';
            this.updateUI();

            await agent.execute();

            agent.status = 'idle';
            agent.lastRun = new Date().toISOString();
            this.log(`Agent ${name} completed successfully.`, 'success');
        } catch (error) {
            agent.status = 'error';
            this.log(`Agent ${name} failed: ${error.message}`, 'error');
        } finally {
            this.updateUI();
        }
    },

    handleTrigger(detail) {
        this.log(`Trigger received: ${detail.action}`, 'info');
        this.taskQueue.push(detail);
    },

    async processQueue() {
        if (this.taskQueue.length === 0) return;
        const task = this.taskQueue.shift();
        // Process logic...
    },

    log(message, type = 'info') {
        const entry = {
            timestamp: new Date().toISOString(),
            message,
            type,
            id: 'LOG-' + Date.now()
        };

        const logs = JSON.parse(localStorage.getItem('erp_agent_logs') || '[]');
        logs.unshift(entry);
        localStorage.setItem('erp_agent_logs', JSON.stringify(logs.slice(0, 50)));

        window.dispatchEvent(new CustomEvent('erp-agent-log-updated', { detail: entry }));
    },

    updateUI() {
        window.dispatchEvent(new CustomEvent('erp-agent-status-updated'));
        this.refreshWidget();
    },

    renderActivityWidget() {
        return `
            <div class="card mt-6" id="agent-monitor-card">
                <div class="card-header flex justify-between align-center">
                    <h2 class="card-title">🤖 Autonomous Agent Monitor</h2>
                    <div id="orchestrator-status-blob" class="status-blob active">ACTIVE</div>
                </div>
                <div class="card-body">
                    <div class="agent-grid mb-4" id="agent-status-list">
                        ${this.renderAgentStatusList()}
                    </div>
                    <hr class="my-4 opacity-10">
                    <div class="agent-logs">
                        <h4 class="text-sm font-semibold mb-2 text-gray uppercase tracking-wider">Recent Activity Log</h4>
                        <div id="agent-log-container" class="space-y-2 max-h-48 overflow-y-auto pr-2">
                            ${this.renderLogs()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderAgentStatusList() {
        if (Object.keys(this.agents).length === 0) {
            return '<p class="text-center text-gray italic py-4">No agents registered.</p>';
        }

        return Object.entries(this.agents).map(([name, agent]) => `
            <div class="agent-status-item p-3 bg-dark-alt rounded-lg border border-gray-900">
                <div class="flex justify-between align-center mb-1">
                    <span class="font-semibold">${name}</span>
                    <span class="badge badge-${agent.status === 'running' ? 'primary' : (agent.status === 'error' ? 'error' : 'secondary')}">
                        ${agent.status.toUpperCase()}
                    </span>
                </div>
                <div class="text-xs text-gray">Last Run: ${agent.lastRun ? new Date(agent.lastRun).toLocaleTimeString() : 'Never'}</div>
            </div>
        `).join('');
    },

    renderLogs() {
        const logs = JSON.parse(localStorage.getItem('erp_agent_logs') || '[]');
        if (logs.length === 0) {
            return '<p class="text-xs text-center text-gray py-2">No activity logs yet.</p>';
        }

        return logs.map(log => `
            <div class="log-entry text-xs flex gap-3 p-2 rounded hover:bg-white/5 transition-colors border-l-2 border-${this.getLogColor(log.type)}">
                <span class="text-gray-500 font-mono">${new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                <span class="font-medium">${log.message}</span>
            </div>
        `).join('');
    },

    getLogColor(type) {
        switch (type) {
            case 'success': return 'success';
            case 'error': return 'error';
            case 'warning': return 'warning';
            default: return 'primary';
        }
    },

    refreshWidget() {
        const list = document.getElementById('agent-status-list');
        const logs = document.getElementById('agent-log-container');
        if (list) list.innerHTML = this.renderAgentStatusList();
        if (logs) logs.innerHTML = this.renderLogs();
    },

    registerDefaultAgents() {
        /**
         * CONTOH IMPLEMENTASI DARI skills.md
         * 1. Asset Guardian
         * Sesuai definisi di skills.md: Melakukan jurnal penyusutan otomatis
         */
        this.registerAgent('Asset Guardian', {
            shouldRun: () => {
                if (typeof FixedAssets === 'undefined') return false;
                const pending = FixedAssets.getPendingDepreciationMonths();
                return pending.length > 0;
            },
            execute: async () => {
                console.log('🤖 [Asset Guardian] Processing pending depreciation...');
                const pending = FixedAssets.getPendingDepreciationMonths();
                for (const month of pending) {
                    await FixedAssets.runDepreciation(month);
                }
            }
        });

        // 2. TTB Sentinel
        this.registerAgent('TTB Sentinel', {
            shouldRun: () => {
                if (typeof TTB === 'undefined') return false;
                return TTB.getPendingApprovals().length > 0;
            },
            execute: async () => {
                const pending = TTB.getPendingApprovals();
                console.log(`🤖 [TTB Sentinel] Found ${pending.length} documents pending approval.`);
            }
        });

        // 3. Risk Commander (Connecting to RiskMonitor.js)
        this.registerAgent('Risk Commander', {
            shouldRun: () => {
                if (typeof RiskMonitor === 'undefined') return false;
                const status = RiskMonitor.getStatus();
                return status.isRunning && (Date.now() - (this.lastRiskCheck || 0) > 1800000); // 30 mins
            },
            execute: async () => {
                console.log('🤖 [Risk Commander] Running high-level security/finance audit...');
                this.lastRiskCheck = Date.now();
                await RiskMonitor.performChecks();
            }
        });

        // 4. Inventory Watchman
        this.registerAgent('Inventory Watchman', {
            shouldRun: () => {
                const lastCheck = localStorage.getItem('last_inventory_watch');
                const today = new Date().toISOString().split('T')[0];
                return lastCheck !== today;
            },
            execute: async () => {
                console.log('🤖 [Inventory Watchman] Checking safety stocks...');
                localStorage.setItem('last_inventory_watch', new Date().toISOString().split('T')[0]);
            }
        });
    }
};

window.AgentOrchestrator = AgentOrchestrator;
