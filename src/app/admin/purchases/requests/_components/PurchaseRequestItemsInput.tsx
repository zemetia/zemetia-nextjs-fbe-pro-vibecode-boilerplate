'use client';

import { Plus, Trash2 } from 'lucide-react';

import { formatCurrency, formatNumber } from '@/lib/number';
import { WEIGHT_UNIT_OPTIONS } from '@/lib/weight';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProductPicker, SupplyPicker } from '@/components/shared';
import type {
  ProductVO,
  PurchaseRequestCategory,
  SupplyVO,
  WeightUnit,
} from '@/types/value-objects';
import {
  emptyItem,
  previewItemAmount,
  withProduct,
  withSupply,
  type PurchaseRequestItemFormState,
} from './form-state';

export interface PurchaseRequestItemsInputProps {
  category: PurchaseRequestCategory;
  currencyCode: string;
  items: PurchaseRequestItemFormState[];
  onChange: (items: PurchaseRequestItemFormState[]) => void;
  errors?: Partial<Record<string, string>>;
}

export function PurchaseRequestItemsInput({
  category,
  currencyCode,
  items,
  onChange,
  errors = {},
}: PurchaseRequestItemsInputProps) {
  const isSupply = category === 'SUPPLY';

  function handleProductChange(index: number, product: ProductVO) {
    const next = [...items];
    const current = next[index];
    if (!current) return;
    next[index] = withProduct(current, product);
    onChange(next);
  }

  function handleSupplyChange(index: number, supply: SupplyVO) {
    const next = [...items];
    const current = next[index];
    if (!current) return;
    next[index] = withSupply(current, supply);
    onChange(next);
  }

  function updateField<K extends keyof PurchaseRequestItemFormState>(
    index: number,
    field: K,
    value: PurchaseRequestItemFormState[K],
  ) {
    const next = [...items];
    const current = next[index];
    if (!current) return;
    next[index] = { ...current, [field]: value };
    onChange(next);
  }

  function addItem() {
    onChange([...items, emptyItem(category)]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Rincian Barang yang Diminta</h3>
          <p className="text-xs text-foreground-muted">
            {isSupply
              ? 'Pilih barang non-logam dari master supplies beserta jumlah dan estimasi harga per satuan.'
              : 'Pilih produk emas/perak beserta jumlah berat dan estimasi harga.'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          Tambah Baris
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead className="min-w-[240px]">
                {isSupply ? 'Barang Non-Logam' : 'Produk Logam Mulia'}
              </TableHead>
              {!isSupply && <TableHead className="w-32">Satuan Berat</TableHead>}
              <TableHead className="w-36">
                {isSupply ? 'Jumlah Satuan' : 'Kuantitas / Berat'}
              </TableHead>
              <TableHead className="w-44 text-right">
                Est. Harga Satuan ({currencyCode})
              </TableHead>
              <TableHead className="w-44 text-right">
                Est. Total ({currencyCode})
              </TableHead>
              <TableHead className="min-w-[160px]">Catatan</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => {
              const rowNum = index + 1;
              const itemError = errors[`items.${index}.product_id`] || errors[`items.${index}.supply_id`];
              const qtyError = errors[`items.${index}.quantity`];
              const priceError = errors[`items.${index}.est_unit_price`];
              const subtotal = previewItemAmount(item);

              return (
                <TableRow key={item.key}>
                  <TableCell className="text-center font-mono text-xs text-foreground-muted">
                    {rowNum}
                  </TableCell>
                  <TableCell>
                    {isSupply ? (
                      <SupplyPicker
                        value={item.supplyId ?? ''}
                        onChange={(supply) => handleSupplyChange(index, supply)}
                        error={itemError}
                        aria-label={`Pilih supply baris ke-${rowNum}`}
                      />
                    ) : (
                      <ProductPicker
                        value={item.productId ?? ''}
                        onChange={(product) => handleProductChange(index, product)}
                        error={itemError}
                        aria-label={`Pilih produk baris ke-${rowNum}`}
                      />
                    )}
                  </TableCell>
                  {!isSupply && (
                    <TableCell>
                      <Combobox
                        options={WEIGHT_UNIT_OPTIONS}
                        value={item.weightUnit ?? 'GRAM'}
                        onValueChange={(val) =>
                          updateField(index, 'weightUnit', val as WeightUnit)
                        }
                        aria-label={`Satuan berat baris ke-${rowNum}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <NumberInput
                      value={item.quantity}
                      onChange={(val) => updateField(index, 'quantity', val)}
                      decimalScale={isSupply ? 0 : 4}
                      error={qtyError}
                      placeholder={isSupply ? 'mis. 5' : 'mis. 100'}
                      aria-label={`Jumlah kuantitas baris ke-${rowNum}`}
                    />
                    {isSupply && item.supplyUnit && (
                      <span className="block text-xs text-foreground-subtle mt-0.5">
                        Satuan: {item.supplyUnit}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <NumberInput
                      value={item.estUnitPrice}
                      onChange={(val) => updateField(index, 'estUnitPrice', val)}
                      decimalScale={currencyCode === 'USD' ? 4 : 2}
                      error={priceError}
                      placeholder="0"
                      aria-label={`Harga satuan baris ke-${rowNum}`}
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-foreground font-medium">
                    {currencyCode === 'IDR'
                      ? formatCurrency(subtotal)
                      : `${currencyCode} ${formatNumber(subtotal, { decimalScale: 2 })}`}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.notes ?? ''}
                      onChange={(e) => updateField(index, 'notes', e.target.value)}
                      placeholder="Keterangan per baris…"
                      aria-label={`Catatan baris ke-${rowNum}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={items.length <= 1}
                      onClick={() => removeItem(index)}
                      title={`Hapus baris ${rowNum}`}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

PurchaseRequestItemsInput.displayName = 'PurchaseRequestItemsInput';
