import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QuickGoalButton } from './QuickGoalButton';

// useIsMobile() calls window.matchMedia, which jsdom does not implement.
// This test env also has no `localStorage` global at all — not specific to
// this component — so it's polyfilled here to prove the removed
// recentScorers mechanism (UX-029) really is gone: without a working
// `localStorage.setItem`, a test asserting "still has whatever was there
// before" would trivially pass even if the component still wrote to it.
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

  let store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: () => null,
    get length() {
      return Object.keys(store).length;
    },
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const player = (id: string, first_name: string) => ({ id, first_name, last_name: 'Surname' });

const buttonNamed = (first_name: string) =>
  screen.getByRole('button', { name: new RegExp(`^${first_name} Surname$`) });
const queryButtonNamed = (first_name: string) =>
  screen.queryByRole('button', { name: new RegExp(`^${first_name} Surname$`) });

function renderDialog(overrides: Partial<Parameters<typeof QuickGoalButton>[0]> = {}) {
  const onGoalScored = vi.fn().mockResolvedValue(undefined);
  render(
    <QuickGoalButton
      pitchPlayers={[player('a', 'Alpha')]}
      benchPlayers={[player('b', 'Bravo')]}
      onGoalScored={onGoalScored}
      open
      onOpenChange={vi.fn()}
      {...overrides}
    />
  );
  return { onGoalScored };
}

describe('QuickGoalButton', () => {
  // UX-029/UX-036: this is the dialog the match screen's primary "Goal"
  // button actually opens. It's an inline list, not a combobox — see
  // PlayerPickerList — because a popover trigger cost an extra tap and put a
  // second amber-adjacent control next to the Goal button.
  it('renders the scorer picker as a plain list, not a combobox', () => {
    renderDialog();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('player names are queryable as buttons without opening anything first', () => {
    renderDialog();
    expect(buttonNamed('Alpha')).toBeInTheDocument();
    expect(buttonNamed('Bravo')).toBeInTheDocument();
  });

  it('no longer reads or writes the removed recentScorers localStorage key', () => {
    localStorage.setItem('sideline-recent-scorers', JSON.stringify(['a']));
    const { onGoalScored } = renderDialog();

    // The old "Recent Scorers (Quick Tap)" and "All Players" sections are gone.
    expect(screen.queryByText(/Recent Scorers/)).not.toBeInTheDocument();
    expect(screen.queryByText('All Players')).not.toBeInTheDocument();

    fireEvent.click(buttonNamed('Alpha'));
    fireEvent.click(screen.getByRole('button', { name: 'No Assist' }));

    expect(onGoalScored).toHaveBeenCalledWith('a', true, undefined, false);
    // Untouched — still exactly what was there before.
    expect(localStorage.getItem('sideline-recent-scorers')).toBe(JSON.stringify(['a']));
  });

  it('shows on-pitch players first, then a separated bench group, in the scorer picker', () => {
    renderDialog({
      pitchPlayers: [player('c', 'Charlie'), player('a', 'Alpha')],
      benchPlayers: [player('b', 'Bravo')],
    });

    expect(screen.getByText('On pitch')).toBeInTheDocument();
    expect(screen.getByText('Bench')).toBeInTheDocument();
  });

  it('a bench player is a reachable scorer, not just the pitch', () => {
    renderDialog();

    fireEvent.click(buttonNamed('Bravo'));

    // Moved on to the assist step, so the scorer pick was accepted.
    expect(screen.getByText('Who Assisted?')).toBeInTheDocument();
  });

  it("the assist step renders both 'On pitch' and 'Bench' headings", () => {
    // Two pitch players: after the scorer is excluded, the On-pitch group
    // still has someone left in it, so its heading has something to head.
    renderDialog({
      pitchPlayers: [player('a', 'Alpha'), player('c', 'Charlie')],
      benchPlayers: [player('b', 'Bravo')],
    });

    fireEvent.click(buttonNamed('Alpha'));

    expect(screen.getByText('On pitch')).toBeInTheDocument();
    expect(screen.getByText('Bench')).toBeInTheDocument();
  });

  it("'No Assist' is present in the assist step", () => {
    renderDialog();
    fireEvent.click(buttonNamed('Alpha'));
    expect(screen.getByRole('button', { name: 'No Assist' })).toBeInTheDocument();
  });

  it('excludes the selected scorer from the assist list entirely, which still includes the bench', () => {
    renderDialog({
      pitchPlayers: [player('a', 'Alpha')],
      benchPlayers: [player('b', 'Bravo'), player('c', 'Charlie')],
    });

    fireEvent.click(buttonNamed('Alpha'));

    expect(queryButtonNamed('Alpha')).not.toBeInTheDocument();
    expect(buttonNamed('Bravo')).toBeInTheDocument();
    expect(buttonNamed('Charlie')).toBeInTheDocument();
  });

  it('records the goal with the chosen assist player', () => {
    const { onGoalScored } = renderDialog({
      pitchPlayers: [player('a', 'Alpha')],
      benchPlayers: [player('b', 'Bravo')],
    });

    fireEvent.click(buttonNamed('Alpha'));
    fireEvent.click(buttonNamed('Bravo'));

    expect(onGoalScored).toHaveBeenCalledWith('a', true, 'b', false);
  });
});

// UX-042: own goals. The ordinary path (Goal → scorer → assist) must be
// untouched when the box isn't ticked — the tests above assert it is still
// called with exactly the four arguments it always was.
describe('QuickGoalButton own goal', () => {
  const ownGoalBox = () => screen.getByRole('checkbox', { name: 'Own goal' });
  const penaltyBox = () => screen.getByRole('checkbox', { name: 'Penalty Kick' });

  it('is unticked by default, and an ordinary goal is recorded exactly as before', () => {
    const { onGoalScored } = renderDialog();

    expect(ownGoalBox()).not.toBeChecked();
    fireEvent.click(buttonNamed('Alpha'));
    fireEvent.click(screen.getByRole('button', { name: 'No Assist' }));

    expect(onGoalScored).toHaveBeenCalledTimes(1);
    expect(onGoalScored.mock.calls[0]).toEqual(['a', true, undefined, false]);
  });

  it('for our team: hides the scorer picker, skips the assist step and credits nobody', () => {
    const { onGoalScored } = renderDialog();

    fireEvent.click(ownGoalBox());

    expect(queryButtonNamed('Alpha')).not.toBeInTheDocument();
    expect(queryButtonNamed('Bravo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirm Own Goal/ }));

    expect(screen.queryByText('Who Assisted?')).not.toBeInTheDocument();
    expect(onGoalScored).toHaveBeenCalledWith('', true, undefined, false, true);
  });

  it('for the opposition: records an own goal that counts for them', () => {
    const { onGoalScored } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Opponent Goal' }));
    fireEvent.click(ownGoalBox());
    fireEvent.click(screen.getByRole('button', { name: /Confirm Own Goal/ }));

    expect(onGoalScored).toHaveBeenCalledWith('', false, undefined, false, true);
  });

  it('unticks and disables Penalty when ticked, and never sends both', () => {
    const { onGoalScored } = renderDialog();

    fireEvent.click(penaltyBox());
    expect(penaltyBox()).toBeChecked();

    fireEvent.click(ownGoalBox());
    expect(penaltyBox()).not.toBeChecked();
    expect(penaltyBox()).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Confirm Own Goal/ }));
    expect(onGoalScored).toHaveBeenCalledWith('', true, undefined, false, true);
  });

  it('unticking Own goal brings the scorer picker back', () => {
    renderDialog();

    fireEvent.click(ownGoalBox());
    fireEvent.click(ownGoalBox());

    expect(buttonNamed('Alpha')).toBeInTheDocument();
    expect(penaltyBox()).not.toBeDisabled();
  });
});

// A failed goal write must not close the dialog or lose what the coach picked —
// the parent shows a "Goal not recorded" toast and re-throws, and the coach
// retries from exactly where they were.
describe('QuickGoalButton when recording fails', () => {
  const failing = () => vi.fn().mockRejectedValueOnce(new Error('insert failed')).mockResolvedValue(undefined);

  it('stays open on the assist step with the scorer kept, and a retry sends the same goal', async () => {
    const onGoalScored = failing();
    const onOpenChange = vi.fn();
    renderDialog({ onGoalScored, onOpenChange });

    fireEvent.click(buttonNamed('Alpha'));
    fireEvent.click(buttonNamed('Bravo'));
    await waitFor(() => expect(onGoalScored).toHaveBeenCalledTimes(1));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText('Who Assisted?')).toBeInTheDocument();
    await waitFor(() => expect(buttonNamed('Bravo')).not.toBeDisabled());

    fireEvent.click(buttonNamed('Bravo'));
    await waitFor(() => expect(onGoalScored).toHaveBeenCalledTimes(2));
    expect(onGoalScored.mock.calls[1]).toEqual(onGoalScored.mock.calls[0]);
    expect(onGoalScored.mock.calls[1]).toEqual(['a', true, 'b', false]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps an own goal ticked after a failure, and a retry sends the same own goal', async () => {
    const onGoalScored = failing();
    const onOpenChange = vi.fn();
    renderDialog({ onGoalScored, onOpenChange });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Own goal' }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm Own Goal/ }));
    await waitFor(() => expect(onGoalScored).toHaveBeenCalledTimes(1));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Own goal' })).toBeChecked();
    const confirm = screen.getByRole('button', { name: /Confirm Own Goal/ });
    await waitFor(() => expect(confirm).not.toBeDisabled());

    fireEvent.click(confirm);
    await waitFor(() => expect(onGoalScored).toHaveBeenCalledTimes(2));
    expect(onGoalScored.mock.calls[1]).toEqual(['', true, undefined, false, true]);
  });

  it('keeps an opponent goal and its penalty tick after a failure', async () => {
    const onGoalScored = failing();
    const onOpenChange = vi.fn();
    renderDialog({ onGoalScored, onOpenChange });

    fireEvent.click(screen.getByRole('button', { name: 'Opponent Goal' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Penalty Kick' }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm Opponent Goal/ }));
    await waitFor(() => expect(onGoalScored).toHaveBeenCalledTimes(1));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Penalty Kick' })).toBeChecked();
    expect(screen.getByRole('button', { name: /Confirm Opponent Goal/ })).toBeInTheDocument();
  });

  it('a successful goal still closes the dialog', async () => {
    const onOpenChange = vi.fn();
    const { onGoalScored } = renderDialog({ onOpenChange });

    fireEvent.click(buttonNamed('Alpha'));
    fireEvent.click(screen.getByRole('button', { name: 'No Assist' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onGoalScored).toHaveBeenCalledTimes(1);
  });
});

