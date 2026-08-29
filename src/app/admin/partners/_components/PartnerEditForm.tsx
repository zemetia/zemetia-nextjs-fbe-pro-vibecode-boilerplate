'use client';

import { useQuery } from '@tanstack/react-query';

import { apiErrorMessage, partnerService } from '@/services';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { PartnerWizard } from './PartnerWizard';

export interface PartnerEditFormProps {
  partnerId: string;
}

/**
 * Loads the partner through the domain service (not Prisma) so the edit form
 * sees exactly the shape the create form produces.
 */
export function PartnerEditForm({ partnerId }: PartnerEditFormProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['partners', 'detail', partnerId],
    queryFn: () => partnerService.detail(partnerId),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (isError || !data) {
    return (
      <ErrorState
        message={apiErrorMessage(error, 'Data partner gagal dimuat.')}
        onRetry={() => void refetch()}
      />
    );
  }

  return <PartnerWizard partner={data} />;
}

PartnerEditForm.displayName = 'PartnerEditForm';
