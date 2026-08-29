'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Info, User } from 'lucide-react';

import { apiErrorMessage, geographyService, partnerService } from '@/services';
import { useDebouncedValue, useFormErrors, useToast } from '@/hooks';
import {
  LOCAL_COUNTRY_ISO2,
  LOCAL_CURRENCY_CODE,
  PARTNER_ORIGIN_LABELS,
  PARTNER_TYPE_OPTIONS,
  isCompanyType,
  isOverseasOrigin,
  partnerOriginFromCountry,
} from '@/lib/partner';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import { FormModal } from '@/components/ui/FormModal';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import type { PartnerDetailVO, PartnerOrigin, PartnerType, PartnerVO } from '@/types/value-objects';
import type { PartnerPickerRole } from './PartnerPicker';

/** Reference lists are small and stable — hold them for the session. */
const LOOKUP_STALE_TIME = 30 * 60 * 1000;

const TYPE_ICONS: Record<PartnerType, typeof Building2> = {
  COMPANY: Building2,
  INDIVIDUAL: User,
};

export interface PartnerQuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which role the calling document needs — decides what gets switched on. */
  role: PartnerPickerRole;
  /** Fixed by the document being filled in; the picker only shows this one. */
  origin: PartnerOrigin;
  onCreated: (partner: PartnerDetailVO) => void;
}

/**
 * The "+" next to the partner picker. Only the identity fields the API requires
 * are asked for; NPWP, bank and terms are filled in later on the partner's own
 * page — blocking a document on data the clerk does not have in front of them is
 * how placeholder partners get invented.
 *
 * **It also adopts, not just creates.** With one table behind both roles, the
 * jeweller who already sells us scrap is *already here* when we first invoice
 * them — but the picker filtered them out, because they hold no customer role
 * yet. Without this, the clerk hits "nama sudah terdaftar", cannot see the row,
 * and files a duplicate. So the name field looks for existing partners as it is
 * typed and offers to grant the missing role instead.
 */
export function PartnerQuickAddDialog({
  open,
  onOpenChange,
  role,
  origin,
  onCreated,
}: PartnerQuickAddDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const roleLabel = role === 'supplier' ? 'Supplier' : 'Customer';
  const originText = PARTNER_ORIGIN_LABELS[origin];

  // The document fixes the origin, and the origin *is* the country — so the
  // country list is narrowed to the ones that qualify rather than validated
  // afterwards. A local document offers Indonesia alone; an export document
  // offers everywhere else.
  const isLocal = !isOverseasOrigin(origin);

  const [name, setName] = useState('');
  const [type, setType] = useState<PartnerType>('COMPANY');
  const [countryId, setCountryId] = useState('');
  const [currencyCode, setCurrencyCode] = useState(isLocal ? LOCAL_CURRENCY_CODE : '');
  const [adopt, setAdopt] = useState<PartnerVO | null>(null);

  const { errors, validate, reset: resetErrors } = useFormErrors(() => ({
    name: name.trim() ? undefined : 'Nama mitra wajib diisi',
    country: countryId ? undefined : 'Negara wajib dipilih',
    currency: currencyCode ? undefined : 'Mata uang wajib dipilih',
  }));

  const countries = useQuery({
    queryKey: ['geography', 'countries'],
    queryFn: () => geographyService.countries(),
    staleTime: LOOKUP_STALE_TIME,
  });

  const currencies = useQuery({
    queryKey: ['geography', 'currencies'],
    queryFn: () => geographyService.currencies(),
    staleTime: LOOKUP_STALE_TIME,
  });

  // Debounced so typing a name costs one lookup, not one per keystroke.
  const debouncedName = useDebouncedValue(name.trim(), 300);

  const matches = useQuery({
    queryKey: ['partners', 'quick-add-match', debouncedName],
    queryFn: () => partnerService.list({ q: debouncedName, limit: 5 }),
    enabled: open && debouncedName.length >= 3,
  });

  /**
   * An existing partner with the same name that simply lacks this role. Matched
   * case-insensitively on the exact name, not on "contains" — offering to adopt
   * a partner the clerk merely typed a prefix of would grant roles by accident.
   *
   * The origin has to match too. Adding a role is a small, reversible claim;
   * moving a partner from Lokal to Overseas is a claim about the entity itself
   * (and would re-qualify every document it can appear on), so a same-name row
   * on the other side of the border is left for someone to resolve on the
   * partner's own page rather than silently rewritten from a document form.
   */
  const adoptable = (matches.data?.items ?? []).find(
    (partner) =>
      partner.name.toLowerCase() === debouncedName.toLowerCase() &&
      partner.origin === origin &&
      !(role === 'supplier' ? partner.isSupplier : partner.isCustomer),
  );

  const createMutation = useMutation({
    mutationFn: () =>
      partnerService.create({
        name: name.trim(),
        type,
        is_supplier: role === 'supplier',
        is_customer: role === 'customer',
        country_id: countryId,
        currency_code: currencyCode,
      }),
    onSuccess: handleSaved,
    onError: (error) => toast.apiError(error, 'Gagal menambahkan mitra. Coba lagi.'),
  });

  /**
   * Adding a role re-sends the whole identity block, because that is what the
   * API validates — so the current row is read first and only the role flag is
   * changed. Nothing the partner already had is guessed at.
   */
  const adoptMutation = useMutation({
    mutationFn: async (partnerId: string) => {
      const existing = await partnerService.detail(partnerId);

      return partnerService.update(partnerId, {
        name: existing.name,
        type: existing.type,
        is_supplier: existing.isSupplier || role === 'supplier',
        is_customer: existing.isCustomer || role === 'customer',
        country_id: existing.countryId,
        currency_code: existing.currencyCode,
      });
    },
    onSuccess: (partner) => {
      toast.success(`${partner.name} kini juga berperan ${roleLabel.toLowerCase()}.`);
      finish(partner);
    },
    onError: (error) => toast.apiError(error, 'Gagal menambahkan peran mitra. Coba lagi.'),
  });

  function handleSaved(partner: PartnerDetailVO): void {
    toast.success(`Mitra ${partner.name} berhasil ditambahkan`);
    finish(partner);
  }

  function finish(partner: PartnerDetailVO): void {
    void queryClient.invalidateQueries({ queryKey: ['partners'] });
    onCreated(partner);
    reset();
    onOpenChange(false);
  }

  const countryOptions = (countries.data ?? []).filter(
    (country) => partnerOriginFromCountry(country.iso2) === origin,
  );

  // A domestic partner is Indonesian by definition — prefill it as soon as the
  // list arrives, without an effect (adjust-state-during-render).
  const [prefilled, setPrefilled] = useState(false);
  if (!prefilled && isLocal && countries.data && countryId === '') {
    const indonesia = countries.data.find((country) => country.iso2 === LOCAL_COUNTRY_ISO2);
    setPrefilled(true);
    if (indonesia) setCountryId(indonesia.id);
  }

  function reset(): void {
    setName('');
    setType('COMPANY');
    setCountryId('');
    setCurrencyCode(isLocal ? LOCAL_CURRENCY_CODE : '');
    setAdopt(null);
    resetErrors();
    setPrefilled(false);
  }

  const isSubmitting = createMutation.isPending || adoptMutation.isPending;

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();

    if (adopt) {
      adoptMutation.mutate(adopt.id);
      return;
    }

    if (!validate()) return;
    createMutation.mutate();
  }

  return (
    <FormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title={adopt ? `Tambahkan Peran ${roleLabel}` : 'Tambah Mitra'}
      description={
        adopt
          ? `${adopt.name} sudah terdaftar sebagai ${adopt.roleLabel.toLowerCase()}. Perannya ditambah, datanya tidak diubah.`
          : `Didaftarkan sebagai ${roleLabel.toLowerCase()} ${originText.toLowerCase()}. Data pajak, rekening, dan termin bisa dilengkapi belakangan di halaman mitra.`
      }
      onSubmit={handleSubmit}
      submitLabel={adopt ? `Tambahkan Peran ${roleLabel}` : 'Tambah'}
      isSubmitting={isSubmitting}
    >
      <Input
        label="Nama mitra"
        required
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setAdopt(null);
        }}
        error={errors.name}
        placeholder={isCompanyType(type) ? 'mis. PT Aneka Tambang' : 'mis. Budi Santoso'}
      />

      {adoptable && !adopt && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-accent/40 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-foreground">
              <span className="font-medium">{adoptable.name}</span> ({adoptable.code}) sudah
              terdaftar sebagai {adoptable.roleLabel.toLowerCase()}, tapi belum berperan{' '}
              {roleLabel.toLowerCase()}.
            </p>
            <Button type="button" size="sm" variant="secondary" onClick={() => setAdopt(adoptable)}>
              Pakai mitra ini
            </Button>
          </div>
        </div>
      )}

      {!adopt && (
        <>
          <div className="flex w-full flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Bentuk mitra</span>
            <Segmented
              options={PARTNER_TYPE_OPTIONS.map((option) => {
                const Icon = TYPE_ICONS[option.value];
                return { ...option, icon: <Icon className="h-4 w-4" aria-hidden="true" /> };
              })}
              value={type}
              onValueChange={setType}
              size="sm"
              aria-label="Bentuk mitra"
            />
          </div>

          <div className="flex w-full flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Negara
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </span>
            <Combobox
              options={countryOptions.map((country) => ({
                value: country.id,
                label: country.label,
              }))}
              value={countryId}
              onValueChange={setCountryId}
              loading={countries.isLoading}
              disabled={isLocal}
              placeholder="Pilih negara…"
              searchPlaceholder="Cari negara…"
              emptyText="Negara tidak ditemukan."
              aria-label="Negara mitra baru"
            />
            {countries.isError && (
              <p className="text-xs text-destructive">
                {apiErrorMessage(countries.error, 'Daftar negara gagal dimuat.')}
              </p>
            )}
            {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
          </div>

          <div className="flex w-full flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Mata uang
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </span>
            <Combobox
              options={(currencies.data ?? []).map((currency) => ({
                value: currency.code,
                label: currency.label,
              }))}
              value={currencyCode}
              onValueChange={setCurrencyCode}
              loading={currencies.isLoading}
              placeholder="Pilih mata uang…"
              searchPlaceholder="Cari mata uang…"
              emptyText="Mata uang tidak ditemukan."
              aria-label="Mata uang mitra baru"
            />
            {currencies.isError && (
              <p className="text-xs text-destructive">
                {apiErrorMessage(currencies.error, 'Daftar mata uang gagal dimuat.')}
              </p>
            )}
            {errors.currency && <p className="text-xs text-destructive">{errors.currency}</p>}
          </div>
        </>
      )}
    </FormModal>
  );
}

PartnerQuickAddDialog.displayName = 'PartnerQuickAddDialog';
