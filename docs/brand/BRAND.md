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
