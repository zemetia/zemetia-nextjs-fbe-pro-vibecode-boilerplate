export interface CountryVO {
  id: string;
  iso2: string;
  iso3: string;
  name: string;
  dialCode: string;
  currencyCode: string | undefined;
  /** Combobox label — "Indonesia (ID)". */
  label: string;
}

export interface CurrencyVO {
  code: string;
  name: string;
  symbol: string;
  decimalDigits: number;
  /** Combobox label — "IDR — Rupiah Indonesia". */
  label: string;
}
