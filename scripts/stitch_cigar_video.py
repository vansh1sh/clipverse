#!/usr/bin/env python3
"""
Stitch the cigar_images (one per query folder) into a single video with crossfade transitions.
Usage:
  python stitch_cigar_video.py [--images-dir DIR] [--output OUT] [--duration D] [--transition T]
Requires: moviepy (pip install -r scripts/requirements.txt)
"""
import argparse
import os
import sys
from pathlib import Path

def main():
    ap = argparse.ArgumentParser(description="Stitch cigar query images into one video with transitions.")
    ap.add_argument(
        "--images-dir",
        default="cigar_images",
        help="Parent dir with subdirs 0, 1, 2, ... each containing the first image (default: cigar_images)",
    )
    ap.add_argument("--output", "-o", default="cigar_story.mp4", help="Output video path")
    ap.add_argument(
        "--duration",
        "-d",
        type=float,
        default=5.0,
        help="Seconds to show each image (default: 5)",
    )
    ap.add_argument(
        "--transition",
        "-t",
        type=float,
        default=0.8,
        help="Crossfade duration in seconds between images (default: 0.8)",
    )
    ap.add_argument("--fps", type=int, default=24, help="Output video fps (default: 24)")
    args = ap.parse_args()

    try:
        from moviepy import ImageClip, concatenate_videoclips
        try:
            from moviepy.video.fx import CrossFadeIn, CrossFadeOut
        except ImportError:
            CrossFadeIn = CrossFadeOut = None
    except ImportError:
        try:
            from moviepy.editor import ImageClip, concatenate_videoclips
            CrossFadeIn = CrossFadeOut = None  # 1.x uses .crossfadein() on clip
        except ImportError:
            print("Install moviepy: pip install -r scripts/requirements.txt", file=sys.stderr)
            sys.exit(1)

    base = Path(args.images_dir).resolve()
    if not base.is_dir():
        print(f"Not a directory: {base}", file=sys.stderr)
        sys.exit(1)

    # Collect first image in each numbered subdir (0, 1, 2, ...)
    exts = (".jpg", ".jpeg", ".png", ".gif", ".bmp")
    paths = []
    for i in range(20):  # 0..19
        sub = base / str(i)
        if not sub.is_dir():
            break
        found = None
        for ext in exts:
            matches = sorted(sub.glob(f"*{ext}"))
            if matches:
                found = str(matches[0].resolve())
                break
        if found:
            paths.append(found)
        else:
            break  # stop at first folder with no image

    # Fallback: if no numbered subdirs, use all images in base sorted by name
    if not paths:
        for ext in exts:
            paths.extend([str(p) for p in sorted(base.glob(f"*{ext}"))])
        paths = sorted(paths)

    if not paths:
        print(f"No images found under {base}", file=sys.stderr)
        sys.exit(1)

    dur = args.duration
    trans = min(args.transition, dur / 2)
    fps = args.fps

    clips = []
    for p in paths:
        # MoviePy 2 uses duration= in constructor; 1.x uses set_duration()
        try:
            clip = ImageClip(p, duration=dur)
        except TypeError:
            clip = ImageClip(p)
            clip = getattr(clip, "with_duration", clip.set_duration)(dur)
        # Add subtle Ken Burns-style zoom for motion
        try:
            # MoviePy 2: resize accepts a lambda(t)
            clips.append(clip.resize(lambda t: 1.0 + 0.05 * (t / max(dur, 0.001))))
        except TypeError:
            # Fallback: no animated resize available, use static clip
            clips.append(clip)

    # Apply crossfade: first clip fades out at end; middle clips fade in and out; last fades in only
    if CrossFadeIn is not None and CrossFadeOut is not None:
        # MoviePy 2: with_effects([CrossFadeIn(d), CrossFadeOut(d)])
        fx = [clips[0].with_effects([CrossFadeOut(trans)])]
        for c in clips[1:-1]:
            fx.append(c.with_effects([CrossFadeIn(trans), CrossFadeOut(trans)]))
        if len(clips) > 1:
            fx.append(clips[-1].with_effects([CrossFadeIn(trans)]))
    else:
        # MoviePy 1.x: .crossfadeout() / .crossfadein() methods
        fx = [clips[0].crossfadeout(trans)]
        for c in clips[1:-1]:
            fx.append(c.crossfadein(trans).crossfadeout(trans))
        if len(clips) > 1:
            fx.append(clips[-1].crossfadein(trans))

    final = concatenate_videoclips(fx, padding=-trans, method="compose")
    out_path = Path(args.output).resolve()
    final.write_videofile(
        str(out_path),
        fps=fps,
        codec="libx264",
        audio=False,
        logger=None,
    )
    final.close()
    for c in clips:
        c.close()
    print(out_path)


if __name__ == "__main__":
    main()
