'use client';

import { useQuery } from '@tanstack/react-query';

import { accountService, apiErrorMessage, flattenAccounts } from '@/services';
import { Combobox } from '@/components/ui/Combobox';
import type { AccountType } from '@/types/value-objects';

/** The chart is small and read constantly — one fetch serves every picker on screen. */
const TREE_STALE_TIME = 5 * 60 * 1000;

export interface AccountPickerProps {
  value: string;
  onChange: (accountId: string) => void;
  label?: string;
  /** Restricts the list to one or more account classes, e.g. only assets. */
  types?: readonly AccountType[];
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Ledger account field for a transaction form.
 *
 * It offers **postable accounts only** — a header groups, it does not receive
 * postings, and its balance is the sum of its subtree (see `accounting.prisma`).
 * The journal rejects one anyway; listing it here would only let the clerk pick
 * something that fails on save with an error about a rule they never saw.
 *
 * Inactive accounts are filtered out for the mirror-image reason: a closed
 * account stays readable in history but is not open to new mutations.
 */
export function AccountPicker({
  value,
  onChange,
  label,
  types,
  placeholder = 'Pilih akun…',
  hint,
  error,
  required = false,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: AccountPickerProps) {
  const {
    data,
    isLoading,
    isError,
    error: queryError,
  } = useQuery({
    queryKey: ['accounts', 'tree', 'postable'],
    queryFn: () => accountService.tree({ is_active: true }),
    staleTime: TREE_STALE_TIME,
  });

  const options = flattenAccounts(data?.items ?? [])
    .filter((account) => account.isPostable && (!types || types.includes(account.type)))
    .map((account) => ({ value: account.id, label: `${account.code} — ${account.name}` }));

  return (
    <div className={className ?? 'flex w-full flex-col gap-1.5'}>
      {label && (
        <span className="text-foreground text-sm font-medium">
          {label}
          {required && (
            <span className="text-destructive ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </span>
      )}

      <Combobox
        options={options}
        value={value}
        onValueChange={onChange}
        loading={isLoading}
        disabled={disabled}
        placeholder={placeholder}
        searchPlaceholder="Cari kode atau nama akun…"
        emptyText="Akun tidak ditemukan."
        aria-label={ariaLabel ?? label ?? 'Akun'}
      />

      {hint && !error && <p className="text-foreground-subtle text-xs">{hint}</p>}
      {isError && (
        <p className="text-destructive text-xs">
          {apiErrorMessage(queryError, 'Bagan akun gagal dimuat.')}
        </p>
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

AccountPicker.displayName = 'AccountPicker';
