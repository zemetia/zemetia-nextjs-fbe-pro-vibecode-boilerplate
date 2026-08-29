import { captureError } from '@/lib/sentry';

/**
 * Kurs valas Bank BCA, dibaca dari halaman kurs publiknya
 * (`https://www.bca.co.id/id/informasi/kurs`).
 *
 * **Kenapa halaman, bukan API resmi.** BCA memang punya API kurs, tapi ia duduk
 * di balik portal developer-nya: butuh kontrak, `client_id`/`client_secret`, dan
 * rekening korporat yang terdaftar. Selama kredensial itu belum ada, halaman
 * publiknya adalah satu-satunya sumber BCA yang bisa dijangkau — dan halaman itu
 * dirender di server (tabelnya ada di HTML-nya, bukan diisi JavaScript), jadi
 * satu `fetch` cukup.
 *
 * **Yang dibaca cuma kolom `e-Rate` beli.** BCA menerbitkan tiga jenis kurs
 * (e-Rate, TT Counter, Bank Notes), masing-masing dengan sisi jual dan beli;
 * yang dipakai dokumen impor adalah **e-Rate beli** atas keputusan developer.
 * Ketiganya tetap diparse karena datang dari baris yang sama — memilih salah
 * satunya nanti tidak perlu menyentuh parser ini lagi.
 *
 * Sifatnya sama dengan feed kurs lain di proyek ini: **saran, bukan bukti**.
 * Angkanya boleh masuk field sebagai nilai awal, tapi yang mengikat adalah angka
 * yang tersimpan di dokumennya sendiri — tidak pernah dibaca ulang dari sini.
 *
 * Server-only: jangan pernah diimpor dari modul `'use client'`.
 */

const KURS_URL = 'https://www.bca.co.id/id/informasi/kurs';

/** Halamannya besar (~350 KB) dan lambat sesekali; jangan gantung request kita. */
const FETCH_TIMEOUT_MS = 8_000;

/**
 * BCA memperbarui e-Rate beberapa kali sehari, jadi cache semenit-dua tidak
 * kehilangan apa pun sementara halaman form yang dibuka bergantian tidak
 * menarik 350 KB berulang kali. Hidup di memori proses — tiap instance
 * memanaskan miliknya sendiri, dan itu cukup untuk cache tanpa peran kebenaran.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

export const BCA_RATE_SOURCE = 'BCA e-Rate (beli)';

export interface BcaRate {
  /** Kode ISO 4217 mata uang asing; lawannya selalu IDR. */
  code: string;
  /** Rupiah per satu satuan, sisi **beli** bank. */
  eRateBuy: number;
  eRateSell: number;
  ttCounterBuy: number;
  ttCounterSell: number;
  bankNotesBuy: number;
  bankNotesSell: number;
}

export interface BcaRateTable {
  rates: Map<string, BcaRate>;
  /** Kapan e-Rate-nya diterbitkan — jam yang tertulis di halaman, bukan jam kita. */
  asOf: Date;
}

let cached: { value: BcaRateTable; expiresAt: number } | null = null;

/** `"17.755,00"` → `17755`. Halamannya berformat id-ID, bukan en-US. */
function parseIdNumber(raw: string): number | undefined {
  const value = Number(raw.trim().replaceAll('.', '').replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'mei',
  'jun',
  'jul',
  'agu',
  'sep',
  'okt',
  'nov',
  'des',
];

/**
 * `"15 Agu 2026 / 04.31 WIB"` → `Date`.
 *
 * WIB adalah UTC+7 dan halamannya tidak pernah menyebut offset, jadi jamnya
 * digeser di sini — membacanya sebagai waktu lokal server akan melaporkan kurs
 * pagi ini sebagai kurs tengah malam nanti begitu aplikasinya berjalan di
 * region lain.
 */
function parseWibTimestamp(raw: string): Date | undefined {
  const match = /(\d{1,2})\s+(\w+)\s+(\d{4})\s*\/\s*(\d{1,2})[.:](\d{2})/.exec(raw);
  if (!match) return undefined;

  const [, day, monthName, year, hour, minute] = match;
  const month = MONTHS.indexOf((monthName ?? '').slice(0, 3).toLowerCase());
  if (month < 0) return undefined;

  const value = new Date(
    Date.UTC(Number(year), month, Number(day), Number(hour) - 7, Number(minute)),
  );
  return Number.isNaN(value.getTime()) ? undefined : value;
}

const ROW_PATTERN = /<tr[^>]*class="m-table-body-row"[^>]*code="([A-Z]{3})"([\s\S]*?)<\/tr>/g;

function cellRate(row: string, rateType: string): number | undefined {
  const pattern = new RegExp(`rate-type="${rateType}"[^>]*>\\s*<p>([^<]+)</p>`);
  const raw = pattern.exec(row)?.[1];
  return raw === undefined ? undefined : parseIdNumber(raw);
}

/**
 * HTML halaman kurs → tabel kursnya.
 *
 * Dipisah dari `fetch`-nya supaya bisa diuji atas HTML yang tersimpan: parser
 * atas markup pihak lain adalah bagian yang paling mungkin patah, dan yang
 * patah harus bisa dibuktikan tanpa jaringan.
 */
export function parseBcaRatePage(html: string): BcaRateTable | undefined {
  const rates = new Map<string, BcaRate>();

  for (const match of html.matchAll(ROW_PATTERN)) {
    const code = match[1];
    const row = match[2];
    if (code === undefined || row === undefined) continue;

    const eRateBuy = cellRate(row, 'eRate-buy');
    const eRateSell = cellRate(row, 'eRate-sell');
    const ttCounterBuy = cellRate(row, 'TTCounter-buy');
    const ttCounterSell = cellRate(row, 'TTCounter-sell');
    const bankNotesBuy = cellRate(row, 'BankNotes-buy');
    const bankNotesSell = cellRate(row, 'BankNotes-sell');

    // Satu baris tanpa e-Rate tidak punya angka yang kita cari; melewatinya
    // lebih benar daripada menyimpan nol yang nanti terbaca sebagai kurs.
    if (eRateBuy === undefined || eRateSell === undefined) continue;

    rates.set(code, {
      code,
      eRateBuy,
      eRateSell,
      ttCounterBuy: ttCounterBuy ?? eRateBuy,
      ttCounterSell: ttCounterSell ?? eRateSell,
      bankNotesBuy: bankNotesBuy ?? eRateBuy,
      bankNotesSell: bankNotesSell ?? eRateSell,
    });
  }

  if (rates.size === 0) return undefined;

  // Tiap jenis kurs punya jam terbitnya sendiri di kepala tabel; yang relevan
  // adalah jam e-Rate, bukan "terakhir diperbarui" yang menaungi ketiganya.
  const header = /<span>e-Rate<\/span>[\s\S]{0,300}?a-text-micro"[^>]*>([^<]+)</.exec(html)?.[1];
  const asOf = header === undefined ? undefined : parseWibTimestamp(header);

  return { rates, asOf: asOf ?? new Date() };
}

/**
 * Tabel kurs BCA hari ini, atau `undefined` bila halamannya tidak bisa dibaca.
 *
 * Sengaja **tidak melempar**: ini sumber pilihan pertama, bukan satu-satunya —
 * pemanggilnya jatuh ke feed berikutnya, dan kegagalan di sini tidak boleh
 * membuat form yang kursnya bisa diketik tangan jadi ikut gagal.
 */
export async function getBcaRates(): Promise<BcaRateTable | undefined> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const response = await fetch(KURS_URL, {
      // Tanpa User-Agent browser, halamannya dijawab dengan versi yang tidak
      // memuat tabel.
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!response.ok) {
      captureError(new Error(`BCA kurs page responded ${response.status}`), { url: KURS_URL });
      return undefined;
    }

    const table = parseBcaRatePage(await response.text());
    if (!table) {
      // Markup-nya berubah — bukan gangguan jaringan, dan yang perlu tahu adalah
      // kita, bukan penggunanya.
      captureError(new Error('BCA kurs page parsed to an empty table'), { url: KURS_URL });
      return undefined;
    }

    cached = { value: table, expiresAt: Date.now() + CACHE_TTL_MS };
    return table;
  } catch (error) {
    captureError(error, { url: KURS_URL });
    return undefined;
  }
}
