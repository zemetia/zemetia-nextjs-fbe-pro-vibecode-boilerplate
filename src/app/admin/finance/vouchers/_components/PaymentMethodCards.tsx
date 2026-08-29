'use client';

import {
  ArrowLeftRight,
  Banknote,
  Coins,
  CreditCard,
  FileText,
  Hash,
  Landmark,
  Lock,
  ReceiptText,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/cn';
import {
  VOUCHER_PAYMENT_METHOD_HINTS,
  VOUCHER_PAYMENT_METHOD_LABELS,
  VOUCHER_PAYMENT_METHODS,
} from '@/lib/cash-voucher';
import type { VoucherPaymentMethod } from '@/types/value-objects';

/**
 * Icons live here, not in `@/lib/cash-voucher` — that module is pure and is
 * imported by route handlers, and a React component has no business crossing
 * that boundary.
 */
const METHOD_ICONS: Record<VoucherPaymentMethod, LucideIcon> = {
  CASH: Banknote,
  BANK_TRANSFER: Landmark,
  CHEQUE: ReceiptText,
  GIRO: FileText,
  CARD: CreditCard,
  VIRTUAL_ACCOUNT: Hash,
  LETTER_OF_CREDIT: ScrollText,
  ESCROW: Lock,
  GOLD: Coins,
  NETTING: ArrowLeftRight,
};

export interface PaymentMethodCardsProps {
  value: VoucherPaymentMethod;
  onChange: (method: VoucherPaymentMethod) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * The payment method, as a grid of cards rather than a dropdown.
 *
 * It is the field that decides the most on this form — it sets the voucher type,
 * which fields appear, and which accounts may be picked — so it is the one field
 * that shows all its options at once instead of hiding them behind a click.
 *
 * Every method is always offered. Picking one that belongs to another fund moves
 * the voucher there rather than being refused: the clerk knows they are paying by
 * giro, not that a giro makes this a BBK.
 */
export function PaymentMethodCards({
  value,
  onChange,
  error,
  disabled = false,
}: PaymentMethodCardsProps) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-foreground text-sm font-medium">
        Metode pembayaran
        <span className="text-destructive ml-0.5" aria-hidden="true">
          *
        </span>
      </span>

      <div
        role="radiogroup"
        aria-label="Metode pembayaran"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
      >
        {VOUCHER_PAYMENT_METHODS.map((method) => {
          const Icon = METHOD_ICONS[method];
          const selected = method === value;

          return (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(method)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors',
                'focus-visible:ring-ring/40 focus-visible:ring-3 focus-visible:outline-none',
                'disabled:cursor-not-allowed disabled:opacity-60',
                selected
                  ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                  : 'border-input bg-card text-foreground-subtle hover:border-border-strong hover:text-foreground',
              )}
            >
              <Icon
                className={cn('h-5 w-5', selected ? 'text-primary' : undefined)}
                aria-hidden="true"
              />
              <span className="text-xs font-medium">{VOUCHER_PAYMENT_METHOD_LABELS[method]}</span>
              <span className="text-foreground-subtle text-[11px] leading-tight">
                {VOUCHER_PAYMENT_METHOD_HINTS[method]}
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

PaymentMethodCards.displayName = 'PaymentMethodCards';
