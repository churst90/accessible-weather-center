# Asset layout and tiers

## Layout

The library is organised around one distinction: whether an asset belongs to
a machine, or is shared between them.

```
assets/
  devices/<device-id>/     art belonging to ONE machine
    backgrounds/ icons/ chrome/
  shared/                  pools genuinely used across machines
    fonts/ music/ narration/ icons/ logos/ sfx/ sounds/ backgrounds/
  data/                    station and city tables
  inbox/                   staging for new material, empty when nothing is
                           pending; encumbered until reviewed and promoted
```

Device directory names are exactly the ids in `src/devices/profiles/<id>.ts`.
That is the point: "what art does the WeatherStar 4000 v2 use" is answered by
`ls`, not by knowing the history of the folder.

It did not start this way. Icons lived in three places (`icons/`,
`themes/intellistar/icons`, `themes/weatherscan/icons-png`), fonts in two, and
`themes/` covered two of the ten machines while `backgrounds/` covered four
and left 66 files loose at its root. `scripts/reorganize-assets.mjs` performed
the migration — dry-run by default, move-only, and every move recorded to
`.asset-migration.json` so `--undo` can replay it backwards. `assets/` is not
in git, so a bad move there is not recoverable with `git checkout`; the
manifest is the safety net.

That manifest is deliberately *not* tracked (gitignored as of v0.13.0, along
with `.inbox-triage.json`). It describes moves inside a directory the repo
does not contain, which makes it machine-local operational state rather than
source — and at 2.2 MB it was the largest file in the tree. It is still
written to the working directory, so `--undo` works exactly as before; it just
does not follow the repo to another clone, where it would be meaningless.

After moving, `npm run assets:check` confirmed all 170 statically-resolvable
references still resolve, and `npm run clips:sweep` confirmed 0 missing files
across both large narrator libraries.

## The application does not know about any of this

Worth stating before the rest, because it is the thing that matters at
runtime: **the app loads whatever library it is pointed at.** It does not
inspect the contents, classify them, or refuse to start over them. Feed it the
authentic library and it plays the authentic library.

Resolution order (`electron/main.ts`, `resolveAssetsDir`):

    AWC_ASSETS_DIR environment variable
    the installed app's user-data directory
    the app's resources directory
    the repository checkout

Nothing in `src/`, `electron/`, the Vite build or the Electron build
references the tier tooling. Everything below is a **packaging** concern —
what you choose to put in an archive and where you choose to publish it —
and it runs only when you invoke it deliberately.

The app also runs with no library at all: system fonts, no music, narration
read by the screen reader. Missing clips degrade to spoken text rather than
failing, so a partial install is a valid install.

## Tiers, as a packaging decision

Most of the library is The Weather Channel's — narrator recordings,
production music, broadcast art, licensed typefaces. Some is ours or freely
licensed: station tables, generated plates, open fonts, synthesised tones.

Running the desktop build on your own machine from material you obtained
yourself is one thing. Serving it from `weather.codyhurst.com` is
publication, which is redistribution whatever the folder is called. The tier
labels exist so that difference can be acted on at packaging time by
somebody who has decided to act on it — not so the software polices it.

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

## There is only one archive today

Worth being blunt about, because it is easy to assume otherwise from the
existence of two tier names: **there is one library with content in it, and
it is the authentic one.** `npm run assets:package` produces it — fourteen
tarballs, ~1.3 GB, split by device and by shared pool so nobody downloads
500 MB of music to get the fonts.

A second, fan-made archive does not exist. Not "is out of date" — has never
been built, because the assets it would contain have not been made. Anything
that says otherwise is describing a plan.

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


## Two undecodable TIFFs, and why nothing is broken

`golf_bg.tif` in both the Weatherscan v1 and v2 resource packages is a 40bpp
TIFF that ffmpeg refuses ("not yet implemented"), so `promote-sources.mjs`
converts 298 of 300 and skips these two.

Nothing depends on them. Golf is a Weatherscan Plus activity pack, recorded
in the v1 profile's `gaps` as having no scene or art — the app never asks for
the file. If that pack is ever built, `MistWeatherMedia/weatherscan-v2` ships
`images/backgrounds/golf_bg.png`, already decoded, as a stand-in until
something can read the original.

The originals are untouched in `sources/`. They are not deleted and not
missing; they are simply not convertible with the tools on this machine.

## Superseded music

`sources/superseded/` holds both sides of the in-house 4-disk revision, so no
take is ever lost to a preference:

    inhouse-4disk-pre-revision/        originals the revision replaced and
                                       which were NOT restored
    inhouse-4disk-revised-not-chosen/  revised takes that WERE replaced, after
                                       the originals were preferred on listening

Each carries a README saying which tracks and why. Copy either back over the
same relative path in `assets/shared/music/` to A/B.
