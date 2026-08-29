/**
 * One live FX quote. `symbol`/`decimal_digits` describe the **quote** currency
 * so the client can format the converted amount without a second lookup.
 */
export interface ExchangeRateDTO {
  base: string;
  quote: string;
  rate: number;
  symbol: string;
  decimal_digits: number;
  /** ISO timestamp of the market tick the rate came from. */
  as_of: string;
  source: string;
}
