'use client';

import { fromDateOnly, toDateOnly, today } from '@/lib/date';
import { NIB_LENGTH, PARTNER_PAYMENT_METHOD_OPTIONS, isCompanyType } from '@/lib/partner';
import { Combobox } from '@/components/ui/Combobox';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { PartnerPaymentMethod } from '@/types/value-objects';
import { FormField } from '../FormField';
import type { PartnerFieldErrors, PartnerFormState } from '../form-state';

export interface FinanceStepProps {
  form: PartnerFormState;
  errors: PartnerFieldErrors;
  onChange: (patch: Partial<PartnerFormState>) => void;
  /** Overseas partners get the SWIFT field; local ones don't need it. */
  isOverseas: boolean;
}

export function FinanceStep({ form, errors, onChange, isOverseas }: FinanceStepProps) {
  // Akta dan SK pengesahan hanya ada pada badan usaha — perorangan tidak punya
  // dokumen pendirian, jadi memintanya cuma menambah field yang selalu kosong.
  const isCompany = isCompanyType(form.type);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Input
        label={isOverseas ? 'Tax ID / VAT number' : 'NPWP'}
        placeholder={isOverseas ? 'GB123456789' : '01.234.567.8-901.000'}
        value={form.taxNumber}
        onChange={(event) => onChange({ taxNumber: event.target.value })}
        error={errors.tax_number}
      />

      {/* NIB dan nomor registrasi asing bukan dua nama untuk satu hal: NIB terbit
          dari OSS dengan panjang tetap yang bisa diperiksa, sedangkan nomor
          registrasi luar negeri berbeda bentuk di tiap yurisdiksi. Karena itu
          keduanya kolom sendiri, dan yang ditampilkan mengikuti negara mitra. */}
      {isOverseas ? (
        <Input
          label="Nomor registrasi perusahaan"
          placeholder="DMCC-123456"
          value={form.foreignRegistrationNumber}
          onChange={(event) => onChange({ foreignRegistrationNumber: event.target.value })}
          error={errors.foreign_registration_number}
          hint="Company registration number di negara asalnya — pengganti NIB."
        />
      ) : (
        <Input
          label="NIB"
          placeholder="1234567890123"
          value={form.nib}
          onChange={(event) => onChange({ nib: event.target.value })}
          error={errors.nib}
          hint={`Nomor Induk Berusaha dari OSS — ${NIB_LENGTH} digit angka.`}
        />
      )}

      <FormField
        label="Status PKP"
        error={errors.is_pkp}
        hint="Menentukan boleh tidaknya faktur pajaknya dikreditkan."
      >
        <label className="flex h-9 cursor-pointer items-center gap-2.5">
          <Switch
            checked={form.isPkp}
            onCheckedChange={(isPkp) =>
              // Mencabut status PKP ikut membuang nomor SPPKP-nya: nomor itu
              // hanya berarti selama statusnya menyala, dan menyimpannya diam-diam
              // membuat form menolak simpan dengan alasan yang tidak terlihat.
              onChange(isPkp ? { isPkp } : { isPkp, sppkpNumber: '' })
            }
            aria-label="Status PKP"
          />
          <span className="text-sm text-foreground">
            {form.isPkp ? 'Pengusaha Kena Pajak' : 'Non-PKP'}
          </span>
        </label>
      </FormField>

      {form.isPkp && (
        <Input
          label="Nomor SPPKP"
          value={form.sppkpNumber}
          onChange={(event) => onChange({ sppkpNumber: event.target.value })}
          error={errors.sppkp_number}
        />
      )}

      {isCompany && (
        <>
          <Input
            label="Nomor akta pendirian"
            placeholder="12/2019"
            value={form.deedNumber}
            onChange={(event) => onChange({ deedNumber: event.target.value })}
            error={errors.deed_number}
          />

          <FormField label="Tanggal akta pendirian" error={errors.deed_date}>
            <DatePicker
              value={fromDateOnly(form.deedDate) ?? null}
              onChange={(date) => onChange({ deedDate: date ? toDateOnly(date) : '' })}
              maxDate={today()}
            />
          </FormField>

          <Input
            label="Nomor SK Kemenkumham"
            placeholder="AHU-0012345.AH.01.01.TAHUN 2019"
            value={form.ministryDecreeNumber}
            onChange={(event) => onChange({ ministryDecreeNumber: event.target.value })}
            error={errors.ministry_decree_number}
            className="md:col-span-2"
          />
        </>
      )}

      {/* Terms are per direction: the same partner can give us 30 days on what we
          buy and demand payment up front on what we sell. Only the roles it
          actually holds are asked about. */}
      {form.isSupplier && (
        <>
          <NumberInput
            label="Termin pembelian"
            rightAddon={<span className="text-sm">hari</span>}
            value={form.purchaseTermDays}
            onChange={(purchaseTermDays) => onChange({ purchaseTermDays })}
            error={errors.purchase_term_days}
            hint="Tempo saat kita membayar mereka. Kosongkan bila belum disepakati, isi 0 untuk bayar di muka."
          />

          <FormField label="Metode pembayaran ke mereka" error={errors.purchase_payment_method}>
            <Combobox
              options={PARTNER_PAYMENT_METHOD_OPTIONS}
              value={form.purchasePaymentMethod ?? null}
              onValueChange={(value) =>
                onChange({ purchasePaymentMethod: value as PartnerPaymentMethod })
              }
              placeholder="Pilih metode…"
              searchPlaceholder="Cari metode…"
              emptyText="Metode tidak ditemukan."
              aria-label="Metode pembayaran pembelian"
            />
          </FormField>
        </>
      )}

      {form.isCustomer && (
        <>
          <NumberInput
            label="Termin penjualan"
            rightAddon={<span className="text-sm">hari</span>}
            value={form.salesTermDays}
            onChange={(salesTermDays) => onChange({ salesTermDays })}
            error={errors.sales_term_days}
            hint="Tempo saat mereka membayar kita. Kosongkan bila belum disepakati, isi 0 untuk bayar di muka."
          />

          <FormField label="Metode pembayaran dari mereka" error={errors.sales_payment_method}>
            <Combobox
              options={PARTNER_PAYMENT_METHOD_OPTIONS}
              value={form.salesPaymentMethod ?? null}
              onValueChange={(value) =>
                onChange({ salesPaymentMethod: value as PartnerPaymentMethod })
              }
              placeholder="Pilih metode…"
              searchPlaceholder="Cari metode…"
              emptyText="Metode tidak ditemukan."
              aria-label="Metode pembayaran penjualan"
            />
          </FormField>
        </>
      )}

      <Input
        label="Nama bank"
        placeholder={isOverseas ? 'HSBC Hong Kong' : 'Bank Mandiri'}
        value={form.bankName}
        onChange={(event) => onChange({ bankName: event.target.value })}
        error={errors.bank_name}
      />

      <Input
        label="Nama pemilik rekening"
        value={form.bankAccountName}
        onChange={(event) => onChange({ bankAccountName: event.target.value })}
        error={errors.bank_account_name}
      />

      <Input
        label="Nomor rekening"
        value={form.bankAccountNo}
        onChange={(event) => onChange({ bankAccountNo: event.target.value })}
        error={errors.bank_account_no}
      />

      {isOverseas && (
        <Input
          label="Kode SWIFT / BIC"
          placeholder="HSBCHKHHHKH"
          value={form.bankSwiftCode}
          onChange={(event) => onChange({ bankSwiftCode: event.target.value })}
          error={errors.bank_swift_code}
          hint="Diperlukan untuk transfer ke luar negeri."
        />
      )}

      <FormField label="Catatan" error={errors.notes} className="md:col-span-2">
        <Textarea
          value={form.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
          placeholder="Kesepakatan khusus, batas kredit, catatan kualitas…"
          rows={3}
        />
      </FormField>
    </div>
  );
}

FinanceStep.displayName = 'FinanceStep';
