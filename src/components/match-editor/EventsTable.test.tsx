import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EventsTable } from './EventsTable';

// UX-042: a goal mis-credited to one of our players must be convertible to an
// own goal in the editor, without SQL — the path that would have avoided the
// 11 Oct 2026 manual repair in production.
const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  eq: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: (row: unknown) => {
        mocks.update(row);
        return {
          eq: (col: string, val: unknown) => {
            mocks.eq(col, val);
            return Promise.resolve({ error: null });
          },
        };
      },
    }),
  },
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

afterEach(cleanup);

const goal = (overrides: Record<string, unknown> = {}) => ({
  id: 'e1',
  event_type: 'goal',
  minute_in_period: 14,
  total_match_minute: 74,
  period_id: 'p1',
  is_our_team: true,
  is_penalty: false,
  player_id: 'river',
  assist_player_id: 'lucas',
  players: { first_name: 'River', last_name: 'WH' },
  assist_players: { first_name: 'Lucas', last_name: 'H' },
  match_periods: { period_number: 2 },
  ...overrides,
});

const props = {
  periods: [{ id: 'p1', period_number: 2, planned_duration_minutes: 25 }],
  players: [
    { id: 'river', first_name: 'River', last_name: 'WH' },
    { id: 'lucas', first_name: 'Lucas', last_name: 'H' },
  ],
  fixtureId: 'fixture-1',
  onUpdate: () => {},
  onHasChanges: () => {},
};

// Edit and Save are icon-only buttons; the row's last cell holds them in order.
const rowButtons = () => screen.getAllByRole('row')[1].querySelectorAll('td:last-child button');

describe('EventsTable own goal (UX-042)', () => {
  beforeEach(() => {
    mocks.update.mockReset();
    mocks.eq.mockReset();
  });

  it('converts a credited goal to an own goal, clearing scorer, assist and penalty', async () => {
    render(<EventsTable events={[goal({ is_penalty: true })]} {...props} />);

    fireEvent.click(rowButtons()[0] as HTMLElement); // Edit
    fireEvent.click(screen.getByRole('checkbox', { name: 'Own goal' }));
    expect(screen.getByRole('checkbox', { name: 'Penalty' })).toBeDisabled();
    fireEvent.click(rowButtons()[0] as HTMLElement); // Save

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update.mock.calls[0][0]).toMatchObject({
      is_own_goal: true,
      player_id: null,
      assist_player_id: null,
      is_penalty: false,
    });
    expect(mocks.eq).toHaveBeenCalledWith('id', 'e1');
  });

  it('saves an ordinary goal edit with its scorer and assist intact', async () => {
    render(<EventsTable events={[goal()]} {...props} />);

    fireEvent.click(rowButtons()[0] as HTMLElement); // Edit
    fireEvent.click(rowButtons()[0] as HTMLElement); // Save

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update.mock.calls[0][0]).toMatchObject({
      is_own_goal: false,
      player_id: 'river',
      assist_player_id: 'lucas',
    });
  });

  it('shows an own goal as "Own goal", not "Unknown"', () => {
    render(
      <EventsTable
        events={[goal({ is_own_goal: true, player_id: undefined, assist_player_id: null, players: undefined, assist_players: undefined })]}
        {...props}
      />
    );
    expect(screen.getAllByText('Own goal').length).toBeGreaterThan(0);
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });
});
