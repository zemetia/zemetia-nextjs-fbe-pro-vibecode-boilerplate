import { normalBalanceForType, signedBalance } from '@/lib/account';
import { roundTo } from '@/lib/number';
import type { AccountType, NormalBalance } from '@/types/value-objects';

/**
 * Aritmetika buku besar — murni, tanpa I/O, jadi yang menentukan sebuah saldo
 * bisa dibuktikan benar tanpa database.
 *
 * Dua kekeliruan laporan lama diperbaiki tepat di sini, dan keduanya diam:
 *
 * 1. **Urutan.** Saldo berjalan lama diakumulasi atas jurnal apa adanya, yang
 *    tersimpan terbaru-di-depan — jadi saldonya berjalan mundur dari transaksi
 *    terakhir ke transaksi pertama. Di sini urutannya kewajiban pemanggil dan
 *    dinyatakan eksplisit: menaik menurut tanggal, lalu nomor, lalu baris.
 * 2. **Sisi normal.** Saldo lama selalu `debit - credit`, sehingga kewajiban,
 *    ekuitas, dan pendapatan tampil negatif sepanjang tahun. `signedBalance()`
 *    membalik arahnya untuk akun bersaldo normal kredit, jadi angka positif
 *    selalu berarti "akun ini berperilaku sebagaimana mestinya".
 *
 * Semua nilai dibulatkan ke dua desimal di setiap langkah, bukan hanya di
 * akhir: `Decimal(18,2)` di database tidak pernah menyimpan pecahan yang lebih
 * halus, dan sisa penjumlahan float yang dibiarkan menumpuk akan muncul sebagai
 * neraca saldo yang selisih satu sen tanpa sebab yang bisa ditunjuk.
 */

export const LEDGER_MONEY_SCALE = 2;

export function money(value: number): number {
  return roundTo(value, LEDGER_MONEY_SCALE);
}

export interface Movement {
  debit: number;
  credit: number;
}

export const NO_MOVEMENT: Movement = { debit: 0, credit: 0 };

export function addMovement(a: Movement, b: Movement): Movement {
  return { debit: money(a.debit + b.debit), credit: money(a.credit + b.credit) };
}

/** Mutasi → saldo bertanda, positif saat akun ada di sisi normalnya. */
export function movementBalance(type: AccountType, movement: Movement): number {
  return money(signedBalance(type, movement.debit, movement.credit));
}

/**
 * Saldo bertanda → dua kolom neraca saldo.
 *
 * Neraca saldo tidak punya kolom "saldo": ia punya kolom debit dan kolom kredit,
 * dan sebuah akun berdiri di salah satunya. Akun bersaldo normal debit yang
 * saldonya positif berdiri di debit; yang negatif — kas yang menurut buku minus,
 * misalnya — berdiri di kredit, dan justru itu yang membuatnya terlihat.
 */
export interface SideAmounts {
  debit: number;
  credit: number;
}

export function toSides(balance: number, normalBalance: NormalBalance): SideAmounts {
  const onNormalSide = balance >= 0;
  const amount = money(Math.abs(balance));

  if (normalBalance === 'DEBIT') {
    return onNormalSide ? { debit: amount, credit: 0 } : { debit: 0, credit: amount };
  }

  return onNormalSide ? { debit: 0, credit: amount } : { debit: amount, credit: 0 };
}

export function sidesForType(balance: number, type: AccountType): SideAmounts {
  return toSides(balance, normalBalanceForType(type));
}

export function addSides(a: SideAmounts, b: SideAmounts): SideAmounts {
  return { debit: money(a.debit + b.debit), credit: money(a.credit + b.credit) };
}

export const NO_SIDES: SideAmounts = { debit: 0, credit: 0 };

/**
 * Saldo berjalan sebuah akun, satu nilai per baris, dalam urutan yang diberikan
 * pemanggil.
 *
 * Saldo awal ikut sebagai parameter dan bukan dihitung di sini, karena ia datang
 * dari periode **sebelum** baris-baris ini — laporan yang memulai dari nol tiap
 * kali periodenya digeser adalah laporan yang bilang saldo kas berubah karena
 * filternya berubah.
 */
export function runningBalances(
  type: AccountType,
  opening: number,
  rows: readonly Movement[],
): number[] {
  let balance = money(opening);

  return rows.map((row) => {
    balance = money(balance + signedBalance(type, row.debit, row.credit));
    return balance;
  });
}

/**
 * Neraca saldo seimbang saat Σ debit = Σ kredit. Dibandingkan setelah dibulatkan
 * ke sen — selisih yang lebih halus dari itu tidak pernah benar-benar tersimpan.
 */
export function isBalanced(sides: SideAmounts): boolean {
  return money(sides.debit) === money(sides.credit);
}
