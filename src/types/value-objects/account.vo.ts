import type { AccountTypeDTO, NormalBalanceDTO } from '@/types/dtos';

export type AccountType = AccountTypeDTO;
export type NormalBalance = NormalBalanceDTO;

export interface AccountVO {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  typeLabel: string;
  normalBalance: NormalBalance;
  normalBalanceLabel: string;
  level: number;
  parentId: string | undefined;
  description: string;
  isTan: boolean;
  isActive: boolean;
  statusLabel: string;
  childCount: number;
  /** A header groups; only a leaf accepts journal lines. */
  isHeader: boolean;
  isPostable: boolean;
  hasMutations: boolean;
  balance: number;
  /** `Rp 0` — already grouped, ready to render. */
  balanceLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountNodeVO extends AccountVO {
  children: AccountNodeVO[];
}

export interface AccountTreeVO {
  /** Roots, in code order. Each node carries its own subtree. */
  items: AccountNodeVO[];
  total: number;
  isEmpty: boolean;
}

