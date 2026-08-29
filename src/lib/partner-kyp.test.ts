import { describe, expect, it } from 'vitest';

import { partnerKypChecklist, type PartnerKypSubject } from './partner-kyp';
import {
  canRequestPartnerVerification,
  partnerVerificationState,
  partnerVerifiedUntil,
} from './partner-verification';

/**
 * Kelengkapan KYP dan masa berlaku verifikasi adalah dua aturan yang gagalnya
 * berupa "tidak terjadi apa-apa" — tombol yang tetap menyala, atau centang yang
 * tetap terpasang. Keduanya diuji dengan kasus yang seharusnya *ditolak*, bukan
 * hanya kasus yang lolos (LEARN 2026-08-11).
 */

const complete: PartnerKypSubject = {
  type: 'COMPANY',
  origin: 'LOCAL',
  legalName: 'PT Emas Nusantara Sejahtera',
  addressLine: 'Jl. Industri Raya No. 12',
  city: 'Jakarta Utara',
  province: 'DKI Jakarta',
  postalCode: '14350',
  contactName: 'Budi Santoso',
  contactRole: 'Direktur',
  contactPhone: '+62 812 3456 7890',
  contactEmail: 'budi@mitra.com',
  contactCountryId: 'country-id',
  contactIdType: 'NIK',
  contactIdNumber: '3175010101900001',
  taxNumber: '01.234.567.8-901.000',
  nib: '1234567890123',
  foreignRegistrationNumber: null,
  isPkp: false,
  sppkpNumber: null,
};

describe('partnerKypChecklist', () => {
  it('menerima badan usaha lokal yang datanya lengkap', () => {
    expect(partnerKypChecklist(complete).isComplete).toBe(true);
  });

  it('menyebut field yang kosong, bukan sekadar menolak', () => {
    const checklist = partnerKypChecklist({ ...complete, city: null, taxNumber: '  ' });

    expect(checklist.isComplete).toBe(false);
    expect(checklist.missing.map((item) => item.key)).toEqual(['city', 'tax_number']);
  });

  it('membaca "—" dari VO layar sebagai kosong, bukan sebagai isi', () => {
    expect(partnerKypChecklist({ ...complete, postalCode: '—' }).isComplete).toBe(false);
  });

  it('meminta NIB pada badan lokal dan nomor registrasi asing pada yang overseas', () => {
    const localWithoutNib = partnerKypChecklist({ ...complete, nib: null });
    expect(localWithoutNib.missing.map((item) => item.key)).toEqual(['nib']);

    const overseas = partnerKypChecklist({
      ...complete,
      origin: 'OVERSEAS',
      nib: null,
      foreignRegistrationNumber: null,
    });
    expect(overseas.missing.map((item) => item.key)).toEqual(['foreign_registration_number']);
  });

  it('tidak meminta nama legal maupun NIB dari perorangan', () => {
    const individual = partnerKypChecklist({
      ...complete,
      type: 'INDIVIDUAL',
      legalName: null,
      nib: null,
    });

    expect(individual.isComplete).toBe(true);
  });

  it('meminta nomor SPPKP hanya dari mitra yang mengaku PKP', () => {
    expect(partnerKypChecklist({ ...complete, isPkp: true }).missing.map((i) => i.key)).toEqual([
      'sppkp_number',
    ]);
    expect(partnerKypChecklist({ ...complete, isPkp: false, sppkpNumber: null }).isComplete).toBe(
      true,
    );
  });

  it('menganggap nomor identitas tanpa jenisnya belum terisi', () => {
    const checklist = partnerKypChecklist({ ...complete, contactIdType: null });

    expect(checklist.missing.map((item) => item.key)).toEqual(['contact_id_number']);
  });
});

describe('partnerVerificationState', () => {
  const now = new Date('2026-08-14T00:00:00.000Z');

  it('membaca verifikasi yang tanggalnya lewat sebagai kedaluwarsa', () => {
    expect(partnerVerificationState('VERIFIED', new Date('2026-08-13T00:00:00.000Z'), now)).toBe(
      'EXPIRED',
    );
    expect(partnerVerificationState('VERIFIED', new Date('2026-08-15T00:00:00.000Z'), now)).toBe(
      'VERIFIED',
    );
  });

  it('tidak mengubah status yang belum pernah terverifikasi', () => {
    expect(partnerVerificationState('PENDING', null, now)).toBe('PENDING');
    expect(partnerVerificationState('REJECTED', null, now)).toBe('REJECTED');
  });

  it('memberi masa berlaku dua tahun', () => {
    expect(partnerVerifiedUntil(now).toISOString()).toBe('2028-08-14T00:00:00.000Z');
  });

  it('menolak pengajuan ulang selama masih berlaku atau sedang ditinjau', () => {
    expect(canRequestPartnerVerification('VERIFIED')).toBe(false);
    expect(canRequestPartnerVerification('PENDING')).toBe(false);
    expect(canRequestPartnerVerification('EXPIRED')).toBe(true);
    expect(canRequestPartnerVerification('REJECTED')).toBe(true);
    expect(canRequestPartnerVerification('UNVERIFIED')).toBe(true);
  });
});
