# ClipVerse

**Prompt → cinematic clip. Change one frame, get a new ending.**

Turn a text prompt into a short video made of 2–3 video clips and ~10 images. Edit any frame (upload, search, or regenerate with a new prompt); all frames to the right update so you get **alternate endings** in one timeline. Branch into multiverses and compare versions side by side.

### Features

- **Mixed timeline** — Video clips (Pixabay) + images (Google) from one prompt
- **Alternate endings** — Replace a frame with a new prompt; every frame to the right refreshes with new content
- **Multiverse branches** — Fork the timeline, edit in place, switch between Main and branches
- **Motion on images** — Ken Burns (pan/zoom) on image frames; smooth crossfade between frames
- **Export** — Download the final sequence as video (MP4 when Python/ffmpeg available)

### Live

[clipverse-six.vercel.app](https://clipverse-six.vercel.app)

### Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Optional: set `PIXABAY_API_KEY` for video clips; add `scripts/requirements.txt` + Python for export.
