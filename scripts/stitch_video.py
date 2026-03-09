#!/usr/bin/env python3
"""
Stitch a sequence of frame images into a video, with optional trim.
Usage:
  python stitch_video.py --frames-dir DIR [--fps FPS] [--trim-start N] [--trim-end N] [--output OUT]
Requires: moviepy (pip install -r scripts/requirements.txt)
"""
import argparse
import os
import glob

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames-dir", required=True, help="Directory containing frame images (0001.jpg, 0002.jpg, ...)")
    ap.add_argument("--fps", type=float, default=1.0, help="Frames per second")
    ap.add_argument("--trim-start", type=int, default=0, help="First frame index (0-based) to include")
    ap.add_argument("--trim-end", type=int, default=None, help="Last frame index (exclusive); default = all")
    ap.add_argument("--output", default="output.mp4", help="Output video path")
    ap.add_argument("--audio", help="Optional audio file (wav) to use as soundtrack")
    ap.add_argument("--intro-video", help="Optional intro video clip (mp4) to prepend before frames")
    ap.add_argument("--mid-video", help="Optional motion clip (mp4) to insert mid-way between frame halves")
    args = ap.parse_args()

    try:
        from moviepy.editor import ImageSequenceClip, AudioFileClip, VideoFileClip, concatenate_videoclips
    except ImportError:
        print("Install moviepy: pip install -r scripts/requirements.txt", file=__import__("sys").stderr)
        raise SystemExit(1)

    # Discover frames (support 0001.jpg, 1.jpg, frame_01.jpg, etc.)
    dir_path = os.path.abspath(args.frames_dir)
    exts = ("*.jpg", "*.jpeg", "*.png", "*.bmp")
    paths = []
    for ext in exts:
        paths.extend(glob.glob(os.path.join(dir_path, ext)))
    def frame_num(p):
        b = os.path.basename(p)
        try:
            return int(b.split(".")[0])
        except ValueError:
            return 0
    paths.sort(key=frame_num)

    if not paths:
        print("No frame images found in", dir_path, file=__import__("sys").stderr)
        raise SystemExit(1)

    end = args.trim_end if args.trim_end is not None else len(paths)
    start = max(0, args.trim_start)
    end = min(len(paths), end)
    if start >= end:
        print("Invalid trim range", start, end, file=__import__("sys").stderr)
        raise SystemExit(1)

    selected = paths[start:end]

    # Build list of clips: optional intro video, frame sequence (optionally split), optional mid video.
    clips = []

    def load_trimmed_video(path: str, target_size):
        clip = VideoFileClip(path)
        max_len = 5
        if clip.duration > max_len:
            clip = clip.subclip(0, max_len)
        if target_size is not None:
            clip = clip.resize(target_size)
        return clip

    # Prepare frame clips (possibly split in two if a mid-video is provided).
    has_mid = bool(args.mid_video)
    if has_mid and len(selected) > 1:
        mid_index = len(selected) // 2
        first_frames = selected[:mid_index]
        second_frames = selected[mid_index:]
        frame_clip_1 = ImageSequenceClip(first_frames, fps=args.fps)
        frame_clip_2 = ImageSequenceClip(second_frames, fps=args.fps) if second_frames else None
    else:
        frame_clip_1 = ImageSequenceClip(selected, fps=args.fps)
        frame_clip_2 = None

    target_size = frame_clip_1.size

    # Optional intro video segment (treated as real video, not frames).
    if args.intro_video:
        intro_path = os.path.abspath(args.intro_video)
        if os.path.exists(intro_path):
            try:
                intro_clip = load_trimmed_video(intro_path, target_size)
                clips.append(intro_clip)
            except Exception as e:
                print(f"Warning: failed to attach intro video: {e}", file=__import__("sys").stderr)

    clips.append(frame_clip_1)

    # Optional mid video segment between two halves of the frame sequence.
    if args.mid_video and frame_clip_2 is not None:
        mid_path = os.path.abspath(args.mid_video)
        if os.path.exists(mid_path):
            try:
                mid_clip = load_trimmed_video(mid_path, target_size)
                clips.append(mid_clip)
            except Exception as e:
                print(f"Warning: failed to attach mid video: {e}", file=__import__("sys").stderr)
        clips.append(frame_clip_2)

    clip = concatenate_videoclips(clips)

    # Optional audio track
    if args.audio:
        try:
            audio_clip = AudioFileClip(os.path.abspath(args.audio))
            # If narration is longer, trim; if shorter, leave natural silence at the end
            if audio_clip.duration > clip.duration:
                audio = audio_clip.subclip(0, clip.duration)
            else:
                audio = audio_clip
            clip = clip.set_audio(audio)
        except Exception as e:
            print(f"Warning: failed to attach audio: {e}", file=__import__("sys").stderr)
    out_path = os.path.abspath(args.output)
    clip.write_videofile(out_path, codec="libx264", audio=True, audio_codec="aac", logger=None)
    clip.close()
    print(out_path)


if __name__ == "__main__":
    main()
