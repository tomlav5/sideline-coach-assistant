import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Fixtures from './Fixtures';

// BUG-025: the row menu's Delete must only open a confirmation; the actual delete
// (supabase .delete().eq('id', …)) runs only on "Delete match".
const mocks = vi.hoisted(() => ({
  deleteEq: vi.fn(),
  deleteCount: 1 as number | null,
  toast: vi.fn(),
  fixtures: [] as unknown[],
  update: vi.fn(),
  updateCount: 1 as number | null,
  updateError: null as { message: string } | null,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: mocks.fixtures, error: null }),
      }),
      delete: () => ({
        eq: (column: string, value: string) => {
          mocks.deleteEq(column, value);
          return Promise.resolve({ error: null, count: mocks.deleteCount });
        },
      }),
      update: (values: Record<string, unknown>, options?: { count?: string }) => ({
        eq: (column: string, value: string) => {
          mocks.update(values, options, column, value);
          return Promise.resolve({ error: mocks.updateError, count: mocks.updateCount });
        },
      }),
    }),
  },
}));

// Stable user object: Fixtures refetches (and shows its loading skeleton) whenever
// `user` changes identity, as the real AuthProvider's user does not.
const authUser = { id: 'me' };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: authUser }) }));
vi.mock('@/hooks/useTeams', () => ({ useTeams: () => ({ data: [], isLoading: false }) }));
vi.mock('@/hooks/useLiveMatchDetection', () => ({ useLiveMatchDetection: () => ({ data: undefined }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/fixtures/CreateFixtureDialog', () => ({ CreateFixtureDialog: () => null }));
// Stub exposing just the controls updateFixture depends on.
vi.mock('@/components/fixtures/EditFixtureDialog', () => ({
  EditFixtureDialog: (props: {
    open: boolean;
    selectedTime: string;
    onDateChange: (date: Date) => void;
    onTimeChange: (time: string) => void;
    onConfirm: () => void;
  }) =>
    props.open ? (
      <div data-testid="edit-dialog">
        <span data-testid="edit-time">{props.selectedTime}</span>
        <button onClick={() => props.onDateChange(new Date(2026, 9, 18))}>Stub set date</button>
        <button onClick={() => props.onTimeChange('')}>Stub clear time</button>
        <button onClick={props.onConfirm}>Update Fixture</button>
      </div>
    ) : null,
}));

const fixture = (id: string, opponent_name: string, scheduled_date: string) => ({
  id,
  opponent_name,
  scheduled_date,
  location: null,
  fixture_type: 'home',
  status: 'scheduled',
  half_length: 25,
  team_id: 'team-1',
  team: { id: 'team-1', name: 'Reds', club: { id: 'club-1', name: 'Club' } },
  created_at: '2026-09-01T00:00:00Z',
  competition_type: 'friendly',
  competition_name: null,
  selected_squad_data: null,
  kickoff_time_tbd: false,
});

const renderPage = async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Fixtures />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText('Albion');
};

// Radix opens the menu on pointerdown (primary button, no ctrl) or on Enter.
const openMenuFor = (opponent: string) => {
  const card = screen.getByText(opponent).closest('.rounded-lg') as HTMLElement;
  const trigger = within(card).getAllByRole('button').at(-1)!;
  fireEvent.keyDown(trigger, { key: 'Enter' });
};

const clickMenuDelete = async () => {
  fireEvent.click(await screen.findByRole('menuitem', { name: /^delete$/i }));
};

describe('Fixtures delete confirmation (BUG-025)', () => {
  beforeEach(() => {
    mocks.deleteEq.mockReset();
    mocks.toast.mockReset();
    mocks.deleteCount = 1;
    mocks.fixtures = [
      fixture('fixture-a', 'Albion', '2026-10-04T10:00:00Z'),
      fixture('fixture-b', 'Borough', '2026-10-11T10:00:00Z'),
    ];
  });

  afterEach(cleanup);

  it('clicking Delete in the menu does not delete', async () => {
    await renderPage();
    openMenuFor('Albion');
    await clickMenuDelete();

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(mocks.deleteEq).not.toHaveBeenCalled();
  });

  it('names the opponent and date of the selected fixture', async () => {
    await renderPage();
    openMenuFor('Borough');
    await clickMenuDelete();

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Delete this match?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Borough');
    expect(dialog).toHaveTextContent('11/10/2026');
    expect(dialog).not.toHaveTextContent('Albion');
    expect(dialog).toHaveTextContent(/cannot be undone/i);
  });

  it('Cancel closes the dialog without deleting', async () => {
    await renderPage();
    openMenuFor('Albion');
    await clickMenuDelete();

    fireEvent.click(await screen.findByRole('button', { name: /^cancel$/i }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(mocks.deleteEq).not.toHaveBeenCalled();
  });

  it('confirming deletes exactly once with the right fixture id', async () => {
    await renderPage();
    openMenuFor('Albion');
    await clickMenuDelete();

    fireEvent.click(await screen.findByRole('button', { name: /^delete match$/i }));

    await waitFor(() => expect(mocks.deleteEq).toHaveBeenCalledTimes(1));
    expect(mocks.deleteEq).toHaveBeenCalledWith('id', 'fixture-a');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('deleting A after cancelling on B targets A, not B', async () => {
    await renderPage();
    openMenuFor('Borough');
    await clickMenuDelete();
    fireEvent.click(await screen.findByRole('button', { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    openMenuFor('Albion');
    await clickMenuDelete();
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Albion');
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete match$/i }));

    await waitFor(() => expect(mocks.deleteEq).toHaveBeenCalledTimes(1));
    expect(mocks.deleteEq).toHaveBeenCalledWith('id', 'fixture-a');
  });

  it('a non-admin confirming still gets the permission error, not a false success', async () => {
    mocks.deleteCount = 0;
    await renderPage();
    openMenuFor('Albion');
    await clickMenuDelete();
    fireEvent.click(await screen.findByRole('button', { name: /^delete match$/i }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'You do not have permission to delete matches' }),
      ),
    );
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Match deleted' }));
  });
});

const clickMenuItem = async (name: RegExp) => {
  fireEvent.click(await screen.findByRole('menuitem', { name }));
};

const openEditFor = async (opponent: string) => {
  openMenuFor(opponent);
  await clickMenuItem(/edit details/i);
  return screen.findByTestId('edit-dialog');
};

const lastUpdate = () => {
  const [values, options, column, value] = mocks.update.mock.calls.at(-1)!;
  return { values, options, column, value };
};

describe('Fixtures update and cancel (BUG-044)', () => {
  // Albion has a kickoff time; Borough is kickoff TBD (stored at local midnight).
  const albionKickoff = new Date('2026-10-04T10:00:00Z');
  const boroughDate = new Date(2026, 9, 11, 0, 0, 0, 0);

  beforeEach(() => {
    mocks.update.mockReset();
    mocks.toast.mockReset();
    mocks.updateCount = 1;
    mocks.updateError = null;
    mocks.fixtures = [
      fixture('fixture-a', 'Albion', albionKickoff.toISOString()),
      { ...fixture('fixture-b', 'Borough', boroughDate.toISOString()), kickoff_time_tbd: true },
    ];
  });

  afterEach(cleanup);

  it('updating a fixture that has a kickoff time saves the new date and keeps the time', async () => {
    await renderPage();
    await openEditFor('Albion');
    fireEvent.click(screen.getByRole('button', { name: 'Stub set date' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update Fixture' }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    const expected = new Date(2026, 9, 18, albionKickoff.getHours(), albionKickoff.getMinutes());
    const { values, options, column, value } = lastUpdate();
    expect(values).toMatchObject({ scheduled_date: expected.toISOString(), kickoff_time_tbd: false });
    expect(options).toEqual({ count: 'exact' });
    expect([column, value]).toEqual(['id', 'fixture-a']);
    await waitFor(() => expect(screen.queryByTestId('edit-dialog')).not.toBeInTheDocument());
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Match updated' }));
  });

  it('updating a fixture with no kickoff time saves and does not throw', async () => {
    await renderPage();
    await openEditFor('Borough');
    expect(screen.getByTestId('edit-time')).toHaveTextContent('');
    fireEvent.click(screen.getByRole('button', { name: 'Stub set date' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update Fixture' }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(lastUpdate().values).toMatchObject({
      scheduled_date: new Date(2026, 9, 18, 0, 0, 0, 0).toISOString(),
      kickoff_time_tbd: true,
    });
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('clearing the time on a fixture that had one saves with kickoff_time_tbd true', async () => {
    await renderPage();
    await openEditFor('Albion');
    expect(screen.getByTestId('edit-time')).not.toHaveTextContent(/^$/);
    fireEvent.click(screen.getByRole('button', { name: 'Stub clear time' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update Fixture' }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    const day = new Date(albionKickoff);
    day.setHours(0, 0, 0, 0);
    expect(lastUpdate().values).toMatchObject({ scheduled_date: day.toISOString(), kickoff_time_tbd: true });
  });

  it('a thrown error surfaces a destructive toast and keeps the dialog open', async () => {
    mocks.updateError = { message: 'network down' };
    await renderPage();
    await openEditFor('Albion');
    fireEvent.click(screen.getByRole('button', { name: 'Update Fixture' }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', description: 'Failed to update match: network down' }),
      ),
    );
    expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
  });

  it('a zero-row update surfaces a permission message, not a success', async () => {
    mocks.updateCount = 0;
    await renderPage();
    await openEditFor('Albion');
    fireEvent.click(screen.getByRole('button', { name: 'Update Fixture' }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: 'Nothing was saved. You do not have permission to edit matches',
        }),
      ),
    );
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Match updated' }));
    expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
  });

  it('cancelling counts rows and reports a zero-row cancel as a permission error', async () => {
    mocks.updateCount = 0;
    await renderPage();
    openMenuFor('Albion');
    await clickMenuItem(/cancel match/i);

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(lastUpdate().options).toEqual({ count: 'exact' });
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'You do not have permission to cancel matches' }),
    );
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Match cancelled' }));
  });

  it('a failed cancel surfaces a destructive toast', async () => {
    mocks.updateError = { message: 'network down' };
    await renderPage();
    openMenuFor('Albion');
    await clickMenuItem(/cancel match/i);

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', description: 'Failed to cancel match: network down' }),
      ),
    );
  });
});
