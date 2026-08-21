/**
 * @jest-environment jsdom
 */

/**
 * Test Suite: BPJS Offboarding Export & Mutation Guard
 * Tests SIPP Online (BPJS TK) and e-Dabu (BPJS Kesehatan) data export & filtering
 */

global.Auth = {
  isAuthenticated: () => true,
  getCurrentUser: () => ({ role: 'ADMIN', username: 'admin' })
};

global.XLSX = {
  utils: {
    aoa_to_sheet: jest.fn((data) => ({ data })),
    book_new: jest.fn(() => ({})),
    book_append_sheet: jest.fn()
  },
  writeFile: jest.fn()
};

global.alert = jest.fn();

let mockEmployees = [];
let mockPayroll = [];

global.Storage = {
  getEmployees: jest.fn(() => mockEmployees),
  getPayroll: jest.fn(() => mockPayroll),
  getOvertimeSettings: jest.fn(() => ({
    bpjs_health_emp: 1,
    bpjs_health_comp: 4,
    jht_emp: 2,
    jht_comp: 3.7,
    jkk_comp: 0.89,
    jkm_comp: 0.3,
    enforce_umk_floor: true
  }))
};

global.TaxEngineTER = {
  calculatePPh21: jest.fn(() => ({
    taxAmount: 0,
    ratePct: 0,
    category: 'A'
  }))
};

const MasterEmployee = require('../../modules/masterEmployee.js');
const BPJSTaxCompliance = require('../../modules/bpjsTaxCompliance.js');

describe('BPJS Offboarding & Termination Mutation Export Tests', () => {
  beforeEach(() => {
    mockEmployees = [
      { id: 1, nik: 'EMP-001', name: 'BUDI ACTIVE', status: 'active', department: 'PROD', base_salary: 6000000 },
      { id: 2, nik: 'EMP-002', name: 'ANDI RESIGNED', status: 'NON-AKTIF', resignation_date: '2026-08-15', resignation_reason: 'Mengundurkan Diri', bpjs_employment: '0012345678', bpjs_health: '0001234567890', ktp: '3578012345678901', kk_number: '3578012345670000', department: 'FIN' }
    ];
    mockPayroll = [];
    MasterEmployee.employees = mockEmployees;
    jest.clearAllMocks();
  });

  test('1. MasterEmployee.exportSippOffboarding generates SIPP Online termination sheet for inactive employees', () => {
    MasterEmployee.exportSippOffboarding('2026-08');

    expect(global.XLSX.utils.aoa_to_sheet).toHaveBeenCalled();
    const calls = global.XLSX.utils.aoa_to_sheet.mock.calls;
    const sheetData = calls[0][0];

    // Find the row for ANDI RESIGNED
    const andiRow = sheetData.find(r => Array.isArray(r) && r.includes('ANDI RESIGNED'));
    expect(andiRow).toBeDefined();
    expect(andiRow).toContain('0012345678');
    expect(andiRow).toContain('3578012345678901');
    expect(andiRow).toContain('2026-08-15');
    expect(andiRow).toContain('Mengundurkan Diri');
  });

  test('2. BPJSTaxCompliance.exportEdabuOffboarding generates e-Dabu termination sheet for inactive employees', () => {
    BPJSTaxCompliance.exportEdabuOffboarding('2026-08');

    expect(global.XLSX.utils.aoa_to_sheet).toHaveBeenCalled();
    const calls = global.XLSX.utils.aoa_to_sheet.mock.calls;
    const sheetData = calls[0][0];

    const andiRow = sheetData.find(r => Array.isArray(r) && r.includes('ANDI RESIGNED'));
    expect(andiRow).toBeDefined();
    expect(andiRow).toContain('0001234567890');
    expect(andiRow).toContain('3578012345678901');
    expect(andiRow).toContain('3578012345670000');
    expect(andiRow).toContain('2026-08-15');
  });

  test('3. BPJSTaxCompliance excludes employees who resigned before active period from calculations', async () => {
    mockEmployees = [
      { id: 1, nik: 'EMP-001', name: 'BUDI ACTIVE', status: 'active', base_salary: 6000000, bpjs_health_enabled: true, bpjs_tk_enabled: true },
      { id: 2, nik: 'EMP-OLD-RESIGN', name: 'DONI PAST RESIGN', status: 'NON-AKTIF', resignation_date: '2026-06-30', base_salary: 6000000, bpjs_health_enabled: true, bpjs_tk_enabled: true }
    ];

    BPJSTaxCompliance.activePeriod = '2026-08';
    await BPJSTaxCompliance.loadData();

    // DONI PAST RESIGN should NOT be in the active reconciliation rows for 2026-08
    const doniInReconciliation = BPJSTaxCompliance.reconciliationData.find(r => r.nik === 'EMP-OLD-RESIGN');
    expect(doniInReconciliation).toBeUndefined();

    // BUDI ACTIVE should be in the reconciliation
    const budiInReconciliation = BPJSTaxCompliance.reconciliationData.find(r => r.nik === 'EMP-001');
    expect(budiInReconciliation).toBeDefined();
  });
});
