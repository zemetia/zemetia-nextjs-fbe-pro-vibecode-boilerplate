'use client';

import { Building2, User } from 'lucide-react';

import {
  PARTNER_ORIGIN_LABELS,
  PARTNER_TYPE_DESCRIPTIONS,
  PARTNER_TYPE_OPTIONS,
  isCompanyType,
  partnerOriginFromCountry,
} from '@/lib/partner';
import { cn } from '@/lib/cn';
import { Combobox } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { Checkbox } from '@/components/ui/checkbox';
import type { CountryVO, CurrencyVO, PartnerType } from '@/types/value-objects';
import { FormField } from '../FormField';
import type { PartnerFieldErrors, PartnerFormState } from '../form-state';

export interface IdentityStepProps {
  form: PartnerFormState;
  errors: PartnerFieldErrors;
  onChange: (patch: Partial<PartnerFormState>) => void;
  countries: CountryVO[];
  currencies: CurrencyVO[];
  isLoadingReferences: boolean;
}

const TYPE_ICONS: Record<PartnerType, typeof Building2> = {
  COMPANY: Building2,
  INDIVIDUAL: User,
};

/**
 * A role card: the tick that switches the role on, and whatever that role then
 * has to answer for. Nothing hangs off a role today — origin belongs to the
 * partner, not to a side of the trade — so the card is currently just the tick.
 */
function RoleCard({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4 transition-colors',
        checked ? 'border-primary/40 bg-accent/40' : 'border-border bg-surface',
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          className="mt-0.5"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-xs text-foreground-subtle">{description}</span>
        </span>
      </label>
    </div>
  );
}

RoleCard.displayName = 'RoleCard';

export function IdentityStep({
  form,
  errors,
  onChange,
  countries,
  currencies,
  isLoadingReferences,
}: IdentityStepProps) {
  // Picking a country pre-fills its official currency, but only while the field
  // is still untouched — an overseas refinery billing in USD keeps its choice.
  const handleCountry = (countryId: string) => {
    const country = countries.find((entry) => entry.id === countryId);
    const currencyCode =
      !form.currencyCode && country?.currencyCode ? country.currencyCode : form.currencyCode;
    onChange({ countryId, currencyCode });
  };

  const isCompany = isCompanyType(form.type);

  // Asal mitra tidak ditanyakan — negaranya sudah menjawabnya, dan menanyakan
  // keduanya hanya membuka peluang jawaban yang saling bertentangan.
  const selectedCountry = countries.find((country) => country.id === form.countryId);
  const originHint = selectedCountry
    ? `Tercatat sebagai mitra ${PARTNER_ORIGIN_LABELS[partnerOriginFromCountry(selectedCountry.iso2)].toLowerCase()} — asal mitra mengikuti negaranya.`
    : 'Menentukan asal mitra: Indonesia berarti lokal, negara lain berarti overseas.';

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          label="Bentuk mitra"
          required
          error={errors.type}
          hint={PARTNER_TYPE_DESCRIPTIONS[form.type]}
          className="md:col-span-2"
        >
          <Segmented
            options={PARTNER_TYPE_OPTIONS.map((option) => {
              const Icon = TYPE_ICONS[option.value];
              return {
                ...option,
                icon: <Icon className="h-4 w-4" aria-hidden="true" />,
              };
            })}
            value={form.type}
            onValueChange={(type) => onChange({ type })}
            aria-label="Bentuk mitra"
          />
        </FormField>

        <Input
          label={isCompany ? 'Nama mitra' : 'Nama lengkap'}
          placeholder={isCompany ? 'PT Emas Nusantara' : 'Budi Santoso'}
          value={form.name}
          onChange={(event) => onChange({ name: event.target.value })}
          error={errors.name}
          required
          className={isCompany ? undefined : 'md:col-span-2'}
        />

        {isCompany && (
          <Input
            label="Nama legal"
            placeholder="PT Emas Nusantara Sejahtera"
            value={form.legalName}
            onChange={(event) => onChange({ legalName: event.target.value })}
            error={errors.legal_name}
            hint="Isi bila berbeda dari nama dagang yang dipakai sehari-hari."
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">
          Peran
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        </span>
        <p className="text-xs text-foreground-subtle">
          Satu mitra boleh berperan ganda — toko emas bisa menyetor scrap sekaligus membeli
          perhiasan jadi.
        </p>

        <div className="mt-1 grid grid-cols-1 gap-3 md:grid-cols-2">
          <RoleCard
            title="Supplier — kita beli dari mereka"
            description="Muncul di pemilihan mitra pada dokumen pembelian."
            checked={form.isSupplier}
            onCheckedChange={(isSupplier) => onChange({ isSupplier })}
          />

          <RoleCard
            title="Customer — kita jual ke mereka"
            description="Muncul di pemilihan mitra pada dokumen penjualan."
            checked={form.isCustomer}
            onCheckedChange={(isCustomer) => onChange({ isCustomer })}
          />
        </div>

        {errors.role && (
          <p role="alert" className="text-xs text-destructive">
            {errors.role}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Negara" required error={errors.country_id} hint={originHint}>
          <Combobox
            options={countries.map((country) => ({ value: country.id, label: country.label }))}
            value={form.countryId || null}
            onValueChange={handleCountry}
            loading={isLoadingReferences}
            placeholder="Pilih negara…"
            searchPlaceholder="Cari negara…"
            emptyText="Negara tidak ditemukan."
            aria-label="Negara"
          />
        </FormField>

        <FormField
          label="Mata uang transaksi"
          required
          error={errors.currency_code}
          hint="Terisi otomatis dari negara — mitra luar negeri umumnya memakai USD."
        >
          <Combobox
            options={currencies.map((currency) => ({
              value: currency.code,
              label: currency.label,
            }))}
            value={form.currencyCode || null}
            onValueChange={(currencyCode) => onChange({ currencyCode })}
            loading={isLoadingReferences}
            placeholder="Pilih mata uang…"
            searchPlaceholder="Cari mata uang…"
            emptyText="Mata uang tidak ditemukan."
            aria-label="Mata uang transaksi"
          />
        </FormField>

        <Input
          label="Email operasional"
          type="email"
          placeholder={isCompany ? 'purchasing@mitra.com' : 'budi@email.com'}
          value={form.email}
          onChange={(event) => onChange({ email: event.target.value })}
          error={errors.email}
        />

        <Input
          label="Telepon"
          placeholder="+62 21 555 0100"
          value={form.phone}
          onChange={(event) => onChange({ phone: event.target.value })}
          error={errors.phone}
        />

        {isCompany && (
          <Input
            label="Website"
            placeholder="https://mitra.com"
            value={form.website}
            onChange={(event) => onChange({ website: event.target.value })}
            error={errors.website}
            className="md:col-span-2"
          />
        )}
      </div>

      {/* Alamat duduk di identitas, bukan di blok kontak: ia milik badan usahanya
          — dicetak di PO, invoice, dan dokumen bea cukai — dan tetap sama walau
          PIC-nya berganti. */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">
          {isCompany ? 'Alamat perusahaan' : 'Alamat'}
        </span>
        <p className="text-xs text-foreground-subtle">
          Dipakai di dokumen pembelian dan penjualan, dan termasuk data yang wajib lengkap
          sebelum mitra bisa diajukan verifikasi.
        </p>

        <div className="mt-1 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Alamat"
            placeholder="Jl. Industri Raya No. 12, Kawasan Berikat"
            value={form.addressLine}
            onChange={(event) => onChange({ addressLine: event.target.value })}
            error={errors.address_line}
            className="md:col-span-2"
          />

          <Input
            label="Kota"
            placeholder="Jakarta Utara"
            value={form.city}
            onChange={(event) => onChange({ city: event.target.value })}
            error={errors.city}
          />

          <Input
            label="Provinsi / State"
            placeholder="DKI Jakarta"
            value={form.province}
            onChange={(event) => onChange({ province: event.target.value })}
            error={errors.province}
          />

          <Input
            label="Kode pos"
            placeholder="14350"
            value={form.postalCode}
            onChange={(event) => onChange({ postalCode: event.target.value })}
            error={errors.postal_code}
          />
        </div>
      </div>
    </div>
  );
}

IdentityStep.displayName = 'IdentityStep';
