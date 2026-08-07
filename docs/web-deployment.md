# Deploying to weather.codyhurst.com

Runbook for putting Accessible Weather Center on a Debian + nginx server
(OVH). Two scripts do the work:

- `deploy/server-setup.sh` — run **once, on the server, as root**. Installs
  packages, creates the web root, gets a TLS certificate, installs the vhost.
- `deploy/publish.sh` — run **from your workstation**, every time you want to
  push a new build. Uploads the app and the media library.

The landing page is yours and neither script overwrites it.

---

## What ends up where

```
/var/www/weather.codyhurst.com/
  index.html      your landing page          -> https://weather.codyhurst.com/
  app/            the application (dist/)    -> https://weather.codyhurst.com/app/
    static/       hashed JS/CSS/font bundle
  assets/         media library, ~1.3 GB     -> https://weather.codyhurst.com/assets/
```

Plus `/nwr/`, which is not a directory — it is a reverse proxy to
weatherUSA's Icecast server.

Two structural facts that constrain this layout:

1. **`/assets/` has to be at the site root, on the same origin as the app.**
   Every media URL the app builds at runtime is root-relative
   (`/assets/narration/...`), so it resolves the same regardless of where the
   app is mounted. Same-origin is a hard requirement, not a preference: the
   clip player routes audio through a `MediaElementAudioSourceNode`, and
   WebAudio refuses cross-origin media that lacks CORS headers. Move the
   library to a separate CDN hostname without adding CORS there and the
   narration goes silent.

2. **`/app/static/` and `/assets/` are unrelated.** Vite fingerprints
   CSS-referenced files (fonts, `LDL.png`) *into* the bundle; the runtime
   `/assets/...` strings in the TypeScript pass through untouched and are
   served from the media library. The bundle directory is named `static`
   rather than Vite's default `assets` precisely so these two don't collide
   in the nginx config.

---

## Prerequisites

1. **DNS.** An `A` record for `weather.codyhurst.com` pointing at the
   server's public IP (and `AAAA` if you use IPv6). Do this first — it takes
   time to propagate and Let's Encrypt cannot issue without it.
2. **SSH key auth** from your workstation to a non-root user on the server
   with `sudo`. `publish.sh` runs non-interactively and will refuse to
   prompt for a password.
3. **Ports 80 and 443 open.** Port 80 stays open permanently — certbot
   renewals use it.
4. **Disk:** ~2 GB free for the media library plus headroom.

---

## One-time server setup

On the server:

```bash
git clone https://github.com/churst90/accessible-weather-center.git
cd accessible-weather-center
sudo bash deploy/server-setup.sh
```

The script is idempotent — re-running it is safe and only fixes what drifted.

It will, in order: check DNS actually points at this host, install nginx +
certbot + rsync, create the web root owned by your deploy user, install a
temporary HTTP-only vhost, obtain a certificate via the **webroot** plugin,
then install the real vhost and reload.

Webroot rather than `--nginx` is deliberate: certbot's nginx plugin rewrites
config files in place, and this vhost is version-controlled. Keeping certbot
out of it means `deploy/nginx/weather.codyhurst.com.conf` in the repo stays
the single source of truth.

If DNS isn't ready yet the script says so, skips TLS, and tells you to re-run
later. That's expected, not a failure.

Overridable via environment:

```bash
sudo DOMAIN=weather.example.com DEPLOY_USER=cody EMAIL=you@example.com \
     bash deploy/server-setup.sh
```

---

## Publishing

**Build on a machine that has the media library — not on the server.**

Vite fingerprints the CSS-referenced fonts into the bundle *at build time*,
reading them from `assets/`. Since `assets/` is gitignored, a `git clone` on
the server followed by `npm run build` produces a bundle whose font URLs are
still absolute `/assets/fonts/...` paths. Those 404, and every theme renders
in system fonts — with no error anywhere in the build output. `publish.sh`
now refuses to build in that state, and `vite build` prints a loud warning.

The intended flow builds locally and uploads both halves. From your
workstation, in a repo checkout:

```bash
bash deploy/publish.sh --host cody@weather.codyhurst.com
```

This builds the app, uploads `dist/` to `app/`, uploads `assets/`, then runs
four HTTP checks against the live site.

**The first run moves ~1.3 GB across ~13,650 files.** Run it inside `tmux` or
`screen`. If the connection drops, run the same command again: rsync uses
`--partial` and re-sends only what's missing.

Afterwards, the common cases are much smaller:

```bash
bash deploy/publish.sh --host cody@... --app-only     # code change, ~2.4 MB
bash deploy/publish.sh --host cody@... --assets-only  # new/changed media only
bash deploy/publish.sh --host cody@... --dry-run      # show, change nothing
```

Both uploads use `--delete`, so the remote mirrors your local tree. That is
scoped to `app/` and `assets/` — your `index.html` at the web root is never
in scope.

If you connect through an ssh alias or a bare IP, the post-upload checks
can't guess the public URL. Pass it:

```bash
bash deploy/publish.sh --host myalias --url https://weather.codyhurst.com
```

---

## Your landing page

`server-setup.sh` writes a placeholder `index.html` **only if the file does
not already exist**. Replace it with your own page whenever you like:

```bash
scp mypage.html cody@weather.codyhurst.com:/var/www/weather.codyhurst.com/index.html
```

Nothing in the deploy pipeline touches it again. Link into the app with a
plain `<a href="/app/">`.

---

## Verifying by hand

```bash
curl -I https://weather.codyhurst.com/app/                        # 200
curl -I https://weather.codyhurst.com/assets/sounds/TWC_Mnemonic.mp3  # 200, audio/mpeg
curl -I https://weather.codyhurst.com/nwr/status-json.xsl         # 200, application/json
curl -I https://weather.codyhurst.com/assets/nope.mp3             # 404, NOT 200 html
```

That last one matters: if a missing media file returns the SPA shell with a
200, the SPA fallback is scoped too broadly and the browser will try to
decode HTML as audio.

Check a byte range works, since audio seeking depends on it:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -r 0-1023 \
     https://weather.codyhurst.com/assets/sounds/TWC_Mnemonic.mp3   # 206
```

---

## Updating later

```bash
git pull
bash deploy/publish.sh --host cody@weather.codyhurst.com --app-only
```

If you change the nginx config, copy it up and reload:

```bash
scp deploy/nginx/weather.codyhurst.com.conf \
    cody@weather.codyhurst.com:/tmp/
ssh cody@weather.codyhurst.com \
    'sudo install -m644 /tmp/weather.codyhurst.com.conf /etc/nginx/sites-available/ \
     && sudo nginx -t && sudo systemctl reload nginx'
```

Always `nginx -t` before reloading. A bad config that fails the test leaves
the previous one running; a bad config that passes the test but is wrong does
not.

---

## Troubleshooting

**certbot fails.** Almost always DNS or a blocked port 80. Check
`getent ahostsv4 weather.codyhurst.com` on the server matches its public IP,
and that nothing upstream is filtering port 80. Re-run `server-setup.sh`.

**`nginx -t` complains about missing certificates.** The vhost references
`/etc/letsencrypt/live/weather.codyhurst.com/` and
`/etc/letsencrypt/options-ssl-nginx.conf`. Both appear after the first
successful issuance. Run `server-setup.sh` again once DNS resolves.

**Media 404s but the app loads.** The library didn't upload, or landed in the
wrong place. Check `ls /var/www/weather.codyhurst.com/assets/` on the server;
it should contain `narration/`, `backgrounds/`, `music/`, etc. directly — not
a nested `assets/` directory.

**Media downloads instead of playing, or fonts don't apply.** MIME types.
Confirm `webp`, `mp3` and `woff2` appear in `/etc/nginx/mime.types`;
`server-setup.sh` warns about this at install time.

**No narration, no errors in the console.** Check the browser network tab for
404s under `/assets/narration/`. Locally, `node scripts/check-asset-refs.mjs`
validates every statically-resolvable asset path in the source.

**Weather Radio silent in the browser but fine in Electron.** The `/nwr/`
proxy isn't working. `curl -I https://weather.codyhurst.com/nwr/status-json.xsl`
should return 200. Without the proxy a browser cannot play these streams at
all — the Icecast host sends no CORS headers, and WebAudio requires them.

**Permission denied in the nginx error log.** Files must be readable by
`www-data`. `server-setup.sh` sets 755 on directories and 644 on files;
`publish.sh` forces the same via `--chmod=D755,F644` on every upload,
deliberately ignoring the source permissions (the repo lives on an NTFS mount
where they're meaningless).

---

## Capacity notes

The app is entirely client-side. Each visitor's browser holds its own
location and settings in its own `localStorage` and talks to api.weather.gov,
api.zippopotam.us and RainViewer from its own IP with its own rate-limit
budget. The server is a static file host plus one stream proxy — there is no
per-user state to scale.

Rough per-visitor bandwidth: 10–25 MB for a normal session (a few
backgrounds, a few dozen narration clips, a music track or two). Weather
Radio adds 32–128 kbps for as long as it's playing, doubled at the server
since each listener holds one upstream connection. Ten concurrent users with
radio and music running is a few Mbit/s — nothing for an OVH box.

The one real cost is the initial 1.3 GB upload from your home connection.
