#!/usr/bin/env bash
# Batch-scrape authentic TWC broadcast still sources for the era research
# pass. Skips twcarchive.com (Cloudflare JS challenge — not bypassable from
# a shell). Each page + its images lands under docs/reference/<era>/<source>/.
#
# Usage: scripts/scrape_batch.sh
set -e
cd "$(dirname "$0")/.."
OUT=docs/reference

run() {
  local era="$1" slug="$2" url="$3"
  echo "=== $era / $slug ==="
  python scripts/scrape_page_images.py "$url" "$OUT/$era/$slug" || true
}

# WS3000
run ws3000 wiki            "https://en.wikipedia.org/wiki/WeatherStar"
run ws3000 fandom          "https://weatherchannel.fandom.com/wiki/WeatherStar_III"
run ws3000 handwiki        "https://handwiki.org/wiki/Engineering:WeatherStar"
run ws3000 twcclassics-flv "https://twcclassics.com/information/weatherstar-3000-jr-flavors.html"
run ws3000 twcclassics-tml "https://twcclassics.com/information/weatherstar-3000-jr-timelines.html"

# WS4000
run ws4000 fandom          "https://weatherchannel.fandom.com/wiki/WeatherStar_4000"
run ws4000 twcclassics-tml "https://twcclassics.com/information/weatherstar-4000-timeline.html"

# WSJr
run wsjr fandom            "https://weatherchannel.fandom.com/wiki/WeatherStar_Jr."

# IS1 — one page covers all three visual eras
run is1 wiki-wx            "https://en.wikipedia.org/wiki/IntelliStar"
run is1 fandom             "https://weatherchannel.fandom.com/wiki/IntelliStar"
run is1 handwiki           "https://handwiki.org/wiki/Engineering:IntelliStar"
run is1 twcclassics        "https://twcclassics.com/information/intellistar-flavors.html"
run is1 mdpi               "https://encyclopedia.pub/entry/34868"

# IS2 HD / Jr
run is2 everybody-hd       "https://en.everybodywiki.com/IntelliStar_2"
run is2 everybody-jr       "https://en.everybodywiki.com/IntelliStar_2_Jr"
run is2 wiki-lot8s         "https://en.wikipedia.org/wiki/Local_on_the_8s"

echo
echo "Batch complete. Browse results under $OUT/"
