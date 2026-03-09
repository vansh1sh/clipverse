#!/usr/bin/env python3
"""
Download a small video clip and extract its first frame as a JPEG data URL.
Usage:
  python video_first_frame.py "https://example.com/video.mp4"
Prints JSON: { "dataUrl": "data:image/jpeg;base64,..." }
Requires: moviepy (pip install -r scripts/requirements.txt)
"""

import sys
import json
import os
import tempfile

try:
    import requests
    from moviepy.editor import VideoFileClip
except ImportError:
    print(json.dumps({"error": "Install moviepy and requests: pip install -r scripts/requirements.txt"}))
    sys.exit(1)


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: video_first_frame.py <url>"}))
        sys.exit(1)

    url = sys.argv[1]
    tmp_dir = tempfile.mkdtemp(prefix="clip-video-")
    video_path = os.path.join(tmp_dir, "video.bin")
    frame_path = os.path.join(tmp_dir, "frame.jpg")

    try:
        # Download video
        with requests.get(url, stream=True, timeout=15) as r:
            r.raise_for_status()
            with open(video_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)

        # Extract first frame
        clip = VideoFileClip(video_path)
        # Save frame at t=0
        clip.save_frame(frame_path, t=0)
        clip.close()

        # Read frame and encode as data URL
        with open(frame_path, "rb") as f:
            b = f.read()
        import base64

        data_url = "data:image/jpeg;base64," + base64.b64encode(b).decode("ascii")
        print(json.dumps({"dataUrl": data_url}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
    finally:
        try:
            if os.path.exists(video_path):
                os.remove(video_path)
            if os.path.exists(frame_path):
                os.remove(frame_path)
            os.rmdir(tmp_dir)
        except Exception:
            pass


if __name__ == "__main__":
    main()

