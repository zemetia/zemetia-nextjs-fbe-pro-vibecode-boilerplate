import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Load legacy backend scripts into window context for data engine
import '../data/storage.js';
import '../modules/auth.js';
import '../modules/_validators.js';
import '../modules/purchaseOrder.js';
import '../modules/paymentVoucher.js';
import '../modules/receiptVoucher.js';
import '../modules/journalEntry.js';
import '../modules/generalLedger.js';
import '../modules/incomeStatement.js';
import '../modules/balanceSheet.js';
import '../modules/cashFlow.js';
import '../modules/journalReport.js';
import '../modules/balanceReports.js';
import '../modules/finalReports.js';
import '../modules/pdfExporter.js';

if (typeof window !== 'undefined' && window.Storage) {
  window.Storage.init();
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
