'use client';

import { formatDateLong } from '@/lib/date';
import { formatNumber } from '@/lib/number';
import {
  PARTNER_CONTACT_ID_TYPE_LABELS,
  PARTNER_ORIGIN_LABELS,
  PARTNER_PAYMENT_METHOD_LABELS,
  PARTNER_TYPE_LABELS,
  isOverseasOrigin,
  partnerOriginFromCountry,
  partnerRoleLabel,
} from '@/lib/partner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { CountryVO, CurrencyVO } from '@/types/value-objects';
import type { PartnerFormState } from '../form-state';

export interface ReviewStepProps {
  form: PartnerFormState;
  countries: CountryVO[];
  currencies: CurrencyVO[];
  onEditStep: (index: number) => void;
}

const EMPTY = '—';

function show(value: string): string {
  return value.trim() ? value.trim() : EMPTY;
}

function term(days: number | undefined): string {
  if (days === undefined) return EMPTY;
  if (days === 0) return 'Bayar di muka';
  return `${formatNumber(days)} hari`;
}

export function ReviewStep({ form, countries, currencies, onEditStep }: ReviewStepProps) {
  const country = countries.find((entry) => entry.id === form.countryId);
  const contactCountry = countries.find((entry) => entry.id === form.contactCountryId);
  const currency = currencies.find((entry) => entry.code === form.currencyCode);
  // Sama seperti di form: negaranya yang menentukan NIB atau nomor registrasi asing.
  const isOverseas = country !== undefined && isOverseasOrigin(partnerOriginFromCountry(country.iso2));

  const sections = [
    {
      title: 'Identitas',
      step: 0,
      rows: [
        ['Nama', show(form.name)],
        ['Bentuk', PARTNER_TYPE_LABELS[form.type]],
        ['Nama legal', show(form.legalName)],
        ['Peran', partnerRoleLabel(form)],
        ['Negara', country?.label ?? EMPTY],
        // Derived from the country above — shown so the classification the
        // documents will use is visible before saving, not chosen twice.
        ['Asal', country ? PARTNER_ORIGIN_LABELS[partnerOriginFromCountry(country.iso2)] : EMPTY],
        ['Mata uang', currency?.label ?? EMPTY],
        ['Email operasional', show(form.email)],
        ['Telepon', show(form.phone)],
        ['Website', show(form.website)],
        ['Alamat', show(form.addressLine)],
        ['Kota', show(form.city)],
        ['Provinsi', show(form.province)],
        ['Kode pos', show(form.postalCode)],
      ],
    },
    {
      title: 'Kontak Person',
      step: 1,
      rows: [
        ['Nama kontak', show(form.contactName)],
        ['Jabatan', show(form.contactRole)],
        ['Telepon kontak', show(form.contactPhone)],
        ['Email kontak', show(form.contactEmail)],
        ['Kewarganegaraan kontak', contactCountry?.label ?? EMPTY],
        [
          'Jenis identitas',
          form.contactIdType ? PARTNER_CONTACT_ID_TYPE_LABELS[form.contactIdType] : EMPTY,
        ],
        ['Nomor identitas', show(form.contactIdNumber)],
      ],
    },
    {
      title: 'Pajak, Legal, Termin & Bank',
      step: 2,
      rows: [
        ['NPWP / Tax ID', show(form.taxNumber)],
        [isOverseas ? 'Nomor registrasi perusahaan' : 'NIB',
          show(isOverseas ? form.foreignRegistrationNumber : form.nib)],
        ['Status PKP', form.isPkp ? 'PKP' : 'Non-PKP'],
        ['Nomor SPPKP', form.isPkp ? show(form.sppkpNumber) : EMPTY],
        ['Nomor akta pendirian', show(form.deedNumber)],
        ['Tanggal akta pendirian', form.deedDate ? formatDateLong(form.deedDate) : EMPTY],
        ['Nomor SK Kemenkumham', show(form.ministryDecreeNumber)],
        ['Termin pembelian', term(form.isSupplier ? form.purchaseTermDays : undefined)],
        [
          'Metode pembayaran pembelian',
          form.isSupplier && form.purchasePaymentMethod
            ? PARTNER_PAYMENT_METHOD_LABELS[form.purchasePaymentMethod]
            : EMPTY,
        ],
        ['Termin penjualan', term(form.isCustomer ? form.salesTermDays : undefined)],
        [
          'Metode pembayaran penjualan',
          form.isCustomer && form.salesPaymentMethod
            ? PARTNER_PAYMENT_METHOD_LABELS[form.salesPaymentMethod]
            : EMPTY,
        ],
        ['Bank', show(form.bankName)],
        ['Pemilik rekening', show(form.bankAccountName)],
        ['Nomor rekening', show(form.bankAccountNo)],
        ['SWIFT / BIC', show(form.bankSwiftCode)],
        ['Catatan', show(form.notes)],
      ],
    },
  ] as const;

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{section.title}</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditStep(section.step)}
            >
              Ubah
            </Button>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {section.rows.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-foreground-subtle">{label}</dt>
                  <dd className="text-sm break-words text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

ReviewStep.displayName = 'ReviewStep';
