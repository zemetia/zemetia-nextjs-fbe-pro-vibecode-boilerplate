import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, HelpCircle, X } from 'lucide-react';

// Pemetaan warna mengikuti DESIGN_SYSTEM.md: emerald = selesai, gold = perhatian,
// merah = gagal, biru = informasi.
const VARIANTS = {
  success: { color: '#10b981', dark: '#059669', Icon: CheckCircle2,  fallbackTitle: 'Berhasil' },
  warning: { color: '#f59e0b', dark: '#d97706', Icon: AlertTriangle, fallbackTitle: 'Perhatian' },
  error:   { color: '#ef4444', dark: '#dc2626', Icon: XCircle,       fallbackTitle: 'Gagal' },
  info:    { color: '#3b82f6', dark: '#2563eb', Icon: Info,          fallbackTitle: 'Informasi' },
  confirm: { color: '#f59e0b', dark: '#d97706', Icon: HelpCircle,    fallbackTitle: 'Konfirmasi' }
};

/**
 * Pengganti alert() / window.confirm().
 *
 *   const { modalProps, showModal } = useModal();
 *   showModal({ variant: 'success', title: '…', message: 'baris 1\nbaris 2' });
 *   showModal({ variant: 'confirm', title: '…', message: '…', onConfirm: () => hapus() });
 *   ...
 *   <Modal {...modalProps} />
 */
export function useModal() {
  const [state, setState] = useState({ open: false });

  const showModal = useCallback((options) => setState({ ...options, open: true }), []);
  const closeModal = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  return { modalProps: { ...state, onClose: closeModal }, showModal, closeModal };
}

export default function Modal({
  open,
  variant = 'info',
  title,
  message,
  children,
  confirmLabel,
  cancelLabel = 'Batal',
  onConfirm,
  onDismiss,
  onClose
}) {
  // Ditutup tanpa menjalankan onConfirm: tombol Mengerti/Batal, ✕, overlay, Esc.
  const handleDismiss = useCallback(() => {
    onClose();
    if (typeof onDismiss === 'function') onDismiss();
  }, [onClose, onDismiss]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (e) => { if (e.key === 'Escape') handleDismiss(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, handleDismiss]);

  if (!open) return null;

  const v = VARIANTS[variant] || VARIANTS.info;
  const Icon = v.Icon;
  const isConfirm = typeof onConfirm === 'function';

  const handleConfirm = () => { onClose(); onConfirm(); };

  return (
    <div className="modal-overlay" onClick={handleDismiss}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        style={{ borderTopColor: v.color }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={handleDismiss} aria-label="Tutup">
          <X size={16} />
        </button>

        <div className="modal-head">
          <span
            className="modal-icon"
            style={{ color: v.color, background: `${v.color}1f`, borderColor: `${v.color}40` }}
          >
            <Icon size={22} />
          </span>
          <h3 className="modal-title">{title || v.fallbackTitle}</h3>
        </div>

        {message && <p className="modal-message">{message}</p>}
        {children}

        <div className="modal-actions">
          {isConfirm && (
            <button className="btn-ghost" onClick={handleDismiss}>{cancelLabel}</button>
          )}
          <button
            className="btn-primary"
            style={{ background: `linear-gradient(135deg, ${v.color}, ${v.dark})` }}
            onClick={isConfirm ? handleConfirm : handleDismiss}
            autoFocus
          >
            {confirmLabel || (isConfirm ? 'Lanjutkan' : 'Mengerti')}
          </button>
        </div>
      </div>
    </div>
  );
}
