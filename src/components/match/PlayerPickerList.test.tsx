import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PlayerPickerList } from './PlayerPickerList';

afterEach(cleanup);

const player = (id: string, first_name: string, jersey_number?: number) => ({
  id,
  first_name,
  last_name: 'Surname',
  jersey_number,
});

const buttonNamed = (first_name: string) =>
  screen.getByRole('button', { name: new RegExp(`^${first_name} Surname$`) });
const queryButtonNamed = (first_name: string) =>
  screen.queryByRole('button', { name: new RegExp(`^${first_name} Surname$`) });

describe('PlayerPickerList', () => {
  it('renders no combobox or popover — a plain, always-visible list', () => {
    render(
      <PlayerPickerList
        groups={[{ label: 'On pitch', players: [player('a', 'Alpha')] }]}
        onSelect={vi.fn()}
        searchValue=""
        onSearchChange={vi.fn()}
      />
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(buttonNamed('Alpha')).toBeInTheDocument();
  });

  it('renders groups in order, each in the order given, under their own heading', () => {
    render(
      <PlayerPickerList
        groups={[
          { label: 'On pitch', players: [player('c', 'Charlie'), player('a', 'Alpha')] },
          { label: 'Bench', players: [player('b', 'Bravo')] },
        ]}
        onSelect={vi.fn()}
        searchValue=""
        onSearchChange={vi.fn()}
      />
    );

    expect(screen.getByText('On pitch')).toBeInTheDocument();
    expect(screen.getByText('Bench')).toBeInTheDocument();

    const names = screen.getAllByRole('button').map((el) => el.textContent);
    expect(names).toEqual([
      expect.stringContaining('Charlie'),
      expect.stringContaining('Alpha'),
      expect.stringContaining('Bravo'),
    ]);
  });

  it('calls onSelect with the tapped player id', () => {
    const onSelect = vi.fn();
    render(
      <PlayerPickerList
        groups={[{ label: 'Bench', players: [player('b', 'Bravo')] }]}
        onSelect={onSelect}
        searchValue=""
        onSearchChange={vi.fn()}
      />
    );

    fireEvent.click(buttonNamed('Bravo'));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  // UX-038: a group left with zero players after the search filter is
  // dropped entirely — no heading with nothing under it.
  it('renders no heading for a group with zero visible players after filtering', () => {
    render(
      <PlayerPickerList
        groups={[
          { label: 'On pitch', players: [player('a', 'Alpha')] },
          { label: 'Bench', players: [player('b', 'Bravo')] },
        ]}
        onSelect={vi.fn()}
        searchValue="Alpha"
        onSearchChange={vi.fn()}
      />
    );

    expect(screen.getByText('On pitch')).toBeInTheDocument();
    expect(buttonNamed('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Bench')).not.toBeInTheDocument();
    expect(queryButtonNamed('Bravo')).not.toBeInTheDocument();
  });

  it('renders emptyMessage instead of the groups when every group is empty', () => {
    render(
      <PlayerPickerList
        groups={[
          { label: 'On pitch', players: [player('a', 'Alpha')] },
          { label: 'Bench', players: [player('b', 'Bravo')] },
        ]}
        onSelect={vi.fn()}
        searchValue="nobody-matches-this"
        onSearchChange={vi.fn()}
        emptyMessage="No players found"
      />
    );

    expect(screen.getByText('No players found')).toBeInTheDocument();
    expect(screen.queryByText('On pitch')).not.toBeInTheDocument();
    expect(screen.queryByText('Bench')).not.toBeInTheDocument();
    expect(queryButtonNamed('Alpha')).not.toBeInTheDocument();
  });

  it('renders leadingAction above the groups and keeps it visible even when every group is empty', () => {
    const onSelect = vi.fn();
    render(
      <PlayerPickerList
        groups={[{ label: 'On pitch', players: [player('a', 'Alpha')] }]}
        onSelect={vi.fn()}
        searchValue="nobody-matches-this"
        onSearchChange={vi.fn()}
        leadingAction={{ label: 'No Assist', onSelect }}
      />
    );

    const action = screen.getByRole('button', { name: 'No Assist' });
    expect(action).toBeInTheDocument();
    fireEvent.click(action);
    expect(onSelect).toHaveBeenCalled();
  });

  it('filters by name or jersey number, case-insensitively, within each group', () => {
    render(
      <PlayerPickerList
        groups={[
          { label: 'On pitch', players: [player('a', 'Alpha', 7), player('c', 'Charlie', 9)] },
        ]}
        onSelect={vi.fn()}
        searchValue="alph"
        onSearchChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Alpha Surname/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Charlie Surname/ })).not.toBeInTheDocument();
  });

  it('disables every player button and the leading action when disabled', () => {
    render(
      <PlayerPickerList
        groups={[{ label: 'On pitch', players: [player('a', 'Alpha')] }]}
        onSelect={vi.fn()}
        searchValue=""
        onSearchChange={vi.fn()}
        leadingAction={{ label: 'No Assist', onSelect: vi.fn() }}
        disabled
      />
    );

    expect(buttonNamed('Alpha')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'No Assist' })).toBeDisabled();
  });

  it('the search input is bound to the parent-owned searchValue/onSearchChange', () => {
    const onSearchChange = vi.fn();
    render(
      <PlayerPickerList
        groups={[{ label: 'On pitch', players: [player('a', 'Alpha')] }]}
        onSelect={vi.fn()}
        searchValue="al"
        onSearchChange={onSearchChange}
      />
    );

    const input = screen.getByPlaceholderText('Search player name or number...');
    expect(input).toHaveValue('al');
    fireEvent.change(input, { target: { value: 'alp' } });
    expect(onSearchChange).toHaveBeenCalledWith('alp');
  });

  it('renders no jersey badge for a player without a jersey number', () => {
    render(
      <PlayerPickerList
        groups={[{ label: 'On pitch', players: [player('a', 'Alpha')] }]}
        onSelect={vi.fn()}
        searchValue=""
        onSearchChange={vi.fn()}
      />
    );

    expect(within(buttonNamed('Alpha')).queryByText(/^#/)).not.toBeInTheDocument();
  });
});
