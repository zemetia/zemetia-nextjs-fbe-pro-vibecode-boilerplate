'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { journalEntryService } from '@/services';
import { useFormErrors, useToast } from '@/hooks';
import { today } from '@/lib/date';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { FormActionBar } from '@/components/ui/FormActionBar';
import { Input } from '@/components/ui/Input';
import { Typography } from '@/components/ui/Typography';
import { JournalLinesEditor } from './JournalLinesEditor';
import { emptyForm, fieldErrors, toPayload, type JournalFormState } from './form-state';

const LIST_PATH = '/admin/accounting/journals';

export interface JournalFormProps {
  /** Kosong saat membuat; terisi saat mengubah draft. */
  entryId?: string;
  initialForm?: JournalFormState;
}

/**
 * Satu form di balik `/new` dan `/[id]/edit`.
 *
 * Yang sengaja **tidak** ada di layar ini: tombol "simpan lalu posting". Menyimpan
 * dan memposting adalah dua keputusan — yang pertama "ini yang saya maksud", yang
 * kedua "ini boleh dihitung neraca" — dan menyatukannya menghapus satu-satunya
 * kesempatan membaca ulang sebelum angkanya ikut ke laporan. Posting dilakukan
 * dari halaman detail, setelah jurnalnya terbaca utuh.
 *
 * Nomor jurnal juga tidak ditampilkan sebagai pratinjau. Berbeda dari voucher —
 * yang nomornya ditulis petugas di kertas sebelum menyimpan — nomor jurnal tidak
 * pernah dipakai di luar sistem, jadi menjanjikannya sebelum tersimpan hanya
 * menambah satu janji yang bisa meleset.
 */
export function JournalForm({ entryId, initialForm }: JournalFormProps) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<JournalFormState>(initialForm ?? emptyForm());
  const { errors, validate } = useFormErrors(() => fieldErrors(form));

  const isEdit = entryId !== undefined;

  function patch(changes: Partial<JournalFormState>): void {
    setForm((current) => ({ ...current, ...changes }));
  }

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? journalEntryService.update(entryId, toPayload(form))
        : journalEntryService.create(toPayload(form)),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast.success(
        isEdit
          ? `Jurnal ${entry.number} berhasil disimpan`
          : `Jurnal ${entry.number} tersimpan sebagai draft — belum masuk buku besar`,
      );
      router.push(`${LIST_PATH}/${entry.id}`);
    },
    onError: (error) => {
      toast.apiError(error, 'Gagal menyimpan jurnal. Coba lagi.');
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
        <CardHeader>
          <CardTitle>Kepala Jurnal</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
          <DatePicker
            label="Tanggal jurnal"
            required
            value={form.date}
            onChange={(date) => patch({ date })}
            error={errors.date}
            maxDate={today()}
            disabled={mutation.isPending}
          />

          <Input
            label="Keterangan"
            required
            placeholder="mis. Koreksi biaya angkut nota SJ-2026-0142"
            value={form.description}
            onChange={(event) => patch({ description: event.target.value })}
            error={errors.description}
            hint="Sebutkan nomor dokumen sumbernya — ini satu-satunya jejak ke kertas di luar sistem."
            disabled={mutation.isPending}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Baris Jurnal</CardTitle>
        </CardHeader>
        <CardContent>
          <JournalLinesEditor
            lines={form.lines}
            onChange={(lines) => patch({ lines })}
            error={errors.lines}
            disabled={mutation.isPending}
          />
        </CardContent>
      </Card>

      <FormActionBar
        onCancel={() => router.push(LIST_PATH)}
        submitLabel={isEdit ? 'Simpan Perubahan' : 'Simpan Draft'}
        isSubmitting={mutation.isPending}
      >
        <Typography variant="muted">
          Tersimpan sebagai draft. Postingnya dilakukan terpisah, setelah jurnalnya dibaca ulang.
        </Typography>
      </FormActionBar>
    </form>
  );
}

JournalForm.displayName = 'JournalForm';
