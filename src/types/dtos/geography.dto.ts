/**
 * Reference lookups feeding the country/currency comboboxes. Deliberately
 * unpaginated: a combobox needs the whole list at once (249 countries), and the
 * shared `paginationSchema` caps a page at 100 rows.
 */

export interface CountryDTO {
  id: string;
  iso2: string;
  iso3: string;
  name: string;
  dial_code: string;
  region: string;
  currency_code: string | null;
}

export interface CurrencyDTO {
  code: string;
  name: string;
  symbol: string;
  decimal_digits: number;
}

export interface CountryLookupDTO {
  data: CountryDTO[];
}

export interface CurrencyLookupDTO {
  data: CurrencyDTO[];
}
