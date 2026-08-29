import { describe, expect, it } from 'vitest';

import { parseBcaRatePage } from './bca-rate';

/**
 * Cuplikan markup halaman kurs BCA apa adanya (15 Agustus 2026), dipangkas ke
 * dua baris. Parser atas markup pihak lain adalah bagian yang paling mungkin
 * patah tanpa suara, dan yang patah harus bisa dibuktikan tanpa jaringan —
 * kalau BCA mengubah kelas atau atributnya, tes inilah yang gagal lebih dulu,
 * bukan form pembelian di tangan petugas.
 */
const PAGE = `
<div class="a-kurs-table">
  <table class="m-table-kurs">
    <thead class="m-table-header">
      <tr class="m-table-header-row">
        <th class="header-column" colspan="2">
          <p class="a-header-rate">
            <span>e-Rate</span>
            <br />
            <span class="a-text-micro">15 Agu 2026 / 04.31 WIB</span>
          </p>
        </th>
        <th class="header-column" colspan="2">
          <p class="a-header-rate">
            <span>TT Counter</span>
            <br />
            <span class="a-text-micro">14 Agu 2026 / 15.19 WIB</span>
          </p>
        </th>
      </tr>
    </thead>
    <tbody class="m-table-body">
      <tr class="m-table-body-row" code="USD">
        <td class="first-column"><p><span>USD</span></p></td>
        <td class="rate-column" rate-type="eRate-buy"><p>17.755,00</p></td>
        <td class="rate-column" rate-type="eRate-sell"><p>17.855,00</p></td>
        <td class="rate-column" rate-type="TTCounter-buy"><p>17.660,00</p></td>
        <td class="rate-column" rate-type="TTCounter-sell"><p>17.940,00</p></td>
        <td class="rate-column" rate-type="BankNotes-buy"><p>17.660,00</p></td>
        <td class="rate-column" rate-type="BankNotes-sell"><p>17.940,00</p></td>
      </tr>
      <tr class="m-table-body-row" code="JPY">
        <td class="first-column"><p><span>JPY</span></p></td>
        <td class="rate-column" rate-type="eRate-buy"><p>110,60</p></td>
        <td class="rate-column" rate-type="eRate-sell"><p>112,91</p></td>
        <td class="rate-column" rate-type="TTCounter-buy"><p>110,34</p></td>
        <td class="rate-column" rate-type="TTCounter-sell"><p>113,25</p></td>
        <td class="rate-column" rate-type="BankNotes-buy"><p>109,77</p></td>
        <td class="rate-column" rate-type="BankNotes-sell"><p>113,53</p></td>
      </tr>
    </tbody>
  </table>
</div>
`;

describe('parseBcaRatePage', () => {
  it('membaca setiap kolom kurs satu baris', () => {
    const table = parseBcaRatePage(PAGE);

    expect(table?.rates.get('USD')).toEqual({
      code: 'USD',
      eRateBuy: 17_755,
      eRateSell: 17_855,
      ttCounterBuy: 17_660,
      ttCounterSell: 17_940,
      bankNotesBuy: 17_660,
      bankNotesSell: 17_940,
    });
  });

  it('membaca angka id-ID: titik ribuan, koma desimal', () => {
    // "110,60" adalah 110,6 — bukan 11.060 seperti kalau dibaca sebagai en-US.
    expect(parseBcaRatePage(PAGE)?.rates.get('JPY')?.eRateBuy).toBe(110.6);
  });

  it('membaca jam terbit e-Rate sebagai WIB, bukan waktu lokal', () => {
    // 15 Agu 2026 04.31 WIB = 14 Agu 2026 21.31 UTC. Membacanya tanpa menggeser
    // offset akan melaporkan kurs pagi ini tujuh jam ke depan.
    expect(parseBcaRatePage(PAGE)?.asOf.toISOString()).toBe('2026-08-14T21:31:00.000Z');
  });

  it('mengabaikan baris yang tidak punya e-Rate', () => {
    const withBlankRow = PAGE.replace('rate-type="eRate-buy"><p>110,60', 'rate-type="eRate-buy"><p>-');

    const table = parseBcaRatePage(withBlankRow);
    expect(table?.rates.has('JPY')).toBe(false);
    expect(table?.rates.has('USD')).toBe(true);
  });

  it('mengembalikan undefined saat markupnya tidak dikenali lagi', () => {
    // Kegagalan yang harus terbaca sebagai "sumbernya tidak bisa dibaca", bukan
    // sebagai tabel kosong yang diam-diam dipakai.
    expect(parseBcaRatePage('<html><body>halaman lain</body></html>')).toBeUndefined();
  });
});
