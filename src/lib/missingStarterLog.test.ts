import { describe, expect, it } from 'vitest';
import { decideMissingStarterLog } from './missingStarterLog';

describe('decideMissingStarterLog', () => {
  describe('case 1 — no rows at all (genuine missing starter)', () => {
    it('inserts a starter interval at minute 0', () => {
      expect(decideMissingStarterLog([], 30)).toEqual({
        insert: true,
        timeOnMinute: 0,
        isStarter: true,
        missingSpell: false,
      });
    });

    it('inserts at minute 0 even when no elapsed time is available', () => {
      // Case 1 does not depend on the duration — a starter is on from minute 0.
      expect(decideMissingStarterLog([], null)).toEqual({
        insert: true,
        timeOnMinute: 0,
        isStarter: true,
        missingSpell: false,
      });
    });
  });

  describe('case 2 — rows exist but none active (returning player, spell not recorded)', () => {
    it('inserts a zero-length spell at the current elapsed minute, not a starter', () => {
      expect(decideMissingStarterLog([{ is_active: false }], 24)).toEqual({
        insert: true,
        timeOnMinute: 24,
        isStarter: false,
        missingSpell: true,
      });
    });

    it('credits nothing rather than over-count a returning player with multiple closed spells', () => {
      const threeClosedSpells = [
        { is_active: false },
        { is_active: false },
        { is_active: false },
      ];
      expect(decideMissingStarterLog(threeClosedSpells, 41)).toEqual({
        insert: true,
        timeOnMinute: 41,
        isStarter: false,
        missingSpell: true,
      });
    });

    it('treats an explicit elapsed minute of 0 as available (distinct from null)', () => {
      expect(decideMissingStarterLog([{ is_active: false }], 0)).toEqual({
        insert: true,
        timeOnMinute: 0,
        isStarter: false,
        missingSpell: true,
      });
    });

    it('skips the insert when the elapsed minute is not available — never falls back to 0', () => {
      expect(decideMissingStarterLog([{ is_active: false }], null)).toEqual({
        insert: false,
        reason: 'missing-spell-no-duration',
      });
    });
  });

  describe('case 3 — an active row exists', () => {
    it('does not insert', () => {
      expect(decideMissingStarterLog([{ is_active: true }], 30)).toEqual({
        insert: false,
        reason: 'active-interval',
      });
    });

    it('an active row wins even alongside earlier closed spells', () => {
      const returningPlayerNowOn = [
        { is_active: false },
        { is_active: false },
        { is_active: true },
      ];
      expect(decideMissingStarterLog(returningPlayerNowOn, 55)).toEqual({
        insert: false,
        reason: 'active-interval',
      });
    });

    it('an active row wins even when no elapsed time is available', () => {
      expect(decideMissingStarterLog([{ is_active: true }], null)).toEqual({
        insert: false,
        reason: 'active-interval',
      });
    });
  });
});
