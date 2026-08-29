import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { buildPaginatedDTO, parseListQuery, toPageWindow } from './pagination';
import { paginationSchema } from './validations/common';

const listQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
});

describe('toPageWindow', () => {
  it('derives skip/take from page and limit', () => {
    expect(toPageWindow({ page: 1, limit: 20 })).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
      take: 20,
    });
    expect(toPageWindow({ page: 3, limit: 20 })).toMatchObject({ skip: 40, take: 20 });
  });
});

describe('parseListQuery', () => {
  function request(query: string): Request {
    return new Request(`https://example.test/api/users${query}`);
  }

  it('applies schema defaults when params are absent', () => {
    expect(parseListQuery(request(''), listQuerySchema)).toEqual({ page: 1, limit: 20 });
  });

  it('coerces numeric params', () => {
    expect(parseListQuery(request('?page=3&limit=50'), listQuerySchema)).toMatchObject({
      page: 3,
      limit: 50,
    });
  });

  it('treats blank params as omitted instead of throwing', () => {
    expect(parseListQuery(request('?page=&limit=&q='), listQuerySchema)).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it('rejects out-of-range values', () => {
    expect(() => parseListQuery(request('?limit=500'), listQuerySchema)).toThrow();
    expect(() => parseListQuery(request('?page=0'), listQuerySchema)).toThrow();
  });
});

describe('buildPaginatedDTO', () => {
  const rows = [{ id: 'a' }, { id: 'b' }];
  const toDTO = (row: { id: string }) => ({ id: row.id.toUpperCase() });

  it('maps rows and reports the unpaginated total', () => {
    expect(buildPaginatedDTO(rows, 42, { page: 2, limit: 2 }, toDTO)).toEqual({
      data: [{ id: 'A' }, { id: 'B' }],
      total: 42,
      page: 2,
      page_size: 2,
      total_pages: 21,
    });
  });

  it('rounds a partial last page up', () => {
    expect(buildPaginatedDTO(rows, 21, { page: 1, limit: 20 }, toDTO).total_pages).toBe(2);
  });

  it('reports zero pages for an empty result', () => {
    expect(buildPaginatedDTO([], 0, { page: 1, limit: 20 }, toDTO)).toMatchObject({
      data: [],
      total: 0,
      total_pages: 0,
    });
  });
});
