import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EnhancedEventDialog } from './EnhancedEventDialog';

// UX-042: the Event button, the 'g' shortcut and the editor's Add Event all
// record through this dialog — a separate write path from QuickGoalButton.
const mocks = vi.hoisted(() => ({ upsert: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      upsert: (row: unknown) => {
        mocks.upsert(row);
        return Promise.resolve({ error: null });
      },
    }),
  },
}));

// useIsMobile() calls window.matchMedia, which jsdom does not implement.
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(cleanup);
beforeEach(() => mocks.upsert.mockReset());

const renderDialog = (periodType: 'period' | 'penalties' = 'period') =>
  render(
    <EnhancedEventDialog
      open
      onOpenChange={vi.fn()}
      fixtureId="fixture-1"
      currentPeriod={{ id: 'p1', period_number: 1, period_type: periodType, planned_duration_minutes: 25 }}
      currentMinute={10}
      totalMatchMinute={10}
      players={[{ id: 'river', first_name: 'River', last_name: 'WH' }]}
    />
  );

describe('EnhancedEventDialog own goal (UX-042)', () => {
  it('records an own goal for our team with no scorer, assist or penalty', async () => {
    renderDialog();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Penalty Kick' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Own goal' }));

    expect(screen.getByRole('checkbox', { name: 'Penalty Kick' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Penalty Kick' })).toBeDisabled();
    expect(screen.queryByText('Goal Scorer')).not.toBeInTheDocument();
    expect(screen.queryByText('Assist Player (optional)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Record Goal' }));

    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(1));
    expect(mocks.upsert.mock.calls[0][0]).toMatchObject({
      event_type: 'goal',
      is_our_team: true,
      is_own_goal: true,
      player_id: null,
      assist_player_id: null,
      is_penalty: false,
    });
  });

  it('is unticked by default and leaves the scorer picker in place', () => {
    renderDialog();
    expect(screen.getByRole('checkbox', { name: 'Own goal' })).not.toBeChecked();
    expect(screen.getByText('Goal Scorer')).toBeInTheDocument();
  });

  it('writes an ordinary goal without an is_own_goal key at all', async () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Opponent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Record Goal' }));

    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(1));
    expect(mocks.upsert.mock.calls[0][0]).not.toHaveProperty('is_own_goal');
    expect(mocks.upsert.mock.calls[0][0]).toMatchObject({ is_our_team: false, is_penalty: false });
  });

  it('offers no Own goal option in a penalty shootout period', () => {
    renderDialog('penalties');
    expect(screen.queryByRole('checkbox', { name: 'Own goal' })).not.toBeInTheDocument();
  });
});
