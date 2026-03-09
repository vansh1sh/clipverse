# Clip Studio — 30s video from prompt

Create 30-second video clips from a text prompt and edit them frame-by-frame.

## Features

- **Prompt to clip**: Enter a description; the app fetches images from Google Image Search and stitches them into a clip (no API keys).
- **Frame editor**: After generation, the app extracts one frame per second (30 frames). You can:
  - **Replace a frame** with an uploaded image or regenerate it with a new prompt.
  - **Reorder frames** by dragging and dropping in the timeline.
  - **Scrub** the video with the seek bar and play/pause.
- **Trim**: Set start/end frame for export (trimmable range).
- **Export**: Download frames as JPEGs or **export video** (MP4) stitched from the current frames using Python + [MoviePy](https://zulko.github.io/moviepy/).

## Setup

1. Install dependencies (already done if you used the create script):
   ```bash
   npm install
   ```

2. **Image source**: Install Python 3 and `pip install -r scripts/requirements.txt` (at least `requests`). The app uses `scripts/google_image_scraper.py` for Google Image Search to fetch clip and frame images.

3. **Export video** (optional): Requires Python 3 and MoviePy. The "Export video" button in the editor stitches the current frame sequence (with your edits and trim range) into an MP4 via `scripts/stitch_video.py`.

5. Run the app:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Testing (browser E2E)

Uses [Playwright](https://playwright.dev) to open a real browser and run the full flow (generate clip → editor → regenerate frame).

1. Start the app (in one terminal):
   ```bash
   npm run dev
   ```

2. Run tests (in another terminal):
   ```bash
   npm run test:e2e          # single run
   npm run test:e2e:loop     # run 5 times
   npm run test:e2e:loop:until-fail   # run until first failure
   npm run test:e2e:ui       # interactive Playwright UI
   ```

Tests reuse the existing dev server on port 3000.

## Deployment

- **GitHub only** — Good for backing up code and sharing. It does **not** run the app; you need a host to have a live site.
- **Vercel** — Runs the UI, editor, timeline, and motion clips, but **does not run generation or export** (no Python runtime). Calls to "Generate clip" and "Regenerate frame" will return a 503 explaining that you should run locally for full functionality.
- **Supabase** — Not used. The app has no database or Supabase integration. You only need Supabase if you add auth, DB, or storage later.
- **With export** — Use a host that runs Node + Python + ffmpeg (e.g. VPS, Railway, Render), or run Export video locally.

**TL;DR:** Push to GitHub, connect to [Vercel](https://vercel.com) for a live demo of the editor UI. For generating clips and exporting video, run locally with Python installed.

## Tech

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- Google Image Search (scraping via `scripts/google_image_scraper.py`) for clip and frame images; no Replicate or Pollinations
- Client-side frame display, drag-and-drop reorder, trim range, frame export
- Python (MoviePy) for stitching frames into MP4
