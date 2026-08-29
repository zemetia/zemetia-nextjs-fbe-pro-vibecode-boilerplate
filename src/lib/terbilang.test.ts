import { describe, expect, it } from 'vitest';

import { terbilang, terbilangRupiah } from './terbilang';

describe('terbilang', () => {
  it('mengeja bilangan di bawah dua puluh dengan bentuk khususnya', () => {
    expect(terbilang(0)).toBe('nol');
    expect(terbilang(7)).toBe('tujuh');
    expect(terbilang(10)).toBe('sepuluh');
    expect(terbilang(11)).toBe('sebelas');
    expect(terbilang(12)).toBe('dua belas');
    expect(terbilang(19)).toBe('sembilan belas');
  });

  it('tidak pernah menyebut "nol" di posisi sisa', () => {
    expect(terbilang(20)).toBe('dua puluh');
    expect(terbilang(100)).toBe('seratus');
    expect(terbilang(1_000)).toBe('seribu');
    expect(terbilang(1_000_000)).toBe('satu juta');
    expect(terbilang(2_000_000)).toBe('dua juta');
  });

  it('memakai "seratus"/"seribu", bukan "satu ratus"/"satu ribu"', () => {
    expect(terbilang(101)).toBe('seratus satu');
    expect(terbilang(1_500)).toBe('seribu lima ratus');
    expect(terbilang(2_500)).toBe('dua ribu lima ratus');
  });

  it('mengeja nilai sebesar dokumen pembelian sungguhan', () => {
    expect(terbilang(150_000_000)).toBe('seratus lima puluh juta');
    expect(terbilang(1_234_567)).toBe('satu juta dua ratus tiga puluh empat ribu lima ratus enam puluh tujuh');
    expect(terbilang(12_500_000_000)).toBe('dua belas miliar lima ratus juta');
    expect(terbilang(3_000_000_000_000)).toBe('tiga triliun');
  });

  it('membulatkan pecahan dan menandai bilangan negatif', () => {
    expect(terbilang(2.4)).toBe('dua');
    expect(terbilang(2.6)).toBe('tiga');
    expect(terbilang(-45)).toBe('minus empat puluh lima');
  });
});

describe('terbilangRupiah', () => {
  it('mengawali dengan huruf besar dan menutup dengan satuannya', () => {
    expect(terbilangRupiah(150_000_000)).toBe('Seratus lima puluh juta rupiah');
    expect(terbilangRupiah(0)).toBe('Nol rupiah');
  });

  it('hanya menyebut sen bila memang ada', () => {
    expect(terbilangRupiah(1_234)).toBe('Seribu dua ratus tiga puluh empat rupiah');
    expect(terbilangRupiah(1_234.5)).toBe('Seribu dua ratus tiga puluh empat rupiah lima puluh sen');
  });

  it('menaikkan sen yang membulat ke seratus, bukan menyebut "seratus sen"', () => {
    expect(terbilangRupiah(9.999)).toBe('Sepuluh rupiah');
  });

  it('menandai nilai negatif', () => {
    expect(terbilangRupiah(-2_000)).toBe('Minus dua ribu rupiah');
  });
});
