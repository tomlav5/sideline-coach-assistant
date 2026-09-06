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

  it('calls onBenchTileTap for a bench tile, and pitch tiles are not buttons', () => {
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
