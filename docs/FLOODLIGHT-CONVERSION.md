# Floodlight conversion plan (DESIGN-002 phase two)

**Audited:** 11 Oct 2026, against the working tree at `a4936aa` (UX-043, #128).
**Supersedes:** the 27 Sep 2026 completion audit, which only ever existed as a chat
report and has been lost.

Phase one (11 Sep) put the Floodlight palette into `src/index.css`'s shadcn tokens.
Phase two routes every component that still hard-codes a colour through those tokens.
This file is the plan for phase two. Re-run the counts in [How to re-count](#how-to-re-count)
whenever a slice lands, and update the tables here rather than in `docs/BACKLOG.md`.

Palette names and hex values throughout are from `docs/brand/BRAND.md`. Where a colour
is in use that BRAND.md does not name, it is flagged as such rather than given a name.

---

## 1. Current state

| Kind | Sites | Notes |
|---|---:|---|
| Tailwind colour utilities | **189** | `text-` `bg-` `border-` `ring-` `ring-offset-` and gradient `from-` `via-` `to-`. Each utility counts once, so `bg-green-50 dark:bg-green-950` is two. Spread over 94 distinct lines. |
| Hex / rgba literals in TSX | **62** | 47 are the values inside local colour constants; 15 are written straight into `style={{…}}`. |
| Local colour-constant references | **101** | Uses of `FLOODLIGHT.*`, `AMBER`, `NAVY`, `RED`, `RED_DEEP` and `INFO_*` across 10 match-screen components. Spread over 64 distinct lines. |
| **Total** | **352** | |

**Excluded from the count, deliberately:**

- `src/components/ui/{dialog,sheet,drawer,alert-dialog}.tsx`. Their `bg-black/80` is the
  vendored shadcn modal scrim (4 sites). A scrim is not palette.
- `src/components/layout/EnvironmentBanner.tsx`. Its 6 hex values are the deployment
  signal: red for production, blue for staging, amber for local. They must not follow
  the theme or the brand, because the whole point is that they look alarming and are
  never confused with app UI.
- Test files (`*.test.ts(x)`, 7 sites). They assert colours and follow whatever the
  components do.

`src/components/ui/toast.tsx` **is** counted (4 sites). Its destructive variant
hard-codes `red-300/50/400/600`, and it is the one global component with colour debt.

### Does "~183 live sites" still hold?

**No, and it was never a total.** The 27 Sep audit reported "291 Tailwind sites (live or
dead) + ~49 hex/rgba + ~65 local-constant usages, ~294 in total". Those three numbers add
up to ~405, not ~294. The ~183 figure came from subtracting the 111 dead-code sites from
~294. It lines up with the **Tailwind component on its own** (291 − 111 = 180), not with
all three kinds together.

Like for like:

| Kind | 27 Sep (live) | 11 Oct | Moved |
|---|---:|---:|---:|
| Tailwind utilities | ~180 | 189 | +9 |
| Hex / rgba | ~49 | 62 | +13 |
| Local-constant refs | ~65 (counted by line) | 64 lines / 101 refs | flat by line |

The 27 Sep counts are not broken down by file anywhere, so the exact source of the
growth cannot be attributed. The likely candidates in today's code are:

- `EnhancedEventDialog.tsx`'s `INFO_BG` / `INFO_BORDER` / `INFO_TEXT` notice constants.
- The inline Red-deep "displaced tracker" notice in `EnhancedMatchTracker.tsx:1104` (SEC-003).
- The 4 `toast.tsx` sites, which an audit that excluded `components/ui/` would not have counted.

Either way, the direction is the point. Since phase one, every new match-screen feature
has followed the UX-007 precedent of local constants, so **the debt grows by a few sites
with each feature until phase two lands.**

### Colour families still in use (Tailwind only)

green 53 · yellow 35 · orange 29 · blue 22 · red 16 · purple 12 · white 9 · gray 7 · amber 2.

None of green, yellow, orange or purple exists in Floodlight.

---

## 2. By screen

A screen is the unit that gets converted and reviewed. Its site count is all three kinds
added together.

| Screen | Route | Sites | Tailwind | Hex | Const refs | Files |
|---|---|---:|---:|---:|---:|---|
| **Match screen** | `/match-day/:id` | **171** | 8 | 62 | 101 | 13 |
| **Home / dashboard** | `/` | **73** | 73 | – | – | 3 |
| **Match report + post-match editor** | `/match-report/:id`, `/match-data-editor/:id` | **37** | 37 | – | – | 6 |
| **Fixtures** | `/fixtures` | **24** | 24 | – | – | 1 |
| **Squad** (selection + players) | `/squad/:id`, `/players` | **24** | 24 | – | – | 2 |
| **Auth** (sign-in, registration, invite) | `/auth`, `/registration-success`, `/invite/:token` | **7** | 7 | – | – | 3 |
| **Reports** | `/reports` | **6** | 6 | – | – | 2 |
| **Club members** | `/club-management`, `/admin/approvals` | **2** | 2 | – | – | 1 |
| Global (toast, 404) | – | **8** | 8 | – | – | 2 |
| **Total** | | **352** | 189 | 62 | 101 | |

`/teams`, `/settings`, `/fixture/:id`, `/club-management` and `/pending-approval` have
**no** colour debt.

### Match screen — 171 sites

Covered separately in [section 5](#5-debt-030--the-match-screen). Worst offenders:

- `MatchLockingBanner.tsx` (31)
- `EnhancedMatchControls.tsx` (30)
- `PlayerTileGrid.tsx` (21)
- `PendingSubsPanel.tsx` (17)

### Home / dashboard — 73

- **`OptimizedIndex.tsx` (42).** The three stat cards each have a blue, green or purple
  gradient with six `dark:` partners. The four quick-action tiles are `bg-blue/green/red/purple-500`.
  There is also a grey gradient on the "AI coming soon" card.
- **`LiveMatchBanner.tsx` (30).** "You're Tracking This Match" is green. "Match Being
  Tracked" (LOCKED) is yellow, with white text on `yellow-500`, which fails contrast.
  "Live Match Available" is orange, and its LIVE badge uses `variant="destructive"` (red).
- `QuickActionCard.tsx` (1). `text-white` on the tile colours above.

### Match report + post-match editor — 37

- **`MatchReport.tsx` (17).** Its `getMatchResult` sets the W/D/L chip to green, yellow
  or red-500 with white text. Draw (white on `yellow-500`) is roughly 1.9:1. There is a
  red pulsing "live" pill, and our goals and the opponent's goals are coloured green and red.
- **`ValidationPanel.tsx` (13).** Green for "all checks passed", yellow for warnings.
- `MatchDataEditor.tsx` (4). A yellow "Unsaved" badge.
- `EventsTable`, `PeriodsTable`, `PlayerTimesTable` (1 each). A green tick.

### Fixtures — 24

- **`Fixtures.tsx` (24).** All of it is the in-progress treatment: an orange card, an
  orange pulse dot and an orange LIVE badge, which is itself `variant="destructive"`
  overridden to orange. There is also an orange "Live Match Available" banner with an
  orange button, plus one green "✓ Squad Ready".

### Squad — 24

- **`SquadSelection.tsx` (23).**
  - Validity is shown in green or red, with one amber-600 icon.
  - The two primary buttons are `bg-blue-600` and `bg-green-600`.
  - Starters and substitutes are told apart by green and blue borders and grounds.
  - There is a `yellow-500` star.
- `PlayerCard.tsx` (1). `border-gray-300`.

### Auth — 7

- `Auth.tsx` (5). The yellow dev-login warning box. It only renders in dev.
- `RegistrationSuccess.tsx` (1) is green. `AcceptInvitation.tsx` (1) is amber-500.

### Reports — 6

- `Reports.tsx` (5). A second, duplicate copy of `getMatchResult` (green/yellow/red-500
  W/D/L circles with white text).
- `MatchItem.tsx` (1).

### Club members — 2

- `AdminApprovals.tsx` (2). Green ticks.

### Global — 8

- `toast.tsx` (4). Destructive toast close button.
- `NotFound.tsx` (4). `bg-gray-100`, `text-blue-500/700` link.

---

## 3. Missing tokens

`src/index.css` declares the shadcn set: background, foreground, card, popover, primary,
secondary, muted, accent, destructive, border, input, ring and the sidebar set. Each is
in `:root` and `.dark`, and each is mapped in `tailwind.config.ts`.

**Floodlight has no green and no yellow.** BRAND.md defines navy, amber, Pitch Blue,
Paper, Card, Slate, Edge, Red and Red-deep, and nothing else. So `--success` and
`--warning` **cannot be given new hues without a BRAND.md change**. The proposals below
map them onto existing palette colours. Where a decision is needed, it is marked
**DECISION**.

| Token (+ `-foreground`) | Light value | Replaces | One-amber / red-rule risk |
|---|---|---|---|
| **`--action`** | Signal Amber `#F5A524`, navy text | `FLOODLIGHT.amber`, `AMBER` (BottomActionBar, QuickGoalButton, EnhancedMatchControls, FixedMatchHeader, PendingSubsPanel, PlayerTileGrid, MatchLockingBanner). Gives DESIGN-003 the semantic name it asks for. | **High, and already live — see below.** |
| **`--active`** | Pitch Blue `#0B5FCC`, white text | `FLOODLIGHT.pitchBlue` (PlayerTileGrid on-pitch tiles, EnhancedMatchControls, MatchLockingBanner). At present the only token holding Pitch Blue is `--ring`, which is the wrong name to build on. | Never adjacent to amber (2.9:1, per BRAND.md). The tile grid already obeys this. |
| **`--info`** | Pitch Blue tint: 8% ground, 35% border, Pitch Blue text | `INFO_BG/BORDER/TEXT` (EnhancedEventDialog), the `rgba(11,95,204,…)` literals (MatchLockingBanner), `blue-50/500` panels (SquadSelection substitutes), `text-blue-500/700` (NotFound). | It shares a hue with `--active`. UX-015 set that precedent. **DECISION:** accept it, or make info neutral. |
| **`--live`** | Pitch Blue with a pulsing dot. A match in progress *is* the active state. | Orange in-progress treatment (Fixtures 22, LiveMatchBanner 4). The red "live" pill (MatchReport 413–414). The `variant="destructive"` LIVE badges (Fixtures, LiveMatchBanner, which are token-based and so not counted, but are the wrong colour). The red "Live Match" home tile. | Today, live is shown in **red** in two places. That breaks the red rule (red only when something is about to be lost). Choosing **amber** for live would break one-amber on the Fixtures screen, which already has an amber resume action. Pitch Blue avoids both. |
| **`--success`** | **Settled 12 Oct 2026 (Tom): Pitch Blue `#0B5FCC`**, for **our-team markers**: our goals in the events lists, Squad Ready, starter states. Success **toasts** take no hue (DESIGN-008 wants most of them removed anyway). | `text-green-600` ticks (AdminApprovals, the editor tables, ValidationPanel, RegistrationSuccess, Fixtures "Squad Ready", SquadSelection, EnhancedMatchTracker goal icon). The green "tracking" panel (LiveMatchBanner). `bg-green-*` (SquadSelection starters). Our goals in green (MatchReport 618, 660, 761). | No new colour. Pitch Blue already means "our side, active" (on-pitch tiles), so this extends an existing meaning rather than adding one. Pitch Blue text measures 5.3:1 on Paper; white text on a Pitch Blue fill measures 6.0:1. See BRAND.md. |
| **`--warning`** | **No hue, and never amber** (unchanged, confirmed 12 Oct 2026). Foreground text, warning icon, `--border` in a heavier weight. | `yellow-*` (ValidationPanel, MatchDataEditor "Unsaved", LiveMatchBanner LOCKED, Auth dev box, EnhancedMatchControls `AlertTriangle`). `amber-500/600` (AcceptInvitation, SquadSelection). | **Highest risk of all.** The obvious choice, amber, would put a second amber element on the editor (warnings next to Save) and on the match screen (pending-subs guard next to Submit). **It must not be amber.** |
| **`--critical`** / **`--critical-deep`** | Red `#E5484D` / Red-deep `#B4232C` | `RED`, `RED_DEEP` (PendingSubsPanel, EnhancedMatchControls). The inline displaced-tracker notice (`EnhancedMatchTracker.tsx:1104`). `toast.tsx` red-*. BRAND.md already documents these as `--red` / `--red-deep`, but **`index.css` does not declare them**. Only `--destructive` (= Red-deep) exists. | Must stay non-decorative. That rules out using it for results; see Loss below. |
| **`--chrome`**, **`--chrome-foreground`**, **`--chrome-muted`** | Navy `#101724`, Paper `#EEF1F4`, Slate on Navy `#8D9AAC` | `FLOODLIGHT.navy/ink/dim` in FixedMatchHeader and PendingSubsPanel, which are navy panels on a light screen. `--primary` cannot do this job, because it flips to Paper in dark mode. | Slate on Navy is now in BRAND.md (6.3:1 on navy). It equals `.dark --muted-foreground` to within rounding. |
| **`--chrome-raised`**, **`--chrome-edge`** | Navy Raised `#2B313D`, Navy Edge `#2A3447` | Navy Raised: the header's period chip (`chipBg`, Paper at 12% over navy) and the pending panel's Undo button (white at 14% over navy, `#313743`). Navy Edge: nothing in the app yet. Only the share-card mockup uses it. | Both now in BRAND.md. Navy Raised is the value the code actually produces; slice 1 should collapse the two overlays into one solid token. Navy Edge is provisional, because no app code uses it (see BRAND.md). |
| **`--result-win`**, **`--result-draw`**, **`--result-loss`** | **Settled 12 Oct 2026 (Tom).** Win: a **filled** Pitch Blue chip, white text. Draw: a **filled** Slate chip, navy text. Loss: an **outline** chip, with a transparent fill, a Navy Edge border and muted text. | Both copies of `getMatchResult` (MatchReport, Reports: green/yellow/red-500 with white text). Their goals in red (MatchReport 618, 660, 765) go to muted text. Our goals go to `--success`. | See [Result treatments](#result-treatments) below. **Draw fails contrast as specified:** navy on Slate measures 3.0:1. |

### Result treatments

Settled 12 Oct 2026 (Tom):

| Result | Treatment | Text on chip |
|---|---|---|
| Win | **Filled** Pitch Blue `#0B5FCC` | White, 6.0:1 |
| Draw | **Filled** Slate `#5A6474` | Floodlight Navy, **3.0:1** |
| Loss | **Outline**: transparent fill, Navy Edge `#2A3447` border | Muted (Slate `#5A6474` on light grounds, 5.3:1 on Paper; Slate on Navy `#8D9AAC` on navy, 6.3:1) |

**Fill versus outline carries the distinction, not hue.** That was chosen for three reasons:

1. **It keeps Red-deep meaning "act now".** That is what makes the pending-subs escalation
   read as urgent. Spending red on a result would teach the eye that red can just mean
   "bad news", and the one red that has to stop a coach would lose its force.
2. **It survives sunlight and colour-vision deficiency,** because hue is not doing the work.
   Filled versus hollow reads in glare and in greyscale.
3. **This is a children's club whose results are shared with parents.** A defeat should not
   be marked in alarm colours. The score already says what happened.

This also resolves the share-card conflict raised in the first draft of this plan. The
approved mockup's Red-deep Loss chip must change to the outline treatment when REPORT-003
is built.

**Two problems with the spec as written.** Both are measured, not guessed. They need a ruling
before slice 4, and neither is changed here:

- **Draw: navy text on Slate is 3.0:1.** That fails the 4.5:1 AA floor for chip-sized text.
  White on Slate measures 6.0:1.
- **Loss on the navy share card: the Navy Edge border against navy is 1.4:1.** That is below
  the 3:1 non-text floor, so on the card the outline effectively disappears. "Loss" then
  reads as plain muted text, and the fill/outline distinction rests on the word alone. On
  light screens the same border measures 11.0:1 on Paper and is clearly visible. (On the
  card, Win's fill is 3.0:1 against navy and Draw's is 3.0:1, both right at the floor.)

**The merge of the two `getMatchResult` copies is not a straight swap.** Today each returns
a single background class, which the caller pairs with `text-white`
(`MatchReport.tsx:470`, `Reports.tsx:307`). That works for two filled chips, but the
outline case needs a **border and a foreground** too, and must drop the white text. The
merged helper has to return a full treatment (fill, border, text) rather than a background
class, and both call sites have to stop appending `text-white` themselves.

### The amber hazard that already exists

`--accent` is Signal Amber, in both themes. shadcn uses `accent` for **hover and focus
states**: `button.tsx`'s `outline` and `ghost` variants are `hover:bg-accent`. So are
dropdown, select, context-menu, command, menubar and calendar items, plus `toggle`. On a
touch device, hover sticks after a tap. So tapping any outline or ghost button leaves it
amber, next to whatever the screen's real amber action is.

That breaks the one-amber rule today, and no audit count catches it because it is a token,
not a hard-coded colour. **The fix is part of the token slice:**

1. Add `--action` for the amber.
2. Point `--accent` back at a neutral hover (Floodlight's sunken `#E4E9EE`, i.e. today's
   `--secondary`).
3. Move every intentional amber onto `--action`.

Logged as DESIGN-010.

---

## 4. Slices

Each slice is roughly one evening, one branch, mergeable on its own. They are ordered so
that the token groundwork lands first, then the most visible screens.

**"Match-recording code"** means the slice edits a component that renders, or sits in the
write path of, the live match screen. Those slices need an early-week slot, so that a
regression shows up on staging days before Saturday rather than at kick-off.

| # | Slice | Screens | Sites | Match-recording? | Unblocks |
|---|---|---|---:|---|---|
| **1** | **Semantic tokens + accent fix** | none directly (`index.css`, `tailwind.config.ts`, BRAND.md) | 0 converted | **Indirectly.** Repointing `--accent` changes hover colour on match-screen dialogs. Only hover state changes; nothing in the write path. Safe any day, but look at the match screen once on staging. | Every other slice. REPORT-003. Settles the decisions in §3. |
| **2** | **Live & tracking states** | Home (`LiveMatchBanner`), Fixtures | 54 | No. The Resume buttons only navigate. | One consistent "live" vocabulary across the screens a coach passes through on the way to a match. Removes the most off-palette colour (orange). |
| **3** | **Home tiles** | Home (`OptimizedIndex`, `QuickActionCard`) | 43 | No | Removes purple. It is the first screen anyone sees. **Check against DESIGN-006 first**, which says this screen needs a redesign, not a recolour. Recommended: do this slice anyway as a pure neutral recolour (no new layout). The class strings live in two config arrays, so DESIGN-006 throws away very little. |
| **4** | **Results** | Match report, Reports | 23 | No. Read-only screens. | **REPORT-003** shares result colours with this screen. It also merges the two copies of `getMatchResult` into one helper. |
| **5** | **Squad** | `SquadSelection`, `PlayerCard` | 24 | **Adjacent.** SquadSelection's Start Match button is the doorway into recording. The change is colour-only and nothing in the write path changes. It should still not land on a Friday. | Settles which control is the screen's single amber. Today there are two coloured primaries: blue Save and green Start. |
| **6** | **Post-match editor** | `MatchDataEditor`, `ValidationPanel`, editor tables | 20 | **Edits match data, but not live.** It is the retrospective editor for irreplaceable rows. It is colour-only. Any day is fine, as long as you check the editor on staging after merging. | `--warning` in its first real use. |
| **7** | **Sweep** | Auth, Club members, 404, toast | 17 | `toast.tsx` is global, so the destructive toast changes on the match screen too. Visual only. | Leaves the match screen as the only debt. |
| **8a** | **Match screen: header & passive panels** | `FixedMatchHeader`, `LiveEventsSummary`, `SmartSuggestionBadge`, `MatchLockingBanner`, `EnhancedMatchTracker` inline | 72 | **Yes** | DEBT-030, part 1 |
| **8b** | **Match screen: tile grid & action bar** | `PlayerTileGrid`, `BottomActionBar`, `QuickGoalButton`, `UndoButton` | 40 | **Yes**. These are the controls a coach presses most. | DEBT-030, part 2 |
| **8c** | **Match screen: controls, pending subs, dialogs** | `EnhancedMatchControls`, `PendingSubsPanel`, `EnhancedEventDialog`, `EditSquadDialog` | 59 | **Yes**. They hold the critical-red states and the UX-010 guard. | Closes DEBT-030. |

Sites: 54 + 43 + 23 + 24 + 20 + 17 + 72 + 40 + 59 = **352**.

**Order rationale.**

- 2 and 3 are the screens everyone sees.
- 4 is next because it unblocks the one feature waiting on this work.
- 8a–c come last because they are the riskiest. They are not the least visible, and nothing
  stops them being pulled forward into an early-week evening once slice 1 is in.
- 8a, 8b and 8c are independent of each other, but each needs slice 1.

### What this implies for the 31 Oct Phase A target

Ten slices at one evening each is **ten evenings**. 31 Oct is a Saturday, 20 days from
this audit. That leaves three early-week windows (the weeks of 12, 19 and 26 Oct), and
**the three match-screen slices need one each.** Even with no slippage, the match screen
alone takes every remaining early-week slot. The other seven slices need seven more
evenings in the same three weeks. **The 31 Oct target is not achievable for the whole
conversion.**

At one slice per week, it is ten weeks. At two per week (one of them early-week), it is
five weeks. What REPORT-003 needs (slices 1 and 4, §6) is two evenings, with no early-week
constraint.

---

## 5. DEBT-030 — the match screen

**Size:** 171 sites (8 Tailwind, 62 hex/rgba, 101 constant references) in 13 files. That
is 49% of all remaining debt, in the 13 files where a mistake costs the most.

**Current shape:**

- Ten components each declare their own `FLOODLIGHT` object or bare constants. The same
  six hex values are copied ten times.
- Colours are applied through `style={{ … }}`. Those ten files hold 66 `style=`
  attributes, most of them carrying colour.
- **None of the ten files contains a single `dark:` variant.** In dark theme the match
  screen renders the light-theme palette inside a dark app: Paper panels, white tiles and
  navy text. DEBT-030 records exactly this. `MatchLockingBanner`'s Paper-ground panel is
  the most visible case.

**What converting it involves:**

1. **Tokens first (slice 1).** The match screen needs `--action`, `--active`, `--info`,
   `--critical`, `--critical-deep` and the `--chrome` set. **`--primary` is the trap.** It
   is navy in light and flips to Paper in dark. The fixed navy header and the
   pending-subs panel must use `--chrome`, not `--primary`, or they turn white under
   floodlights.
2. **Replace each constant reference and inline style with a token class.** Keep `style=`
   only for genuinely dynamic values: the undo progress width, `paddingBottom`, the
   animation delay.
3. **Choose a dark value for every surface.** Today there isn't one. In particular, the
   on-pitch tile in dark theme needs `.dark --active` (the lighter Pitch Blue at
   `214 77% 61%`, which `--ring` already uses), checked against white text.
4. **Re-verify the one-amber rule in every state.** These are: before kick-off, live,
   between periods, pending subs, pending subs critical, displaced, and match ended. UX-007
   and the 11 Sep polish both found one-amber violations that only appeared in a particular
   state.
5. **Rework the tests.** `PendingSubsPanel.test.tsx` asserts the computed colour
   `rgb(180, 35, 44)` from an inline style. Once the colour comes from a CSS variable
   through a Tailwind class, jsdom will not resolve it, and those assertions break. Assert
   on the class name or a `data-state` attribute instead. Fix this in 8c itself, rather
   than deleting the assertion.

**What could go wrong at a live match:**

- **A control loses contrast in one theme.** For example, an amber Submit whose text
  becomes Paper instead of navy. Amber takes navy text, always.
- **A second amber appears in some state** and the coach's eye goes to the wrong button.
- **The critical-red pending panel stops turning red,** because a class did not apply. The
  coach then misses an unsubmitted substitution. This is the regression the
  PendingSubsPanel tests exist to catch, which is why they must be reworked rather than
  removed.

None of the slices changes a write path, a timer or a query. The risk is entirely visual,
but visual failures on this screen are how coaches make recording mistakes.

**Test on staging in both themes, and on a phone outdoors, before each match-screen slice
merges.**

---

## 6. What unblocks what

```
1 tokens ──┬── 2 live states
           ├── 3 home tiles
           ├── 4 results ──────── REPORT-003 share card (phase 2)
           ├── 5 squad
           ├── 6 editor
           ├── 7 sweep
           └── 8a / 8b / 8c match screen ── closes DEBT-030 ── unblocks DESIGN-003
```

**REPORT-003's share card needs slice 1. It should also wait for slice 4.**

- **Slice 1 is the hard prerequisite.** The card is a fixed-navy surface ("never themed":
  it is rasterised to a PNG), so it does not need any other screen converted. It does need
  the `--chrome` family and the result tokens to exist. They are now in BRAND.md (12 Oct).
  Otherwise the card hard-codes its own copies of them and becomes the eleventh local
  constant object. Note that the mockup's own values differ slightly from the code's: it uses
  raised `#1B2434` where the app produces `#2B313D`, and `#8D99AC` for `#8D9AAC`. The card
  should take the BRAND.md values.
- **Slice 4 is a strong should.** It puts the settled win/draw/loss treatments (§3,
  [Result treatments](#result-treatments)) on the match report itself. The card and the
  report then show the same result the same way, and the card can reuse the merged
  `getMatchResult` helper. The mockup's Red-deep Loss chip changes to the outline treatment.

So: **slices 1 and 4. That is two evenings if 4 follows 1 directly, or four if 2 and 3 go
first as ordered.** None of them touches match-recording code.

DESIGN-003 (club palettes) is blocked by the whole phase, because every colour has to come
from a token first.

---

## How to re-count

Run from the repo root in **bash** (zsh expands the `--include` globs):

```bash
PAL='(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)'

# Tailwind colour utilities (then subtract tests and ui/ scrims)
grep -rnoE "(text|bg|border|ring|ring-offset|from|via|to|fill|stroke|outline|divide|placeholder|caret|decoration|shadow)(-[trblxy])?-${PAL}(-[0-9]{2,3})?(/[0-9]+)?\b" \
  src --include='*.tsx' --include='*.ts' | grep -v '\.test\.' \
  | grep -vE 'ui/(dialog|sheet|drawer|alert-dialog)\.tsx' | wc -l

# Hex / rgba literals (then subtract EnvironmentBanner)
grep -rnoE "#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)" \
  src --include='*.tsx' --include='*.ts' | grep -v '\.test\.' \
  | grep -v 'integrations/supabase/types.ts' | grep -v EnvironmentBanner | wc -l

# Local-constant references (per match component, excluding the declaration line)
grep -nE "\b(FLOODLIGHT\.[a-zA-Z]+|AMBER|NAVY|RED_DEEP|RED|INFO_BG|INFO_BORDER|INFO_TEXT)\b" \
  src/components/match/*.tsx | grep -v '\.test\.' | grep -vE ':[0-9]+:const ' | grep -oE "\b(FLOODLIGHT\.[a-zA-Z]+|AMBER|NAVY|RED_DEEP|RED|INFO_BG|INFO_BORDER|INFO_TEXT)\b" | wc -l
```

Expected on 11 Oct 2026: 189, 62, 101.
