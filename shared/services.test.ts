import { describe, expect, it } from 'vitest';
import { CATEGORIES, getService, SERVICES } from './services';

describe('services', () => {
  it('have unique, URL-safe ids', () => {
    const ids = SERVICES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('only link to services and categories that exist', () => {
    for (const s of SERVICES) {
      expect(CATEGORIES.some((c) => c.id === s.category)).toBe(true);
      for (const id of s.related) expect(getService(id), `${s.id} → ${id}`).toBeDefined();
      expect(s.related).not.toContain(s.id);
    }
  });

  it('every category has at least one service', () => {
    for (const c of CATEGORIES) expect(SERVICES.some((s) => s.category === c.id)).toBe(true);
  });
});
