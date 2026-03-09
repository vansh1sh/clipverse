# ClipVerse — prompt to video

ClipVerse is a small web app that turns a short text prompt into a cinematic clip you can tweak frame‑by‑frame.

### What you can do

- **Turn a prompt into a clip**: Type a description and get a sequence of images as a video.
- **Edit frames visually**:
  - Replace any frame with an uploaded image.
  - Regenerate frames from a new prompt.
  - Reorder frames with drag and drop.
- **Control the timing**:
  - Scrub and play/pause on the main preview.
  - Adjust where the clip starts and ends with a trim range.
- **Add motion and music**:
  - Optional intro/mid motion clips between frames.
  - Background music picked automatically from bundled tracks.

### Live site

Once deployed (for example on Vercel), you get:

- A simple homepage where you enter a prompt.
- An editor view with:
  - Main preview player.
  - Right‑hand panel for replacing/regenerating frames and uploading images.
  - Timeline of frames with optional intro/mid motion clips.

### Local setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **(Optional) Enable full export**

   If you want to export final MP4s locally:

   - Install Python 3.
   - Install the video dependencies:

     ```bash
     pip install -r scripts/requirements.txt
     ```

3. **Run the dev server**

   ```bash
   npm run dev
   ```

   Then open `http://localhost:3000` in your browser.
