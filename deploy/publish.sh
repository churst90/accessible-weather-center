#!/usr/bin/env bash
#
# Publish the app and media library to weather.codyhurst.com.
#
# Run this from your WORKSTATION, in a repo checkout:
#
#     bash deploy/publish.sh --host cody@weather.codyhurst.com
#
# Options:
#   --host USER@HOST   ssh destination (required, or set AWC_HOST)
#   --app-only         upload only the built app (fast, ~2.4 MB)
#   --assets-only      upload only the media library
#   --dry-run          show what rsync would transfer, change nothing
#   --no-build         skip `npm run build` and publish the existing dist/
#   --webroot PATH     remote web root (default /var/www/weather.codyhurst.com)
#   --url URL          public base URL for the post-upload checks. Defaults to
#                      https://<host part of --host>, which is wrong if you
#                      connect via an ssh alias or a bare IP.
#
# What it will NOT do: touch your landing page. It writes only into the
# remote `app/` and `assets/` subdirectories, so index.html at the web root
# is never in scope, even with --delete.
#
# The first asset upload moves ~1.3 GB across ~13,650 files. Run it inside
# tmux or screen; if the link drops, just run it again — rsync resumes and
# re-sends only what is missing.

set -euo pipefail

HOST="${AWC_HOST:-}"
WEBROOT="/var/www/weather.codyhurst.com"
PUBLIC_URL="${AWC_URL:-}"
DO_APP=1
DO_ASSETS=1
DO_BUILD=1
DRY=""

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

step() { printf '\n==> %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
    case "$1" in
        --host)     HOST="${2:-}"; shift 2 ;;
        --webroot)  WEBROOT="${2:-}"; shift 2 ;;
        --url)      PUBLIC_URL="${2:-}"; shift 2 ;;
        --app-only)    DO_ASSETS=0; shift ;;
        --assets-only) DO_APP=0; DO_BUILD=0; shift ;;
        --no-build) DO_BUILD=0; shift ;;
        --dry-run)  DRY="--dry-run"; shift ;;
        -h|--help)  sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) die "Unknown option: $1" ;;
    esac
done

[ -n "$HOST" ] || die "No target. Pass --host USER@HOST or set AWC_HOST."
command -v rsync >/dev/null || die "rsync is not installed locally."

cd "$REPO_DIR"

# Checked before anything slow (an unreachable host takes ~2 min to time out),
# because this is the failure that looks like success.
#
# Vite fingerprints the CSS-referenced fonts into the bundle AT BUILD TIME,
# reading them from assets/. Build without the library and it silently leaves
# absolute /assets/fonts/... URLs in the CSS; they 404 at runtime and every
# theme renders in system fonts. The build reports no error. This is exactly
# what happens when you `git clone` on a server and build there, because
# assets/ is gitignored.
if [ "$DO_BUILD" = "1" ] && [ "$DO_APP" = "1" ]; then
    if [ ! -d assets/fonts ] || [ -z "$(ls -A assets/fonts 2>/dev/null)" ]; then
        die "assets/fonts is missing or empty — refusing to build.

       A build without the media library produces an app that renders in
       system fonts no matter what is on the server.

       Either build on a machine that has the library, or pass --no-build
       and publish a dist/ that was built on one."
    fi
fi

step "Target"
info "host:    ${HOST}"
info "webroot: ${WEBROOT}"
[ -n "$DRY" ] && info "DRY RUN — nothing will be written."

# rsync flags shared by both uploads.
#
#  -r -l -t       recurse, keep symlinks and mtimes
#  --no-perms --no-owner --no-group
#                 ignore source permissions entirely. The repo lives on an
#                 NTFS mount where everything is 777/root-ish; copying that
#                 to the server would be wrong and occasionally unreadable.
#  --chmod        force sane modes on arrival instead.
#  --delete       mirror: files removed locally are removed remotely. Safe
#                 because each invocation is scoped to one subdirectory.
#  --partial      keep partially transferred files so a retry resumes them.
#  --human-readable --stats
#                 plain, screen-reader-friendly summary at the end.
RSYNC_OPTS=(
    -r -l -t
    --no-perms --no-owner --no-group
    --chmod=D755,F644
    --delete
    --partial
    --human-readable
    --stats
    --exclude='.DS_Store'
    --exclude='Thumbs.db'
)
[ -n "$DRY" ] && RSYNC_OPTS+=("$DRY")

# Show per-file progress only on a terminal; in a log it is just noise.
if [ -t 1 ]; then
    RSYNC_OPTS+=(--info=progress2)
fi

step "Checking connectivity"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST" "true" \
    || die "Cannot ssh to ${HOST} non-interactively. Set up key auth first."
ssh "$HOST" "mkdir -p '${WEBROOT}/app' '${WEBROOT}/assets'" \
    || die "Could not create remote directories under ${WEBROOT}."
info "OK"

# ------------------------------------------------------------------ app ---
if [ "$DO_APP" = "1" ]; then
    if [ "$DO_BUILD" = "1" ]; then
        step "Building"
        npm run build
    else
        step "Skipping build (--no-build)"
    fi

    [ -f dist/index.html ] || die "dist/index.html missing — build first, or drop --no-build."
    [ -d dist/static ]     || die "dist/static missing — the build output looks wrong."

    step "Uploading application ($(du -sh dist | cut -f1))"
    # Trailing slash on the source: copy the CONTENTS of dist/ into app/.
    rsync "${RSYNC_OPTS[@]}" dist/ "${HOST}:${WEBROOT}/app/"
fi

# --------------------------------------------------------------- assets ---
if [ "$DO_ASSETS" = "1" ]; then
    [ -d assets ] || die "assets/ not found."
    count="$(find assets -type f | wc -l)"
    size="$(du -sh assets | cut -f1)"

    step "Uploading media library (${count} files, ${size})"
    info "First run transfers everything; later runs send only what changed."
    rsync "${RSYNC_OPTS[@]}" \
        --exclude='_transcode-report.json' \
        --exclude='_verify-problems.json' \
        assets/ "${HOST}:${WEBROOT}/assets/"
fi

# ---------------------------------------------------------------- check ---
if [ -z "$DRY" ]; then
    step "Verifying"
    # An ssh alias or IP in --host would produce a nonsense URL here, so
    # --url / AWC_URL overrides it.
    base="${PUBLIC_URL:-https://$(printf '%s' "$HOST" | sed 's/.*@//')}"
    base="${base%/}"

    check() {
        local url="$1" want="$2" code
        code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$url" || echo 000)"
        if [ "$code" = "$want" ]; then
            info "OK   ${code}  ${url}"
        else
            info "FAIL ${code} (expected ${want})  ${url}"
            return 1
        fi
    }

    rc=0
    check "${base}/app/" 200 || rc=1
    # A known-good media file proves the library is readable end to end.
    check "${base}/assets/sounds/TWC_Mnemonic.mp3" 200 || rc=1
    check "${base}/nwr/status-json.xsl" 200 || rc=1
    # A missing clip must 404, not fall through to the SPA shell.
    check "${base}/assets/definitely-not-a-real-file.mp3" 404 || rc=1

    if [ "$rc" -eq 0 ]; then
        step "Published successfully"
        info "${base}/app/"
    else
        step "Published, but some checks failed"
        info "Check /var/log/nginx/*.error.log on the server."
        exit 1
    fi
else
    step "Dry run complete"
fi
