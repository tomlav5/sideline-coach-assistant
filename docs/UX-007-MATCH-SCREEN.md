# UX-007 — Match screen rebuild

Design specification for the live match screen. Settled 5 September 2026 against an
interactive prototype; every decision below was tested by tapping it, not argued in the
abstract.

**Read this before starting any of the four branches.** It exists so a session doesn't
have to rediscover decisions that were already made, or undo one by accident.

Prototype: `claude.ai/code/artifact/682d58fa-3c9f-4f49-a12f-917c5727146d`

---

## Why this screen and not another

Every other screen in this app is used sitting down. This one is used standing on a
touchline, one-handed, in weather, with the coach's eyes mostly on the pitch and a game
running. It is the only screen where a mis-tap costs something and where two extra seconds
matter.

That is the whole design brief. Everything below follows from it.

---

## What could go wrong at a live match

Required by `CLAUDE.md` before any change touching match recording.

**A substitution is silently lost.** The new model stages substitutions rather than
committing them on tap, so nothing reaches the database until Submit. A coach who stages
three subs and pockets the phone loses all three, and — worse — the pitch on screen no
longer matches the pitch in front of them. Mitigated by a visible waiting timer, a critical
state at 60 seconds, and a **hard guard on End period and End match**. The guard is the part
that actually prevents the loss; the timer only nudges.

**Playing time is corrupted by a partial batch.** Submitting N subs writes across
`player_time_logs` and `match_events` for each pair. A failure midway leaves some players
with open intervals and others closed. Submit must be all-or-nothing, or idempotently
retryable — keep the existing `client_event_id` upsert pattern so a retry cannot duplicate
events.

**The clock lies.** `useEnhancedMatchTimer` computes elapsed time from `actual_start_time`
in Postgres, minus `total_paused_seconds`. **It must never become a JavaScript tick
counter.** That derivation is what survives iOS suspending the app in a coat pocket at half
time. This is the single most load-bearing rule in the codebase.

**Event minutes are corrupted.** `currentMinute` and `totalMatchMinute` feed
`match_events.minute_in_period` and `total_match_minute` and must remain whole minutes.
Seconds are a display concern only and must be passed alongside, never by converting the
existing values. See UX-009.

**Two coaches diverge.** A pending stack lives in one device's memory. Coach B cannot see
Coach A's staged subs, and both submitting produces conflicting state. The existing
`active_tracker_id` lock already gates recording — the pending panel and its Submit must be
disabled for anyone who is not the active tracker.

**Undo deletes the wrong row.** Established by BUG-004: delete by the id returned from the
insert, never "the most recent event". A second coach recording on another device must be
unaffectable.

**The footer covers the pitch.** New this rebuild: the bottom furniture is now
variable-height — it grows with each pending substitution. The scroll container's fixed
`pb-24` will not hold. Bottom padding must be derived from the actual footer height, or the
player grid ends up underneath it at exactly the moment a coach is trying to tap a player.

---

## Locked design decisions

### Player tiles

**First name and minutes played. Nothing else.**

No surname — these are minors, and surnames on a live screen are personal data this app
does not need to display. Revisit only with a proper data-protection review.

No shirt number — grassroots squads do not have stable numbers, kids wear whatever shirt
they are handed, so a number is an unreliable identifier week to week. The name is what the
coach actually reads.

Minutes played sits on the tile so equal-playing-time decisions are made at a glance rather
than from memory. This is also the app's most defensible feature and should be visible, not
buried in a report.

### Grid

Sizes itself from the squad count. **No format is hardcoded** — UK youth football runs 3,
5, 7, 9 and 11-a-side by age, teams flex between them for friendlies, and the app should
suit other sports later.

- 4 players or fewer → 2 columns, name at `1.2rem`
- 5 to 9 → 3 columns, name at `1.05rem`
- 10 or more → 3 columns, name at `0.95rem`

Bench tiles are the same size as pitch tiles. Deliberate: a substitution is exactly when a
coach is rushing, so the target must not shrink.

### Substitution

**Two taps, one screen, staged not committed.**

Tap a player on the pitch, tap their replacement on the bench. The pair joins a pending
stack rather than writing to the database. Both grids highlight during selection so the
next tap is obvious.

Players caught in a pending swap render with a dashed amber border and a `PENDING` tag, and
are locked out of further selection until submitted or undone — otherwise a coach could
stage the same player on and off in one batch.

**Undo peels off the newest pending pair.** Stack three, undo twice, submit the first.

**Submit commits the batch, stamped at submit time — not staging time.** A coach may prepare
a substitution and wait a few minutes for the ball to go out or the referee to allow it.
Submit time is when the change actually happened on the pitch.

**Playing time does not move while a substitution is pending.** Nothing has changed on the
pitch until Submit, so minutes must not accrue to the incoming player early.

### Goals

Commit immediately with the existing 10-second undo (BUG-004, shipped). Goals are not a
batch operation — nobody stacks three goals and reviews them. Tapping GOAL arms the grid
("Who scored?"), then tapping a player records it. Same two-tap rhythm as a substitution,
no dialog.

### Alerting on unsubmitted work

The pending panel shows how long the oldest pending substitution has been waiting.

At **60 seconds** it goes critical: the panel turns deep red, the label reads
`NOT SUBMITTED`, and the panel breathes on a 1.6-second cycle.

**The Submit button stays amber and does not move.** You are asking someone under pressure
to hit a specific target — recolouring or relocating it at the moment of urgency is exactly
wrong. The button gains a soft amber halo so it lifts off the red instead.

**No flashing.** Anything faster than three flashes per second is a seizure risk and fails
WCAG. A slow breathe reads as serious; a strobe reads as broken and gets filtered out within
minutes. Both animations respect `prefers-reduced-motion` and fall back to a static glow.

Push notifications are **not** required here and must not be introduced. The app is open in
the coach's hand during a match — the panel only has to get louder. Notifications remain
PWA-003, after the season.

### Nothing floats

No modals, no floating cards, no dialogs over the pitch (UX-006). Undo attaches to the thing
it undoes. The event history is a pull-up sheet, not an overlay that appears unbidden.

### Clocks

Both are visible in the header: period elapsed large, total match time small beneath it.
Both tick seconds (UX-009).

---

## Palette addition

Floodlight gains one **semantic critical** colour. It is not a second accent and must never
be used decoratively or for branding — only when something is about to be lost.

| Token | Hex | Use |
|---|---|---|
| `--red` | `#E5484D` | Critical borders, accents on the critical state |
| `--red-deep` | `#B4232C` | Critical panel ground; white text reads at 6.5:1 |

Signal Amber continues to mean *this is the action* everywhere in the app. Record this
addition in `docs/brand/BRAND.md`.

---

## The four branches

Each is independently testable and mergeable. If the weekend runs out after two, two
improvements have shipped rather than a half-built branch sitting unmerged.

### Branch 1 — Header and clocks
`feat/match-header-clocks`

Rebuild `FixedMatchHeader` in Floodlight: team names, score, period clock large, match clock
small. Fix UX-009 by passing second-level values from `timerState.currentTime` and
`timerState.totalMatchTime` **alongside** the existing minute values, not instead of them.

Do not touch: the timer's derivation, `handleTimerUpdate`'s minute arguments, or anything
writing to `match_events`.

### Branch 2 — Player tiles and adaptive grid
`feat/match-player-tiles`

Replace the active-player list and substitutes bench with the tile grid. First name and
minutes only. Column count and name size derived from squad length. Blue for on-pitch, card
white for bench.

Do not touch: substitution logic. Tiles keep their current behaviour in this branch — the
staging model arrives in branch 3.

### Branch 3 — Staged substitutions
`feat/match-staged-subs`

The pending stack, peel-back undo, Submit, the waiting timer and critical state, and the
**End period / End match guard**.

**Scope narrowed 6 September 2026.** Undo operates on the **pending stack only** — it pops
the newest staged pair before anything has been written. Reversing an already-*submitted*
substitution is deliberately out of scope: the staging model catches the mis-tap before it
reaches the database, which is the case that actually happens on a touchline, and undoing a
committed swap across `player_time_logs` and `match_events` is both the riskiest code in
this rebuild and redundant once staging exists. Correcting a submitted substitution belongs
in the post-match editor, not on the touchline.

Submit reuses the existing write sequence in the substitution dialog's `onConfirm` handler,
which already accepts an array of pairs — it is moved or extracted, not reimplemented.

The largest and riskiest branch. Read the risk section above again before starting.

### Branch 4 — History sheet
`feat/match-history-sheet`

Collapse the stacked event cards into a pull-up sheet. Move the goal undo out of its
floating card and onto the last event row (UX-006). Fix the variable-height footer padding.

---

## What must not change

1. The match timer stays derived from `actual_start_time` in Postgres. Never a JS counter.
2. `minute_in_period` and `total_match_minute` stay whole minutes.
3. Undo deletes by the id returned from its own insert.
4. `client_event_id` upserts stay, so retries cannot duplicate events.
5. Recording stays gated on `active_tracker_id`.
6. Surnames stay off the live match screen.
