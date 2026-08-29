'use client';

import { cn } from '@/lib/cn';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { PartnerDetailVO } from '@/types/value-objects';

/** The service already turned every empty optional field into this. */
const EMPTY = '—';

interface Row {
  label: string;
  value: string;
  /** Rendered as a link when the value is actually there. */
  href?: string;
  /** Codes and account numbers read better monospaced. */
  mono?: boolean;
}

interface Section {
  title: string;
  rows: Row[];
}

export interface PartnerProfileProps {
  partner: PartnerDetailVO;
}

function link(value: string, build: (value: string) => string): string | undefined {
  return value === EMPTY ? undefined : build(value);
}

/**
 * The stored profile, grouped the same way the wizard captures it — a clerk who
 * filled step 2 finds the same fields under the same heading here.
 */
export function PartnerProfile({ partner }: PartnerProfileProps) {
  const sections: Section[] = [
    {
      title: 'Identitas',
      rows: [
        { label: 'Kode mitra', value: partner.code, mono: true },
        { label: 'Bentuk', value: partner.typeLabel },
        { label: 'Nama legal', value: partner.legalName },
        { label: 'Peran', value: partner.roleLabel },
        { label: 'Asal', value: partner.originLabel },
        { label: 'Negara', value: `${partner.countryName} (${partner.countryIso2})` },
        {
          label: 'Mata uang',
          value: `${partner.currencyCode} · ${partner.currencySymbol}`,
        },
        {
          label: 'Email operasional',
          value: partner.email,
          href: link(partner.email, (value) => `mailto:${value}`),
        },
        {
          label: 'Telepon',
          value: partner.phone,
          href: link(partner.phone, (value) => `tel:${value}`),
        },
        { label: 'Website', value: partner.website, href: link(partner.website, (value) => value) },
        // Alamatnya milik badan usahanya, jadi ia dibaca di blok yang sama dengan
        // identitasnya — bukan di bawah nama orang yang kebetulan jadi PIC.
        { label: 'Alamat', value: partner.addressLine },
        { label: 'Kota', value: partner.city },
        { label: 'Provinsi', value: partner.province },
        { label: 'Kode pos', value: partner.postalCode },
        { label: 'Terdaftar', value: partner.createdAtLabel },
        { label: 'Terakhir diubah', value: partner.updatedAtLabel },
      ],
    },
    {
      title: 'Kontak Person',
      rows: [
        { label: 'Nama kontak', value: partner.contactName },
        { label: 'Jabatan', value: partner.contactRole },
        {
          label: 'Telepon kontak',
          value: partner.contactPhone,
          href: link(partner.contactPhone, (value) => `tel:${value}`),
        },
        {
          label: 'Email kontak',
          value: partner.contactEmail,
          href: link(partner.contactEmail, (value) => `mailto:${value}`),
        },
        { label: 'Kewarganegaraan', value: partner.contactCountryName },
        { label: 'Jenis identitas', value: partner.contactIdTypeLabel },
        { label: 'Nomor identitas', value: partner.contactIdNumber, mono: true },
      ],
    },
    {
      title: 'Pajak & Legal',
      rows: [
        { label: 'NPWP / Tax ID', value: partner.taxNumber, mono: true },
        partner.isOverseas
          ? {
              label: 'Nomor registrasi perusahaan',
              value: partner.foreignRegistrationNumber,
              mono: true,
            }
          : { label: 'NIB', value: partner.nib, mono: true },
        { label: 'Status PKP', value: partner.pkpLabel },
        ...(partner.isPkp
          ? [{ label: 'Nomor SPPKP', value: partner.sppkpNumber, mono: true }]
          : []),
        { label: 'Nomor akta pendirian', value: partner.deedNumber, mono: true },
        { label: 'Tanggal akta pendirian', value: partner.deedDateLabel },
        { label: 'SK Kemenkumham', value: partner.ministryDecreeNumber, mono: true },
      ],
    },
    {
      title: 'Termin & Bank',
      rows: [
        ...(partner.isSupplier
          ? [
              { label: 'Termin pembelian', value: partner.purchaseTermLabel },
              { label: 'Metode pembayaran ke mereka', value: partner.purchasePaymentMethodLabel },
            ]
          : []),
        ...(partner.isCustomer
          ? [
              { label: 'Termin penjualan', value: partner.salesTermLabel },
              { label: 'Metode pembayaran dari mereka', value: partner.salesPaymentMethodLabel },
            ]
          : []),
        { label: 'Bank', value: partner.bankName },
        { label: 'Pemilik rekening', value: partner.bankAccountName },
        { label: 'Nomor rekening', value: partner.bankAccountNo, mono: true },
        { label: 'SWIFT / BIC', value: partner.bankSwiftCode, mono: true },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {section.rows.map((row) => (
                  <div key={row.label} className="flex flex-col gap-0.5">
                    <dt className="text-xs text-foreground-subtle">{row.label}</dt>
                    <dd className={cn('text-sm break-words text-foreground', row.mono && 'font-mono')}>
                      {row.href ? (
                        <a
                          href={row.href}
                          className="text-primary transition-colors hover:text-primary-hover"
                          {...(row.href.startsWith('http')
                            ? { target: '_blank', rel: 'noreferrer noopener' }
                            : {})}
                        >
                          {row.value}
                        </a>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      {partner.notes !== EMPTY && (
        <Card>
          <CardHeader>
            <CardTitle>Catatan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line text-foreground-muted">{partner.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

PartnerProfile.displayName = 'PartnerProfile';
