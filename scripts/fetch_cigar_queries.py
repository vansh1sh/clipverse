#!/usr/bin/env python3
"""Run google_image_scraper for each query, then stitch all first images into one video with transitions."""
import subprocess
import sys
from pathlib import Path

QUERIES = [
    "indigenous Caribbean people smoking tobacco rolls pre-Columbian illustration",
    "Taíno people smoking tobacco leaves rolled into cigars historical drawing",
    "Christopher Columbus meeting indigenous people smoking tobacco 1492 painting",
    "early tobacco cigar depiction 16th century engraving",
    "Spanish explorers discovering tobacco smoking in the Caribbean artwork",
    "seville spain cigar factory 18th century engraving",
    "old cigar rolling factory workers hand rolling cigars 1800s",
    "Cuban cigar rollers 19th century historical photograph",
    "Havana Cuba cigar production early 1900s factory workers",
    "vintage advertisement Cuban cigars 1920s poster",
    "Winston Churchill smoking cigar historic photograph",
    "Fidel Castro smoking cigar iconic photo",
    "hand rolling premium cigar close up tobacco leaves",
    "premium Cuban cigar on wooden table cinematic lighting",
    "modern luxury cigar lounge people enjoying cigars",
]

def main():
    base = Path(__file__).resolve().parent.parent
    script = base / "scripts" / "google_image_scraper.py"
    out_dir = base / "cigar_images"
    out_dir.mkdir(parents=True, exist_ok=True)

    for i, q in enumerate(QUERIES):
        subdir = out_dir / str(i)
        print(f"[{i+1}/{len(QUERIES)}] {q[:50]}...")
        r = subprocess.run(
            [
                sys.executable,
                str(script),
                q,
                "--download", str(subdir),
                "--count", "1",
                "--delay", "1.5",
            ],
            cwd=str(base),
            capture_output=True,
            text=True,
            timeout=60,
        )
        if r.returncode != 0:
            print(f"  Error: {r.stderr or r.stdout}")
        else:
            print(f"  OK: {r.stdout.strip()}")

    # Stitch first image from each folder into one video with crossfade transitions
    print("\nStitching video with transitions...")
    stitch_script = base / "scripts" / "stitch_cigar_video.py"
    out_video = base / "cigar_story.mp4"
    r2 = subprocess.run(
        [sys.executable, str(stitch_script), "--images-dir", str(out_dir), "--output", str(out_video)],
        cwd=str(base),
        capture_output=True,
        text=True,
        timeout=300,
    )
    if r2.returncode != 0:
        print("Stitch error:", r2.stderr or r2.stdout)
        sys.exit(1)
    print("Video:", r2.stdout.strip())

if __name__ == "__main__":
    main()
