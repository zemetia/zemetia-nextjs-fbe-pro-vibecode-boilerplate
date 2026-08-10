// Properly mock JSDOM window objects first
global.window = global.window || {};
global.window.db = {};
global.window.firestore = {
    collection: jest.fn(),
    getDocs: jest.fn().mockResolvedValue({
        forEach: jest.fn()
    }),
    query: jest.fn(),
    where: jest.fn(),
    limit: jest.fn()
};

// Mock XLSX
global.XLSX = {
    utils: {
        json_to_sheet: jest.fn(() => ({})),
        book_new: jest.fn(() => ({})),
        book_append_sheet: jest.fn()
    },
    writeFile: jest.fn()
};

const Payroll = require('../../modules/payroll.js');

// Mock global.Storage
global.Storage = {
    KEYS: {
        PAYROLL: 'erp_payroll',
        EMPLOYEES: 'employees'
    },
    getEmployees: jest.fn(() => []),
    getPayroll: jest.fn(() => []),
    getOvertimeSettings: jest.fn(() => ({
        bpjs_health_emp: 1,
        jht_emp: 2,
        bpjs_health_comp: 4,
        jht_comp: 3.7,
        jkk_comp: 0.24,
        jkm_comp: 0.3
    })),
    getAttendance: jest.fn(() => []),
    getProductionLogs: jest.fn(() => []),
    getPayrollPeriods: jest.fn(() => []),
    set: jest.fn(async () => true),
    get: jest.fn(() => null)
};

// Mock alert
global.alert = jest.fn();

describe('Payroll Excel Import & Standalone Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Payroll.payrollRecords = [];
        Payroll.employees = [
            { nik: 'NIK001', name: 'John Doe', base_salary: 5000000, department: 'IT', position: 'Developer', ptkp: 'K/0', npwp: '12.345.678.9-012.000' },
            { nik: 'NIK002', name: 'Jane Smith', base_salary: 6000000, department: 'HR', position: 'Manager', ptkp: 'TK/0', npwp: '-' }
        ];
        Payroll.period = '2026-07';
        Payroll.isAuthenticatedWithPassword = true;
        
        global.window.firestore.getDocs.mockResolvedValue({
            forEach: jest.fn()
        });
    });

    test('exportToExcel generates a template from active employees when period list is empty', () => {
        global.Storage.getEmployees.mockReturnValue(Payroll.employees);

        Payroll.exportToExcel();

        expect(global.XLSX.utils.json_to_sheet).toHaveBeenCalled();
        const exportData = global.XLSX.utils.json_to_sheet.mock.calls[0][0];
        
        expect(exportData.length).toBe(2);
        expect(exportData[0]['Nama Karyawan']).toBe('John Doe');
        expect(exportData[0]['Basic Salary']).toBe(5000000);
        expect(exportData[0]['THP (Take Home Pay)']).toBe(5000000); // template THP defaults to basic salary
        expect(exportData[0]['H']).toBe(0); // template attendance defaults to 0
        
        expect(global.XLSX.writeFile).toHaveBeenCalledWith(expect.any(Object), 'Template_Payroll_2026-07.xlsx');
    });

    test('processImportExcel handles zero-pay entries correctly (resigned / inactive employees)', async () => {
        const mappings = {
            0: 'nik',
            1: 'base_salary',
            2: 'meal_pay',
            3: 'work_days'
        };

        const headers = ['NIK', 'Gaji Pokok', 'Tunjangan Makan', 'H'];
        const rows = [
            ['NIK001', '0', '0', '0'] // all components set to zero
        ];

        await Payroll.processImportExcel(mappings, headers, rows);

        expect(global.Storage.set).toHaveBeenCalled();
        const savedPayroll = global.Storage.set.mock.calls[0][1];
        const record = savedPayroll[0];

        expect(record.base_salary).toBe(0);
        expect(record.meal_pay).toBe(0);
        expect(record.work_days).toBe(0);
        expect(record.total_salary).toBe(0); // zero-balance entry
    });

    test('processImportExcel links manually added rows against Master Karyawan database', async () => {
        const mappings = {
            0: 'nik',
            1: 'base_salary'
        };

        const headers = ['NIK', 'Basic Salary'];
        const rows = [
            ['NIK002', '6000000'] // Jane Smith, missing from initial but manually added
        ];

        await Payroll.processImportExcel(mappings, headers, rows);

        const savedPayroll = global.Storage.set.mock.calls[0][1];
        const record = savedPayroll.find(r => r.nik === 'NIK002');
        
        expect(record).toBeDefined();
        expect(record.name).toBe('Jane Smith');
        expect(record.base_salary).toBe(6000000);
        expect(record.total_salary).toBe(6000000);
    });

    test('processImportExcel correctly maps standard columns and calculates net salary', async () => {
        const mappings = {
            0: 'nik',
            1: 'base_salary',
            2: 'meal_pay',
            3: 'bpjs_health_deduction',
            4: 'work_days'
        };

        const headers = ['NIK Karyawan', 'Gaji Pokok', 'Tunj Makan', 'Potongan BPJS', 'Hadir'];
        const rows = [
            ['NIK001', '5000000', '500000', '50000', '22'],
            ['NIK002', '6000000', '600000', '60000', '21']
        ];

        await Payroll.processImportExcel(mappings, headers, rows);

        expect(global.Storage.set).toHaveBeenCalledWith(global.Storage.KEYS.PAYROLL, expect.any(Array));
        const savedPayroll = global.Storage.set.mock.calls[0][1];
        
        expect(savedPayroll.length).toBe(2);
        
        const john = savedPayroll.find(r => r.nik === 'NIK001');
        expect(john).toBeDefined();
        expect(john.base_salary).toBe(5000000);
        expect(john.meal_pay).toBe(500000);
        expect(john.bpjs_health_deduction).toBe(50000);
        expect(john.work_days).toBe(22);
        expect(john.imported).toBe(true);
        expect(john.total_salary).toBe(5450000);
    });

    test('processImportExcel handles custom fields mapping and saves them in structured JSON fields', async () => {
        const mappings = {
            0: 'nik',
            1: 'base_salary',
            2: 'custom_earnings',
            3: 'custom_deductions',
            4: 'custom_benefits',
            5: 'custom_attendance'
        };

        const headers = ['NIK', 'Gapok', 'Custom CT', 'Custom Potongan', 'Custom Benefit BPJS', 'Holiday Shift'];
        const rows = [
            ['NIK001', '5000000', '200000', '15000', '40000', '2']
        ];

        await Payroll.processImportExcel(mappings, headers, rows);

        const savedPayroll = global.Storage.set.mock.calls[0][1];
        const record = savedPayroll[0];

        expect(record.custom_components['Custom CT']).toEqual({ type: 'earnings', amount: 200000 });
        expect(record.custom_components['Custom Potongan']).toEqual({ type: 'deduction', amount: 15000 });
        expect(record.custom_benefits['Custom Benefit BPJS']).toEqual({ amount: 40000 });
        expect(record.custom_attendance['Holiday Shift']).toBe(2);

        expect(record.total_salary).toBe(5185000);
    });

    test('generatePayroll skips overwriting imported records', async () => {
        Payroll.payrollRecords = [
            {
                id: 'PAY-2026-07-NIK001',
                nik: 'NIK001',
                name: 'John Doe',
                period: '2026-07',
                base_salary: 8888888,
                total_salary: 8888888,
                status: 'draft',
                imported: true
            }
        ];

        await Payroll.generatePayroll();

        const savedPayroll = global.Storage.set.mock.calls[0][1];
        const record = savedPayroll.find(r => r.nik === 'NIK001');
        
        expect(record.base_salary).toBe(8888888);
        expect(record.imported).toBe(true);
    });

    test('loadData correctly converts Excel serial numbers for start_date and resign_date to standard date strings', async () => {
        global.Storage.getEmployees.mockReturnValue([
            { nik: 'NIK003', name: 'Lucky', start_date: 45964, resign_date: undefined }
        ]);

        await Payroll.loadData();

        const lucky = Payroll.employees.find(e => e.nik === 'NIK003');
        expect(lucky.start_date).toBe('2025-11-03');
    });

    test('guessMapping correctly matches BPJS column headers without collisions', () => {
        expect(Payroll.guessMapping('BPJS K Employee')).toBe('bpjs_health_deduction');
        expect(Payroll.guessMapping('BPJS Kesehatan Employee')).toBe('bpjs_health_deduction');
        expect(Payroll.guessMapping('BPJS Kes Rate')).toBe('bpjs_kes_benefit');
        expect(Payroll.guessMapping('BPJS Kesehatan Rate')).toBe('bpjs_kes_benefit');
        expect(Payroll.guessMapping('BPJS TK Rate')).toBe('bpjs_tk_benefit');
        expect(Payroll.guessMapping('BPJS TK Karyawan')).toBe('jht_deduction');
        expect(Payroll.guessMapping('BPJS Ketenagakerjaan Employee')).toBe('jht_deduction');
        expect(Payroll.guessMapping('JHT Karyawan')).toBe('jht_deduction');
        expect(Payroll.guessMapping('BPJS Kes Karyawan')).toBe('bpjs_health_deduction');

        // Verify new exact column names
        expect(Payroll.guessMapping('Iuran BPJS Kes')).toBe('bpjs_health_deduction');
        expect(Payroll.guessMapping('Iuran JHT')).toBe('jht_deduction');
        expect(Payroll.guessMapping('Rate Dasar BPJS Kes')).toBe('bpjs_kes_benefit');
        expect(Payroll.guessMapping('Rate Dasar BPJS TK')).toBe('bpjs_tk_benefit');
    });

    test('saveEditModal correctly updates structured payroll components and recalculates THP', async () => {
        const record = {
            id: 'PAY-2026-07-NIK004',
            nik: 'NIK004',
            name: 'Rachel',
            period: '2026-07',
            base_salary: 5000000,
            imported: false
        };
        Payroll.payrollRecords = [record];

        // Create standard JSDOM inputs and append to body
        const inputs = {
            'edit-base-salary': 6000000,
            'edit-tunj-tetap': 500000,
            'edit-meal-pay': 100000,
            'edit-night-meal-pay': 50000,
            'edit-tunj-luar-kota': 200000,
            'edit-production-pay': 300000,
            'edit-presence-pay': 150000,
            'edit-previous-month-deficiency': 10000,
            'edit-bonus': 400000,
            'edit-overtime-pay': 250000,
            'edit-variable-allowance': 80000,
            'edit-potongan-tidak-hadir': 50000,
            'edit-potongan-lambat-pulang': 30000,
            'edit-bpjs-health-deduction': 60000,
            'edit-jht-deduction': 120000,
            'edit-pph21-deduction': 25000,
            'edit-other-deductions': 15000,
            'edit-bpjs-kes-benefit': 240000,
            'edit-bpjs-tk-benefit': 222000,
            'edit-pph21-benefit': 25000
        };

        const createdElements = [];
        Object.entries(inputs).forEach(([id, val]) => {
            const input = window.document.createElement('input');
            input.id = id;
            input.value = String(val);
            window.document.body.appendChild(input);
            createdElements.push(input);
        });

        const modal = window.document.createElement('div');
        modal.id = 'payroll-edit-modal';
        window.document.body.appendChild(modal);
        createdElements.push(modal);

        Payroll.render = jest.fn();

        await Payroll.saveEditModal('PAY-2026-07-NIK004');

        // Cleanup DOM
        createdElements.forEach(el => el.remove());

        expect(record.base_salary).toBe(6000000);
        expect(record.tunj_tetap).toBe(500000);
        expect(record.bpjs_health_deduction).toBe(60000);
        expect(record.bpjs_kes_benefit).toBe(240000);
        expect(record.imported).toBe(true);
        expect(record.total_salary).toBe(
            (6000000 + 500000 + 100000 + 50000 + 200000 + 300000 + 150000 + 10000 + 400000 + 250000 + 80000) -
            (50000 + 30000 + 60000 + 120000 + 25000 + 15000)
        );
    });

    test('automatically converts imported or edited BPJS Wage Basis (5.2m) to 1% deduction and 4% benefit across all employees', async () => {
        const records = [
            {
                id: 'PAY-2026-07-NIK005',
                nik: 'NIK005',
                name: 'Ardiyansah',
                period: '2026-07',
                base_salary: 5288796,
                bpjs_health_deduction: 5288796,
                bpjs_kes_benefit: 5288796,
                imported: true
            },
            {
                id: 'PAY-2026-07-NIK006',
                nik: 'NIK006',
                name: 'Budi',
                period: '2026-07',
                base_salary: 6000000,
                bpjs_health_deduction: 6000000,
                bpjs_kes_benefit: 6000000,
                imported: true
            }
        ];
        Storage.getPayroll.mockReturnValue(records);
        Payroll.employees = [
            { nik: 'NIK005', name: 'Ardiyansah', bpjs_wage_basis: 5288796 },
            { nik: 'NIK006', name: 'Budi', bpjs_wage_basis: 6000000 }
        ];

        // Trigger loadData self-healing pass
        await Payroll.loadData();

        expect(records[0].bpjs_health_deduction).toBe(52888); // 1% of 5,288,796
        expect(records[0].bpjs_kes_benefit).toBe(211552); // 4% of 5,288,796

        expect(records[1].bpjs_health_deduction).toBe(60000); // 1% of 6,000,000
        expect(records[1].bpjs_kes_benefit).toBe(240000); // 4% of 6,000,000
    });

    test('downloadAllPayslipsZIP generates PDF files and builds a ZIP package for all filtered records', async () => {
        const records = [
            {
                id: 'PAY-2026-07-NIK005',
                nik: 'NIK005',
                name: 'Ardiyansah',
                period: '2026-07',
                base_salary: 5288796,
                imported: true
            }
        ];
        Payroll.payrollRecords = records;
        Payroll.employees = [{ nik: 'NIK005', name: 'Ardiyansah' }];
        Payroll.period = '2026-07';

        // Mock window.JSZip
        const zipFileMock = jest.fn();
        const zipGenerateAsyncMock = jest.fn().mockResolvedValue(new Blob(['mockzip']));
        window.JSZip = jest.fn().mockImplementation(() => ({
            file: zipFileMock,
            generateAsync: zipGenerateAsyncMock
        }));

        // Mock generatePayslipPDF
        Payroll.generatePayslipPDF = jest.fn().mockReturnValue({
            output: jest.fn().mockReturnValue(new ArrayBuffer(8))
        });

        // Mock URL.createObjectURL
        window.URL.createObjectURL = jest.fn().mockReturnValue('blob:http://localhost/mockzip');
        window.URL.revokeObjectURL = jest.fn();
        window.alert = jest.fn();

        await Payroll.downloadAllPayslipsZIP();

        expect(Payroll.generatePayslipPDF).toHaveBeenCalled();
        expect(zipFileMock).toHaveBeenCalledWith('Payslip_2026-07_NIK005_Ardiyansah.pdf', expect.any(ArrayBuffer));
        expect(zipGenerateAsyncMock).toHaveBeenCalledWith({ type: 'blob' });
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Berhasil mengunduh ZIP'));
    });

    test('should format phone number to international country code 62 correctly', () => {
        expect(Payroll.formatPhoneNumber('08123456789')).toBe('628123456789');
        expect(Payroll.formatPhoneNumber('628123456789')).toBe('628123456789');
        expect(Payroll.formatPhoneNumber('8123456789')).toBe('628123456789');
        expect(Payroll.formatPhoneNumber('0812-3456-789')).toBe('628123456789');
        expect(Payroll.formatPhoneNumber(null)).toBeNull();
    });

    test('should build WhatsApp text message with THP and DOB password hint', () => {
        const record = { name: 'Ardiyansah', nik: '17', position: 'Staff', total_salary: 5000000, period: '2026-07' };
        const emp = { birth_date: '1994-10-11' };

        const msg = Payroll.buildWhatsAppTextMessage(record, emp);

        expect(msg).toContain('Yth. Bapak/Ibu Ardiyansah (NIK: 17)');
        expect(msg).toContain('Take Home Pay (THP): Rp 5.000.000');
        expect(msg).toContain('Password untuk membuka file PDF slip gaji Anda adalah: 11101994');
    });
});


