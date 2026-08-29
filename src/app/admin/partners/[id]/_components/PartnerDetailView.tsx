'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Pencil } from 'lucide-react';

import { apiErrorMessage, partnerService } from '@/services';
import type { PermissionKey } from '@/lib/permissions';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { Typography } from '@/components/ui/Typography';
import { PartnerRowMenu } from '../../_components/PartnerRowMenu';
import { PartnerVerificationBadge } from '../../_components/PartnerVerificationBadge';
import { PartnerProfile } from './PartnerProfile';
import { PartnerVerificationCard } from './PartnerVerificationCard';

export interface PartnerDetailViewProps {
  partnerId: string;
}

export function PartnerDetailView({ partnerId }: PartnerDetailViewProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const permissions = new Set(session?.user.permissions ?? []);
  const can = (key: PermissionKey) => permissions.has(key);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['partners', 'detail', partnerId],
    queryFn: () => partnerService.detail(partnerId),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="Partner tidak bisa ditampilkan"
        message={apiErrorMessage(error, 'Data mitra ini tidak ditemukan atau gagal dimuat.')}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/partners"
        className="inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Kembali ke daftar mitra
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <Typography variant="h2">{data.name}</Typography>
            <PartnerVerificationBadge state={data.verificationState} />
            <Badge variant={data.isActive ? 'success' : 'secondary'} dot>
              {data.statusLabel}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground-muted">
            <span className="font-mono text-foreground-subtle">{data.code}</span>
            <span aria-hidden="true">·</span>
            <span>{data.typeLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{data.roleLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{data.countryName}</span>
            <span aria-hidden="true">·</span>
            <span>{data.currencyCode}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {can('partners:update') && (
            <Button
              variant="outline"
              onClick={() => router.push(`/admin/partners/${data.id}/edit`)}
              leftIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}
            >
              Ubah Data
            </Button>
          )}
          <PartnerRowMenu
            partner={data}
            canUpdate={can('partners:update')}
            canSetStatus={can('partners:set-status')}
          />
        </div>
      </div>

      <PartnerVerificationCard
        partner={data}
        canRequest={can('partners:request-verification')}
        canReview={can('partners:review-verification')}
      />

      <PartnerProfile partner={data} />
    </div>
  );
}

PartnerDetailView.displayName = 'PartnerDetailView';
