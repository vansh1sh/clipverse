#!/usr/bin/env python3
"""
Scrape image URLs from Google Image Search (no API, parsing HTML/JS).
Usage:
  python google_image_scraper.py "search query" [--count N] [--download DIR]
Output: JSON array of image URLs to stdout, or download to DIR if --download given.

Requires: requests (pip install requests). Optional: beautifulsoup4 for cleaner parsing.

Note: Scraping Google may violate their ToS. Use responsibly and consider rate limiting.
"""

import argparse
import json
import re
import sys
import time
import urllib.parse
from pathlib import Path

try:
    import requests
except ImportError:
    print('{"error": "Install requests: pip install requests"}', file=sys.stderr)
    sys.exit(1)

GOOGLE_IMAGE_SEARCH_URL = "https://www.google.com/search"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
DEFAULT_COUNT = 20
REQUEST_DELAY = 1.0  # seconds between requests if paginating


def decode_google_url(s: str) -> str:
    """Decode unicode escapes Google uses in embedded JSON."""
    try:
        return s.encode("utf-8").decode("unicode_escape")
    except Exception:
        return s


def extract_image_urls(html: str, limit: int = 100) -> list[str]:
    """
    Parse Google Image Search page HTML for image URLs.
    Google embeds URLs in script content and data attributes.
    """
    seen = set()
    urls: list[str] = []

    # Pattern 1: "ou":"https://..." (original image URL in JSON)
    for m in re.finditer(r'"ou"\s*:\s*"(https?://[^"]+)"', html):
        u = m.group(1)
        u = decode_google_url(u.replace("\\u003d", "=").replace("\\u0026", "&"))
        if u not in seen and _looks_like_image_url(u):
            seen.add(u)
            urls.append(u)
            if len(urls) >= limit:
                return urls

    # Pattern 2: ["https://...", width, height] style in script
    for m in re.finditer(r'\[\s*"(https://[^"]+)"\s*,\s*\d+\s*,\s*\d+\s*\]', html):
        u = m.group(1)
        u = decode_google_url(u.replace("\\u003d", "=").replace("\\u0026", "&"))
        if u not in seen and _looks_like_image_url(u):
            seen.add(u)
            urls.append(u)
            if len(urls) >= limit:
                return urls

    # Pattern 3: ,"https://...", (comma-quoted URL)
    for m in re.finditer(r',\s*"(https://[^"]+)"\s*,', html):
        u = m.group(1)
        u = decode_google_url(u.replace("\\u003d", "=").replace("\\u0026", "&"))
        if u not in seen and _looks_like_image_url(u) and "google" not in u.lower():
            seen.add(u)
            urls.append(u)
            if len(urls) >= limit:
                return urls

    return urls


def _looks_like_image_url(url: str) -> bool:
    """Filter out obvious non-image or tracking URLs."""
    url_lower = url.lower()
    skip = (
        "gstatic.com/safe_image" in url_lower
        or "encrypted-tbn0.gstatic.com" in url_lower
        or "images?q=tbn:" in url_lower
        or "favicon" in url_lower
        or url_lower.endswith(".js")
        or url_lower.endswith(".css")
    )
    return not skip


def fetch_search_page(query: str, start: int = 0) -> str:
    """Fetch one page of Google Image Search results."""
    params = {
        "q": query,
        "tbm": "isch",
        "ijn": start,  # page index (0 = first ~100, 1 = next, etc.)
    }
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    r = requests.get(
        GOOGLE_IMAGE_SEARCH_URL,
        params=params,
        headers=headers,
        timeout=15,
    )
    r.raise_for_status()
    return r.text


def download_image(url: str, path: Path, session: requests.Session) -> bool:
    """Download a single image to path. Returns True on success."""
    try:
        r = session.get(url, timeout=10, stream=True)
        r.raise_for_status()
        path.write_bytes(r.content)
        return True
    except Exception:
        return False


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scrape image URLs from Google Image Search (no API)."
    )
    parser.add_argument(
        "query",
        nargs="+",
        help="Search query (words)",
    )
    parser.add_argument(
        "-n",
        "--count",
        type=int,
        default=DEFAULT_COUNT,
        metavar="N",
        help=f"Max number of image URLs to return (default: {DEFAULT_COUNT})",
    )
    parser.add_argument(
        "-d",
        "--download",
        metavar="DIR",
        help="Download images into this directory instead of printing URLs",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=REQUEST_DELAY,
        help="Delay in seconds between requests (default: 1.0)",
    )
    args = parser.parse_args()
    query = " ".join(args.query).strip()
    if not query:
        print(json.dumps({"error": "Provide a search query"}), file=sys.stderr)
        sys.exit(1)

    urls: list[str] = []
    try:
        for page in range(2):  # first 2 pages usually enough for dozens of URLs
            html = fetch_search_page(query, start=page)
            new_urls = extract_image_urls(html, limit=args.count - len(urls))
            for u in new_urls:
                if u not in urls:
                    urls.append(u)
                if len(urls) >= args.count:
                    break
            if len(urls) >= args.count:
                break
            time.sleep(args.delay)
    except requests.RequestException as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

    urls = urls[: args.count]

    if args.download:
        out_dir = Path(args.download)
        out_dir.mkdir(parents=True, exist_ok=True)
        session = requests.Session()
        session.headers["User-Agent"] = USER_AGENT
        downloaded = 0
        for i, url in enumerate(urls):
            ext = ".jpg"
            if ".png" in url.lower().split("?")[0]:
                ext = ".png"
            elif ".gif" in url.lower().split("?")[0]:
                ext = ".gif"
            path = out_dir / f"image_{i:04d}{ext}"
            if download_image(url, path, session):
                downloaded += 1
            time.sleep(0.3)
        print(json.dumps({"downloaded": downloaded, "dir": str(out_dir.absolute())}))
    else:
        print(json.dumps(urls, indent=0))


if __name__ == "__main__":
    main()
