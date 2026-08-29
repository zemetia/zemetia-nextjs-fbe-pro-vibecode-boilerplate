'use client';

import {
  LOCAL_COUNTRY_ISO2,
  NIK_LENGTH,
  PARTNER_CONTACT_ID_TYPE_OPTIONS,
} from '@/lib/partner';
import { Combobox } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/Input';
import type { CountryVO, PartnerContactIdType } from '@/types/value-objects';
import { FormField } from '../FormField';
import type { PartnerFieldErrors, PartnerFormState } from '../form-state';

export interface ContactStepProps {
  form: PartnerFormState;
  errors: PartnerFieldErrors;
  onChange: (patch: Partial<PartnerFormState>) => void;
  countries: CountryVO[];
  isLoadingReferences: boolean;
}

/**
 * Identitas **orangnya**, bukan badannya. Kewarganegaraan kontak ditanya sendiri
 * karena ia tidak mengikuti negara mitra: perusahaan Dubai sering menaruh PIC
 * orang Indonesia, dan pabrik lokal bisa dipegang ekspatriat — yang menentukan
 * NIK atau paspor adalah orangnya.
 */
export function ContactStep({
  form,
  errors,
  onChange,
  countries,
  isLoadingReferences,
}: ContactStepProps) {
  const nationality = countries.find((country) => country.id === form.contactCountryId);
  const isIndonesian = nationality?.iso2 === LOCAL_COUNTRY_ISO2;

  // Memilih kewarganegaraan sudah menjawab jenis identitasnya untuk sebagian
  // besar kasus — tapi hanya diisikan selama pengguna belum memilih sendiri,
  // supaya WNI berpaspor tidak dipaksa balik ke NIK.
  const handleNationality = (contactCountryId: string) => {
    const country = countries.find((entry) => entry.id === contactCountryId);
    const suggested: PartnerContactIdType =
      country?.iso2 === LOCAL_COUNTRY_ISO2 ? 'NIK' : 'PASSPORT';

    onChange({
      contactCountryId,
      contactIdType: form.contactIdType ?? suggested,
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Input
        label="Nama kontak (PIC)"
        placeholder="Budi Santoso"
        value={form.contactName}
        onChange={(event) => onChange({ contactName: event.target.value })}
        error={errors.contact_name}
      />

      <Input
        label="Jabatan"
        placeholder="Sales Manager"
        value={form.contactRole}
        onChange={(event) => onChange({ contactRole: event.target.value })}
        error={errors.contact_role}
      />

      <Input
        label="Telepon kontak"
        placeholder="+62 812 3456 7890"
        value={form.contactPhone}
        onChange={(event) => onChange({ contactPhone: event.target.value })}
        error={errors.contact_phone}
      />

      <Input
        label="Email kontak"
        type="email"
        placeholder="budi@partner.com"
        value={form.contactEmail}
        onChange={(event) => onChange({ contactEmail: event.target.value })}
        error={errors.contact_email}
      />

      <FormField
        label="Kewarganegaraan kontak"
        error={errors.contact_country_id}
        hint="Bisa berbeda dari negara mitranya — perusahaan luar negeri sering diwakili orang Indonesia."
      >
        <Combobox
          options={countries.map((country) => ({ value: country.id, label: country.label }))}
          value={form.contactCountryId || null}
          onValueChange={handleNationality}
          loading={isLoadingReferences}
          placeholder="Pilih kewarganegaraan…"
          searchPlaceholder="Cari negara…"
          emptyText="Negara tidak ditemukan."
          aria-label="Kewarganegaraan kontak"
        />
      </FormField>

      <FormField label="Jenis identitas" error={errors.contact_id_type}>
        <Combobox
          options={PARTNER_CONTACT_ID_TYPE_OPTIONS}
          value={form.contactIdType ?? null}
          onValueChange={(value) => onChange({ contactIdType: value as PartnerContactIdType })}
          placeholder="Pilih jenis identitas…"
          searchPlaceholder="Cari jenis identitas…"
          emptyText="Jenis identitas tidak ditemukan."
          aria-label="Jenis identitas kontak"
        />
      </FormField>

      <Input
        label={form.contactIdType === 'NIK' ? 'Nomor NIK' : 'Nomor identitas'}
        placeholder={form.contactIdType === 'NIK' ? '3175xxxxxxxxxxxx' : 'X1234567'}
        value={form.contactIdNumber}
        onChange={(event) => onChange({ contactIdNumber: event.target.value })}
        error={errors.contact_id_number}
        hint={
          isIndonesian
            ? `NIK KTP berisi ${NIK_LENGTH} digit angka.`
            : 'Nomor paspor atau identitas resmi lain yang dipakai kontak ini.'
        }
        className="md:col-span-2"
      />
    </div>
  );
}

ContactStep.displayName = 'ContactStep';
