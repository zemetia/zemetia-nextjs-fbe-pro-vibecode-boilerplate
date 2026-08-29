'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ZodType } from 'zod';

import { apiErrorMessage, geographyService, partnerService } from '@/services';
import { useFormErrors, useToast, zodFieldErrors } from '@/hooks';
import { isOverseasOrigin, partnerOriginFromCountry } from '@/lib/partner';
import {
  partnerContactStepSchema,
  partnerFinanceStepSchema,
  partnerIdentityStepSchema,
} from '@/lib/validations';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Wizard, type WizardStep } from '@/components/ui/Wizard';
import type { PartnerDetailVO } from '@/types/value-objects';
import { ContactStep } from './steps/ContactStep';
import { FinanceStep } from './steps/FinanceStep';
import { IdentityStep } from './steps/IdentityStep';
import { ReviewStep } from './steps/ReviewStep';
import {
  contactInput,
  EMPTY_PARTNER_FORM,
  financeInput,
  identityInput,
  toFormState,
  toPayload,
  type PartnerFieldErrors,
  type PartnerFormState,
} from './form-state';

const STEPS: WizardStep[] = [
  {
    id: 'identity',
    title: 'Identitas & Alamat',
    description: 'Data dasar dan alamat perusahaan — keduanya milik badan usahanya.',
  },
  {
    id: 'contact',
    title: 'Kontak Person',
    description: 'Siapa orangnya dan identitas resminya. Opsional, tapi wajib untuk verifikasi.',
  },
  {
    id: 'finance',
    title: 'Pajak, Legal, Termin & Bank',
    description: 'Semua opsional — biasanya baru terisi setelah kesepakatan dagang.',
  },
  { id: 'review', title: 'Tinjau', description: 'Periksa sekali lagi sebelum disimpan.' },
];

/** Each step validates with the same rules the API re-applies on submit. */
const STEP_SCHEMAS: Record<number, { schema: ZodType; input: (form: PartnerFormState) => unknown }> =
  {
    0: { schema: partnerIdentityStepSchema, input: identityInput },
    1: { schema: partnerContactStepSchema, input: contactInput },
    2: { schema: partnerFinanceStepSchema, input: financeInput },
  };

/**
 * One step's failures, keyed by API field name — which is what the steps read.
 *
 * The "at least one role" rule is the one issue that belongs to no field — it is
 * raised without a path and lands under `role`, which the identity step renders
 * beneath the two role cards. Dropping pathless issues would have made that rule
 * fail the step with nothing on screen to explain it.
 */
function stepErrors(step: number, form: PartnerFormState): PartnerFieldErrors {
  const entry = STEP_SCHEMAS[step];
  if (!entry) return {};
  return zodFieldErrors(entry.schema, entry.input(form), 'role');
}

export interface PartnerWizardProps {
  /** Present in edit mode; absent when registering a new partner. */
  partner?: PartnerDetailVO;
}

export function PartnerWizard({ partner }: PartnerWizardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const isEdit = partner !== undefined;

  const [form, setForm] = useState<PartnerFormState>(() =>
    partner ? toFormState(partner) : EMPTY_PARTNER_FORM,
  );
  const [dirty, setDirty] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  // An existing partner has already cleared every step, so all of them stay
  // reachable; a new one unlocks them one at a time.
  const [reachedStep, setReachedStep] = useState(isEdit ? STEPS.length - 1 : 0);

  const stepParam = Number(searchParams.get('step') ?? '1');
  const activeStep = Number.isFinite(stepParam)
    ? Math.min(Math.max(stepParam - 1, 0), STEPS.length - 1)
    : 0;

  // Only the step on screen is checked live — a field two steps ahead has not
  // been asked for yet, so it has nothing to complain about.
  const { errors, validate, report } = useFormErrors(() => stepErrors(activeStep, form));

  const references = useQuery({
    queryKey: ['geography', 'references'],
    // Two static reference lists — fetched once per session, then filtered
    // client-side by the comboboxes.
    queryFn: async () => {
      const [countries, currencies] = await Promise.all([
        geographyService.countries(),
        geographyService.currencies(),
      ]);
      return { countries, currencies };
    },
    staleTime: 60 * 60 * 1000,
  });

  const countries = references.data?.countries ?? [];
  const currencies = references.data?.currencies ?? [];

  // The country *is* the origin — nothing is asked twice, and the SWIFT hint on
  // the finance step follows whatever country is selected. Until one is picked
  // the partner reads as domestic, which is what the vast majority are.
  const selectedCountry = countries.find((country) => country.id === form.countryId);
  const isOverseas =
    selectedCountry !== undefined && isOverseasOrigin(partnerOriginFromCountry(selectedCountry.iso2));

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? partnerService.update(partner.id, toPayload(form))
        : partnerService.create(toPayload(form)),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast.success(
        isEdit
          ? `Perubahan ${saved.name} tersimpan.`
          : `${saved.name} terdaftar dengan kode ${saved.code}.`,
      );
      router.push('/admin/partners');
    },
    onError: (error) =>
      toast.apiError(error, 'Data mitra gagal disimpan. Coba lagi sebentar lagi.'),
  });

  const goToStep = (index: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('step', String(index + 1));
    // Typed routes can't express "current path + query" — the path itself comes
    // from `usePathname()`, so it is already a real route.
    router.replace(`${pathname}?${params.toString()}` as Route, { scroll: false });
  };

  const handleChange = (patch: Partial<PartnerFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    setDirty(true);
  };

  const handleNext = () => {
    if (!validate()) return;
    const next = activeStep + 1;
    setReachedStep((highest) => Math.max(highest, next));
    goToStep(next);
  };

  const handleSubmit = () => {
    // The review step has no fields of its own, so a failure here belongs to an
    // earlier step: name that step's fields, then send the user to them.
    const invalid = [0, 1, 2].find((step) => Object.keys(stepErrors(step, form)).length > 0);
    if (invalid !== undefined) {
      report(stepErrors(invalid, form));
      goToStep(invalid);
      return;
    }
    mutation.mutate();
  };

  const leave = () => router.push('/admin/partners');

  const handleCancel = () => {
    if (dirty) {
      setCancelOpen(true);
      return;
    }
    leave();
  };

  if (references.isError) {
    return (
      <ErrorState
        message={apiErrorMessage(references.error, 'Daftar negara dan mata uang gagal dimuat.')}
        onRetry={() => void references.refetch()}
      />
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Wizard
            steps={STEPS}
            activeStep={activeStep}
            reachedStep={reachedStep}
            onStepSelect={goToStep}
            onBack={() => goToStep(activeStep - 1)}
            onNext={handleNext}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={mutation.isPending}
            // Country and currency are required and come from the reference
            // lists, so advancing before they arrive would fail fields the user
            // has no way to fill in yet.
            nextDisabled={activeStep === 0 && references.isLoading}
            submitLabel={isEdit ? 'Simpan Perubahan' : 'Simpan Mitra'}
          >
            {activeStep === 0 && (
              <IdentityStep
                form={form}
                errors={errors}
                onChange={handleChange}
                countries={countries}
                currencies={currencies}
                isLoadingReferences={references.isLoading}
              />
            )}
            {activeStep === 1 && (
              <ContactStep
                form={form}
                errors={errors}
                onChange={handleChange}
                countries={countries}
                isLoadingReferences={references.isLoading}
              />
            )}
            {activeStep === 2 && (
              <FinanceStep
                form={form}
                errors={errors}
                onChange={handleChange}
                isOverseas={isOverseas}
              />
            )}
            {activeStep === 3 && (
              <ReviewStep
                form={form}
                countries={countries}
                currencies={currencies}
                onEditStep={goToStep}
              />
            )}
          </Wizard>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirm={leave}
        tone="warning"
        title="Tinggalkan formulir ini?"
        description="Data yang sudah diisi akan hilang karena belum disimpan."
        confirmLabel="Tinggalkan"
        cancelLabel="Lanjut mengisi"
      />
    </>
  );
}

PartnerWizard.displayName = 'PartnerWizard';
