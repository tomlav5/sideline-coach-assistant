import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { PendingSubsPanel } from './PendingSubsPanel';
import type { PendingPair } from '@/lib/pendingSubs';

afterEach(cleanup);

const pair = (id: string, outId: string, inId: string): PendingPair => ({
  id,
  outId,
  inId,
  stagedAt: 0,
  offEventId: `off-${id}`,
  onEventId: `on-${id}`,
});

const names: Record<string, string> = { A: 'Milo', B: 'Sam', X: 'Kai', Y: 'Jo' };
const nameFor = (id: string) => names[id] ?? '';

describe('PendingSubsPanel', () => {
  it('renders nothing when there are no pending pairs', () => {
    const { container } = render(
      <PendingSubsPanel
        pairs={[]}
        nameFor={nameFor}
        waitedSeconds={0}
        tone="pending"
        onUndoLast={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders exactly one row per counted pair and the header count agrees (DEFECT 4)', () => {
    render(
      <PendingSubsPanel
        pairs={[pair('p1', 'A', 'X'), pair('p2', 'B', 'Y')]}
        nameFor={nameFor}
        waitedSeconds={12}
        tone="pending"
        onUndoLast={() => {}}
      />,
    );

    expect(screen.getByText('2 subs pending')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    // Newest first.
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]).getByText('Jo')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Sam')).toBeInTheDocument();
  });

  it('shows the count in the critical state too, alongside "Not submitted"', () => {
    render(
      <PendingSubsPanel
        pairs={[pair('p1', 'A', 'X')]}
        nameFor={nameFor}
        waitedSeconds={75}
        tone="critical"
        onUndoLast={() => {}}
      />,
    );
    expect(screen.getByText('Not submitted · 1 sub')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('renders an unresolvable name as "Unknown", never as an empty row', () => {
    render(
      <PendingSubsPanel
        pairs={[pair('p1', 'GHOST', 'X')]}
        nameFor={nameFor}
        waitedSeconds={3}
        tone="pending"
        onUndoLast={() => {}}
      />,
    );

    const row = screen.getByRole('listitem');
    expect(within(row).getByText('Kai')).toBeInTheDocument();
    expect(within(row).getByText('Unknown')).toBeInTheDocument();
    expect(row.textContent).toContain('Kai on · Unknown off');
  });

  it('disables "Undo last" when the panel is inert', () => {
    render(
      <PendingSubsPanel
        pairs={[pair('p1', 'A', 'X')]}
        nameFor={nameFor}
        waitedSeconds={0}
        tone="pending"
        onUndoLast={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByRole('button', { name: 'Undo last' })).toBeDisabled();
  });

  describe('three distinct states (UX-043)', () => {
    const renderTone = (tone: 'pending' | 'break' | 'critical') =>
      render(
        <PendingSubsPanel
          pairs={[pair('p1', 'A', 'X'), pair('p2', 'B', 'Y'), pair('p3', 'A', 'Y')]}
          nameFor={nameFor}
          waitedSeconds={83}
          tone={tone}
          onUndoLast={() => {}}
        />,
      );

    it('pending: amber count and the waiting clock, no breathe', () => {
      const { container } = renderTone('pending');
      expect(screen.getByText('3 subs pending')).toBeInTheDocument();
      expect(screen.getByText('waiting 1:23')).toBeInTheDocument();
      expect(container.querySelector('.pending-critical-breathe')).toBeNull();
    });

    it('break: calm "ready" copy, no waiting clock, no red, no breathe', () => {
      const { container } = renderTone('break');
      expect(screen.getByText('3 subs ready')).toBeInTheDocument();
      expect(screen.getByText('on at Start Period')).toBeInTheDocument();
      expect(screen.queryByText(/waiting/)).toBeNull();
      expect(screen.queryByText(/Not submitted/)).toBeNull();
      expect(container.querySelector('.pending-critical-breathe')).toBeNull();
      expect((container.firstChild as HTMLElement).style.backgroundColor).not.toBe('rgb(180, 35, 44)');
      // Undo is unchanged in every state.
      expect(screen.getByRole('button', { name: 'Undo last' })).toBeEnabled();
    });

    it('critical: Red-deep, breathing, "Not submitted", clock still shown', () => {
      const { container } = renderTone('critical');
      expect(screen.getByText('Not submitted · 3 subs')).toBeInTheDocument();
      expect(screen.getByText('waiting 1:23')).toBeInTheDocument();
      const root = container.firstChild as HTMLElement;
      expect(root).toHaveClass('pending-critical-breathe');
      expect(root.style.backgroundColor).toBe('rgb(180, 35, 44)');
    });
  });
});
