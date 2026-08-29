// ==========================================
// Master Refining Rules Module
// Manages Metal Return % and Refining Fees based on Grade & Weight
// ==========================================

const MasterRefiningRules = {
    // Default Rules based on User's Table
    // We group by Grade ID, and then define ranges
    rules: [
        // 24K Rules (99.99%)
        { grade_id: 'P-24K', min_weight: 0, max_weight: 99999, refining_fee: 1000, ppn: 110, pph: 20, au_return_pct: 100.00, ag_return: 98.00 },

        // 23K Rules (95.83 - 99.99%)
        { grade_id: 'P-23K', min_weight: 0, max_weight: 5, refining_fee: 1000, ppn: 110, pph: 20, au_return_pct: 99.98, ag_return: 98.00 },
        { grade_id: 'P-23K', min_weight: 5.001, max_weight: 10, refining_fee: 1000, ppn: 110, pph: 20, au_return_pct: 99.98, ag_return: 98.00 },
        { grade_id: 'P-23K', min_weight: 10.001, max_weight: 15, refining_fee: 1000, ppn: 110, pph: 20, au_return_pct: 99.98, ag_return: 98.00 },
        { grade_id: 'P-23K', min_weight: 15.001, max_weight: 99999, refining_fee: 1000, ppn: 110, pph: 20, au_return_pct: 99.98, ag_return: 98.00 },

        // 21-23K Rules
        { grade_id: 'P-22K', min_weight: 0, max_weight: 99999, refining_fee: 1000, ppn: 110, pph: 20, au_return_pct: 99.95, ag_return: 98.00 },
        { grade_id: 'P-21K', min_weight: 0, max_weight: 99999, refining_fee: 1000, ppn: 110, pph: 20, au_return_pct: 99.95, ag_return: 98.00 },

        // 12-21K Rules (Range covering 20K, 19K, ..., 13K)
        // We map multiple grades to this rule set
        ...['P-20K', 'P-19K', 'P-18K', 'P-17K', 'P-16K', 'P-15K', 'P-14K', 'P-13K'].map(gid =>
            ({ grade_id: gid, min_weight: 0, max_weight: 99999, refining_fee: 1000, ppn: 110, pph: 20, au_return_pct: 99.90, ag_return: 98.00 })
        ),

        // 3-12K Rules
        ...['P-12K', 'P-11K', 'P-10K', 'P-9K', 'P-8K', 'P-6K'].map(gid =>
            ({ grade_id: gid, min_weight: 0, max_weight: 99999, refining_fee: 1000, ppn: 110, pph: 20, au_return_pct: 99.70, ag_return: 98.00 })
        ),
    ],

    init() {
        console.log('MasterRefiningRules initialized');
        const stored = Storage.get(Storage.KEYS.MASTER_REFINING_RULES);
        if (stored && stored.length > 0) {
            this.rules = stored;
        } else {
            this.save();
        }
    },

    async save() {
        await Storage.set(Storage.KEYS.MASTER_REFINING_RULES, this.rules);
    },

    // Main Function to calculate Return & Fees
    calculateReturn(gradeId, weight) {
        if (!gradeId || weight <= 0) return null;

        const rule = this.rules.find(r =>
            r.grade_id === gradeId &&
            weight >= r.min_weight &&
            weight <= r.max_weight
        );

        if (!rule) {
            console.warn(`No refining rule found for ${gradeId} with weight ${weight}g`);
            return null;
        }

        return rule;
    },

    getRule(gradeId, weight) {
        return this.calculateReturn(gradeId, weight);
    },

    getAllRules() {
        return this.rules;
    },

    // CRUD Operations for Management UI
    addRule(rule) {
        this.rules.push(rule);
        this.save();
    },

    updateRule(index, updatedRule) {
        if (index >= 0 && index < this.rules.length) {
            this.rules[index] = { ...this.rules[index], ...updatedRule };
            this.save();
        }
    },

    deleteRule(index) {
        if (index >= 0 && index < this.rules.length) {
            this.rules.splice(index, 1);
            this.save();
        }
    }
};

window.MasterRefiningRules = MasterRefiningRules;
