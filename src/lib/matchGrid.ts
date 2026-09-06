/**
 * Player-tile grid sizing for the live match screen (UX-007 branch 2).
 *
 * Column count and first-name size are derived from the whole match-day squad, never
 * from an assumed format: UK youth football runs 3, 5, 7, 9 and 11-a-side by age and
 * teams flex between them for friendlies, so nothing here hardcodes a team size.
 */
export interface GridSize {
  columns: number;
  /** Font size for the player's first name, in rem. */
  nameRem: number;
}

export function gridSizeForSquad(squadCount: number): GridSize {
  if (squadCount <= 4) return { columns: 2, nameRem: 1.2 };
  if (squadCount <= 9) return { columns: 3, nameRem: 1.05 };
  return { columns: 3, nameRem: 0.95 };
}
