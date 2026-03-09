#!/usr/bin/env python3
"""
Fetch image URLs from Pexels API by keyword.
Usage: python get_images.py "your search query"
Output: JSON array of { "url", "alt", "photographer" } to stdout.
Requires: PEXELS_API_KEY env var, requests (pip install -r requirements.txt)
"""
import os
import sys
import json
import urllib.parse

try:
    import requests
except ImportError:
    print(json.dumps({"error": "Install requests: pip install -r scripts/requirements.txt"}), file=sys.stderr)
    sys.exit(1)

def main():
    api_key = os.environ.get("PEXELS_API_KEY")
    if not api_key:
        print(json.dumps({"error": "PEXELS_API_KEY not set"}), file=sys.stderr)
        sys.exit(1)

    query = " ".join(sys.argv[1:]).strip() if len(sys.argv) > 1 else ""
    if not query:
        print(json.dumps({"error": "Usage: python get_images.py \"search terms\""}), file=sys.stderr)
        sys.exit(1)

    url = "https://api.pexels.com/v1/search"
    headers = {"Authorization": api_key}
    params = {"query": query, "per_page": 10, "page": 1}

    try:
        r = requests.get(url, headers=headers, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
    except requests.RequestException as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

    out = []
    for photo in data.get("photos", []):
        # Prefer medium size for thumbnails/frames
        src = photo.get("src", {})
        img_url = src.get("medium") or src.get("large") or src.get("original")
        if img_url:
            out.append({
                "url": img_url,
                "alt": photo.get("alt") or query,
                "photographer": photo.get("photographer", ""),
            })
    print(json.dumps(out))

if __name__ == "__main__":
    main()
