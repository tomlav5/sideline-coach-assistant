import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EnhancedMatchControls } from './EnhancedMatchControls';
import type { TrackerHolder } from '@/lib/trackerGate';

// The timer hook is mocked: this test is about which controls are pressable for a
// given tracker holder, and what Start / End do about ownership — not about the timer.
// The timer functions are spies so ordering ("no start before a successful claim") is
// asserted, not assumed.
const mocks = vi.hoisted(() => ({
  timerState: {} as Record<string, unknown>,
  startNewPeriod: vi.fn(),
  endCurrentPeriod: vi.fn(),
  endMatch: vi.fn(),
  loadMatchState: vi.fn(),
  toast: vi.fn(),
  // What the "at least one starter" read returns.
  onField: [] as Array<{ player_id: string }>,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => Promise.resolve({ data: mocks.onField, error: null }) }),
      }),
    }),
  },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/useEnhancedMatchTimer', () => {
  const noop = () => {};
  return {
    useEnhancedMatchTimer: () => ({
      timerState: mocks.timerState,
      startNewPeriod: mocks.startNewPeriod,
      startPenaltyShootout: noop,
      pauseTimer: noop,
      resumeTimer: noop,
      endCurrentPeriod: mocks.endCurrentPeriod,
      endMatch: mocks.endMatch,
      getCurrentMinute: () => 0,
      getTotalMatchMinute: () => 0,
      formatTime: (s: number) => String(s),
      loadMatchState: mocks.loadMatchState,
    }),
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.onField = [{ player_id: 'p1' }];
});
afterEach(cleanup);

const openPeriod = { id: 'p1', period_number: 1, period_type: 'regular', actual_end_time: null };
const endedPeriod = { ...openPeriod, actual_end_time: '2026-09-20T10:30:00Z' };
const base = { currentTime: 90, totalMatchTime: 90 };

// One timer state per control, so every gated button is on screen in at least one case.
const states = {
  'Start Period': { ...base, periods: [], currentPeriod: undefined, isRunning: false, matchStatus: 'not_started' },
  'Pause Period': { ...base, periods: [openPeriod], currentPeriod: openPeriod, isRunning: true, matchStatus: 'in_progress' },
  'Resume Period': { ...base, periods: [openPeriod], currentPeriod: openPeriod, isRunning: false, matchStatus: 'paused' },
  'End Period': { ...base, periods: [openPeriod], currentPeriod: openPeriod, isRunning: true, matchStatus: 'in_progress' },
  'End Match': { ...base, periods: [openPeriod], currentPeriod: openPeriod, isRunning: true, matchStatus: 'in_progress' },
  'Start Penalty Shootout': { ...base, periods: [endedPeriod], currentPeriod: endedPeriod, isRunning: false, matchStatus: 'in_progress' },
} as const;

type Props = Parameters<typeof EnhancedMatchControls>[0];

// Defaults: a claim that succeeds and a fresh in-flight flag. Override per test.
const controlsProps = (over: Partial<Props> = {}): Props => ({
  fixtureId: 'fx1',
  trackerHolder: 'self',
  onClaimTracking: () => Promise.resolve(true),
  startInFlightRef: { current: false },
  ...over,
});

function renderControls(over: Partial<Props> = {}) {
  return render(<EnhancedMatchControls {...controlsProps(over)} />);
}

function renderControl(label: keyof typeof states, trackerHolder: TrackerHolder) {
  mocks.timerState = states[label];
  renderControls({ trackerHolder });
  return screen.getByRole('button', { name: new RegExp(label, 'i') });
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const controls = Object.keys(states) as Array<keyof typeof states>;

describe('EnhancedMatchControls › ownership gate', () => {
  describe.each(controls)('%s', (label) => {
    // Regression check: with active_tracker_id NULL every official must still act
    // (never claimed, or the tracker released — mirrors restart_match).
    it('is enabled for the tracker', () => {
      expect(renderControl(label, 'self')).toBeEnabled();
    });

    it('is enabled when nobody holds the match', () => {
      expect(renderControl(label, 'nobody')).toBeEnabled();
    });

    it('is disabled for a non-tracker while another user holds the match', () => {
      expect(renderControl(label, 'other')).toBeDisabled();
    });

    it('is disabled while the holder is not yet known — never enabled then disabled', () => {
      expect(renderControl(label, 'unknown')).toBeDisabled();
    });
  });

  describe('tracker-pending message', () => {
    it('is shown only while the holder is unknown', () => {
      mocks.timerState = states['Start Period'];
      const { rerender } = renderControls({ trackerHolder: 'unknown' });
      expect(screen.getByRole('status')).toHaveTextContent(/checking who is tracking/i);

      for (const holder of ['self', 'nobody', 'other'] as const) {
        rerender(<EnhancedMatchControls {...controlsProps({ trackerHolder: holder })} />);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }
    });
  });
});

describe('EnhancedMatchControls › claim on start', () => {
  const pressStart = () => fireEvent.click(screen.getByRole('button', { name: /start period/i }));

  it('does not claim just because the page rendered — nobody stays nobody until someone acts', () => {
    mocks.timerState = states['Start Period'];
    const onClaimTracking = vi.fn().mockResolvedValue(true);
    renderControls({ trackerHolder: 'nobody', onClaimTracking });

    expect(onClaimTracking).not.toHaveBeenCalled();
    expect(mocks.startNewPeriod).not.toHaveBeenCalled();
  });

  it('claims first, then starts, when nobody holds the match', async () => {
    mocks.timerState = states['Start Period'];
    const calls: string[] = [];
    const onClaimTracking = vi.fn(async () => {
      calls.push('claim');
      return true;
    });
    mocks.startNewPeriod.mockImplementation(async () => {
      calls.push('start');
    });
    renderControls({ trackerHolder: 'nobody', onClaimTracking });

    pressStart();

    await waitFor(() => expect(mocks.startNewPeriod).toHaveBeenCalledTimes(1));
    expect(calls).toEqual(['claim', 'start']);
    expect(onClaimTracking).toHaveBeenCalledTimes(1);
  });

  it('does not start while the claim is still in flight, and says it is working', async () => {
    mocks.timerState = states['Start Period'];
    const claim = deferred<boolean>();
    renderControls({ trackerHolder: 'nobody', onClaimTracking: () => claim.promise });

    pressStart();

    // Feedback while the claim round trip runs — not a button that did nothing.
    const busy = await screen.findByRole('button', { name: /starting/i });
    expect(busy).toBeDisabled();
    expect(mocks.startNewPeriod).not.toHaveBeenCalled();

    claim.resolve(true);
    await waitFor(() => expect(mocks.startNewPeriod).toHaveBeenCalledTimes(1));
  });

  it('does NOT start when the claim is refused, and tells the user nothing started', async () => {
    mocks.timerState = states['Start Period'];
    const onClaimTracking = vi.fn().mockResolvedValue(false);
    renderControls({ trackerHolder: 'nobody', onClaimTracking });

    pressStart();

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.startNewPeriod).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Period not started',
        variant: 'destructive',
        description: expect.stringMatching(/nothing was started/i),
      }),
    );
    // Not left stuck: the label and the button come back so it can be retried.
    expect(await screen.findByRole('button', { name: /start period/i })).toBeEnabled();
  });

  it('does not claim when this user already holds the match — a re-claim would reset tracking_started_at', async () => {
    mocks.timerState = states['Start Period'];
    const onClaimTracking = vi.fn().mockResolvedValue(true);
    renderControls({ trackerHolder: 'self', onClaimTracking });

    pressStart();

    await waitFor(() => expect(mocks.startNewPeriod).toHaveBeenCalledTimes(1));
    expect(onClaimTracking).not.toHaveBeenCalled();
  });

  it('with no starters set, neither claims nor starts — a start that will not proceed must not take ownership', async () => {
    mocks.timerState = states['Start Period'];
    mocks.onField = [];
    const onClaimTracking = vi.fn().mockResolvedValue(true);
    renderControls({ trackerHolder: 'nobody', onClaimTracking });

    pressStart();

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'No starters set' })),
    );
    expect(onClaimTracking).not.toHaveBeenCalled();
    expect(mocks.startNewPeriod).not.toHaveBeenCalled();
  });

  it('holds the in-flight flag from press until the start is written, then clears it', async () => {
    mocks.timerState = states['Start Period'];
    const startInFlightRef = { current: false };
    const claim = deferred<boolean>();
    const start = deferred<void>();
    mocks.startNewPeriod.mockReturnValue(start.promise);
    renderControls({ trackerHolder: 'nobody', onClaimTracking: () => claim.promise, startInFlightRef });

    pressStart();
    expect(startInFlightRef.current).toBe(true); // during the claim

    claim.resolve(true);
    await waitFor(() => expect(mocks.startNewPeriod).toHaveBeenCalled());
    expect(startInFlightRef.current).toBe(true); // still set during the period insert

    start.resolve();
    await waitFor(() => expect(startInFlightRef.current).toBe(false));
  });

  it('clears the in-flight flag when the claim is refused', async () => {
    mocks.timerState = states['Start Period'];
    const startInFlightRef = { current: false };
    renderControls({
      trackerHolder: 'nobody',
      onClaimTracking: () => Promise.resolve(false),
      startInFlightRef,
    });

    pressStart();

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    await waitFor(() => expect(startInFlightRef.current).toBe(false));
  });

  it('ignores a press while a start is already in flight — no second period insert', async () => {
    mocks.timerState = states['Start Period'];
    const onClaimTracking = vi.fn().mockResolvedValue(true);
    renderControls({
      trackerHolder: 'nobody',
      onClaimTracking,
      startInFlightRef: { current: true },
    });

    pressStart();
    await Promise.resolve();

    expect(onClaimTracking).not.toHaveBeenCalled();
    expect(mocks.startNewPeriod).not.toHaveBeenCalled();
  });

  describe('forceRefresh reload', () => {
    it('runs when control is taken normally', () => {
      mocks.timerState = states['Pause Period'];
      renderControls({ forceRefresh: true, startInFlightRef: { current: false } });
      expect(mocks.loadMatchState).toHaveBeenCalled();
    });

    it('is skipped while Start Period is claiming and writing — it must not overlap the period insert', () => {
      mocks.timerState = states['Pause Period'];
      renderControls({ forceRefresh: true, startInFlightRef: { current: true } });
      expect(mocks.loadMatchState).not.toHaveBeenCalled();
    });
  });
});

describe('EnhancedMatchControls › the confirm is gated, not just the trigger', () => {
  const openEndMatch = () => fireEvent.click(screen.getByRole('button', { name: /^end match$/i }));
  const openEndPeriod = () => fireEvent.click(screen.getByRole('button', { name: /^end period$/i }));
  const confirmEndMatch = () => fireEvent.click(screen.getByRole('button', { name: /yes, end match/i }));
  const confirmEndPeriod = () => fireEvent.click(screen.getByRole('button', { name: /yes, end period/i }));

  const expectRefusal = () =>
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/not applied/i),
        variant: 'destructive',
        description: expect.stringMatching(/not the active tracker/i),
      }),
    );

  it('control: the tracker confirming End Match ends the match', () => {
    mocks.timerState = states['End Match'];
    renderControls({ trackerHolder: 'self' });

    openEndMatch();
    confirmEndMatch();

    expect(mocks.endMatch).toHaveBeenCalledTimes(1);
  });

  it('End Match: a dialog opened while permitted, then displaced, does not end the match — it closes with an explanation', async () => {
    mocks.timerState = states['End Match'];
    const { rerender } = renderControls({ trackerHolder: 'self' });

    openEndMatch(); // permitted when opened
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    rerender(<EnhancedMatchControls {...controlsProps({ trackerHolder: 'other' })} />); // displaced
    confirmEndMatch();

    expect(mocks.endMatch).not.toHaveBeenCalled();
    expectRefusal();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('End Period: same — a displaced coach cannot confirm', async () => {
    mocks.timerState = states['End Period'];
    const { rerender } = renderControls({ trackerHolder: 'self' });

    openEndPeriod();
    rerender(<EnhancedMatchControls {...controlsProps({ trackerHolder: 'other' })} />);
    confirmEndPeriod();

    expect(mocks.endCurrentPeriod).not.toHaveBeenCalled();
    expectRefusal();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  describe('with substitutions still pending (the UX-010 guard)', () => {
    const openGuardForMatch = () => {
      openEndMatch();
      confirmEndMatch(); // → the guard dialog
    };

    it('control: the tracker discarding ends the match', async () => {
      mocks.timerState = states['End Match'];
      const onDiscardPendingSubs = vi.fn();
      renderControls({ trackerHolder: 'self', pendingSubCount: 1, onDiscardPendingSubs });

      openGuardForMatch();
      fireEvent.click(await screen.findByRole('button', { name: /discard & end match/i }));

      await waitFor(() => expect(mocks.endMatch).toHaveBeenCalledTimes(1));
      expect(onDiscardPendingSubs).toHaveBeenCalledTimes(1);
    });

    it('a guard opened while permitted, then displaced, neither submits, discards nor ends — and closes', async () => {
      mocks.timerState = states['End Match'];
      const onSubmitPendingSubs = vi.fn().mockResolvedValue(undefined);
      const onDiscardPendingSubs = vi.fn();
      const props = { pendingSubCount: 1, onSubmitPendingSubs, onDiscardPendingSubs };
      const { rerender } = renderControls({ trackerHolder: 'self', ...props });

      openGuardForMatch();
      const discard = await screen.findByRole('button', { name: /discard & end match/i });
      rerender(<EnhancedMatchControls {...controlsProps({ trackerHolder: 'other', ...props })} />);
      fireEvent.click(discard);

      expect(mocks.endMatch).not.toHaveBeenCalled();
      expect(onSubmitPendingSubs).not.toHaveBeenCalled(); // a displaced coach must not commit subs
      expect(onDiscardPendingSubs).not.toHaveBeenCalled();
      expectRefusal();
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    });

    it('ownership lost WHILE the submit is in flight: the end is refused, and the message says the subs were submitted', async () => {
      mocks.timerState = states['End Match'];
      const submit = deferred<void>();
      const onSubmitPendingSubs = vi.fn(() => submit.promise);
      const props = { pendingSubCount: 1, onSubmitPendingSubs };
      const { rerender } = renderControls({ trackerHolder: 'self', ...props });

      openGuardForMatch();
      fireEvent.click(await screen.findByRole('button', { name: /submit 1 & end match/i }));
      expect(onSubmitPendingSubs).toHaveBeenCalledTimes(1);

      // Displaced while the submit is still awaiting…
      rerender(<EnhancedMatchControls {...controlsProps({ trackerHolder: 'other', ...props })} />);
      submit.resolve();

      // …so the end must be refused at the point of action, after the await.
      await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
      expect(mocks.endMatch).not.toHaveBeenCalled();
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringMatching(/substitutions were submitted before you lost control/i),
        }),
      );
    });
  });
});
