export interface ExchangeRateVO {
  base: string;
  quote: string;
  rate: number;
  symbol: string;
  decimalDigits: number;
  asOf: Date;
  source: string;
  /** "1 USD = Rp 16.250,00". */
  label: string;
  /** Converts an amount in the base currency, rounded to the quote's precision. */
  convert: (amount: number) => number;
  /** Same conversion, already formatted — "Rp 16.250.000,00". */
  format: (amount: number) => string;
}
