'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Send } from 'lucide-react';

import { partnerService } from '@/services';
import { useToast } from '@/hooks';
import { formatNumber } from '@/lib/number';
import { PARTNER_VERIFICATION_VALID_YEARS } from '@/lib/partner-verification';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormModal } from '@/components/ui/FormModal';
import { Textarea } from '@/components/ui/textarea';
import type { PartnerDetailVO } from '@/types/value-objects';
import { PartnerVerificationBadge } from '../../_components/PartnerVerificationBadge';

const EMPTY = '—';

export interface PartnerVerificationCardProps {
  partner: PartnerDetailVO;
  /** Petunjuk UI saja — kedua endpoint tetap memeriksa izinnya sendiri. */
  canRequest: boolean;
  canReview: boolean;
}

/**
 * Verifikasi KYP di halaman mitra: status sekarang, apa yang masih kurang, dan
 * tombol yang sesuai peran pembacanya.
 *
 * Yang sengaja dilakukan di sini: **menyebut alasannya**. Tombol "Ajukan
 * Verifikasi" yang mati tanpa penjelasan hanya akan jadi tiket ke admin, jadi
 * daftar data yang belum terisi ditampilkan apa adanya — dan daftarnya datang
 * dari server, aturan yang sama persis dengan yang akan menolak pengajuannya.
 */
export function PartnerVerificationCard({
  partner,
  canRequest,
  canReview,
}: PartnerVerificationCardProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState('');
  const [rejectError, setRejectError] = useState<string | undefined>(undefined);

  const { verification } = partner;
  const isPending = verification.status === 'PENDING';

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['partners'] });
  };

  const requestMutation = useMutation({
    mutationFn: () => partnerService.requestVerification(partner.id),
    onSuccess: () => {
      refresh();
      toast.success(`Verifikasi ${partner.name} diajukan dan menunggu peninjauan.`);
    },
    onError: (error) => toast.apiError(error, 'Pengajuan verifikasi gagal dikirim.'),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ decision, reason }: { decision: 'APPROVE' | 'REJECT'; reason?: string }) =>
      partnerService.reviewVerification(partner.id, decision, reason),
    onSuccess: (updated) => {
      refresh();
      setApproveOpen(false);
      setRejectOpen(false);
      setNote('');
      toast.success(
        updated.verification.isVerified
          ? `${updated.name} terverifikasi sampai ${updated.verification.verifiedUntilLabel}.`
          : `Pengajuan verifikasi ${updated.name} ditolak.`,
      );
    },
    onError: (error) => toast.apiError(error, 'Keputusan verifikasi gagal disimpan.'),
  });

  const handleReject = (event: FormEvent) => {
    event.preventDefault();

    // Alasan wajib: mitra yang ditolak tanpa keterangan akan mengajukan hal yang
    // persis sama minggu depan.
    if (!note.trim()) {
      setRejectError('Alasan penolakan wajib diisi.');
      return;
    }

    setRejectError(undefined);
    reviewMutation.mutate({ decision: 'REJECT', reason: note.trim() });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Verifikasi (KYP)</CardTitle>
          <PartnerVerificationBadge state={verification.state} />
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-foreground-muted">{statusSentence(partner)}</p>

          {verification.note !== EMPTY && (
            <div className="rounded-lg border border-border bg-surface-raised p-3">
              <p className="text-xs text-foreground-subtle">Catatan peninjau</p>
              <p className="mt-1 text-sm text-foreground">{verification.note}</p>
            </div>
          )}

          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Row label="Diajukan oleh" value={verification.requestedByLabel} />
            <Row label="Tanggal pengajuan" value={verification.requestedAtLabel} />
            <Row label="Ditinjau oleh" value={verification.reviewedByLabel} />
            <Row label="Tanggal peninjauan" value={verification.reviewedAtLabel} />
            <Row label="Terverifikasi sejak" value={verification.verifiedAtLabel} />
            <Row label="Berlaku sampai" value={verification.verifiedUntilLabel} />
          </dl>

          <div className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">Kelengkapan data KYP</span>
              <span className="text-xs text-foreground-subtle">
                {verification.kyp.progressLabel}
              </span>
            </div>

            {verification.kyp.isComplete ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-success">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                Semua data wajib sudah terisi.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-foreground-muted">
                  Lengkapi {formatNumber(verification.kyp.missing.length)} data berikut lewat
                  “Ubah Data” sebelum verifikasi bisa diajukan:
                </p>
                <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {verification.kyp.missing.map((item) => (
                    <li key={item.key} className="text-sm text-foreground">
                      <span className="text-foreground-subtle">{item.sectionLabel}:</span>{' '}
                      {item.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {(canRequest || canReview) && (
            <div className="flex flex-wrap items-center gap-2">
              {canRequest && !isPending && (
                <Button
                  onClick={() => requestMutation.mutate()}
                  disabled={!verification.canRequest || requestMutation.isPending}
                  isLoading={requestMutation.isPending}
                  leftIcon={<Send className="h-4 w-4" aria-hidden="true" />}
                >
                  Ajukan Verifikasi
                </Button>
              )}

              {canReview && isPending && (
                <>
                  <Button onClick={() => setApproveOpen(true)}>Setujui</Button>
                  <Button variant="outline" onClick={() => setRejectOpen(true)}>
                    Tolak
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        onConfirm={() => reviewMutation.mutate({ decision: 'APPROVE' })}
        isConfirming={reviewMutation.isPending}
        tone="info"
        title={`Setujui verifikasi ${partner.name}?`}
        description={`Mitra ini akan bertanda terverifikasi selama ${formatNumber(PARTNER_VERIFICATION_VALID_YEARS)} tahun. Setelah itu datanya harus diperbarui dan diajukan lagi.`}
        confirmLabel="Setujui"
      />

      <FormModal
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open);
          if (!open) {
            setNote('');
            setRejectError(undefined);
          }
        }}
        title={`Tolak verifikasi ${partner.name}?`}
        description="Alasannya tampil di halaman mitra, jadi tulis apa yang harus diperbaiki sebelum diajukan lagi."
        onSubmit={handleReject}
        submitLabel="Tolak Pengajuan"
        isSubmitting={reviewMutation.isPending}
        error={rejectError}
      >
        <div className="flex w-full flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            Alasan penolakan
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          </span>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="mis. NPWP yang dilampirkan tidak sesuai nama legal."
            rows={3}
          />
        </div>
      </FormModal>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-foreground-subtle">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

/** Satu kalimat yang menjelaskan status sekarang beserta konsekuensinya. */
function statusSentence(partner: PartnerDetailVO): string {
  const { verification } = partner;

  switch (verification.state) {
    case 'VERIFIED':
      return verification.isExpiringSoon
        ? `Terverifikasi, tapi masa berlakunya tinggal ${formatNumber(verification.daysUntilExpiry ?? 0)} hari (sampai ${verification.verifiedUntilLabel}). Perbarui datanya lalu ajukan lagi.`
        : `Terverifikasi dan berlaku sampai ${verification.verifiedUntilLabel}.`;
    case 'EXPIRED':
      return `Verifikasi kedaluwarsa sejak ${verification.verifiedUntilLabel}. Perbarui data mitra, lalu ajukan verifikasi ulang.`;
    case 'PENDING':
      return 'Pengajuan sudah masuk dan menunggu keputusan peninjau.';
    case 'REJECTED':
      return 'Pengajuan terakhir ditolak. Perbaiki datanya sesuai catatan, lalu ajukan lagi.';
    default:
      return verification.kyp.isComplete
        ? 'Data KYP sudah lengkap — mitra ini siap diajukan untuk verifikasi.'
        : 'Belum pernah diverifikasi. Lengkapi dulu data KYP di bawah ini.';
  }
}

PartnerVerificationCard.displayName = 'PartnerVerificationCard';
