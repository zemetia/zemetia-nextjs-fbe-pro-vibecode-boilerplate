import { describe, expect, it } from 'vitest';

import { buildListQuery, toPaginatedVO, type ListParams } from './pagination';
import type { PaginatedDTO } from '@/types/dtos';

describe('buildListQuery', () => {
  it('returns an empty string when nothing is set', () => {
    expect(buildListQuery()).toBe('');
    expect(buildListQuery({})).toBe('');
    expect(buildListQuery({ page: undefined, q: undefined })).toBe('');
  });

  it('serializes the params that are set', () => {
    expect(buildListQuery({ page: 2, limit: 50 })).toBe('?page=2&limit=50');
  });

  it('drops blank and null values so a cleared filter is omitted', () => {
    expect(buildListQuery({ page: 2, q: '', limit: null })).toBe('?page=2');
  });

  it('keeps page 1 and other falsy-but-meaningful values', () => {
    expect(buildListQuery({ page: 1, isActive: false })).toBe('?page=1&isActive=false');
  });

  it('encodes values', () => {
    expect(buildListQuery({ q: 'budi & ani' })).toBe('?q=budi+%26+ani');
  });

  it('accepts a domain params type extended from ListParams', () => {
    const params: ListParams & { isActive?: boolean } = { q: 'budi', isActive: true };
    expect(buildListQuery(params)).toBe('?q=budi&isActive=true');
  });
});

describe('toPaginatedVO', () => {
  const dto: PaginatedDTO<{ id: string; full_name: string }> = {
    data: [{ id: 'a', full_name: 'Budi' }],
    total: 3,
    page: 2,
    page_size: 1,
    total_pages: 3,
  };
  const toVO = (item: { id: string; full_name: string }) => ({
    id: item.id,
    name: item.full_name,
  });

  it('maps items and renames envelope fields to camelCase', () => {
    expect(toPaginatedVO(dto, toVO)).toEqual({
      items: [{ id: 'a', name: 'Budi' }],
      total: 3,
      page: 2,
      pageSize: 1,
      totalPages: 3,
      hasPrevPage: true,
      hasNextPage: true,
      isEmpty: false,
    });
  });

  it('has no previous page on the first page', () => {
    expect(toPaginatedVO({ ...dto, page: 1 }, toVO)).toMatchObject({
      hasPrevPage: false,
      hasNextPage: true,
    });
  });

  it('has no next page on the last page', () => {
    expect(toPaginatedVO({ ...dto, page: 3 }, toVO)).toMatchObject({
      hasPrevPage: true,
      hasNextPage: false,
    });
  });

  it('marks an empty result as empty with no pages either way', () => {
    expect(
      toPaginatedVO({ data: [], total: 0, page: 1, page_size: 20, total_pages: 0 }, toVO),
    ).toMatchObject({ items: [], isEmpty: true, hasPrevPage: false, hasNextPage: false });
  });
});
