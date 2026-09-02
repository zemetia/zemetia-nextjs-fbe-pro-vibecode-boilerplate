// ==========================================
// Mini ERP - AI Advisor Module
// Intelligent Analytics & Recommendations
// ==========================================

const AIAdvisor = {
  // Initialize AI Advisor module
  init() {
    this.renderPage();
  },

  // ==========================================
  // DATA ANALYSIS FUNCTIONS
  // ==========================================

  // Analyze sales performance
  analyzeSales() {
    const entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
    const customers = Storage.get(Storage.KEYS.CUSTOMERS) || [];

    // Filter sales transactions
    const salesEntries = entries.filter(e =>
      e.lines.some(l => l.accountCode?.startsWith('4'))
    );

    if (salesEntries.length === 0) {
      return {
        totalRevenue: 0,
        avgTransactionValue: 0,
        transactionCount: 0,
        trend: 'stable',
        topCustomers: [],
        monthlyGrowth: 0
      };
    }

    // Calculate metrics
    const totalRevenue = salesEntries.reduce((sum, e) => {
      return sum + e.lines
        .filter(l => l.accountCode?.startsWith('4'))
        .reduce((s, l) => s + l.credit, 0);
    }, 0);

    const avgTransactionValue = totalRevenue / salesEntries.length;

    // Calculate monthly growth
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const lastMonthSales = salesEntries
      .filter(e => new Date(e.date) >= lastMonth && new Date(e.date) < now)
      .reduce((sum, e) => sum + e.lines.filter(l => l.accountCode?.startsWith('4')).reduce((s, l) => s + l.credit, 0), 0);

    const prevMonthSales = salesEntries
      .filter(e => new Date(e.date) >= twoMonthsAgo && new Date(e.date) < lastMonth)
      .reduce((sum, e) => sum + e.lines.filter(l => l.accountCode?.startsWith('4')).reduce((s, l) => s + l.credit, 0), 0);

    const monthlyGrowth = prevMonthSales > 0 ? ((lastMonthSales - prevMonthSales) / prevMonthSales) * 100 : 0;

    // Determine trend
    let trend = 'stable';
    if (monthlyGrowth > 5) trend = 'increasing';
    else if (monthlyGrowth < -5) trend = 'decreasing';

    // Top customers analysis
    const customerSales = {};
    salesEntries.forEach(entry => {
      const customer = entry.reference?.includes('CUST') ?
        entry.reference.match(/CUST-\d+/)?.[0] : null;
      if (customer) {
        const amount = entry.lines
          .filter(l => l.accountCode?.startsWith('4'))
          .reduce((s, l) => s + l.credit, 0);
        customerSales[customer] = (customerSales[customer] || 0) + amount;
      }
    });

    const topCustomers = Object.entries(customerSales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([code, amount]) => {
        const customer = customers.find(c => c.code === code);
        return {
          code,
          name: customer?.name || code,
          amount
        };
      });

    return {
      totalRevenue,
      avgTransactionValue,
      transactionCount: salesEntries.length,
      trend,
      monthlyGrowth,
      topCustomers
    };
  },

  // Analyze purchase patterns
  analyzePurchases() {
    const entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
    const suppliers = Storage.get(Storage.KEYS.SUPPLIERS) || [];

    // Filter purchase transactions  
    const purchaseEntries = entries.filter(e =>
      e.description?.toLowerCase().includes('pembelian') ||
      e.description?.toLowerCase().includes('purchase')
    );

    if (purchaseEntries.length === 0) {
      return {
        totalPurchases: 0,
        avgPurchaseValue: 0,
        topSuppliers: [],
        trend: 'stable'
      };
    }

    const totalPurchases = purchaseEntries.reduce((sum, e) => {
      return sum + e.lines
        .filter(l => l.debit > 0 && l.accountCode?.startsWith('1'))
        .reduce((s, l) => s + l.debit, 0);
    }, 0);

    const avgPurchaseValue = totalPurchases / purchaseEntries.length;

    // Top suppliers
    const supplierPurchases = {};
    purchaseEntries.forEach(entry => {
      const supplier = entry.reference?.includes('SUPP') ?
        entry.reference.match(/SUPP-\d+/)?.[0] : null;
      if (supplier) {
        const amount = entry.lines
          .filter(l => l.debit > 0 && l.accountCode?.startsWith('1'))
          .reduce((s, l) => s + l.debit, 0);
        supplierPurchases[supplier] = (supplierPurchases[supplier] || 0) + amount;
      }
    });

    const topSuppliers = Object.entries(supplierPurchases)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([code, amount]) => {
        const supplier = suppliers.find(s => s.code === code);
        return {
          code,
          name: supplier?.name || code,
          amount
        };
      });

    return {
      totalPurchases,
      avgPurchaseValue,
      transactionCount: purchaseEntries.length,
      topSuppliers,
      trend: 'stable'
    };
  },

  // Analyze financial health
  analyzeFinancialHealth() {
    const accounts = ChartOfAccounts.accounts || [];

    // Calculate key ratios
    const assets = accounts
      .filter(a => a.category === 'aset' && a.type === 'detail')
      .reduce((sum, a) => sum + (a.balance || 0), 0);

    const currentAssets = accounts
      .filter(a => a.category === 'aset' && a.type === 'detail' &&
        (parseInt(a.code) >= 1100 && parseInt(a.code) < 1200))
      .reduce((sum, a) => sum + (a.balance || 0), 0);

    const liabilities = accounts
      .filter(a => a.category === 'kewajiban' && a.type === 'detail')
      .reduce((sum, a) => sum + Math.abs(a.balance || 0), 0);

    const currentLiabilities = accounts
      .filter(a => a.category === 'kewajiban' && a.type === 'detail' &&
        (parseInt(a.code) >= 2100 && parseInt(a.code) < 2200))
      .reduce((sum, a) => sum + Math.abs(a.balance || 0), 0);

    const revenue = accounts
      .filter(a => a.category === 'pendapatan' && a.type === 'detail')
      .reduce((sum, a) => sum + Math.abs(a.balance || 0), 0);

    const expenses = accounts
      .filter(a => a.category === 'beban' && a.type === 'detail')
      .reduce((sum, a) => sum + (a.balance || 0), 0);

    const netProfit = revenue - expenses;
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
    const debtRatio = assets > 0 ? liabilities / assets : 0;

    // Determine health score (0-100)
    let healthScore = 50; // base score

    // Profit margin impact (max +30)
    if (profitMargin > 20) healthScore += 30;
    else if (profitMargin > 10) healthScore += 20;
    else if (profitMargin > 0) healthScore += 10;
    else healthScore -= 20;

    // Current ratio impact (max +20)
    if (currentRatio > 2) healthScore += 20;
    else if (currentRatio > 1.5) healthScore += 15;
    else if (currentRatio > 1) healthScore += 10;
    else healthScore -= 15;

    // Debt ratio impact (max +20)
    if (debtRatio < 0.3) healthScore += 20;
    else if (debtRatio < 0.5) healthScore += 10;
    else if (debtRatio > 0.7) healthScore -= 10;

    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      healthScore,
      currentRatio,
      debtRatio,
      profitMargin,
      netProfit,
      totalAssets: assets,
      totalLiabilities: liabilities
    };
  },

  // Analyze inventory
  analyzeInventory() {
    const entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
    const items = Storage.get(Storage.KEYS.ITEMS) || [];
    const accounts = ChartOfAccounts.accounts || [];

    // Get inventory accounts
    const inventoryAccounts = accounts.filter(a =>
      (parseInt(a.code) >= 1150 && parseInt(a.code) < 1200) &&
      a.type === 'detail'
    );

    const totalInventoryValue = inventoryAccounts.reduce((sum, a) =>
      sum + (a.balance || 0), 0
    );

    // Slow-moving items detection (simplified - check for low value)
    const slowMovingItems = inventoryAccounts
      .filter(a => a.balance > 0 && a.balance < 1000000)
      .slice(0, 3);

    // Stock turnover (simplified calculation)
    const cogs = accounts
      .filter(a => a.code?.startsWith('5'))
      .reduce((sum, a) => sum + (a.balance || 0), 0);

    const stockTurnover = totalInventoryValue > 0 ? cogs / totalInventoryValue : 0;

    return {
      totalValue: totalInventoryValue,
      itemCount: items.length,
      stockTurnover: stockTurnover.toFixed(2),
      slowMovingItems: slowMovingItems.map(a => ({
        name: a.name,
        value: a.balance
      })),
      needsReorder: items.filter(i => i.trackStock).slice(0, 2)
    };
  },

  // ─── Analisis HPP vs Revenue (Gross Margin Efficiency) ──────────────────────
  analyzeGrossMargin() {
    const accounts = (typeof ChartOfAccounts !== 'undefined' ? ChartOfAccounts.accounts : null)
                     || Storage.getChartOfAccounts()
                     || [];

    // Revenue: akun 4xxx (Pendapatan)
    const revenue = accounts
      .filter(a => a.type === 'detail' && String(a.code).startsWith('4'))
      .reduce((sum, a) => sum + Math.abs(a.balance || 0), 0);

    // HPP / COGS: akun 5100–5199 (Beban Pokok Penjualan)
    const cogs = accounts
      .filter(a => a.type === 'detail' && parseInt(a.code) >= 5100 && parseInt(a.code) <= 5199)
      .reduce((sum, a) => sum + Math.abs(a.balance || 0), 0);

    // Operating Expenses: akun 5200+ (di luar COGS)
    const opex = accounts
      .filter(a => a.type === 'detail' && parseInt(a.code) >= 5200)
      .reduce((sum, a) => sum + Math.abs(a.balance || 0), 0);

    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : null;
    const cogsRatio   = revenue > 0 ? (cogs / revenue) * 100 : null;

    // Benchmark untuk gold refinery: Gross Margin normal > 25%
    let status = 'no_data';
    let severity = 'info';
    if (grossMargin !== null) {
      if (grossMargin >= 40)         { status = 'excellent'; severity = 'success'; }
      else if (grossMargin >= 25)    { status = 'acceptable'; severity = 'info'; }
      else if (grossMargin >= 10)    { status = 'warning'; severity = 'warning'; }
      else if (grossMargin >= 0)     { status = 'critical'; severity = 'critical'; }
      else                           { status = 'loss'; severity = 'critical'; }
    }

    // Month-over-month COGS trend (banding journal entries)
    const entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
    const now  = new Date();
    const m1s  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const m1e  = new Date(now.getFullYear(), now.getMonth(), 1);
    const m2s  = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const sumCOGS = (from, to) => entries
      .filter(e => { const d = new Date(e.date); return d >= from && d < to; })
      .reduce((s, e) => s + e.lines
        .filter(l => parseInt(l.accountCode) >= 5100 && parseInt(l.accountCode) <= 5199)
        .reduce((ss, l) => ss + (l.debit || 0), 0), 0);

    const sumRev = (from, to) => entries
      .filter(e => { const d = new Date(e.date); return d >= from && d < to; })
      .reduce((s, e) => s + e.lines
        .filter(l => String(l.accountCode).startsWith('4'))
        .reduce((ss, l) => ss + (l.credit || 0), 0), 0);

    const thisCOGS = sumCOGS(m1s, m1e);
    const prevCOGS = sumCOGS(m2s, m1s);
    const thisRev  = sumRev(m1s, m1e);
    const prevRev  = sumRev(m2s, m1s);

    const thisGM  = thisRev  > 0 ? ((thisRev - thisCOGS) / thisRev * 100) : null;
    const prevGM  = prevRev  > 0 ? ((prevRev - prevCOGS) / prevRev * 100) : null;
    const gmDelta = (thisGM !== null && prevGM !== null) ? (thisGM - prevGM) : null;

    return {
      revenue, cogs, grossProfit, opex,
      grossMargin: grossMargin !== null ? parseFloat(grossMargin.toFixed(2)) : null,
      cogsRatio:   cogsRatio   !== null ? parseFloat(cogsRatio.toFixed(2))   : null,
      status, severity,
      monthly: { thisGM, prevGM, gmDelta, thisCOGS, thisRev }
    };
  },


  // Analyze production efficiency (specific for gold refinery)
  analyzeProduction() {
    const batches = (Storage.get('production_batches') || [])
      .filter(b => b.status === 'completed' && b.actualOutput);

    if (batches.length === 0) {
      return { avgRecoveryRate: 0, avgLossRate: 0, productionCosts: 0, alerts: [], stageMetrics: {} };
    }

    const totalWeight = batches.reduce((sum, b) => sum + (b.totalGrossWeight || 0), 0);
    const totalAu = batches.reduce((sum, b) => sum + (b.actualOutput?.pureAu || 0), 0);
    const totalLoss = batches.reduce((sum, b) => sum + (b.actualOutput?.loss || 0), 0);

    const avgRecoveryRate = totalWeight > 0 ? (totalAu / totalWeight) * 100 : 0;
    const avgLossRate = totalWeight > 0 ? (totalLoss / totalWeight) * 100 : 0;

    // Stage-specific analysis
    const stageMetrics = {};
    batches.forEach(b => {
      const stage = b.stage || 'GENERAL';
      if (!stageMetrics[stage]) {
        stageMetrics[stage] = { totalLoss: 0, totalInput: 0, count: 0 };
      }
      stageMetrics[stage].totalLoss += b.actualOutput.loss || 0;
      stageMetrics[stage].totalInput += b.totalGrossWeight || 0;
      stageMetrics[stage].count++;
    });

    for (const stage in stageMetrics) {
      stageMetrics[stage].avgLossPercent = (stageMetrics[stage].totalLoss / stageMetrics[stage].totalInput) * 100;
    }

    // Detect anomalies (batches with > 0.5% loss - AI Guardian Threshold)
    const anomalies = batches.filter(b => {
      const lossPct = (b.actualOutput?.loss / b.totalGrossWeight) * 100;
      return lossPct > 0.5; // Stricter threshold per user request
    });

    const accounts = ChartOfAccounts.accounts || [];
    const productionCosts = accounts.filter(a => a.code >= '5100' && a.code < '5200' && a.type === 'detail')
      .reduce((sum, a) => sum + (a.balance || 0), 0);

    return {
      avgRecoveryRate: avgRecoveryRate.toFixed(2),
      avgLossRate: avgLossRate.toFixed(2),
      productionCosts,
      efficiency: avgRecoveryRate > 85 ? 'high' : avgRecoveryRate > 75 ? 'medium' : 'low',
      anomalies: anomalies.length,
      stageMetrics
    };
  },

  // Analyze Compliance (KYC) Health
  analyzeCompliance() {
    const kycRecords = (typeof CustomerKYC !== 'undefined') ? CustomerKYC.kycRecords : [];
    const customers = Storage.get(Storage.KEYS.CUSTOMERS) || [];

    if (customers.length === 0) return { healthScore: 0, pending: 0, expired: 0, verifiedPct: 0 };

    const approved = kycRecords.filter(r => r.status === 'approved').length;
    const expired = kycRecords.filter(r => r.status === 'expired').length;
    const pending = kycRecords.filter(r => ['submitted', 'under_review'].includes(r.status)).length;

    // Check for "Pengkinian Soon" (within 30 days)
    const today = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);

    const expiringSoon = kycRecords.filter(r => {
      if (r.status !== 'approved' || !r.expiryDate) return false;
      const exp = new Date(r.expiryDate);
      return exp >= today && exp <= soon;
    }).length;

    const verifiedPct = (approved / customers.length) * 100;

    // Compliance Health Score (0-100)
    let score = verifiedPct;
    if (expired > 0) score -= (expired * 5);
    if (pending > 5) score -= 10;

    return {
      healthScore: Math.max(0, Math.min(100, score)).toFixed(0),
      totalCustomers: customers.length,
      verifiedPct: verifiedPct.toFixed(1),
      pending,
      expired,
      expiringSoon,
      status: score > 80 ? 'Excellent' : score > 60 ? 'Good' : score > 40 ? 'Fair' : 'Critical'
    };
  },

  // Analyze Gold Liquidity (Deposits vs Obligations)
  analyzeGoldLiquidity() {
    const goldTrx = (typeof GoldSavings !== 'undefined') ? GoldSavings.transactions : [];
    const customers = Storage.get(Storage.KEYS.CUSTOMERS) || [];

    let totalDeposits = 0; // We owe customer
    let totalObligations = 0; // Customer owes us

    customers.forEach(c => {
      const bal = (typeof GoldSavings !== 'undefined') ? GoldSavings.getBalance(c.id) : 0;
      if (bal > 0) totalDeposits += bal;
      else if (bal < 0) totalObligations += Math.abs(bal);
    });

    const netExposure = totalDeposits - totalObligations;

    return {
      totalDeposits: totalDeposits.toFixed(3),
      totalObligations: totalObligations.toFixed(3),
      netExposure: netExposure.toFixed(3),
      riskLevel: Math.max(totalDeposits, totalObligations) > 1000 ? 'High' : 'Moderate',
      impact: netExposure > 0 ? 'LIABILITY' : 'ASSET'
    };
  },

  // Analyze Refining Excellence (Variance & Shrinkage)
  analyzeRefiningExcellence() {
    const goldTrx = (typeof GoldSavings !== 'undefined') ? GoldSavings.transactions : [];
    const varianceTrx = goldTrx.filter(t => t.type.includes('VARIANCE'));

    if (varianceTrx.length === 0) return { avgVariance: 0, totalVariance: 0, trend: 'N/A' };

    const totalVariance = varianceTrx.reduce((sum, t) => sum + (parseFloat(t.weight) || 0), 0);
    const avgVariance = totalVariance / varianceTrx.length;

    // Detect if variance is skewing positive (more deposits) or negative (more obligations)
    const positive = varianceTrx.filter(t => t.weight > 0).length;
    const negative = varianceTrx.filter(t => t.weight < 0).length;

    return {
      totalVariance: totalVariance.toFixed(3),
      avgVariance: avgVariance.toFixed(3),
      positiveCount: positive,
      negativeCount: negative,
      consistency: Math.abs(avgVariance) < 0.1 ? 'High' : 'Low'
    };
  },

  // Analyze Strategic Customer Profiles
  analyzeStrategicCustomers() {
    const customers = Storage.get(Storage.KEYS.CUSTOMERS) || [];
    const profiles = customers.map(c => {
      const financialBal = c.balance || 0;
      const goldBal = (typeof GoldSavings !== 'undefined') ? GoldSavings.getBalance(c.id) : 0;

      // Scoring formula: Financial + (Gold * SpotPrice)
      // Assume SpotPrice ~ 1.5jt/g for scoring weight
      const score = Math.abs(financialBal) + (Math.abs(goldBal) * 1500000);

      return {
        id: c.id,
        name: c.name,
        code: c.code,
        financialBal,
        goldBal,
        score
      };
    });

    return profiles.sort((a, b) => b.score - a.score).slice(0, 5);
  },

  // Analyze Attendance Fraud (HRD Guardian)
  analyzeAttendanceFraud() {
    const records = Storage.getAttendance() || [];
    const employees = Storage.getEmployees() || [];
    const batches = (Storage.get('production_batches') || []).filter(b => b.status === 'completed');

    const manualOverrides = records.filter(r => r.is_manual);
    const frequentOverrides = {};
    manualOverrides.forEach(r => {
      frequentOverrides[r.nik] = (frequentOverrides[r.nik] || 0) + 1;
    });

    const highManualEmployees = Object.entries(frequentOverrides)
      .filter(([, count]) => count >= 2)
      .map(([nik, count]) => {
        const emp = employees.find(e => e.nik === nik);
        return { nik, name: emp?.name || 'Unknown', count };
      });

    // Patterns of tardiness (e.g. consistently late on Mondays)
    const lateRecords = records.filter(r => r.late_count > 0);
    // Note: Simple detector for now since records might be monthly or daily
    // If records are monthly (like in attendance.js), we look for high relative late count

    // Efficiency Mismatch: High OT in departments but low batch output for those employees
    // (This requires complex mapping, for now let's flag high OT in PROD)
    const prodOvertime = records.filter(r => {
      const emp = employees.find(e => e.nik === r.nik);
      return emp?.department === 'PROD' && r.overtime_hours > 40; // Over 40hrs/month
    });

    return {
      manualOverrideCount: manualOverrides.length,
      highManualEmployees,
      prodOvertimeFlags: prodOvertime.map(r => ({
        name: r.name,
        ot: r.overtime_hours
      }))
    };
  },

  // ==========================================
  // INSIGHT GENERATION
  // ==========================================

  generateInsights() {
    const insights = [];
    const sales = this.analyzeSales();
    const purchases = this.analyzePurchases();
    const financial = this.analyzeFinancialHealth();
    const inventory = this.analyzeInventory();
    const production = this.analyzeProduction();
    const compliance = this.analyzeCompliance();
    const liquidity = this.analyzeGoldLiquidity();
    const excellence = this.analyzeRefiningExcellence();

    // Sales insights
    if (sales.trend === 'increasing') {
      insights.push({
        type: 'success',
        priority: 'info',
        icon: '📈',
        title: 'Sales Trending Up',
        message: `Sales meningkat ${sales.monthlyGrowth.toFixed(1)}% bulan ini. Pertahankan momentum!`,
        recommendation: 'Fokus pada customer retention dan upselling ke existing customers.'
      });
    } else if (sales.trend === 'decreasing') {
      insights.push({
        type: 'warning',
        priority: 'warning',
        icon: '📉',
        title: 'Sales Declining',
        message: `Sales turun ${Math.abs(sales.monthlyGrowth).toFixed(1)}% bulan ini.`,
        recommendation: 'Review pricing strategy dan lakukan customer outreach. Pertimbangkan promosi.'
      });
    }

    // Financial health insights
    if (financial.healthScore < 40) {
      insights.push({
        type: 'error',
        priority: 'critical',
        icon: '🚨',
        title: 'Financial Health Critical',
        message: `Health score: ${financial.healthScore}/100. Immediate action required!`,
        recommendation: 'Kurangi expenses dan fokus pada cash flow management. Konsultasi dengan financial advisor.'
      });
    } else if (financial.healthScore < 60) {
      insights.push({
        type: 'warning',
        priority: 'warning',
        icon: '⚠️',
        title: 'Financial Health Needs Attention',
        message: `Health score: ${financial.healthScore}/100. Perlu improvement.`,
        recommendation: 'Optimalkan profit margin dan pantau cash flow. Evaluasi cost structure.'
      });
    } else if (financial.healthScore >= 80) {
      insights.push({
        type: 'success',
        priority: 'info',
        icon: '💎',
        title: 'Excellent Financial Health',
        message: `Health score: ${financial.healthScore}/100. Perusahaan dalam kondisi sangat baik!`,
        recommendation: 'Pertimbangkan ekspansi atau investasi untuk pertumbuhan lebih lanjut.'
      });
    }

    // Current ratio insights
    if (financial.currentRatio < 1) {
      insights.push({
        type: 'error',
        priority: 'critical',
        icon: '💰',
        title: 'Liquidity Risk',
        message: `Current ratio ${financial.currentRatio.toFixed(2)} < 1.0. Potensi kesulitan bayar hutang jangka pendek.`,
        recommendation: 'Tingkatkan cash reserves atau negosiasi payment terms dengan supplier.'
      });
    }

    // Profit margin insights
    if (financial.profitMargin < 5 && financial.profitMargin > 0) {
      insights.push({
        type: 'warning',
        priority: 'warning',
        icon: '📊',
        title: 'Low Profit Margin',
        message: `Profit margin hanya ${financial.profitMargin.toFixed(1)}%. Target minimal 10%.`,
        recommendation: 'Review pricing dan cost structure. Fokus pada high-margin products.'
      });
    } else if (financial.profitMargin < 0) {
      insights.push({
        type: 'error',
        priority: 'critical',
        icon: '🔴',
        title: 'Operating at Loss',
        message: `Perusahaan operating at loss (${financial.profitMargin.toFixed(1)}% margin).`,
        recommendation: 'Urgent: Review semua expenses dan adjust pricing. Pertimbangkan cost reduction.'
      });
    }

    // Inventory insights
    if (inventory.slowMovingItems.length > 0) {
      insights.push({
        type: 'info',
        priority: 'info',
        icon: '📦',
        title: 'Slow-Moving Inventory Detected',
        message: `${inventory.slowMovingItems.length} items dengan pergerakan lambat.`,
        recommendation: 'Pertimbangkan promosi atau bundling untuk meningkatkan turnover.'
      });
    }

    // Compliance Insights (KYC)
    if (compliance.totalCustomers > 0) {
      if (compliance.verifiedPct < 50) {
        insights.push({
          type: 'warning',
          priority: 'critical',
          icon: '🛡️',
          title: 'Low Governance Standard',
          message: `Hanya ${compliance.verifiedPct}% customer yang terverifikasi KYC.`,
          recommendation: 'Wajibkan verifikasi KYC sebelum transaksi Direct Swap atau Job Order untuk mitigasi risiko hukum.'
        });
      }
      if (compliance.expired > 0 || compliance.expiringSoon > 0) {
        insights.push({
          type: 'warning',
          priority: 'warning',
          icon: '📅',
          title: 'Data Update Required',
          message: `${compliance.expired} customer perlu pengkinian data, ${compliance.expiringSoon} akan menyusul.`,
          recommendation: 'Hubungi customer terkait untuk update dokumen (KTP/NPWP/NIB) agar tetap compliance.'
        });
      }
    }

    // Gold Liquidity Insights
    if (Math.abs(parseFloat(liquidity.netExposure)) > 10) {
      if (parseFloat(liquidity.netExposure) > 0) {
        insights.push({
          type: 'info',
          priority: 'warning',
          icon: '⚖️',
          title: 'High Gold Liability',
          message: `Perusahaan memiliki hutang emas ke customer sebesar ${liquidity.netExposure} gram.`,
          recommendation: 'Pastikan ketersediaan stok fisik emas 24K di vault untuk memenuhi potensi penarikan mendadak.'
        });
      } else {
        insights.push({
          type: 'success',
          priority: 'info',
          icon: '💰',
          title: 'Gold Asset Surplus',
          message: `Terdapat piutang emas (obligasi customer) sebesar ${Math.abs(liquidity.netExposure).toFixed(3)} gram.`,
          recommendation: 'Monitoring penagihan atau konversi piutang emas menjadi saldo kas jika diperlukan likuiditas uang.'
        });
      }
    }

    // Refining Excellence Insights
    if (excellence.totalVariance !== '0.000') {
      if (Math.abs(parseFloat(excellence.avgVariance)) > 0.05) {
        insights.push({
          type: 'warning',
          priority: 'warning',
          icon: '🔍',
          title: 'Refining Variance Alert',
          message: `Rata-rata selisih (variance) mencapai ${excellence.avgVariance}g per transaksi.`,
          recommendation: 'Review tabel Master Purity & Refining Rules. Perbedaan signifikan dapat mengindikasikan grading yang kurang akurat.'
        });
      }
    }

    if (production.avgRecoveryRate > 0) {
      if (production.efficiency === 'low') {
        insights.push({
          type: 'warning',
          priority: 'warning',
          icon: '🏭',
          title: 'Low Production Efficiency',
          message: `Gold recovery rate ${production.avgRecoveryRate}% di bawah standard (85%).`,
          recommendation: 'Check proses refining, training operator, dan quality control procedures.'
        });
      } else if (production.efficiency === 'high') {
        insights.push({
          type: 'success',
          priority: 'info',
          icon: '⭐',
          title: 'Excellent Production Efficiency',
          message: `Gold recovery rate ${production.avgRecoveryRate}% - sangat baik!`,
          recommendation: 'Dokumentasikan best practices dan share dengan team untuk konsistensi.'
        });
      }

      // Loss specific insights
      if (production.anomalies > 0) {
        insights.push({
          type: 'error',
          priority: 'critical',
          icon: '📉',
          title: 'High Weight Loss Detected',
          message: `Terdapat ${production.anomalies} batch dengan susut (loss) > 0.5% (Guardian Threshold).`,
          recommendation: 'Segera audit proses peleburan dan pemurnian. Pastikan mesin dalam kondisi optimal dan kurangi tumpahan.'
        });
      }

      // Stage-specific shrinkage insights
      Object.entries(production.stageMetrics).forEach(([stage, metrics]) => {
        if (metrics.avgLossPercent > 8) {
          insights.push({
            type: 'warning',
            priority: 'warning',
            icon: '🔍',
            title: `High Shrinkage in ${stage}`,
            message: `Rata-rata susut di tahap ${stage} mencapai ${metrics.avgLossPercent.toFixed(2)}%.`,
            recommendation: `Lakukan evaluasi mendalam pada prosedur kerja di tahap ${stage}. Pastikan ventilasi dan filter debu emas berfungsi baik.`
          });
        }
      });
    }

    // Top customer insights
    if (sales.topCustomers.length > 0) {
      const topCustomer = sales.topCustomers[0];
      const topCustomerPercent = (topCustomer.amount / sales.totalRevenue) * 100;
      if (topCustomerPercent > 50) {
        insights.push({
          type: 'warning',
          priority: 'warning',
          icon: '⚠️',
          title: 'Customer Concentration Risk',
          message: `${topCustomer.name} mewakili ${topCustomerPercent.toFixed(0)}% dari total sales.`,
          recommendation: 'Diversifikasi customer base untuk mengurangi dependency risk.'
        });
      }
    }

    // General insights if no data
    if (insights.length === 0) {
      insights.push({
        type: 'info',
        priority: 'info',
        icon: '📊',
        title: 'Mulai Input Data',
        message: 'Belum cukup data untuk analisis mendalam.',
        recommendation: 'Input lebih banyak transaksi untuk mendapatkan insights yang lebih akurat.'
      });
    }

    // HRD Guardian Insights
    const hrdFraud = this.analyzeAttendanceFraud();
    if (hrdFraud.highManualEmployees.length > 0) {
      insights.push({
        type: 'warning',
        priority: 'warning',
        icon: '🕵️',
        title: 'HRD Guardian: Manual Override Alert',
        message: `${hrdFraud.highManualEmployees.length} karyawan memiliki terlalu banyak input absensi manual.`,
        recommendation: 'Verifikasi alasan penginputan manual dengan kepala bagian terkait untuk mencegah manipulasi data.'
      });
    }

    if (hrdFraud.prodOvertimeFlags.length > 0) {
      insights.push({
        type: 'info',
        priority: 'warning',
        icon: '⚠️',
        title: 'HRD Guardian: Efficiency Mismatch',
        message: `Terdapat indikasi lembur tinggi (${hrdFraud.prodOvertimeFlags.length} orang) di bagian Produksi.`,
        recommendation: 'Bandingkan total jam lembur dengan output gram produksi untuk memastikan produktivitas seimbang.'
      });
    }

    // ─── HPP vs Revenue (Gross Margin Efficiency) Insights ───────────────
    const gm = this.analyzeGrossMargin();
    if (gm.grossMargin !== null && gm.revenue > 0) {
      if (gm.status === 'excellent') {
        insights.push({
          type: 'success', priority: 'info', icon: '🌟',
          title: 'HPP Sangat Efisien — Gross Margin Excellent',
          message: `Gross Margin: ${gm.grossMargin}% — HPP (${this.formatCurrency(gm.cogs)}) jauh di bawah Revenue (${this.formatCurrency(gm.revenue)}). Efisiensi operasional sangat baik!`,
          recommendation: 'Pertahankan struktur biaya ini. Pertimbangkan reinvestasi keuntungan untuk ekspansi kapasitas.'
        });
      } else if (gm.status === 'acceptable') {
        insights.push({
          type: 'info', priority: 'info', icon: '✅',
          title: 'HPP Terkendali — Gross Margin Normal',
          message: `Gross Margin: ${gm.grossMargin}% — HPP ${gm.cogsRatio}% dari Revenue. Dalam batas wajar industri.`,
          recommendation: 'Monitor tren bulanan. Cari peluang efisiensi di proses produksi untuk menaikkan margin ke >40%.'
        });
      } else if (gm.status === 'warning') {
        insights.push({
          type: 'warning', priority: 'warning', icon: '⚠️',
          title: 'HPP Terlalu Tinggi — Gross Margin Rendah',
          message: `Gross Margin hanya ${gm.grossMargin}% (target >25%). HPP mencapai ${gm.cogsRatio}% dari Revenue sebesar ${this.formatCurrency(gm.revenue)}.`,
          recommendation: 'Review komponen HPP: bahan baku, biaya proses, dan susut. Negosiasi harga beli bahan baku atau optimalkan yield produksi.'
        });
      } else if (gm.status === 'critical' || gm.status === 'loss') {
        insights.push({
          type: 'error', priority: 'critical', icon: '🚨',
          title: gm.status === 'loss' ? 'HPP Melebihi Revenue — RUGI KOTOR!' : 'HPP Kritis — Gross Margin Hampir Nol',
          message: gm.status === 'loss'
            ? `PERINGATAN KERAS: HPP (${this.formatCurrency(gm.cogs)}) lebih besar dari Revenue (${this.formatCurrency(gm.revenue)}). Setiap penjualan menghasilkan kerugian kotor!`
            : `Gross Margin hanya ${gm.grossMargin}%. HPP (${this.formatCurrency(gm.cogs)}) hampir sama dengan Revenue (${this.formatCurrency(gm.revenue)}).`,
          recommendation: 'Tindakan darurat: Hentikan sementara penjualan produk bermargin negatif. Audit menyeluruh komponen HPP dan review harga jual segera.'
        });
      }

      // Monthly COGS trend alert
      if (gm.monthly.gmDelta !== null) {
        if (gm.monthly.gmDelta < -5) {
          insights.push({
            type: 'warning', priority: 'warning', icon: '📉',
            title: 'Gross Margin Turun Bulan Ini',
            message: `Gross margin turun ${Math.abs(gm.monthly.gmDelta).toFixed(1)}% dibanding bulan lalu (dari ${gm.monthly.prevGM?.toFixed(1)}% → ${gm.monthly.thisGM?.toFixed(1)}%).`,
            recommendation: 'Investigasi kenaikan biaya bahan baku atau penurunan harga jual yang menekan margin. Cek apakah ada transaksi HPP yang salah posting.'
          });
        } else if (gm.monthly.gmDelta > 5) {
          insights.push({
            type: 'success', priority: 'info', icon: '📈',
            title: 'Gross Margin Meningkat Bulan Ini',
            message: `Gross margin naik ${gm.monthly.gmDelta.toFixed(1)}% dari bulan lalu (dari ${gm.monthly.prevGM?.toFixed(1)}% → ${gm.monthly.thisGM?.toFixed(1)}%).`,
            recommendation: 'Identifikasi faktor pendorong peningkatan margin dan replikasi ke bulan berikutnya.'
          });
        }
      }
    }

    return insights.sort((a, b) => {
      const priority = { critical: 3, warning: 2, info: 1 };
      return priority[b.priority] - priority[a.priority];
    });
  },

  // ==========================================
  // UI RENDERING
  // ==========================================

  renderPage() {
    const content = document.getElementById('main-content');
    const insights = this.generateInsights();
    const sales = this.analyzeSales();
    const financial = this.analyzeFinancialHealth();
    const inventory = this.analyzeInventory();
    const production = this.analyzeProduction();
    const compliance = this.analyzeCompliance();
    const liquidity = this.analyzeGoldLiquidity();
    const excellence = this.analyzeRefiningExcellence();
    const strategic = this.analyzeStrategicCustomers();
    const gm = this.analyzeGrossMargin();

    content.innerHTML = `
      <div class="page-header" style="margin-bottom: 32px;">
        <div>
          <h1 class="page-title">🤖 AI Business Advisor</h1>
          <p class="page-description">Intelligent insights & recommendations powered by data analytics</p>
        </div>
        <button class="btn btn-secondary" onclick="AIAdvisor.init()">
          🔄 Refresh Analysis
        </button>
      </div>

      <!-- Financial Health Score Card -->
      <div class="card mb-3" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">
        <div class="card-body" style="text-align: center; padding: 32px;">
          <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; margin-bottom: 12px;">
            Overall Financial Health
          </div>
          <div style="font-size: 72px; font-weight: 700; margin-bottom: 8px;">
            ${financial.healthScore}
            <span style="font-size: 32px; opacity: 0.8;">/100</span>
          </div>
          <div style="font-size: 18px; opacity: 0.9;">
            ${financial.healthScore >= 80 ? '🌟 Excellent' :
        financial.healthScore >= 60 ? '✅ Good' :
          financial.healthScore >= 40 ? '⚠️ Fair' : '🚨 Critical'}
          </div>
          <div style="margin-top: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center;">
            <div>
              <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">Current Ratio</div>
              <div style="font-size: 24px; font-weight: 600;">${financial.currentRatio.toFixed(2)}</div>
            </div>
            <div>
              <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">Profit Margin</div>
              <div style="font-size: 24px; font-weight: 600;">${financial.profitMargin.toFixed(1)}%</div>
            </div>
            <div>
              <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">Debt Ratio</div>
              <div style="font-size: 24px; font-weight: 600;">${(financial.debtRatio * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
      </div>

      <!-- AI Insights & Recommendations -->
      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">💡 Smart Insights & Recommendations</h2>
          <span class="badge badge-primary">${insights.length} insights</span>
        </div>
        <div class="card-body" style="padding: 0;">
          ${insights.map((insight, index) => `
            <div class="insight-card insight-${insight.type}" style="
              padding: 20px 24px;
              border-left: 4px solid ${insight.type === 'success' ? '#43e97b' :
              insight.type === 'warning' ? '#f093fb' :
                insight.type === 'error' ? '#f5576c' : '#4facfe'};
              ${index < insights.length - 1 ? 'border-bottom: 1px solid var(--color-gray-800);' : ''}
            ">
              <div style="display: flex; gap: 16px; align-items: flex-start;">
                <div style="font-size: 32px; line-height: 1;">${insight.icon}</div>
                <div style="flex: 1;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <h3 style="font-size: 16px; font-weight: 600; margin: 0;">${insight.title}</h3>
                    <span class="badge badge-${insight.priority === 'critical' ? 'error' : insight.priority === 'warning' ? 'warning' : 'info'}" style="font-size: 10px;">
                      ${insight.priority.toUpperCase()}
                    </span>
                  </div>
                  <p style="color: var(--color-gray-400); margin-bottom: 12px; font-size: 14px;">
                    ${insight.message}
                  </p>
                  <div style="background: rgba(102, 126, 234, 0.1); padding: 12px; border-radius: 6px; border-left: 3px solid #667eea;">
                    <strong style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #667eea;">💡 Recommendation:</strong>
                    <p style="margin: 6px 0 0 0; font-size: 14px;">${insight.recommendation}</p>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Analytics Grid -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-bottom: 24px;">
        <!-- Sales Analytics -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">💰 Sales Performance</h2>
          </div>
          <div class="card-body">
            <div class="stat-grid" style="margin-bottom: 20px;">
              <div>
                <div class="stat-label">Total Revenue</div>
                <div class="stat-value">${this.formatCurrency(sales.totalRevenue)}</div>
              </div>
              <div>
                <div class="stat-label">Avg Transaction</div>
                <div class="stat-value">${this.formatCurrency(sales.avgTransactionValue)}</div>
              </div>
              <div>
                <div class="stat-label">Monthly Growth</div>
                <div class="stat-value ${sales.monthlyGrowth >= 0 ? 'text-success' : 'text-error'}">
                  ${sales.monthlyGrowth >= 0 ? '↗️' : '↘️'} ${Math.abs(sales.monthlyGrowth).toFixed(1)}%
                </div>
              </div>
              <div>
                <div class="stat-label">Transactions</div>
                <div class="stat-value">${sales.transactionCount}</div>
              </div>
            </div>

            ${sales.topCustomers.length > 0 ? `
              <div style="border-top: 1px solid var(--color-gray-800); padding-top: 16px;">
                <div style="font-weight: 600; margin-bottom: 12px; font-size: 14px;">Top Customers</div>
                ${sales.topCustomers.map((c, i) => `
                  <div style="display: flex; justify-content: space-between; padding: 8px 0; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="
                        width: 24px; 
                        height: 24px; 
                        border-radius: 50%; 
                        background: ${i === 0 ? 'linear-gradient(135deg, #FFD700, #FFA500)' :
                    i === 1 ? 'linear-gradient(135deg, #C0C0C0, #808080)' :
                      'linear-gradient(135deg, #CD7F32, #8B4513)'};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: 600;
                        font-size: 12px;
                        color: white;
                      ">${i + 1}</span>
                      <span style="font-size: 14px;">${c.name}</span>
                    </div>
                    <strong>${this.formatCurrency(c.amount)}</strong>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-gray text-center" style="padding: 20px;">No customer data available</p>'}
          </div>
        </div>

        <!-- HPP vs Revenue Card -->
        <div class="card" style="grid-column: span 2;">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <h2 class="card-title">📊 HPP vs Revenue — Gross Margin Monitor</h2>
            <span style="font-size:0.78rem;color:var(--color-gray-400);">Data dari Chart of Accounts (akun 4xxx & 5100–5199)</span>
          </div>
          <div class="card-body">
            ${gm.grossMargin === null || gm.revenue === 0
              ? `<p style="color:var(--color-gray-400);text-align:center;padding:1.5rem;">Belum ada data Revenue di Chart of Accounts. Input transaksi penjualan terlebih dahulu.</p>`
              : `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1.5rem;margin-bottom:1.5rem;">
              <div>
                <div class="stat-label">Revenue</div>
                <div class="stat-value">${this.formatCurrency(gm.revenue)}</div>
              </div>
              <div>
                <div class="stat-label">HPP / COGS</div>
                <div class="stat-value" style="color:${gm.status==='excellent'||gm.status==='acceptable'?'var(--color-success)':'var(--color-error)'}">${this.formatCurrency(gm.cogs)}</div>
              </div>
              <div>
                <div class="stat-label">Gross Profit</div>
                <div class="stat-value" style="color:${gm.grossProfit>=0?'var(--color-success)':'var(--color-error)'}">${this.formatCurrency(gm.grossProfit)}</div>
              </div>
              <div>
                <div class="stat-label">Gross Margin</div>
                <div class="stat-value" style="font-size:1.6rem;font-weight:800;color:${
                  gm.status==='excellent'   ? '#10b981' :
                  gm.status==='acceptable'  ? '#3b82f6' :
                  gm.status==='warning'     ? '#f59e0b' : '#ef4444'
                }">${gm.grossMargin}%</div>
              </div>
            </div>

            <!-- Gauge Bar -->
            <div style="margin-bottom:1rem;">
              <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--color-gray-400);margin-bottom:4px;">
                <span>0% (Rugi)</span><span>10% Kritis</span><span>25% Normal</span><span>40% Excellent</span><span>100%</span>
              </div>
              <div style="position:relative;height:14px;background:linear-gradient(to right,#ef4444 0%,#f59e0b 20%,#3b82f6 45%,#10b981 70%);border-radius:99px;overflow:hidden;">
                <div style="position:absolute;top:50%;transform:translateX(-50%) translateY(-50%);left:${Math.min(Math.max(gm.grossMargin??0,0),100)}%;width:18px;height:18px;background:white;border-radius:50%;border:3px solid #1e293b;box-shadow:0 0 6px rgba(0,0,0,.5);"></div>
              </div>
            </div>

            <!-- Status Badge -->
            <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
              <span style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-weight:700;font-size:0.85rem;background:${
                gm.status==='excellent'   ? 'rgba(16,185,129,.15);color:#10b981' :
                gm.status==='acceptable'  ? 'rgba(59,130,246,.15);color:#3b82f6' :
                gm.status==='warning'     ? 'rgba(245,158,11,.15);color:#f59e0b' : 'rgba(239,68,68,.15);color:#ef4444'
              };">
                ${
                  gm.status==='excellent'  ? '🌟 Excellent — HPP Sangat Efisien' :
                  gm.status==='acceptable' ? '✅ Normal — HPP Terkendali' :
                  gm.status==='warning'    ? '⚠️ Peringatan — HPP Terlalu Tinggi' :
                  gm.status==='critical'   ? '🚨 Kritis — Gross Margin Hampir Nol' : '🔴 RUGI — HPP Melebihi Revenue'
                }
              </span>
              ${gm.monthly.gmDelta !== null ? `
              <span style="font-size:0.82rem;color:var(--color-gray-400);">
                vs. bulan lalu:
                <strong style="color:${gm.monthly.gmDelta>=0?'#10b981':'#ef4444'}">
                  ${gm.monthly.gmDelta>=0?'+':''}${gm.monthly.gmDelta.toFixed(1)}%
                </strong>
                (${gm.monthly.prevGM?.toFixed(1)}% → ${gm.monthly.thisGM?.toFixed(1)}%)
              </span>` : ''}
              <span style="font-size:0.78rem;color:var(--color-gray-400);">
                HPP = ${gm.cogsRatio}% dari Revenue &nbsp;|&nbsp; Benchmark Gold Refinery: &ge;25%
              </span>
            </div>
            `}
          </div>
        </div>

        <!-- Inventory Analytics -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">📦 Inventory Intelligence</h2>
          </div>
          <div class="card-body">
            <div class="stat-grid" style="margin-bottom: 20px;">
              <div>
                <div class="stat-label">Total Value</div>
                <div class="stat-value">${this.formatCurrency(inventory.totalValue)}</div>
              </div>
              <div>
                <div class="stat-label">Total Items</div>
                <div class="stat-value">${inventory.itemCount}</div>
              </div>
              <div>
                <div class="stat-label">Stock Turnover</div>
                <div class="stat-value">${inventory.stockTurnover}x</div>
              </div>
              <div>
                <div class="stat-label">Need Attention</div>
                <div class="stat-value text-warning">${inventory.slowMovingItems.length}</div>
              </div>
            </div>

            ${inventory.slowMovingItems.length > 0 ? `
              <div style="border-top: 1px solid var(--color-gray-800); padding-top: 16px;">
                <div style="font-weight: 600; margin-bottom: 12px; font-size: 14px;">Slow-Moving Items</div>
                ${inventory.slowMovingItems.map(item => `
                  <div style="padding: 8px 12px; background: rgba(241, 93, 108, 0.1); border-radius: 6px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-size: 14px;">⚠️ ${item.name}</span>
                      <span style="font-size: 12px; color: var(--color-gray-400);">${this.formatCurrency(item.value)}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-gray text-center" style="padding: 20px;">All items moving well</p>'}
          </div>
        </div>

        <!-- Production Analytics (Gold Refinery Specific) -->
        ${production.avgRecoveryRate > 0 ? `
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">🏭 Production Efficiency</h2>
            </div>
            <div class="card-body">
              <div class="stat-grid">
                <div>
                  <div class="stat-label">Avg Recovery Rate</div>
                  <div class="stat-value">${production.avgRecoveryRate}%</div>
                </div>
                <div>
                  <div class="stat-label">Efficiency Level</div>
                  <div class="stat-value ${production.efficiency === 'high' ? 'text-success' : production.efficiency === 'medium' ? 'text-warning' : 'text-error'}">
                    ${production.efficiency === 'high' ? '⭐ High' : production.efficiency === 'medium' ? '📊 Medium' : '⚠️ Low'}
                  </div>
                </div>
                <div>
                  <div class="stat-label">Trend</div>
                  <div class="stat-value">${production.recoveryTrend === 'increasing' ? '↗️ Up' : production.recoveryTrend === 'decreasing' ? '↘️ Down' : '→ Stable'}</div>
                </div>
                <div>
                  <div class="stat-label">Production Costs</div>
                  <div class="stat-value">${this.formatCurrency(production.productionCosts)}</div>
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Compliance & Governance -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">🛡️ Compliance Health</h2>
          </div>
          <div class="card-body">
            <div class="text-center mb-4">
                <div style="font-size: 48px; font-weight: 700; color: ${compliance.healthScore > 80 ? '#43e97b' : compliance.healthScore > 40 ? '#f093fb' : '#f5576c'}">
                    ${compliance.healthScore}%
                </div>
                <div class="badge badge-${compliance.healthScore > 80 ? 'success' : compliance.healthScore > 40 ? 'warning' : 'error'}">
                    Verified: ${compliance.verifiedPct}%
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; text-align: center;">
                <div style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.05);">
                    <div style="font-size: 11px; color: var(--color-gray-400); text-transform: uppercase;">Perlu Pengkinian</div>
                    <div style="font-size: 20px; font-weight: 700;" class="${compliance.expired > 0 ? 'text-error' : ''}">${compliance.expired}</div>
                </div>
                <div style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.05);">
                    <div style="font-size: 11px; color: var(--color-gray-400); text-transform: uppercase;">Menunggu Review</div>
                    <div style="font-size: 20px; font-weight: 700;">${compliance.pending}</div>
                </div>
            </div>
          </div>
        </div>

        <!-- Gold Liquidity Position -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">⚖️ Gold Liquidity Position</h2>
          </div>
          <div class="card-body">
            <div style="padding: 16px; background: rgba(180, 136, 17, 0.1); border-radius: 8px; border: 1px solid #b48811; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: #b48811; font-weight: 600;">Net Gold Exposure</span>
                    <span style="font-size: 24px; font-weight: 700;" class="${parseFloat(liquidity.netExposure) > 0 ? 'text-warning' : 'text-success'}">
                        ${liquidity.netExposure} g
                    </span>
                </div>
                <div style="font-size: 11px; opacity: 0.8; text-transform: uppercase;">
                    Position: <span class="badge ${liquidity.impact === 'LIABILITY' ? 'badge-warning' : 'badge-success'}">${liquidity.impact}</span>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 14px;">
                    <span>Total Deposits (Cust. Gold)</span>
                    <span style="font-weight: 600;">${liquidity.totalDeposits} g</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 14px;">
                    <span>Total Obligations (Due to Us)</span>
                    <span style="font-weight: 600;">${liquidity.totalObligations} g</span>
                </div>
            </div>
          </div>
        </div>

        <!-- Strategic Customer Scoring -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">👑 Strategic Customer Scoring</h2>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="list-group">
                ${strategic.map((s, i) => `
                    <div style="padding: 14px 20px; border-bottom: 1px solid var(--color-gray-800); display: flex; align-items: center; gap: 16px;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #1e272e, #485460); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #f9ca24; font-size: 14px; border: 1px solid rgba(249, 202, 36, 0.3);">
                            ${i + 1}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 15px;">${s.name}</div>
                            <div style="font-size: 12px; color: var(--color-gray-400);">
                                Vol: ${s.goldBal.toFixed(3)}g | Val: ${this.formatCurrency(s.financialBal)}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 10px; opacity: 0.6; text-transform: uppercase; margin-bottom: 2px;">Score</div>
                            <div style="font-size: 16px; font-weight: 700; color: #4facfe;">${(s.score / 1000000).toFixed(1)}M</div>
                        </div>
                    </div>
                `).join('')}
            </div>
          </div>
        </div>

        <!-- Refining Accuracy -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">🔍 Refining Accuracy (Variance)</h2>
          </div>
          <div class="card-body">
            <div class="stat-grid mb-4">
                <div>
                    <div class="stat-label">Avg Variance</div>
                    <div class="stat-value ${Math.abs(parseFloat(excellence.avgVariance)) > 0.1 ? 'text-error' : 'text-success'}">
                        ${excellence.avgVariance} g
                    </div>
                </div>
                <div>
                    <div class="stat-label">Total Cumulative</div>
                    <div class="stat-value" style="color: #4facfe;">${excellence.totalVariance} g</div>
                </div>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid var(--color-gray-800);">
                <div style="display: flex; height: 10px; border-radius: 5px; overflow: hidden; margin-bottom: 12px; background: rgba(255,255,255,0.1);">
                    <div style="width: ${(excellence.positiveCount / (excellence.positiveCount + excellence.negativeCount || 1)) * 100}%; background: linear-gradient(to right, #43e97b, #38f9d7);"></div>
                    <div style="width: ${(excellence.negativeCount / (excellence.positiveCount + excellence.negativeCount || 1)) * 100}%; background: linear-gradient(to right, #f5576c, #f093fb);"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-gray-400);">
                    <span>Deposit (+) : <strong>${excellence.positiveCount}</strong></span>
                    <span>Obligation (-) : <strong>${excellence.negativeCount}</strong></span>
                </div>
            </div>
            <div style="margin-top: 20px; text-align: center;">
                <span style="font-size: 13px; color: var(--color-gray-400);">Consistency Index:</span>
                <span class="badge ${excellence.consistency === 'High' ? 'badge-success' : 'badge-warning'}" style="margin-left: 8px;">${excellence.consistency}</span>
            </div>
          </div>
        </div>

        <!-- Financial Metrics -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">💎 Financial Metrics</h2>
          </div>
          <div class="card-body">
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div style="padding: 16px; background: rgba(102, 126, 234, 0.1); border-radius: 8px; border-left: 4px solid #667eea;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-weight: 600; color: #667eea;">💰 Net Profit</span>
                  <span style="font-size: 20px; font-weight: 700;">${this.formatCurrency(financial.netProfit)}</span>
                </div>
                <div style="font-size: 12px; opacity: 0.7;">Profit margin: ${financial.profitMargin.toFixed(1)}%</div>
              </div>

              <div style="padding: 16px; background: rgba(79, 172, 254, 0.1); border-radius: 8px; border-left: 4px solid #4facfe;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-weight: 600; color: #4facfe;">📊 Total Assets</span>
                  <span style="font-size: 20px; font-weight: 700;">${this.formatCurrency(financial.totalAssets)}</span>
                </div>
                <div style="font-size: 12px; opacity: 0.7;">Company's total resources</div>
              </div>

              <div style="padding: 16px; background: rgba(240, 147, 251, 0.1); border-radius: 8px; border-left: 4px solid #f093fb;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-weight: 600; color: #f093fb;">📉 Total Liabilities</span>
                  <span style="font-size: 20px; font-weight: 700;">${this.formatCurrency(financial.totalLiabilities)}</span>
                </div>
                <div style="font-size: 12px; opacity: 0.7;">Debt ratio: ${(financial.debtRatio * 100).toFixed(0)}%</div>
              </div>

              <div style="padding: 16px; background: rgba(67, 233, 123, 0.1); border-radius: 8px; border-left: 4px solid #43e97b;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-weight: 600; color: #43e97b;">🔄 Current Ratio</span>
                  <span style="font-size: 20px; font-weight: 700;">${financial.currentRatio.toFixed(2)}</span>
                </div>
                <div style="font-size: 12px; opacity: 0.7;">${financial.currentRatio >= 2 ? 'Excellent liquidity' : financial.currentRatio >= 1.5 ? 'Good liquidity' : financial.currentRatio >= 1 ? 'Adequate liquidity' : 'Poor liquidity'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Info Box -->
      <div class="card" style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%); border: 1px dashed var(--color-gray-800);">
        <div class="card-body" style="text-align: center; padding: 24px;">
          <div style="font-size: 32px; margin-bottom: 12px;">🤖</div>
          <div style="font-weight: 600; margin-bottom: 8px;">AI-Powered Business Intelligence</div>
          <p class="text-gray" style="margin: 0; font-size: 14px;">
            Insights dihasilkan dari analisis real-time terhadap ${sales.transactionCount + purchases.transactionCount} transactions, 
            ${inventory.itemCount} items, dan data keuangan perusahaan. Data diperbarui otomatis setiap kali Anda melakukan transaksi.
          </p>
        </div>
      </div>
    `;
  },

  // Render compact widget for dashboard
  renderDashboardWidget() {
    const insights = this.generateInsights().slice(0, 3); // Top 3 insights only
    const financial = this.analyzeFinancialHealth();

    return `
      <div class="card mb-3" style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%); border: 1px solid var(--color-gray-800);">
        <div class="card-header" style="background: transparent;">
          <h2 class="card-title">🤖 AI Insights</h2>
          <div style="display: flex; gap: 12px; align-items: center;">
            <div style="
              padding: 6px 12px; 
              border-radius: 20px; 
              background: linear-gradient(135deg, #667eea, #764ba2);
              color: white;
              font-weight: 600;
              font-size: 14px;
            ">
              Score: ${financial.healthScore}/100
            </div>
            <a href="#" onclick="App.navigateTo('ai-advisor')" class="btn btn-sm btn-secondary">
              View All →
            </a>
          </div>
        </div>
        <div class="card-body" style="padding: 16px 24px;">
          ${insights.length > 0 ? insights.map(insight => `
            <div style="
              padding: 12px;
              border-left: 3px solid ${insight.type === 'success' ? '#43e97b' :
        insight.type === 'warning' ? '#f093fb' :
          insight.type === 'error' ? '#f5576c' : '#4facfe'};
              background: ${insight.type === 'success' ? 'rgba(67, 233, 123, 0.05)' :
        insight.type === 'warning' ? 'rgba(240, 147, 251, 0.05)' :
          insight.type === 'error' ? 'rgba(245, 87, 108, 0.05)' : 'rgba(79, 172, 254, 0.05)'};
              border-radius: 6px;
              margin-bottom: 12px;
            ">
              <div style="display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 24px;">${insight.icon}</span>
                <div style="flex: 1;">
                  <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${insight.title}</div>
                  <div style="font-size: 13px; color: var(--color-gray-400);">${insight.message}</div>
                </div>
              </div>
            </div>
          `).join('') : `
            <div class="text-center text-gray" style="padding: 20px;">
              <div style="font-size: 32px; margin-bottom: 8px;">📊</div>
              <p>Tambahkan lebih banyak transaksi untuk mendapatkan AI insights</p>
            </div>
          `}
        </div>
      </div>
    `;
  },

  // Utility function
  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(amount));
  }
};
