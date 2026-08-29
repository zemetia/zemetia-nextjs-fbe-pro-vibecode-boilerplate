import { describe, expect, it } from 'vitest';

import { partnerOriginFromCountry } from './partner';
import { toPartnerColumns } from './partner-write';
import { createPartnerSchema } from './validations';

/**
 * The rule that makes one table safe for two roles: every partner must hold at
 * least one. Where the partner trades is not asked at all — it is derived from
 * its country (`partnerOriginFromCountry`), so no payload can claim otherwise.
 */

const base = {
  name: 'Toko Mas Jaya',
  type: 'INDIVIDUAL' as const,
  country_id: 'country-id',
  currency_code: 'IDR',
};

describe('createPartnerSchema role rules', () => {
  it('rejects a partner with no role at all', () => {
    const result = createPartnerSchema.safeParse({
      ...base,
      is_supplier: false,
      is_customer: false,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('minimal satu peran');
  });

  it('accepts a partner holding one role, or both', () => {
    const supplierOnly = createPartnerSchema.safeParse({
      ...base,
      is_supplier: true,
      is_customer: false,
    });
    expect(supplierOnly.success).toBe(true);

    const both = createPartnerSchema.safeParse({
      ...base,
      is_supplier: true,
      is_customer: true,
    });
    expect(both.success).toBe(true);
  });

  it('requires a country — it is what classifies the partner', () => {
    const { country_id: _countryId, ...withoutCountry } = base;

    const result = createPartnerSchema.safeParse({
      ...withoutCountry,
      is_supplier: true,
      is_customer: false,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['country_id']);
  });
});

describe('toPartnerColumns', () => {
  it('writes no origin column — the country is the only record of it', () => {
    const parsed = createPartnerSchema.parse({
      ...base,
      is_supplier: false,
      is_customer: true,
    });

    const columns = toPartnerColumns(parsed);

    expect(columns.isSupplier).toBe(false);
    expect(columns.countryId).toBe('country-id');
    expect(columns).not.toHaveProperty('origin');
  });
});

describe('partnerOriginFromCountry', () => {
  it('reads Indonesia as local and everything else as overseas', () => {
    expect(partnerOriginFromCountry('ID')).toBe('LOCAL');
    expect(partnerOriginFromCountry('id')).toBe('LOCAL');
    expect(partnerOriginFromCountry('AE')).toBe('OVERSEAS');
    expect(partnerOriginFromCountry('SG')).toBe('OVERSEAS');
  });
});
