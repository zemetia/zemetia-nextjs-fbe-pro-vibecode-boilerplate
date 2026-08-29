import type { LedgerAccount } from '@prisma/client';

import { signedBalance } from './account';
import { ACCOUNT_MAX_LEVEL } from './account-code';
import type { AccountDTO, AccountNodeDTO } from '@/types/dtos';

/**
 * Turns the flat `ledger_accounts` rows into the tree the COA page renders,
 * with each node's balance rolled up from its subtree.
 *
 * Keeping this out of the route handler means the tree endpoint and any future
 * report share one definition of "what a node's balance is".
 */

/** Net movement of one account, already netted per side by the caller's query. */
export interface AccountMovement {
  debit: number;
  credit: number;
}

export interface BuildAccountTreeInput {
  rows: LedgerAccount[];
  /** Posted movement per account id. Missing ids count as zero. */
  movements: Map<string, AccountMovement>;
  /** Account ids that carry at least one journal line, in any status. */
  withMutations: Set<string>;
}

/** One row → one node, without its children. Also used by the create endpoint. */
export function toAccountDTO(
  row: LedgerAccount,
  childCount = 0,
  movement?: AccountMovement,
  hasMutations = false,
): AccountDTO {
  const ownBalance = movement
    ? signedBalance(row.type, movement.debit, movement.credit)
    : 0;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    level: row.level,
    parent_id: row.parentId,
    description: row.description,
    is_tan: row.isTan,
    is_active: row.isActive,
    child_count: childCount,
    // Leaf-only posting, and a node at the deepest level can never grow children.
    is_postable: childCount === 0 && row.isActive,
    has_mutations: hasMutations,
    own_balance: ownBalance,
    // Replaced by the rolled-up figure while walking the tree below.
    balance: ownBalance,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/**
 * Builds the forest and returns the roots. `rows` must already be sorted by
 * `code` — that ordering is tree pre-order, so children land in code order for
 * free (see `account-code.ts`).
 *
 * Nodes whose parent is missing from `rows` are treated as roots rather than
 * dropped: a filtered query should never make accounts disappear silently.
 */
export function buildAccountTree({
  rows,
  movements,
  withMutations,
}: BuildAccountTreeInput): AccountNodeDTO[] {
  const childrenByParent = new Map<string, LedgerAccount[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const siblings = childrenByParent.get(row.parentId);
    if (siblings) siblings.push(row);
    else childrenByParent.set(row.parentId, [row]);
  }

  const known = new Set(rows.map((row) => row.id));

  function build(row: LedgerAccount, depth: number): AccountNodeDTO {
    const children = depth < ACCOUNT_MAX_LEVEL ? (childrenByParent.get(row.id) ?? []) : [];
    const node: AccountNodeDTO = {
      ...toAccountDTO(row, children.length, movements.get(row.id), withMutations.has(row.id)),
      children: children.map((child) => build(child, depth + 1)),
    };

    node.balance = node.children.reduce((total, child) => total + child.balance, node.own_balance);

    return node;
  }

  return rows
    .filter((row) => !row.parentId || !known.has(row.parentId))
    .map((row) => build(row, 1));
}

export function countAccountNodes(nodes: AccountNodeDTO[]): number {
  return nodes.reduce((total, node) => total + 1 + countAccountNodes(node.children), 0);
}

/**
 * Keeps a node when it matches, or when any of its descendants does — a search
 * for "BCA" must still show the Aset → Aset Lancar → Bank path that leads to
 * it, otherwise the result is a set of orphan rows with no context.
 */
export function filterAccountTree(
  nodes: AccountNodeDTO[],
  matches: (node: AccountNodeDTO) => boolean,
): AccountNodeDTO[] {
  return nodes.flatMap((node) => {
    const children = filterAccountTree(node.children, matches);
    if (children.length === 0 && !matches(node)) return [];
    return [{ ...node, children }];
  });
}
