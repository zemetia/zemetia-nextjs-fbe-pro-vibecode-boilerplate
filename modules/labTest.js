// ==========================================
// Lab Test Module
// Purity Testing & Verification for Precious Metals
// ==========================================

const LabTest = {
    labTests: [],

    init() {
        this.loadLabTests();
    },

    loadLabTests() {
        this.labTests = Storage.get(Storage.KEYS.LAB_TESTS) || [];
    },

    async saveLabTests() {
        await Storage.set(Storage.KEYS.LAB_TESTS, this.labTests);
    },

    /**
     * Generate lab test number
     */
    generateTestNumber() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const count = this.labTests.filter(t =>
            t.testNumber.startsWith(`LAB-${year}${month}`)
        ).length + 1;
        return `LAB-${year}${month}-${String(count).padStart(4, '0')}`;
    },

    /**
     * Create new lab test
     */
    async createLabTest(sampleData) {
        const labTest = {
            id: Date.now(),
            testNumber: this.generateTestNumber(),
            testDate: new Date().toISOString().split('T')[0],

            // Sample information
            sampleFrom: sampleData.sourceDocument,
            sampleFromId: sampleData.sourceDocumentId,
            sampleType: sampleData.sampleType || 'incoming_material',
            itemCode: sampleData.itemCode,
            itemName: sampleData.itemName,

            // Sample details
            sampleGrossWeight: sampleData.sampleWeight,
            sampleId: sampleData.sampleId || `S-${Date.now()}`,

            // Status
            status: 'pending',

            // Test results (to be filled)
            testResults: null,

            // Technician
            createdBy: Auth.getCurrentUser().id,
            createdByName: Auth.getCurrentUser().name,
            createdAt: new Date().toISOString()
        };

        this.labTests.push(labTest);
        await this.saveLabTests();

        AuditLog.log('create', 'lab_test', labTest.id,
            `Created lab test ${labTest.testNumber} for ${sampleData.itemCode}`);

        return { success: true, labTest };
    },

    /**
     * Record test results
     */
    async recordTestResults(labTestId, results) {
        const labTest = this.labTests.find(t => t.id === labTestId);

        if (!labTest) {
            return { success: false, error: 'Lab test not found' };
        }

        // Calculate actual purity
        const actualPurity = (results.goldContent / labTest.sampleGrossWeight) * 100;
        const actualPurityDecimal = actualPurity / 100;

        // Get item for nominal purity
        const items = Storage.getItems();
        const item = items.find(i => i.code === labTest.itemCode);
        const nominalPurity = item?.nominalPurity || 0;

        labTest.testResults = {
            // Composition analysis
            goldContent: parseFloat(results.goldContent),
            silverContent: parseFloat(results.silverContent) || 0,
            copperContent: parseFloat(results.copperContent) || 0,
            otherMetals: parseFloat(results.otherMetals) || 0,
            impurities: parseFloat(results.impurities) || 0,

            // Calculated purity
            actualPurity: actualPurity,
            actualPurityDecimal: actualPurityDecimal,

            // Variance from nominal
            nominalPurity: nominalPurity,
            variance: actualPurity - nominalPurity,
            variancePercentage: nominalPurity > 0 ?
                ((actualPurity - nominalPurity) / nominalPurity * 100) : 0,

            // Physical Integrity (Added for Anti-Fraud)
            physicalCheck: results.physicalCheck || {
                method: 'none', // e.g., 'cut', 'drill', 'acid', 'fire'
                isVerified: false
            }
        };

        labTest.status = 'completed';
        labTest.testedBy = Auth.getCurrentUser().id;
        labTest.testedByName = Auth.getCurrentUser().name;
        labTest.testedAt = new Date().toISOString();

        await this.saveLabTests();

        AuditLog.log('update', 'lab_test', labTest.id,
            `Recorded test results: ${actualPurity.toFixed(2)}% purity`);

        console.log(`🔬 Lab Test ${labTest.testNumber} completed:`);
        console.log(`   Sample: ${labTest.sampleGrossWeight}g`);
        console.log(`   Gold Content: ${results.goldContent}g`);
        console.log(`   Actual Purity: ${actualPurity.toFixed(2)}%`);
        console.log(`   Nominal Purity: ${nominalPurity}%`);
        console.log(`   Variance: ${labTest.testResults.variance.toFixed(2)}%`);

        return { success: true, labTest };
    },

    /**
     * Approve lab test
     */
    async approveLabTest(labTestId) {
        const labTest = this.labTests.find(t => t.id === labTestId);

        if (!labTest) {
            return { success: false, error: 'Lab test not found' };
        }

        if (labTest.status !== 'completed') {
            return { success: false, error: 'Test results not yet recorded' };
        }

        labTest.status = 'approved';
        labTest.approvedBy = Auth.getCurrentUser().id;
        labTest.approvedByName = Auth.getCurrentUser().name;
        labTest.approvedAt = new Date().toISOString();

        await this.saveLabTests();

        AuditLog.log('update', 'lab_test', labTest.id, 'Lab test approved');

        return { success: true, labTest };
    },

    /**
     * Get lab test by ID
     */
    getLabTest(id) {
        return this.labTests.find(t => t.id === id);
    },

    /**
     * Get lab tests by status
     */
    getLabTestsByStatus(status) {
        return this.labTests.filter(t => t.status === status);
    },

    /**
     * Get lab tests for a source document
     */
    getLabTestsForDocument(sourceDocument, sourceDocumentId) {
        return this.labTests.filter(t =>
            t.sampleFrom === sourceDocument && t.sampleFromId === sourceDocumentId
        );
    },

    /**
     * Format currency
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }
};

// Add LAB_TESTS to Storage keys if not exists
if (!Storage.KEYS.LAB_TESTS) {
    Storage.KEYS.LAB_TESTS = 'lab_tests';
}


// Explicitly make LabTest globally available
window.LabTest = LabTest;
