import { describe, expect, it } from 'vitest';

import {
  PERMISSION_CATALOG,
  PERMISSION_CATALOG_BY_KEY,
  PERMISSION_MODULES,
} from '@/lib/permissions';

describe('permission catalog', () => {
  it('derives every key as `resource:action`', () => {
    for (const entry of PERMISSION_CATALOG) {
      expect(entry.key).toBe(`${entry.resource}:${entry.action}`);
    }
  });

  it('has no duplicate keys — a duplicate would collide on the unique index', () => {
    const keys = PERMISSION_CATALOG.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has no duplicate actions within a resource', () => {
    // `module` is a reserved identifier under @next/next/no-assign-module-variable
    for (const permissionModule of PERMISSION_MODULES) {
      for (const resource of permissionModule.resources) {
        const actions = resource.permissions.map((permission) => permission.action);
        expect(new Set(actions).size).toBe(actions.length);
      }
    }
  });

  it('flattens every declared permission, in declaration order', () => {
    const declared = PERMISSION_MODULES.flatMap((permissionModule) =>
      permissionModule.resources.flatMap((resource) =>
        resource.permissions.map((permission) => `${resource.resource}:${permission.action}`),
      ),
    );
    expect(PERMISSION_CATALOG.map((entry) => entry.key)).toEqual(declared);
  });

  it('carries the module and resource labels the UI groups by', () => {
    const entry = PERMISSION_CATALOG_BY_KEY.get('roles:set-permissions');
    expect(entry).toMatchObject({
      resource: 'roles',
      action: 'set-permissions',
      module: 'administration',
    });
    expect(entry?.resourceLabel).not.toBe('');
    expect(entry?.moduleLabel).not.toBe('');
  });

  it('indexes every catalog entry by key', () => {
    expect(PERMISSION_CATALOG_BY_KEY.size).toBe(PERMISSION_CATALOG.length);
    for (const entry of PERMISSION_CATALOG) {
      expect(PERMISSION_CATALOG_BY_KEY.get(entry.key)).toBe(entry);
    }
  });

  it('gives every permission a label, endpoint and description for the matrix UI', () => {
    for (const entry of PERMISSION_CATALOG) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.endpoint.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('declares the user-management operations the admin UI calls', () => {
    const userKeys = PERMISSION_CATALOG.filter((entry) => entry.resource === 'users').map(
      (entry) => entry.key,
    );
    expect(userKeys).toEqual([
      'users:list',
      'users:create',
      'users:assign-role',
      'users:set-status',
    ]);
  });
});
