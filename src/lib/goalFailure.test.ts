import { describe, expect, it } from 'vitest';
import { goalFailureToast } from './goalFailure';

describe('goalFailureToast', () => {
  // Protects a coach from a dead-looking Confirm button: the failure is loud.
  it('is a destructive toast titled "Goal not recorded"', () => {
    expect(goalFailureToast(new Error('x'))).toMatchObject({
      title: 'Goal not recorded',
      variant: 'destructive',
    });
  });

  // Supabase/PostgREST errors are plain objects, not Error instances — the
  // 11 Oct staging failure was one of these, for the then-missing column.
  it('names what went wrong for a Supabase error object', () => {
    const toast = goalFailureToast({
      message: "Could not find the 'is_own_goal' column of 'match_events' in the schema cache",
      code: 'PGRST204',
    });
    expect(toast.description).toContain("Could not find the 'is_own_goal' column");
    expect(toast.description).toContain('try again');
  });

  it('names what went wrong for a thrown Error', () => {
    expect(goalFailureToast(new Error('No period is running — start a period first')).description)
      .toContain('No period is running');
  });

  it('still says something useful when the error has no message', () => {
    expect(goalFailureToast(null).description).toContain('Unknown error');
  });
});
