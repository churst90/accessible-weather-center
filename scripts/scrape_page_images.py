"""
Download a web page and all images referenced from it.

Usage:
    python scrape_page_images.py <url> <outdir>

Saves:
    <outdir>/page.html         — the raw HTML
    <outdir>/images/           — every <img src> referenced by the page
    <outdir>/manifest.txt      — list of (original URL, local filename) pairs

No external deps. Uses stdlib only so it runs on any Python 3.8+.
Spoofs a browser User-Agent to get past common hotlink filters.
Skips Cloudflare JS-challenge pages (detects "Just a moment..." title).
"""

from __future__ import annotations
import os
import re
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


class ImgCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.images: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "img":
            return
        d = dict(attrs)
        srcset = d.get("srcset")
        # Prefer highest-density candidate from srcset, else data-src, else src.
        src = None
        if srcset:
            # srcset: "url1 1x, url2 2x, url3 3x" — candidates separated by comma,
            # each candidate is "<url> <descriptor>". We want the URL from the
            # highest descriptor candidate (usually the last).
            candidates = [c.strip() for c in srcset.split(",") if c.strip()]
            if candidates:
                last = candidates[-1]
                # First whitespace-separated token is the URL.
                src = last.split()[0]
        if not src:
            src = d.get("data-src") or d.get("src")
        if not src:
            return
        self.images.append(src)


def safe_filename(url: str, idx: int) -> str:
    parsed = urllib.parse.urlparse(url)
    base = os.path.basename(parsed.path) or f"img{idx}"
    base = urllib.parse.unquote(base)
    base = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    if not os.path.splitext(base)[1]:
        base += ".bin"
    return f"{idx:03d}_{base}"


def main(url: str, outdir: str) -> int:
    out = Path(outdir)
    (out / "images").mkdir(parents=True, exist_ok=True)

    print(f"Fetching {url}")
    try:
        html = fetch(url)
    except Exception as e:
        print(f"  FAILED: {e}")
        return 1

    text = html.decode("utf-8", errors="replace")

    if "Just a moment..." in text[:2000] or "cf-chl-opt" in text:
        print("  Cloudflare JS challenge detected — cannot bypass without a real browser.")
        print("  Skipping this URL.")
        return 2

    (out / "page.html").write_bytes(html)

    collector = ImgCollector()
    collector.feed(text)

    manifest: list[str] = []
    for idx, raw in enumerate(collector.images):
        abs_url = urllib.parse.urljoin(url, raw)
        if abs_url.startswith("data:"):
            continue
        fn = safe_filename(abs_url, idx)
        target = out / "images" / fn
        try:
            data = fetch(abs_url)
            target.write_bytes(data)
            manifest.append(f"{abs_url}\t{fn}\t{len(data)}")
            print(f"  [{idx+1}/{len(collector.images)}] {fn} ({len(data)} bytes)")
        except Exception as e:
            manifest.append(f"{abs_url}\tFAILED\t{e}")
            print(f"  [{idx+1}/{len(collector.images)}] FAILED {abs_url}: {e}")

    (out / "manifest.txt").write_text("\n".join(manifest), encoding="utf-8")
    print(f"Done. {len(manifest)} entries in manifest.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    sys.exit(main(sys.argv[1], sys.argv[2]))
