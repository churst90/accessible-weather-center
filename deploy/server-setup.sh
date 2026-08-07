#!/usr/bin/env bash
#
# One-time server preparation for weather.codyhurst.com on Debian + nginx.
#
# Run this ON THE SERVER, as root (or via sudo), from a checkout of the repo:
#
#     sudo bash deploy/server-setup.sh
#
# It is idempotent: running it again is safe and will only fix whatever
# drifted. Nothing here uploads content — use deploy/publish.sh from your
# workstation for that.
#
# What it does, in order:
#   1. Sanity-checks the environment (root, Debian, DNS pointing here).
#   2. Installs nginx, certbot and rsync.
#   3. Creates the web root and hands ownership to the deploy user.
#   4. Installs an HTTP-only vhost so Let's Encrypt can answer its challenge.
#   5. Obtains a TLS certificate (webroot mode, so our config stays ours).
#   6. Installs the real vhost, tests it, and reloads nginx.
#
# Output is plain linear text with "==>" step markers and no cursor tricks,
# so it reads cleanly in a screen reader or over a slow SSH link.

set -euo pipefail

DOMAIN="${DOMAIN:-weather.codyhurst.com}"
WEBROOT="${WEBROOT:-/var/www/${DOMAIN}}"
# Account that will own the files and receive rsync pushes.
DEPLOY_USER="${DEPLOY_USER:-${SUDO_USER:-root}}"
EMAIL="${EMAIL:-codythurst@gmail.com}"
# Skip the Let's Encrypt step (useful when re-running, or behind another proxy).
SKIP_TLS="${SKIP_TLS:-0}"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VHOST_SRC="${REPO_DIR}/deploy/nginx/${DOMAIN}.conf"
VHOST_DST="/etc/nginx/sites-available/${DOMAIN}.conf"

step()  { printf '\n==> %s\n' "$*"; }
info()  { printf '    %s\n' "$*"; }
warn()  { printf '    WARNING: %s\n' "$*" >&2; }
die()   { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- checks ---
step "Checking environment"

[ "$(id -u)" -eq 0 ] || die "Must run as root. Try: sudo bash deploy/server-setup.sh"

if [ -r /etc/os-release ]; then
    . /etc/os-release
    info "OS: ${PRETTY_NAME:-unknown}"
    case "${ID:-}${ID_LIKE:-}" in
        *debian*|*ubuntu*) ;;
        *) warn "This script targets Debian/Ubuntu. Package steps may not apply." ;;
    esac
fi

[ -f "$VHOST_SRC" ] || die "vhost template not found at ${VHOST_SRC} (run from a repo checkout)"

info "Domain:      ${DOMAIN}"
info "Web root:    ${WEBROOT}"
info "Deploy user: ${DEPLOY_USER}"

id -u "$DEPLOY_USER" >/dev/null 2>&1 || die "Deploy user '${DEPLOY_USER}' does not exist. Create it first, or set DEPLOY_USER=."

# DNS is the single most common reason certbot fails. Check before installing.
step "Checking DNS for ${DOMAIN}"
resolved="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || true)"
public_ip="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || true)"
if [ -z "$resolved" ]; then
    warn "${DOMAIN} does not resolve yet. Add an A record pointing at this server."
    warn "TLS issuance will fail until it does. Continuing with SKIP_TLS behaviour."
    SKIP_TLS=1
elif [ -n "$public_ip" ] && [ "$resolved" != "$public_ip" ]; then
    warn "${DOMAIN} resolves to ${resolved} but this host's public IP looks like ${public_ip}."
    warn "If that is not an intentional proxy, fix DNS before relying on TLS issuance."
else
    info "${DOMAIN} -> ${resolved} (matches this host)"
fi

# ------------------------------------------------------------- packages ---
step "Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx rsync curl
info "nginx: $(nginx -v 2>&1)"

# Debian's mime.types covers these, but a stripped image might not. A missing
# type means the browser refuses the file — silent narration, unstyled page.
step "Checking MIME types for the media library"
for t in webp mp3 woff2; do
    if grep -qw "$t" /etc/nginx/mime.types; then
        info "${t}: present"
    else
        warn "${t} missing from /etc/nginx/mime.types — those files will be served as octet-stream."
    fi
done

# ------------------------------------------------------------ web root ----
step "Creating web root"
mkdir -p "${WEBROOT}/app" "${WEBROOT}/assets"

# Placeholder landing page — created only if absent, so re-running never
# overwrites the real one. publish.sh does not touch this file either.
if [ ! -e "${WEBROOT}/index.html" ]; then
    cat > "${WEBROOT}/index.html" <<HTML
<!doctype html>
<meta charset="utf-8">
<title>Accessible Weather Center</title>
<h1>Accessible Weather Center</h1>
<p>Landing page placeholder. Replace this file with your own page.</p>
<p><a href="/app/">Launch the application</a></p>
HTML
    info "Wrote placeholder ${WEBROOT}/index.html — replace with your landing page."
else
    info "Landing page already present; left untouched."
fi

chown -R "${DEPLOY_USER}:www-data" "$WEBROOT"
# Directories need +x to be traversable; files only need to be readable.
find "$WEBROOT" -type d -exec chmod 755 {} +
find "$WEBROOT" -type f -exec chmod 644 {} +
info "Ownership: ${DEPLOY_USER}:www-data, dirs 755, files 644"

# Report free space — the media library is ~1.3 GB and the upload is the
# slowest part of the whole process. Better to find out now.
avail_kb="$(df -Pk "$WEBROOT" | awk 'NR==2{print $4}')"
info "Free space on the web root filesystem: $(( avail_kb / 1024 )) MB"
[ "$avail_kb" -gt 2500000 ] || warn "Less than ~2.5 GB free; the 1.3 GB media library may not fit."

# ------------------------------------------------------------------ TLS ---
install_vhost() {
    install -m 644 "$VHOST_SRC" "$VHOST_DST"
    ln -sfn "$VHOST_DST" "/etc/nginx/sites-enabled/${DOMAIN}.conf"
}

if [ "$SKIP_TLS" != "1" ] && [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    step "Obtaining TLS certificate"
    # The real vhost references certificate files that do not exist yet, so
    # nginx would refuse to start with it installed. Serve plain HTTP just
    # long enough for the ACME challenge, then swap in the real config.
    cat > "$VHOST_DST" <<CONF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    root ${WEBROOT};
    location ^~ /.well-known/acme-challenge/ { root ${WEBROOT}; default_type "text/plain"; }
    location / { try_files \$uri \$uri/ =404; }
}
CONF
    ln -sfn "$VHOST_DST" "/etc/nginx/sites-enabled/${DOMAIN}.conf"
    nginx -t || die "Bootstrap nginx config failed to validate."
    systemctl reload nginx

    # webroot rather than --nginx: certbot rewrites config files in --nginx
    # mode, and this vhost is version-controlled. Renewal uses the same path.
    certbot certonly --webroot -w "$WEBROOT" -d "$DOMAIN" \
        --non-interactive --agree-tos -m "$EMAIL" \
        || die "certbot failed. Check DNS and that port 80 is reachable, then re-run."
    info "Certificate obtained."
elif [ "$SKIP_TLS" = "1" ]; then
    step "Skipping TLS issuance (SKIP_TLS=1 or DNS not ready)"
    warn "The real vhost expects certificates at /etc/letsencrypt/live/${DOMAIN}/."
    warn "It will not validate until they exist. Re-run this script once DNS resolves."
else
    step "TLS certificate already present"
    info "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem exists; not re-issuing."
fi

# certbot's recommended SSL snippets are referenced by the vhost. On a fresh
# box they may not exist until the first issuance.
for f in /etc/letsencrypt/options-ssl-nginx.conf /etc/letsencrypt/ssl-dhparams.pem; do
    [ -f "$f" ] || warn "${f} is missing; the vhost includes it and nginx -t will fail."
done

# -------------------------------------------------------------- install ---
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    step "Installing the application vhost"
    install_vhost
    rm -f /etc/nginx/sites-enabled/default
    if nginx -t; then
        systemctl reload nginx
        info "nginx reloaded with ${DOMAIN}.conf"
    else
        die "nginx config test failed. The previous config is still live; fix and re-run."
    fi

    step "Verifying renewal"
    certbot renew --dry-run --cert-name "$DOMAIN" >/dev/null 2>&1 \
        && info "Renewal dry-run passed." \
        || warn "Renewal dry-run failed — check 'certbot renew --dry-run' output manually."
fi

# --------------------------------------------------------------- finish ---
step "Done"
cat <<SUMMARY

Next steps, from your workstation:

  1. Publish the app and media library:
         bash deploy/publish.sh --host <user>@${DOMAIN}

     The first run uploads ~1.3 GB. Run it inside tmux or screen so a
     dropped connection doesn't kill it; it resumes cleanly either way.

  2. Replace ${WEBROOT}/index.html with your landing page.

  3. Check it:
         curl -I https://${DOMAIN}/app/
         curl -sI https://${DOMAIN}/nwr/status-json.xsl | head -1

Logs: /var/log/nginx/${DOMAIN}.{access,error}.log
SUMMARY
