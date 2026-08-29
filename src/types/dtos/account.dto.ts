export type AccountTypeDTO =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'COST_EXPENSE'
  | 'NON_OPERATING';

export type NormalBalanceDTO = 'DEBIT' | 'CREDIT';

/**
 * One node of the chart of accounts. Money is sent as a plain number: balances
 * are rupiah with two decimals, well inside the safe integer range, and the
 * client formats them with `formatCurrency()`.
 */
export interface AccountDTO {
  id: string;
  code: string;
  name: string;
  type: AccountTypeDTO;
  /** 1..5 — depth in the tree, equal to the number of significant code digits. */
  level: number;
  parent_id: string | null;
  description: string | null;
  /** Milik PT TAN Export. */
  is_tan: boolean;
  is_active: boolean;
  child_count: number;
  /** Leaf-only posting: a node accepts journal lines while it has no children. */
  is_postable: boolean;
  /** Whether this node already carries posted or draft journal lines. */
  has_mutations: boolean;
  /** Net movement posted on this node alone. Always `0` for a header. */
  own_balance: number;
  /** `own_balance` plus every descendant — what the tree shows on each row. */
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface AccountNodeDTO extends AccountDTO {
  children: AccountNodeDTO[];
}

/** The tree endpoint returns the whole chart — a COA is small and never paged. */
export interface AccountTreeDTO {
  data: AccountNodeDTO[];
  total: number;
}

