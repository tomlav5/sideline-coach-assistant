import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LiveEventsSummary } from './LiveEventsSummary';

afterEach(cleanup);

const players = [
  { id: 'milo', first_name: 'Milo', last_name: 'Adams' },
  { id: 'kai', first_name: 'Kai', last_name: 'Brown' },
  { id: 'sam', first_name: 'Sam', last_name: 'Clark' },
];

const baseEvent = {
  period_id: 'p1',
  minute_in_period: 20,
  total_match_minute: 20,
  is_our_team: true,
};

describe('LiveEventsSummary', () => {
  it('shows a substitution as one row pairing the on and off players (FIX 5)', () => {
    const events = [
      {
        ...baseEvent,
        id: 'e-off',
        event_type: 'substitution_off',
        player_id: 'milo', // player coming OFF is on player_id, not assist_player_id
      },
      {
        ...baseEvent,
        id: 'e-on',
        event_type: 'substitution_on',
        player_id: 'kai',
      },
    ];

    render(<LiveEventsSummary events={events} players={players} />);

    const rows = screen.getAllByText((_, el) => el?.classList.contains('rounded-md') ?? false);
    // Exactly one card for the pair — not two, not a blank one.
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Kai Brown on');
    expect(rows[0].textContent).toContain('Milo Adams off');
  });

  it('does not render an empty card for a lone substitution_on', () => {
    const events = [
      { ...baseEvent, id: 'e-on', event_type: 'substitution_on', player_id: 'sam' },
    ];

    render(<LiveEventsSummary events={events} players={players} />);

    const rows = screen.getAllByText((_, el) => el?.classList.contains('rounded-md') ?? false);
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Sam Clark on');
  });

  it('still renders goals normally', () => {
    const events = [
      {
        ...baseEvent,
        id: 'g1',
        event_type: 'goal',
        player_id: 'milo',
        players: { id: 'milo', first_name: 'Milo', last_name: 'Adams' },
      },
    ];

    render(<LiveEventsSummary events={events} players={players} />);
    expect(screen.getByText('Milo Adams')).toBeInTheDocument();
  });

  it('keeps an off/on pair together across the 5-item cut-off', () => {
    // 4 goals then a sub pair: the pair must not be split — the "on" row must
    // still carry its "off" partner.
    const events = [
      ...[1, 2, 3, 4].map((n) => ({
        ...baseEvent,
        id: `g${n}`,
        total_match_minute: n,
        event_type: 'goal',
        player_id: 'sam',
        players: { id: 'sam', first_name: 'Sam', last_name: 'Clark' },
      })),
      { ...baseEvent, id: 'off', total_match_minute: 30, event_type: 'substitution_off', player_id: 'milo' },
      { ...baseEvent, id: 'on', total_match_minute: 30, event_type: 'substitution_on', player_id: 'kai' },
    ];

    render(<LiveEventsSummary events={events} players={players} />);
    const subRow = screen
      .getAllByText((_, el) => el?.classList.contains('rounded-md') ?? false)
      .find((el) => el.textContent?.includes('Substitution'));
    expect(subRow?.textContent).toContain('Kai Brown on');
    expect(subRow?.textContent).toContain('Milo Adams off');
  });
});
