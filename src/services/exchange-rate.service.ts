import { apiClient } from './client';
import { buildListQuery } from './pagination';
import { convertAmount, DEFAULT_QUOTE_CURRENCY, formatMoney, rateLabel } from '@/lib/currency';
import type { ExchangeRateDTO } from '@/types/dtos';
import type { ExchangeRateVO } from '@/types/value-objects';

/**
 * Live currency conversion. The rate is a moving quote, not stored data — cache
 * it short (`staleTime` of a minute or two) and never key a saved document off
 * it; a document that needs a rate must persist its own.
 *
 * ```ts
 * const { data: fx } = useQuery({
 *   queryKey: ['exchange-rate', currencyCode],
 *   queryFn: () => exchangeRateService.quote(currencyCode),
 *   enabled: currencyCode !== 'IDR',
 *   staleTime: 60_000,
 * });
 *
 * <Text>{fx?.label}</Text>          // "1 USD = Rp 16.250,00"
 * <Text>{fx?.format(amount)}</Text> // amount converted into IDR
 * ```
 */

function toVO(dto: ExchangeRateDTO): ExchangeRateVO {
  const quoteCurrency = {
    code: dto.quote,
    symbol: dto.symbol,
    decimalDigits: dto.decimal_digits,
  };

  const convert = (amount: number) => convertAmount(amount, dto.rate, dto.decimal_digits);

  return {
    base: dto.base,
    quote: dto.quote,
    rate: dto.rate,
    symbol: dto.symbol,
    decimalDigits: dto.decimal_digits,
    asOf: new Date(dto.as_of),
    source: dto.source,
    label: rateLabel(dto.base, dto.rate, quoteCurrency),
    convert,
    format: (amount: number) => formatMoney(convert(amount), quoteCurrency),
  };
}

export const exchangeRateService = {
  quote: async (from: string, to: string = DEFAULT_QUOTE_CURRENCY): Promise<ExchangeRateVO> =>
    toVO(
      await apiClient.get<ExchangeRateDTO>(
        `/api/exchange-rates${buildListQuery({ from, to })}`,
        { cache: 'no-store' },
      ),
    ),
};
