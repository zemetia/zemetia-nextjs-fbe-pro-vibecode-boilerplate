// @ts-nocheck
'use client';
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

  // Nama varian salah ketik akan diam-diam jadi biru — warna yang salah arti di aplikasi ini.
  if (!VARIANTS[variant]) {
    console.warn(`<Modal>: variant "${variant}" tidak dikenal. Pakai: ${Object.keys(VARIANTS).join(' | ')}`);
  }

  const v = VARIANTS[variant] || VARIANTS.info;
  const Icon = v.Icon;
  const isConfirm = typeof onConfirm === 'function';

  const handleConfirm = () => { onClose(); onConfirm(); };

  return (
    <div
      className="animate-modal-fade fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(3,7,18,0.72)] p-6 backdrop-blur-[6px]"
      onClick={handleDismiss}
    >
      <div
        className="animate-modal-rise relative max-h-[85vh] w-full max-w-[540px] overflow-y-auto rounded-lg border border-t-[3px] border-line bg-linear-160 from-[#1a2338] to-surface px-7 pb-5 pt-[26px] shadow-modal"
        role="dialog"
        aria-modal="true"
        style={{ borderTopColor: v.color }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute right-3.5 top-3.5 inline-flex cursor-pointer rounded-sm bg-transparent p-1.5 text-fg-muted transition-colors duration-200 hover:bg-white/[0.06] hover:text-fg"
          onClick={handleDismiss}
          aria-label="Tutup"
        >
          <X size={16} />
        </button>

        <div className="mb-4 flex items-center gap-3.5 pr-7">
          <span
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-transparent"
            style={{ color: v.color, background: `${v.color}1f`, borderColor: `${v.color}40` }}
          >
            <Icon size={22} />
          </span>
          <h3 className="text-[1.1rem] font-semibold leading-[1.35]">{title || v.fallbackTitle}</h3>
        </div>

        {message && (
          <p className="mb-5 whitespace-pre-wrap text-sm leading-[1.7] text-fg-soft">{message}</p>
        )}
        {children}

        <div className="flex justify-end gap-2.5 border-t border-line pt-4">
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
