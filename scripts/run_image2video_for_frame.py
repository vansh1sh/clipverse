#!/usr/bin/env python3
"""
Helper script to animate a single frame image using the Image2Video (First Order Motion Model) repo.

Usage:
  python run_image2video_for_frame.py \
    --image /Users/vansh/Downloads/frame_for_animation.jpg \
    --driving-video /Users/vansh/Downloads/drive.mp4 \
    --repo-dir /Users/vansh/Downloads/Image2Video \
    --output /Users/vansh/video-clip-creator/public/animated/frame_animated.mp4

Notes:
  - You must have already cloned the repo:
        git clone https://github.com/JoaoLages/Image2Video.git
  - And installed its requirements (from inside that repo):
        bash requirements.sh
  - This script just delegates to `python main.py` in that repo and then copies
    the `generated_video.mp4` result to the desired output path.
"""

import argparse
import os
import shutil
import subprocess
import sys


def run():
  ap = argparse.ArgumentParser()
  ap.add_argument("--image", required=True, help="Path to the source frame image (jpg/png)")
  ap.add_argument("--driving-video", required=True, help="Path to the driving video (mp4)")
  ap.add_argument(
    "--repo-dir",
    required=True,
    help="Path to the cloned Image2Video repository (where main.py lives)",
  )
  ap.add_argument(
    "--output",
    required=True,
    help="Path where the animated video should be written (e.g. public/animated/frame_animated.mp4)",
  )
  args = ap.parse_args()

  repo_dir = os.path.abspath(args.repo_dir)
  image_path = os.path.abspath(args.image)
  driving_path = os.path.abspath(args.driving_video)
  output_path = os.path.abspath(args.output)

  if not os.path.isdir(repo_dir):
    print(f"Repo dir not found: {repo_dir}", file=sys.stderr)
    sys.exit(1)
  if not os.path.exists(image_path):
    print(f"Image not found: {image_path}", file=sys.stderr)
    sys.exit(1)
  if not os.path.exists(driving_path):
    print(f"Driving video not found: {driving_path}", file=sys.stderr)
    sys.exit(1)

  main_py = os.path.join(repo_dir, "main.py")
  if not os.path.exists(main_py):
    print(f"main.py not found in repo dir: {main_py}", file=sys.stderr)
    sys.exit(1)

  # Run Image2Video: it will produce generated_video.mp4 in the repo root.
  print("Running Image2Video ...")
  cmd = [sys.executable, "main.py", image_path, driving_path]
  try:
    subprocess.run(cmd, cwd=repo_dir, check=True)
  except subprocess.CalledProcessError as e:
    print(f"Image2Video failed with exit code {e.returncode}", file=sys.stderr)
    sys.exit(e.returncode)

  generated = os.path.join(repo_dir, "generated_video.mp4")
  if not os.path.exists(generated):
    print(f"generated_video.mp4 not found in repo dir: {generated}", file=sys.stderr)
    sys.exit(1)

  os.makedirs(os.path.dirname(output_path), exist_ok=True)
  shutil.copy2(generated, output_path)
  print(f"Animated video written to: {output_path}")


if __name__ == "__main__":
  run()

