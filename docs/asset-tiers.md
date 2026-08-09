# Asset tiers

The library is two libraries wearing one coat, and they have never had the
same rules.

Most of it is The Weather Channel's — narrator recordings, production music,
broadcast art, licensed typefaces. Some of it is ours or freely licensed:
station tables, generated plates, open fonts, synthesised tones.

The desktop build is something you run on your own machine, from material you
obtained yourself. The web build at `weather.codyhurst.com` is *publication*:
it hands the bytes to anyone who loads the page, which is redistribution
whatever the folder is called. Keeping both in one undifferentiated `assets/`
meant the only thing between them was remembering, correctly, every time,
which files were which. That is not a control. It is a hope.

## The two tiers

| Tier | What it is | Where it goes |
|---|---|---|
| `real` | Rights-encumbered. TWC recordings, production music, broadcast art, commercial typefaces. | Desktop / Electron only. Never published. |
| `clean` | Recreated, generated, or open-licensed. | The web build. |

Classification lives in `scripts/asset-tiers.mjs` as rules, not as a manifest.
A manifest of 13,000 entries goes stale the first time somebody adds a file;
a rule does not.

**Anything unmatched is `real`.** Mislabelling a clean asset costs you a
missing image. Mislabelling an encumbered one costs you a takedown. Those are
not comparable, so the tie goes to caution — and if the classifier says
"unclassified", that is a prompt to write a rule, not a bug.

## Commands

```bash
npm run assets:tiers          # inventory: what is where, and why
npm run assets:tiers -- --list-clean
npm run assets:guard          # block a publish containing encumbered assets
```

`assets:guard` classifies a staging directory and exits non-zero if a single
`real` asset is present. Run it before any deploy. It is the entire point of
the split: the rule stops depending on anyone remembering it.

## Where things stand

As of the split being introduced:

```
real    13,644 files   1,402 MB
clean        3 files       0.3 MB
```

That is the honest starting position and it should not be softened. **The
clean tier does not exist yet.** Every asset in the library today came off TWC
hardware; the three clean files are station and city data tables.

This matters for planning: building the clean tier is a *content* project, not
a packaging one. Nothing in `scripts/` can manufacture a publishable icon set.
What the tooling does is make the boundary real and enforceable, so the
content work has somewhere to land and the site cannot quietly acquire
encumbered assets in the meantime.

## Building the clean tier

Roughly in order of how much they unblock:

1. **Fonts.** The cheapest win, and the most visible. The real library carries
   Interstate, Frutiger, Helvetica and Akzidenz-Grotesk — all commercial.
   Open substitutes with close metrics exist for each (Archivo and Public Sans
   for Interstate; Inter or Noto Sans for Frutiger). Drop them under
   `fonts/open/` and the rule already publishes them.

2. **Condition icons.** ~1,250 files, the largest visual category. These have
   to be *redrawn* — matching silhouette and palette is fine, tracing the
   original artwork is not. `icons/recreated/`.

3. **Backgrounds.** 1,911 files, 239 MB, and the easiest to replace
   convincingly: most are gradients and soft city plates. Generate them from
   the palette each device profile already declares, into
   `backgrounds/generated/`.

4. **Audio.** The hardest, and the one to be realistic about. There is no
   clean substitute for Allen Jackson. The web build should simply run silent
   and lean on the screen reader — which the app already does correctly when a
   clip is missing, because clip resolution degrades to spoken text rather
   than failing. A silent web build is not a broken web build; it is the
   application working as designed.

## Primary sources

`scripts/fetch-sources.mjs` pulls original material — drive dumps off real
hardware, and the TWC production packages that shipped to them — into
`sources/` (gitignored). Everything it fetches is `real` tier by definition.

It writes a `SOURCE.txt` beside every download recording the Archive item, the
URL, the date and the tier. A folder of `.tgz` files with no record of where
it came from is worthless in six months.

Nothing in that script writes into `assets/`. Extraction and classification
are deliberate, separate, reviewable steps, and they should stay that way.

```bash
npm run sources:list
node scripts/fetch-sources.mjs --only weatherscan-packages
```

Worth knowing about the production packages specifically: they are not just
art. `twc_wxscan_dynamic-*.tgz` contains TWC's own render scripts — readable
Python templates with every element's pixel coordinates, font name and point
size. For any layout gap recorded as "needs a still to lay out faithfully",
these are better than a still, because they are the source the still was
rendered from.
