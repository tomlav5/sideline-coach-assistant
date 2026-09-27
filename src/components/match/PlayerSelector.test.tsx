import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PlayerSelector } from './PlayerSelector';

afterEach(cleanup);

const player = (id: string, first_name: string, jersey_number?: number) => ({
  id,
  first_name,
  last_name: 'Surname',
  jersey_number,
});

function openPicker() {
  fireEvent.click(screen.getByRole('combobox'));
}

// CommandItem renders `{first_name} {last_name}` as sibling text nodes, so the
// element's combined text is "Alpha Surname", not "Alpha" — match by option
// role + name (built from that same combined text) rather than exact text.
const optionNamed = (first_name: string) =>
  screen.getByRole('option', { name: new RegExp(`^${first_name} Surname$`) });
const queryOptionNamed = (first_name: string) =>
  screen.queryByRole('option', { name: new RegExp(`^${first_name} Surname$`) });

describe('PlayerSelector', () => {
  // UX-029: on-pitch first, in tile-grid order, then a separated bench group.
  it('renders groups in order, each in the order given, under their own heading', () => {
    const onValueChange = vi.fn();
    render(
      <PlayerSelector
        groups={[
          { label: 'On pitch', players: [player('c', 'Charlie'), player('a', 'Alpha')] },
          { label: 'Bench', players: [player('b', 'Bravo')] },
        ]}
        value=""
        onValueChange={onValueChange}
      />
    );
    openPicker();

    expect(screen.getByText('On pitch')).toBeInTheDocument();
    expect(screen.getByText('Bench')).toBeInTheDocument();

    const names = screen.getAllByRole('option').map((el) => el.textContent);
    // Pitch group's own order preserved (Charlie before Alpha), and the
    // whole pitch group precedes the whole bench group.
    expect(names).toEqual([
      expect.stringContaining('Charlie'),
      expect.stringContaining('Alpha'),
      expect.stringContaining('Bravo'),
    ]);
  });

  it('keeps a bench player reachable and selectable even though they are not on the pitch', () => {
    const onValueChange = vi.fn();
    render(
      <PlayerSelector
        groups={[
          { label: 'On pitch', players: [player('a', 'Alpha')] },
          { label: 'Bench', players: [player('b', 'Bravo')] },
        ]}
        value=""
        onValueChange={onValueChange}
      />
    );
    openPicker();

    const benchSection = screen.getByText('Bench').closest('[cmdk-group]') as HTMLElement;
    fireEvent.click(within(benchSection).getByRole('option'));
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('excludes a given player id from every group entirely, not just the visible search results', () => {
    render(
      <PlayerSelector
        groups={[
          { label: 'On pitch', players: [player('a', 'Alpha'), player('c', 'Charlie')] },
          { label: 'Bench', players: [player('b', 'Bravo')] },
        ]}
        value=""
        onValueChange={vi.fn()}
        excludePlayerId="a"
      />
    );
    openPicker();

    expect(queryOptionNamed('Alpha')).not.toBeInTheDocument();
    expect(optionNamed('Charlie')).toBeInTheDocument();
    expect(optionNamed('Bravo')).toBeInTheDocument();
  });

  it('drops a group entirely (no stray heading) once its players are excluded or filtered out', () => {
    render(
      <PlayerSelector
        groups={[
          { label: 'On pitch', players: [player('a', 'Alpha')] },
          { label: 'Bench', players: [] },
        ]}
        value=""
        onValueChange={vi.fn()}
      />
    );
    openPicker();

    expect(optionNamed('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Bench')).not.toBeInTheDocument();
  });

  it('filters within each group by typed text, hiding a group with no matches', () => {
    render(
      <PlayerSelector
        groups={[
          { label: 'On pitch', players: [player('a', 'Alpha'), player('c', 'Charlie')] },
          { label: 'Bench', players: [player('b', 'Bravo')] },
        ]}
        value=""
        onValueChange={vi.fn()}
      />
    );
    openPicker();

    fireEvent.change(screen.getByPlaceholderText('Type to search...'), {
      target: { value: 'Alpha' },
    });

    expect(optionNamed('Alpha')).toBeInTheDocument();
    expect(queryOptionNamed('Charlie')).not.toBeInTheDocument();
    // No player on the bench matches "Alpha" — the whole group disappears.
    expect(screen.queryByText('Bench')).not.toBeInTheDocument();
    expect(queryOptionNamed('Bravo')).not.toBeInTheDocument();
  });

  it('clears the search box when the popover closes, so reopening starts unfiltered', () => {
    render(
      <PlayerSelector
        groups={[{ label: 'On pitch', players: [player('a', 'Alpha'), player('b', 'Bravo')] }]}
        value=""
        onValueChange={vi.fn()}
      />
    );

    openPicker();
    const input = screen.getByPlaceholderText('Type to search...');
    fireEvent.change(input, { target: { value: 'Alpha' } });
    expect(queryOptionNamed('Bravo')).not.toBeInTheDocument();

    // Close, then reopen.
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    openPicker();

    expect(screen.getByPlaceholderText('Type to search...')).toHaveValue('');
    expect(optionNamed('Bravo')).toBeInTheDocument();
  });

  it('flat `players` mode (no groups) renders no group heading, matching the legacy list', () => {
    render(
      <PlayerSelector
        players={[player('a', 'Alpha'), player('b', 'Bravo')]}
        value=""
        onValueChange={vi.fn()}
      />
    );
    openPicker();

    expect(optionNamed('Alpha')).toBeInTheDocument();
    expect(optionNamed('Bravo')).toBeInTheDocument();
    expect(screen.queryByText('On pitch')).not.toBeInTheDocument();
    expect(screen.queryByText('Bench')).not.toBeInTheDocument();
  });

  it('shows a "No assist" option ahead of every group when allowNone is set, and it stays selectable', () => {
    const onValueChange = vi.fn();
    render(
      <PlayerSelector
        groups={[{ label: 'On pitch', players: [player('a', 'Alpha')] }]}
        value="none"
        onValueChange={onValueChange}
        allowNone
      />
    );
    openPicker();

    fireEvent.click(screen.getByRole('option', { name: 'No assist' }));
    expect(onValueChange).toHaveBeenCalledWith('none');
  });
});
