import { describe, expect, it } from 'vitest';
import { gridSizeForSquad } from './matchGrid';

// Boundaries from UX-007: 4 or fewer / 5–9 / 10 or more.
describe('gridSizeForSquad', () => {
  it('uses 2 columns at 1.2rem for a squad of 4 or fewer', () => {
    expect(gridSizeForSquad(1)).toEqual({ columns: 2, nameRem: 1.2 });
    expect(gridSizeForSquad(4)).toEqual({ columns: 2, nameRem: 1.2 });
  });

  it('uses 3 columns at 1.05rem for a squad of 5 to 9', () => {
    expect(gridSizeForSquad(5)).toEqual({ columns: 3, nameRem: 1.05 });
    expect(gridSizeForSquad(9)).toEqual({ columns: 3, nameRem: 1.05 });
  });

  it('uses 3 columns at 0.95rem for a squad of 10 or more', () => {
    expect(gridSizeForSquad(10)).toEqual({ columns: 3, nameRem: 0.95 });
    expect(gridSizeForSquad(16)).toEqual({ columns: 3, nameRem: 0.95 });
  });
});
