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
    }),
  },
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/hooks/useTeams', () => ({ useTeams: () => ({ data: [], isLoading: false }) }));
vi.mock('@/hooks/useLiveMatchDetection', () => ({ useLiveMatchDetection: () => ({ data: undefined }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/fixtures/CreateFixtureDialog', () => ({ CreateFixtureDialog: () => null }));
vi.mock('@/components/fixtures/EditFixtureDialog', () => ({ EditFixtureDialog: () => null }));

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
