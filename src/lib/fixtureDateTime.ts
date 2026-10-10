/**
 * Combines a fixture's date with its optional kickoff time — the "HH:mm" value
 * of an `<input type="time">`, or '' when the kickoff is TBD.
 *
 * An empty time is a supported state (the field is labelled Optional, and the
 * row stores `kickoff_time_tbd: true`). It resolves to local midnight on the
 * chosen date — the default `createFixture` has always used.
 *
 * BUG-044: `updateFixture` used to split and parseInt an empty time, so
 * `setHours(NaN, NaN)` produced an Invalid Date and `toISOString()` threw.
 * A malformed non-empty time throws a readable error rather than ever reaching
 * `setHours` with NaN.
 */
export function combineFixtureDateTime(date: Date, time: string): Date {
  const combined = new Date(date);

  if (!time) {
    combined.setHours(0, 0, 0, 0);
    return combined;
  }

  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  const hours = match ? Number(match[1]) : NaN;
  const minutes = match ? Number(match[2]) : NaN;
  if (!match || hours > 23 || minutes > 59) {
    throw new Error(`Invalid kickoff time "${time}"`);
  }

  combined.setHours(hours, minutes, 0, 0);
  return combined;
}
