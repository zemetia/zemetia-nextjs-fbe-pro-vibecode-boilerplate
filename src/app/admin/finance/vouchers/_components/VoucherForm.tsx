'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cashVoucherService } from '@/services';
import { useFormErrors, useToast, zodFieldErrors } from '@/hooks';
import { toDateOnly, today } from '@/lib/date';
import {
  counterpartyLabel,
  requiresDueDate,
  requiresTransferChannel,
  VOUCHER_CATEGORY_OPTIONS,
  VOUCHER_DIRECTION_OPTIONS,
  VOUCHER_KIND_LABELS,
  VOUCHER_TRANSFER_CHANNEL_OPTIONS,
  voucherKind,
} from '@/lib/cash-voucher';
import { createCashVoucherSchema } from '@/lib/validations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Combobox } from '@/components/ui/Combobox';
import { DatePicker } from '@/components/ui/DatePicker';
import { FormActionBar } from '@/components/ui/FormActionBar';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PartnerPicker } from '@/components/shared';
import type { VoucherDirection, VoucherPaymentMethod } from '@/types/value-objects';
import { PaymentMethodCards } from './PaymentMethodCards';
import { VoucherFundsEditor } from './VoucherFundsEditor';
import { VoucherLinesEditor } from './VoucherLinesEditor';
import {
  applyPaymentMethod,
  emptyForm,
  previewTotal,
  toPayload,
  type VoucherFormState,
} from './form-state';

const LIST_PATH = '/admin/finance/vouchers';

export interface VoucherFormProps {
  /** Absent for create; present when editing a draft. */
  voucherId?: string;
  initialForm?: VoucherFormState;
  canCreatePartner?: boolean;
}

/**
 * The one form behind `/new` and `/[id]/edit`.
 *
 * What is deliberately *not* on this screen: a debit/credit picker, and a total
 * field. The voucher type answers the first and the rows answer the second, so
 * neither is asked — a form that lets one fact be stated twice is a form where
 * the two statements eventually disagree.
 *
 * The voucher type itself is not asked either. It falls out of the payment method
 * card the clerk picks, which is the decision they actually make: they know they
 * are paying by bilyet giro, not that a giro makes this a BBK.
 */
export function VoucherForm({
  voucherId,
  initialForm,
  canCreatePartner = false,
}: VoucherFormProps) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<VoucherFormState>(initialForm ?? emptyForm());
  const { errors, validate } = useFormErrors(() =>
    zodFieldErrors(createCashVoucherSchema, toPayload(form)),
  );

  const isEdit = voucherId !== undefined;
  const kind = voucherKind(form.fund, form.direction);
  const isBank = form.fund === 'BANK';
  const total = previewTotal(form);

  function patch(changes: Partial<VoucherFormState>): void {
    setForm((current) => ({ ...current, ...changes }));
  }

  // The number this voucher would take, shown so the clerk can write it on the
  // paperwork before saving. It follows the type and the date because both are
  // part of it, and it reserves nothing.
  const preview = useQuery({
    queryKey: ['cash-vouchers', 'next-number', form.fund, form.direction, form.date?.toISOString()],
    queryFn: () =>
      cashVoucherService.nextNumber({
        fund: form.fund,
        direction: form.direction,
        ...(form.date ? { date: toDateOnly(form.date) } : {}),
      }),
    enabled: !isEdit,
  });

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? cashVoucherService.update(voucherId, toPayload(form))
        : cashVoucherService.create(toPayload(form)),
    onSuccess: (voucher) => {
      queryClient.invalidateQueries({ queryKey: ['cash-vouchers'] });
      toast.success(
        isEdit
          ? `Voucher ${voucher.number} berhasil disimpan`
          : `Voucher ${voucher.number} tersimpan sebagai draft`,
      );
      router.push(LIST_PATH);
    },
    onError: (error) => {
      toast.apiError(error, 'Gagal menyimpan voucher. Coba lagi.');
    },
  });

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();

    if (!validate()) return;
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6 pb-24">
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <CardTitle>{VOUCHER_KIND_LABELS[kind]}</CardTitle>
          {!isEdit && (
            <span className="text-foreground-subtle font-mono text-sm">{preview.data ?? '—'}</span>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex w-full flex-col gap-1.5">
            <span className="text-foreground text-sm font-medium">Arah</span>
            <Segmented
              options={VOUCHER_DIRECTION_OPTIONS}
              value={form.direction}
              onValueChange={(direction: VoucherDirection) => patch({ direction })}
              disabled={mutation.isPending}
              aria-label="Arah voucher"
            />
            <p className="text-foreground-subtle text-xs">
              Menentukan sisi jurnalnya, jadi tidak ada pilihan debit/kredit per baris.
            </p>
          </div>

          <DatePicker
            label="Tanggal voucher"
            required
            value={form.date}
            onChange={(date) => patch({ date })}
            error={errors.date}
            maxDate={today()}
            disabled={mutation.isPending}
          />

          <div className="flex w-full flex-col gap-1.5">
            <span className="text-foreground text-sm font-medium">
              Kategori
              <span className="text-destructive ml-0.5" aria-hidden="true">
                *
              </span>
            </span>
            <Combobox
              options={VOUCHER_CATEGORY_OPTIONS}
              value={form.category}
              onValueChange={(category) =>
                patch({ category: category as VoucherFormState['category'] })
              }
              disabled={mutation.isPending}
              placeholder="Pilih kategori…"
              searchPlaceholder="Cari kategori…"
              emptyText="Kategori tidak ditemukan."
              aria-label="Kategori pembayaran"
            />
            {errors.category && <p className="text-destructive text-xs">{errors.category}</p>}
          </div>

          <Input
            label={counterpartyLabel(form.direction)}
            required
            placeholder="mis. CV Sinar Logam"
            value={form.counterpartyName}
            onChange={(event) => patch({ counterpartyName: event.target.value })}
            error={errors.counterparty_name}
            disabled={mutation.isPending}
            hint="Ditulis apa adanya, dan tetap terbaca sama meski mitranya berganti nama."
          />

          <div className="md:col-span-2">
            <Input
              label="Keperluan"
              required
              placeholder="mis. Pelunasan pembelian emas batangan 500 gr"
              value={form.purpose}
              onChange={(event) => patch({ purpose: event.target.value })}
              error={errors.purpose}
              disabled={mutation.isPending}
            />
          </div>

          {/* Optional on purpose: plenty of legitimate payments — petty cash, a
              reimbursement — have no partner row to point at, and demanding one
              only teaches the clerk to pick whichever name is nearest. */}
          <div className="md:col-span-2">
            <PartnerPicker
              role={form.direction === 'OUT' ? 'supplier' : 'customer'}
              origin="LOCAL"
              label="Mitra terdaftar (opsional)"
              value={form.partnerId}
              onChange={(partnerId) => patch({ partnerId })}
              error={errors.partner_id}
              canCreate={canCreatePartner}
              disabled={mutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Pembayaran</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PaymentMethodCards
            value={form.paymentMethod}
            onChange={(method: VoucherPaymentMethod) =>
              setForm((current) => applyPaymentMethod(current, method))
            }
            error={errors.payment_method}
            disabled={mutation.isPending}
          />

          <VoucherFundsEditor
            funds={form.funds}
            onChange={(funds) => patch({ funds })}
            fund={form.fund}
            target={previewTotal(form)}
            deferred={requiresDueDate(form.paymentMethod)}
            error={errors.funds}
            disabled={mutation.isPending}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {requiresTransferChannel(form.paymentMethod) && (
              <div className="flex w-full flex-col gap-1.5">
                <span className="text-foreground text-sm font-medium">
                  Jalur transfer
                  <span className="text-destructive ml-0.5" aria-hidden="true">
                    *
                  </span>
                </span>
                <Segmented
                  options={VOUCHER_TRANSFER_CHANNEL_OPTIONS}
                  value={form.transferChannel ?? ''}
                  onValueChange={(transferChannel) =>
                    patch({
                      transferChannel: transferChannel as VoucherFormState['transferChannel'],
                    })
                  }
                  disabled={mutation.isPending}
                  aria-label="Jalur transfer"
                />
                <p className="text-foreground-subtle text-xs">
                  Di atas Rp 1 miliar hanya RTGS yang bisa dipakai.
                </p>
                {errors.transfer_channel && (
                  <p className="text-destructive text-xs">{errors.transfer_channel}</p>
                )}
              </div>
            )}

            {isBank && (
              <>
                <Input
                  label="Nama bank"
                  placeholder="mis. BCA"
                  value={form.bankName}
                  onChange={(event) => patch({ bankName: event.target.value })}
                  error={errors.bank_name}
                  disabled={mutation.isPending}
                />
                <Input
                  label="Nomor rekening"
                  placeholder="mis. 1234567890"
                  value={form.bankAccountNo}
                  onChange={(event) => patch({ bankAccountNo: event.target.value })}
                  error={errors.bank_account_no}
                  disabled={mutation.isPending}
                />
              </>
            )}

            <Input
              label="Nomor referensi"
              placeholder="Nomor cek / BG / VA / L/C"
              value={form.referenceNumber}
              onChange={(event) => patch({ referenceNumber: event.target.value })}
              error={errors.reference_number}
              disabled={mutation.isPending}
            />

            {requiresDueDate(form.paymentMethod) && (
              <DatePicker
                label="Tanggal jatuh tempo"
                required
                value={form.dueDate}
                onChange={(dueDate) => patch({ dueDate })}
                error={errors.due_date}
                minDate={form.date}
                disabled={mutation.isPending}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Rincian</CardTitle>
        </CardHeader>
        <CardContent>
          <VoucherLinesEditor
            lines={form.lines}
            onChange={(lines) => patch({ lines })}
            total={total}
            error={errors.lines}
            disabled={mutation.isPending}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Posting & Catatan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-border flex items-start justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-foreground text-sm font-medium">
                Posting jurnal otomatis saat disetujui
              </p>
              <p className="text-foreground-subtle text-xs">
                Kalau dimatikan, voucher berhenti di status Disetujui dan harus diposting manual.
                Pilihan ini terkunci begitu voucher diajukan.
              </p>
            </div>
            <Switch
              checked={form.autoPostOnApproval}
              onCheckedChange={(autoPostOnApproval) => patch({ autoPostOnApproval })}
              disabled={mutation.isPending}
              aria-label="Posting jurnal otomatis saat disetujui"
            />
          </div>

          <div>
            <Textarea
              placeholder="Catatan (opsional)"
              value={form.notes}
              onChange={(event) => patch({ notes: event.target.value })}
              disabled={mutation.isPending}
              rows={2}
            />
            {errors.notes && <p className="text-destructive mt-1.5 text-xs">{errors.notes}</p>}
          </div>
        </CardContent>
      </Card>

      <FormActionBar
        onCancel={() => router.push(LIST_PATH)}
        submitLabel={isEdit ? 'Simpan Perubahan' : 'Simpan Draft'}
        isSubmitting={mutation.isPending}
      />
    </form>
  );
}

VoucherForm.displayName = 'VoucherForm';
