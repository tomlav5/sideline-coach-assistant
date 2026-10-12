# Brand assets

Source files for the app icon, favicon and link-preview image. Nothing here is
served — `public/` holds the copies the browser actually loads.

## Palette — "Floodlight"

| Role | Name | Hex |
|---|---|---|
| Ground, text | Floodlight Navy | `#101724` |
| Primary action | Signal Amber | `#F5A524` |
| Active state | Pitch Blue | `#0B5FCC` |
| App background | Paper | `#EEF1F4` |
| Raised surfaces | Card | `#FFFFFF` |
| Secondary text | Slate | `#5A6474` |
| Borders only | Edge | `#CBD3DC` |

Preferred logo pairing is Signal Amber on Floodlight Navy — 8.8:1.
Never set amber on white (2.0:1) or place amber directly against blue (2.9:1).

### Navy surfaces

Added 12 Oct 2026. These colours were already in use on the match screen's navy panels
(the fixed header and the pending-substitutions panel) and in the share-card mockup, but
were not written down here.

| Role | Name | Hex | Contrast |
|---|---|---|---|
| Secondary text on navy | Slate on Navy | `#8D9AAC` | 6.3:1 on Floodlight Navy; 4.6:1 on Navy Raised |
| Chips and buttons on navy | Navy Raised | `#2B313D` | Paper text on it 11.5:1; the surface is 1.4:1 against navy |
| Borders on navy only | Navy Edge | `#2A3447` | 1.4:1 against navy; 11.0:1 against Paper |

- **Slate on Navy** is what Slate is on a light ground, carried onto navy. Slate itself
  measures only 3.0:1 on navy. In code it is `FLOODLIGHT.dim` in `FixedMatchHeader.tsx` and
  `PendingSubsPanel.tsx`. It matches the dark theme's `--muted-foreground` to within
  rounding.
- **Navy Raised** is the solid colour the code produces today with translucency. The
  header's period chip is Paper at 12% over navy, which composites to `#2B313D`. The
  pending panel's Undo button is white at 14% over navy, `#313743`, which is close enough
  to be the same surface. The token should be solid, and both should use it.
- **Navy Edge** is **provisional**. No app code uses it yet. The value comes from the
  approved share-card mockup (REPORT-003). At 1.4:1 it is a subtle divider between navy
  areas, not a boundary that has to be seen. Do not rely on it alone to show a shape on
  navy; see Loss below.

The share-card mockup uses `#1B2434` for raised and `#8D99AC` for muted. Build to the
values above, which are what the app already ships.

### Results

Settled 12 Oct 2026. A result is shown by **fill versus outline, not by hue**.

| Result | Treatment | Text |
|---|---|---|
| Win | Filled Pitch Blue | White (6.0:1) |
| Draw | Tinted: Slate at 10% over the ground, Edge border | Floodlight Navy (13.9:1) |
| Loss | Outline: no fill. Edge border on light grounds, Slate on Navy border on navy grounds | Muted |

Why:

- **Red-deep keeps meaning "act now".** That is what makes the pending-subs escalation
  read as urgent, so it is never spent on a result.
- **Hue is not doing the work,** so the treatment survives sunlight and colour-vision
  deficiency.
- **This is a children's club, and results go to parents.** A defeat is not marked in alarm
  colours. The score already says what happened.

**Colour alone is not enough.** Pitch Blue and Slate sit within 1% of each other in
luminance, so a result marker that carries no word or letter cannot rely on colour alone.
The result chips and the Reports circles both carry text, so this is a constraint on any
future form-guide dot, not on what exists today.

### Pitch Blue carries two related meanings

On the match screen, Pitch Blue means **"our side, active"**: a player on the pitch, our
goals, squad-ready and starter states. On a result it means **"we won"**. These are the
same idea, our side doing well, so it is one meaning stretched, not a collision. Do not
"fix" it by giving the win chip a different colour.

The rule that still holds is never amber directly against Pitch Blue (2.9:1).

### Semantic critical

| Token | Name | Hex | Use |
|---|---|---|---|
| `--critical` | Red | `#E5484D` | Critical borders and accents |
| `--critical-deep` | Red-deep | `#B4232C` | Critical panel grounds; white text reads at 6.5:1 |

Renamed from `--red` / `--red-deep` on 12 Oct 2026 (Floodlight slice 1), when they were
first declared in `src/index.css`: the palette is moving to semantic names, and a token
called `--red` cannot later mean anything else.

**This is not a second accent.** It must never be used decoratively, for branding, or to
draw general attention. It appears only when something is about to be lost — the first
use is the unsubmitted-substitutions state on the match screen (UX-007), where the panel
turns red after 60 seconds.

Signal Amber remains the action colour everywhere in the app. Notably, when the pending
panel goes critical the Submit button **stays amber and does not move**: the control a
coach must hit under pressure should not change beneath their thumb.

## App icon

`icon-1024.png` is the master. Every size in `public/icons/` is derived from it.

The mark is a two-letter monogram with an ascending line, on a navy field. Its warm
channel was shifted from the original antique gold (`#C59965`, hue 28°) onto Signal
Amber (hue 37°, saturation 0.85) so it matches the app's action colour. The shift
preserved the original brightness gradient, so the stroke still runs dark at its
tail and bright into the glow rather than reading as flat orange.

The artwork is deliberately **not** pre-rounded. iOS and Android apply their own
corner mask; artwork that arrives already rounded gets rounded twice and shows gaps
at the corners.

`icon-maskable-*.png` insets the artwork to 80% so Android's adaptive-icon crop
cannot clip it.

`icon-180.png` maps 1:1 to an iPhone home screen icon at @3x, and `icon-192.png`
maps 1:1 to an Android launcher icon at xxxhdpi, so neither is resampled by the OS.

## Favicon

The favicon is the app icon's **"A" element, isolated** — the white letterform with
the amber arrow running through it. Keeping it inside the same family as the app
icon is the point; it is a crop of the same idea rather than a different drawing.

`favicon-source.png` is the artwork as supplied. In it the mark sits **151 px right
of centre**; `favicon-master-1024.png` is that artwork recentred on the mark's true
centre (663, 515), cropped to a 560 px square and scaled up, which magnifies the
strokes by 1.83× and is what makes the small sizes viable at all. The amber was
nudged onto Signal Amber; the white and the navy field were left alone.

**Each size in `favicon.ico` uses a different treatment**, chosen for its grid:

| Size | Treatment |
|---|---|
| 48 px | Unsharp mask, radius 1.0 / 110% |
| 32 px | Unsharp mask plus 1.18× contrast |
| 16 px | Same; legible but busy |

An outline letterform with a counter is close to the limit of what 16 px can carry.
At the 560 px crop the strokes land at roughly 2.5 px at 48, 1.7 px at 32 and 0.9 px
at 16. **This matters less than it appears:** on any Retina display a 16 CSS-pixel
tab favicon is rendered from 32 device pixels, so the 32 px entry is what almost
everyone actually sees. The true 16 px path is non-Retina screens and some history
and bookmark lists.

A tighter crop than 560 px was tested at 620 and 680; both were measurably worse at
32 and 16. Tighter is better here, and 560 is about as tight as the composition
allows before the glow clips.

`index.html` deliberately points its PNG icon link at `favicon-96.png` rather than
`icons/icon-192.png`. If the larger file were offered, browsers would prefer it for
high-DPI tabs and downsample the app icon's full lockup, which is the exact failure
this avoids.


## Regenerating

App icon: derive every size from `icon-1024.png` with Lanczos resampling — 512, 192,
180, maskable at 512 and 192.

Favicon: re-crop from `favicon-source.png` — 560 px square centred on (663, 515) —
then apply the per-size treatments in the table above. A uniform downsample across
all three sizes will look noticeably worse at 16 and 32 px.

## Known gaps

- Both marks are **raster with no vector master**, so 1024 px is the ceiling. The App
  Store's 1024 px requirement is met with zero headroom. Rework from vector when
  there is time.
- The wordmark on `og-image.png` is set in Poppins Bold. The app's display face is
  Archivo — worth re-rendering when a licensed copy is to hand.
- The favicon carries an outline letterform, which is near the floor of what 16 px
  can hold. If it ever needs to work on non-Retina screens, a solid silhouette would
  survive better than an outline.
- `public/favicon.png` is a leftover path from the Lovable export. It has been
  overwritten with current artwork but nothing references it; safe to delete.
