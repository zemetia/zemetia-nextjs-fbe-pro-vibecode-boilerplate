import { describe, expect, it } from 'vitest';

import {
  barWeightLabel,
  barWeightOptions,
  largestBarWeightAtMost,
  splitBarWeights,
} from './bar-weight';

/**
 * Pembagian keping. Yang diuji di sini adalah contoh lapangan yang menentukan
 * bentuk algoritmanya — berat yang habis dibagi rata, berat yang tidak akan
 * pernah muat karena kepingnya memang tidak sebesar itu, dan kedua daftar ukuran
 * yang berdiri sendiri-sendiri per satuan.
 */

describe('largestBarWeightAtMost', () => {
  it('mengambil ukuran terbesar yang tidak melewati jatahnya', () => {
    expect(largestBarWeightAtMost(20, 'GRAM')).toBe(20);
    expect(largestBarWeightAtMost(16.67, 'GRAM')).toBe(10);
    expect(largestBarWeightAtMost(999, 'GRAM')).toBe(500);
  });

  it('membaca daftar troy ounce, bukan daftar gram yang dikonversi', () => {
    // 25 g ada di daftar gram; 25 oz tidak ada di daftar ounce, jadi jatahnya
    // turun ke 20 oz — ukuran yang memang benar-benar dijual.
    expect(largestBarWeightAtMost(25, 'TROY_OUNCE')).toBe(20);
    expect(largestBarWeightAtMost(400, 'TROY_OUNCE')).toBe(400);
    expect(largestBarWeightAtMost(2_000, 'TROY_OUNCE')).toBe(1_000);
  });

  it('tidak punya jawaban untuk jatah di bawah keping terkecil', () => {
    expect(largestBarWeightAtMost(0.4, 'GRAM')).toBeUndefined();
    expect(largestBarWeightAtMost(0.4, 'TROY_OUNCE')).toBeUndefined();
  });
});

describe('splitBarWeights', () => {
  it('membagi rata saat jatahnya persis ukuran yang ada', () => {
    expect(splitBarWeights(100, 5, 'GRAM')).toEqual([20, 20, 20, 20, 20]);
  });

  it('menutup sisanya dengan ukuran yang lebih besar saat tidak habis dibagi', () => {
    const weights = splitBarWeights(100, 6, 'GRAM');

    expect(weights).toHaveLength(6);
    expect(weights.reduce((total, weight) => total + weight, 0)).toBe(100);
  });

  it('berhenti di keping terbesar dan sengaja menyisakan kekurangan', () => {
    // 10 kg atas 5 sertifikat: keping terbesar 1 kg, jadi hanya 5 kg yang bisa
    // dinyatakan — selisihnya ditampilkan, bukan dikarang.
    expect(splitBarWeights(10_000, 5, 'GRAM')).toEqual([1000, 1000, 1000, 1000, 1000]);
  });

  it('memberi keping terkecil saat jatahnya lebih kecil dari keping mana pun', () => {
    expect(splitBarWeights(2, 5, 'GRAM')).toEqual([1, 1, 1, 1, 1]);
  });

  it('membagi troy ounce dalam ukuran troy ounce', () => {
    // 4.000 oz atas 10 sertifikat = 400 oz per keping, ukuran Good Delivery emas.
    expect(splitBarWeights(4_000, 10, 'TROY_OUNCE')).toEqual(Array(10).fill(400));
  });

  it('batas atasnya 1.000 oz, jadi kekurangannya terlihat alih-alih dikarang', () => {
    // 5.000 oz atas 3 sertifikat berhenti di 3.000 oz — keping 1.667 oz tidak ada
    // wujudnya, dan selisih 2.000 oz-nya ditampilkan di kaki daftar.
    expect(splitBarWeights(5_000, 3, 'TROY_OUNCE')).toEqual([1_000, 1_000, 1_000]);
  });

  it('tidak membuat apa pun tanpa keping', () => {
    expect(splitBarWeights(100, 0, 'GRAM')).toEqual([]);
  });
});

describe('barWeightLabel', () => {
  it('menyebut kelipatan seribu gram sebagai kilogram', () => {
    expect(barWeightLabel(1000, 'GRAM')).toBe('1 kg');
    expect(barWeightLabel(250, 'GRAM')).toBe('250 g');
  });

  it('troy ounce tidak punya kelipatan bernama — seribu oz tetap seribu oz', () => {
    expect(barWeightLabel(1000, 'TROY_OUNCE')).toBe('1.000 troy oz');
    expect(barWeightLabel(400, 'TROY_OUNCE')).toBe('400 troy oz');
  });
});

describe('barWeightOptions', () => {
  it('menawarkan berat di luar daftar bila memang sudah tersimpan', () => {
    const options = barWeightOptions('GRAM', 31.1035);

    expect(options.some((option) => option.value === '31.1035')).toBe(true);
    expect(options.filter((option) => option.value === '100')).toHaveLength(1);
  });

  it('daftar troy ounce berhenti di 1.000 oz', () => {
    const values = barWeightOptions('TROY_OUNCE').map((option) => Number(option.value));

    expect(Math.max(...values)).toBe(1_000);
    // 250 g ada di daftar gram tapi bukan ukuran batangan ounce mana pun.
    expect(values).not.toContain(250);
  });
});
