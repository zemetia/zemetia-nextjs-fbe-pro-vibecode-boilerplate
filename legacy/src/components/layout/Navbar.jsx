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
    <div className="glass-panel mb-7 flex items-center justify-between rounded-md px-7 py-4">
      <div>
        <h1 className="text-[1.4rem]">{pageTitle}</h1>
      </div>

      <div className="flex gap-3">
        <div
          className="badge badge-gold cursor-pointer"
          onClick={loadRate}
          title="Klik untuk Refresh Kurs BCA e-Rate Terbaru"
        >
          <DollarSign size={14} />
          <span>USD/IDR: {formatIDR(rateInfo.rate || 16250)}</span>
          <RefreshCw size={12} className={loading ? 'ml-1 animate-spin' : 'ml-1'} />
        </div>
        <div className="badge badge-emerald">
          <Globe size={14} />
          <span>Market: EXPORT ONLY (PPN 0%)</span>
        </div>
      </div>
    </div>
  );
}
