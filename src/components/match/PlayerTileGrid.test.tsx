import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { PlayerTileGrid } from './PlayerTileGrid';

afterEach(cleanup);

const mk = (n: number, prefix = 'p') =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    first_name: `${prefix}Name${i}`,
    last_name: 'Surname',
    jersey_number: i + 1,
  }));

describe('PlayerTileGrid', () => {
  it('shows first name and minutes played, and never a surname or shirt number', () => {
    render(
      <PlayerTileGrid
        activePlayers={mk(1, 'a')}
        benchPlayers={[]}
        getPlayerTime={() => 23}
      />
    );

    expect(screen.getByText('aName0')).toBeInTheDocument();
    expect(screen.getByText('23m')).toBeInTheDocument();
    expect(screen.queryByText(/Surname/)).not.toBeInTheDocument();
    expect(screen.queryByText(/#1|^1$/)).not.toBeInTheDocument();
  });

  it('derives the grid template columns from the combined squad size', () => {
    const { container } = render(
      <PlayerTileGrid
        activePlayers={mk(5, 'a')}
        benchPlayers={mk(6, 'b')}
        getPlayerTime={() => 0}
      />
    );

    // 11 players -> 3 columns.
    const grids = container.querySelectorAll('div.grid');
    expect(grids.length).toBe(2);
    grids.forEach((g) => {
      expect((g as HTMLElement).style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
    });
  });

  it('drops to 2 columns for a small squad', () => {
    const { container } = render(
      <PlayerTileGrid
        activePlayers={mk(3, 'a')}
        benchPlayers={[]}
        getPlayerTime={() => 0}
      />
    );

    const grid = container.querySelector('div.grid') as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
  });

  it('calls onBenchTileTap for a bench tile, and pitch tiles are not buttons without a pitch handler', () => {
    const onBenchTileTap = vi.fn();
    render(
      <PlayerTileGrid
        activePlayers={mk(1, 'a')}
        benchPlayers={mk(1, 'b')}
        getPlayerTime={() => 0}
        onBenchTileTap={onBenchTileTap}
      />
    );

    const benchSection = screen.getByText('Bench (1)').parentElement as HTMLElement;
    within(benchSection).getByRole('button').click();
    expect(onBenchTileTap).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b0', first_name: 'bName0' })
    );

    const pitchSection = screen.getByText('On field (1)').parentElement as HTMLElement;
    expect(within(pitchSection).queryByRole('button')).toBeNull();
  });

  it('makes pitch tiles tappable and marks the selected one pressed (UX-007 branch 3)', () => {
    const onPitchTileTap = vi.fn();
    render(
      <PlayerTileGrid
        activePlayers={mk(2, 'a')}
        benchPlayers={mk(1, 'b')}
        getPlayerTime={() => 0}
        onPitchTileTap={onPitchTileTap}
        selectedId="a1"
      />
    );

    const pitchSection = screen.getByText('On field (2)').parentElement as HTMLElement;
    const buttons = within(pitchSection).getAllByRole('button');
    expect(buttons).toHaveLength(2);

    buttons[0].click();
    expect(onPitchTileTap).toHaveBeenCalledWith(expect.objectContaining({ id: 'a0' }));

    // a1 is selected -> aria-pressed.
    expect(within(pitchSection).getByText('aName1').closest('button')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('locks a pending player out of selection and shows a PENDING tag instead of minutes', () => {
    const onPitchTileTap = vi.fn();
    const onBenchTileTap = vi.fn();
    render(
      <PlayerTileGrid
        activePlayers={mk(2, 'a')}
        benchPlayers={mk(1, 'b')}
        getPlayerTime={() => 12}
        onPitchTileTap={onPitchTileTap}
        onBenchTileTap={onBenchTileTap}
        pendingIds={new Set(['a0'])}
      />
    );

    // The pending tile is not a button and carries the PENDING tag.
    const pendingTile = screen.getByText('aName0').closest('div') as HTMLElement;
    expect(pendingTile.tagName).toBe('DIV');
    expect(within(pendingTile).getByText('Pending')).toBeInTheDocument();

    // Only the non-pending pitch player (a1) is still tappable.
    const pitchSection = screen.getByText('On field (2)').parentElement as HTMLElement;
    expect(within(pitchSection).getAllByRole('button')).toHaveLength(1);
  });

  it('renders no bench section when the bench is empty', () => {
    render(
      <PlayerTileGrid
        activePlayers={mk(2, 'a')}
        benchPlayers={[]}
        getPlayerTime={() => 0}
      />
    );

    expect(screen.queryByText(/^Bench/)).not.toBeInTheDocument();
  });
});
