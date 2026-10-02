import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PeriodsTable } from './PeriodsTable';

// BUG-043: the Add dialog must be mounted whether or not any periods exist —
// it used to live only in the table branch, so "Add First Period" did nothing.
const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: (row: unknown) => {
        mocks.insert(row);
        return Promise.resolve({ error: null });
      },
    }),
  },
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

afterEach(cleanup);

const period = (n: number) => ({
  id: `p${n}`,
  period_number: n,
  period_type: 'period',
  planned_duration_minutes: 25,
  is_active: false,
});

const props = { fixtureId: 'fixture-1', onUpdate: () => {}, onHasChanges: () => {} };

const submitDialog = () =>
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add Period' }));

describe('PeriodsTable Add dialog (BUG-043)', () => {
  beforeEach(() => {
    mocks.insert.mockReset();
    mocks.toast.mockReset();
  });

  it('opens from "Add First Period" when there are no periods', () => {
    render(<PeriodsTable periods={[]} {...props} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add first period/i }));

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByText('Add Match Period')).toBeInTheDocument();
  });

  it('opens from "Add Period" when periods exist', () => {
    render(<PeriodsTable periods={[period(1)]} {...props} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add period/i }));

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByText('Add Match Period')).toBeInTheDocument();
  });

  it('inserts period_number 1 for the first period', async () => {
    render(<PeriodsTable periods={[]} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /add first period/i }));
    submitDialog();

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1));
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ fixture_id: 'fixture-1', period_number: 1 }),
    );
  });

  it('inserts period_number 2 when one period exists', async () => {
    render(<PeriodsTable periods={[period(1)]} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /add period/i }));
    submitDialog();

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1));
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ fixture_id: 'fixture-1', period_number: 2 }),
    );
  });

  it('still opens after going back to zero periods', () => {
    const { rerender } = render(<PeriodsTable periods={[period(1)]} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /add period/i }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<PeriodsTable periods={[]} {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /add first period/i }));

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});
