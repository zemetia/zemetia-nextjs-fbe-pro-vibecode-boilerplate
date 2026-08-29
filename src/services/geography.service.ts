import { apiClient } from './client';
import type { CountryDTO, CountryLookupDTO, CurrencyDTO, CurrencyLookupDTO } from '@/types/dtos';
import type { CountryVO, CurrencyVO } from '@/types/value-objects';

/**
 * Reference lookups for the country/currency comboboxes. Both lists are small,
 * stable and unpaginated on purpose — a combobox filters client-side, so the
 * caller should cache them long (`staleTime`) rather than refetch per keystroke.
 */

function toCountryVO(dto: CountryDTO): CountryVO {
  return {
    id: dto.id,
    iso2: dto.iso2,
    iso3: dto.iso3,
    name: dto.name,
    dialCode: dto.dial_code,
    currencyCode: dto.currency_code ?? undefined,
    label: `${dto.name} (${dto.iso2})`,
  };
}

function toCurrencyVO(dto: CurrencyDTO): CurrencyVO {
  return {
    code: dto.code,
    name: dto.name,
    symbol: dto.symbol,
    decimalDigits: dto.decimal_digits,
    label: `${dto.code} — ${dto.name}`,
  };
}

export const geographyService = {
  countries: async (): Promise<CountryVO[]> => {
    const dto = await apiClient.get<CountryLookupDTO>('/api/geography/countries');
    return dto.data.map(toCountryVO);
  },

  currencies: async (): Promise<CurrencyVO[]> => {
    const dto = await apiClient.get<CurrencyLookupDTO>('/api/geography/currencies');
    return dto.data.map(toCurrencyVO);
  },
};
