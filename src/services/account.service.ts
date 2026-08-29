import { apiClient } from './client';
import { buildListQuery } from './pagination';
import {
  ACCOUNT_TYPE_LABELS,
  NORMAL_BALANCE_LABELS,
  normalBalanceForType,
} from '@/lib/account';
import { formatCurrency } from '@/lib/number';
import type { AccountDTO, AccountNodeDTO, AccountTreeDTO } from '@/types/dtos';
import type { AccountNodeVO, AccountTreeVO, AccountType, AccountVO } from '@/types/value-objects';

function toVO(dto: AccountDTO): AccountVO {
  const normalBalance = normalBalanceForType(dto.type);

  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    type: dto.type,
    typeLabel: ACCOUNT_TYPE_LABELS[dto.type],
    normalBalance,
    normalBalanceLabel: NORMAL_BALANCE_LABELS[normalBalance],
    level: dto.level,
    parentId: dto.parent_id ?? undefined,
    description: dto.description ?? '',
    isTan: dto.is_tan,
    isActive: dto.is_active,
    statusLabel: dto.is_active ? 'Aktif' : 'Nonaktif',
    childCount: dto.child_count,
    isHeader: dto.child_count > 0,
    isPostable: dto.is_postable,
    hasMutations: dto.has_mutations,
    balance: dto.balance,
    balanceLabel: formatCurrency(dto.balance),
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function toNodeVO(dto: AccountNodeDTO): AccountNodeVO {
  return { ...toVO(dto), children: dto.children.map(toNodeVO) };
}

/**
 * Depth-first flattening, in code order — what the table renders and what the
 * parent picker lists. Indentation comes from `level`, so the caller never has
 * to track depth itself.
 */
export function flattenAccounts(nodes: readonly AccountNodeVO[]): AccountNodeVO[] {
  return nodes.flatMap((node) => [node, ...flattenAccounts(node.children)]);
}

export type AccountTreeParams = {
  q?: string;
  type?: AccountType;
  is_active?: boolean;
  is_tan?: boolean;
};

export interface AccountCreatePayload {
  parent_id: string;
  /** Which of the nine slots under the parent to take. Omitted = lowest free. */
  ordinal?: number;
  name: string;
  description?: string;
  is_tan?: boolean;
}

export interface AccountUpdatePayload {
  name?: string;
  description?: string;
  is_tan?: boolean;
}

export const accountService = {
  tree: async (params?: AccountTreeParams): Promise<AccountTreeVO> => {
    const dto = await apiClient.get<AccountTreeDTO>(`/api/accounts${buildListQuery(params)}`, {
      cache: 'no-store',
    });

    return {
      items: dto.data.map(toNodeVO),
      total: dto.total,
      isEmpty: dto.total === 0,
    };
  },

  create: async (payload: AccountCreatePayload): Promise<AccountVO> =>
    toVO(await apiClient.post<AccountDTO>('/api/accounts', payload)),

  update: async (id: string, payload: AccountUpdatePayload): Promise<AccountVO> =>
    toVO(await apiClient.patch<AccountDTO>(`/api/accounts/${id}`, payload)),

  setActive: async (id: string, isActive: boolean): Promise<AccountVO> =>
    toVO(
      await apiClient.patch<AccountDTO>(`/api/accounts/${id}/status`, { is_active: isActive }),
    ),

  remove: async (id: string): Promise<void> => {
    await apiClient.delete<void>(`/api/accounts/${id}`);
  },
};
