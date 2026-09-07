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
        critical={false}
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
        critical={false}
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
        critical
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
        critical={false}
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
        critical={false}
        onUndoLast={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByRole('button', { name: 'Undo last' })).toBeDisabled();
  });
});
