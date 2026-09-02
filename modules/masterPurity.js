// ==========================================
// Master Purity Module
// Manages Metal Grades (Karat) and Purity Ranges
// ==========================================

const MasterPurity = {
    // Built-in defaults — always available as hard fallback
    DEFAULT_GRADES: [
        { id: 'P-24K', metal: 'GOLD', grade: '24K', min: 99.99, max: 100.00, description: 'Logam Mulia (LM)' },
        { id: 'P-23K', metal: 'GOLD', grade: '23K', min: 95.83, max: 99.98, description: 'Emas Tua' },
        { id: 'P-22K', metal: 'GOLD', grade: '22K', min: 91.67, max: 95.82, description: 'Emas 916' },
        { id: 'P-21K', metal: 'GOLD', grade: '21K', min: 87.50, max: 91.66, description: 'Emas 21K' },
        { id: 'P-20K', metal: 'GOLD', grade: '20K', min: 83.33, max: 87.49, description: 'Emas 20K' },
        { id: 'P-19K', metal: 'GOLD', grade: '19K', min: 79.17, max: 83.32, description: 'Emas 19K' },
        { id: 'P-18K', metal: 'GOLD', grade: '18K', min: 75.00, max: 79.16, description: 'Emas 18K' },
        { id: 'P-17K', metal: 'GOLD', grade: '17K', min: 70.83, max: 74.99, description: 'Emas 17K' },
        { id: 'P-16K', metal: 'GOLD', grade: '16K', min: 66.67, max: 70.82, description: 'Emas 16K' },
        { id: 'P-15K', metal: 'GOLD', grade: '15K', min: 62.50, max: 66.66, description: 'Emas 15K' },
        { id: 'P-14K', metal: 'GOLD', grade: '14K', min: 58.33, max: 62.49, description: 'Emas 14K' },
        { id: 'P-13K', metal: 'GOLD', grade: '13K', min: 54.17, max: 58.32, description: 'Emas 13K' },
        { id: 'P-12K', metal: 'GOLD', grade: '12K', min: 50.00, max: 54.16, description: 'Emas 12K' },
        { id: 'P-11K', metal: 'GOLD', grade: '11K', min: 45.83, max: 49.99, description: 'Emas 11K' },
        { id: 'P-10K', metal: 'GOLD', grade: '10K', min: 41.67, max: 45.82, description: 'Emas 10K' },
        { id: 'P-9K',  metal: 'GOLD', grade: '9K',  min: 37.50, max: 41.66, description: 'Emas 9K' },
        { id: 'P-8K',  metal: 'GOLD', grade: '8K',  min: 33.33, max: 37.49, description: 'Emas 8K' },
        { id: 'P-6K',  metal: 'GOLD', grade: '6K',  min: 25.00, max: 33.32, description: 'Emas 6K' },
        { id: 'S-999', metal: 'SILVER', grade: 'Silver 999', min: 99.90, max: 100.00, description: 'Fine Silver' },
        { id: 'S-925', metal: 'SILVER', grade: 'Sterling',   min: 92.50, max: 99.89, description: 'Perak Standar' },
        { id: 'S-STD', metal: 'SILVER', grade: 'Silver Std', min: 50.00, max: 92.49, description: 'Perak Campur' }
    ],

    // Active working grades (may be overridden from storage)
    grades: [],

    init() {
        // Always start from defaults
        this.grades = [...this.DEFAULT_GRADES];

        // Load from storage if exists — only use if it has a reasonable amount of data
        const stored = Storage.get(Storage.KEYS.MASTER_PURITY_GRADES);
        if (stored && Array.isArray(stored) && stored.length >= this.DEFAULT_GRADES.length) {
            this.grades = stored;
            console.log('MasterPurity: loaded from storage (' + stored.length + ' grades)');
        } else if (!stored || stored.length === 0) {
            // First time or empty: save defaults to storage
            console.log('MasterPurity: saving default grades to storage');
            this.save();
        } else {
            console.warn('MasterPurity: stored grades count (' + (stored?.length || 0) + ') < defaults (' + this.DEFAULT_GRADES.length + '). Using defaults.');
        }
    },

    async save() {
        await Storage.set(Storage.KEYS.MASTER_PURITY_GRADES, this.grades);
    },

    // Main Function to determine Grade from XRF
    getGrade(metal, purityPercentage) {
        if (!metal || purityPercentage === undefined) return null;
        metal = metal.toUpperCase();
        const pct = parseFloat(purityPercentage);

        // Search current grades first
        let found = this.grades.find(g => g.metal === metal && pct >= g.min && pct <= g.max);

        // Fallback to built-in defaults if not found (guards against stale/corrupt stored data)
        if (!found) {
            found = this.DEFAULT_GRADES.find(g => g.metal === metal && pct >= g.min && pct <= g.max);
        }

        return found || null;
    },

    getPurityGrade(metal, purityPercentage) {
        return this.getGrade(metal, purityPercentage);
    },

    getAllGrades() {
        return this.grades;
    },

    // CRUD Operations for Management UI
    addGrade(grade) {
        this.grades.push(grade);
        this.save();
    },

    updateGrade(id, updatedData) {
        const idx = this.grades.findIndex(g => g.id === id);
        if (idx !== -1) {
            this.grades[idx] = { ...this.grades[idx], ...updatedData };
            this.save();
        }
    },

    deleteGrade(id) {
        this.grades = this.grades.filter(g => g.id !== id);
        this.save();
    }
};

window.MasterPurity = MasterPurity;
