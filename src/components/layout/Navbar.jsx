import React, { useState, useEffect } from 'react';
import { DollarSign, Globe, RefreshCw } from 'lucide-react';
import { fetchBcaERateUSD } from '../../services/currencyService';
import { formatIDR } from '../../utils/format';

export default function Navbar({ pageTitle }) {
  const [rateInfo, setRateInfo] = useState({ rate: 16250, source: 'BCA e-Rate (Live)' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRate();
  }, []);

  const loadRate = async () => {
    setLoading(true);
    const data = await fetchBcaERateUSD();
    setRateInfo(data);
    setLoading(false);
  };

  return (
    <div className="navbar glass-panel">
      <div className="navbar-title">
        <h1>{pageTitle}</h1>
      </div>

      <div className="navbar-badges">
        <div 
          className="badge badge-gold" 
          onClick={loadRate}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          title="Klik untuk Refresh Kurs BCA e-Rate Terbaru"
        >
          <DollarSign size={14} />
          <span>USD/IDR: {formatIDR(rateInfo.rate || 16250)}</span>
          <RefreshCw size={12} className={loading ? 'spin' : ''} style={{ marginLeft: '4px' }} />
        </div>
        <div className="badge badge-emerald">
          <Globe size={14} />
          <span>Market: EXPORT ONLY (PPN 0%)</span>
        </div>
      </div>
    </div>
  );
}
