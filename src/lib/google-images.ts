/**
 * Fetch image URLs via Google Image Search (Python scraper), then return as data URLs.
 * No Replicate or Pollinations; uses scripts/google_image_scraper.py.
 */

import { spawn } from "child_process";
import path from "path";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "google_image_scraper.py");
const PYTHON = "python3";

export const DEFAULT_FRAME_COUNT = 15;

/**
 * Run the Python scraper and return raw image URLs (no download).
 */
function runScraper(query: string, count: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const args = [SCRIPT_PATH, query, "--count", String(count)];
    const proc = spawn(PYTHON, args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    proc.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code !== 0) {
        try {
          const err = JSON.parse(stderr || stdout);
          reject(new Error(err.error || "Scraper failed"));
        } catch {
          reject(new Error(stderr || stdout || `Scraper exited ${code}`));
        }
        return;
      }
      try {
        const urls = JSON.parse(stdout) as string[];
        resolve(Array.isArray(urls) ? urls : []);
      } catch {
        reject(new Error("Invalid scraper output"));
      }
    });
  });
}

/**
 * Fetch a single URL and return as data URL (base64).
 */
async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "ClipStudio/1.0" },
  });
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);

  const contentType = res.headers.get("content-type") || "";
  // If this is a small video clip, delegate to Python helper to grab first frame
  if (contentType.startsWith("video/")) {
    return videoUrlToDataUrl(url);
  }

  if (!contentType.startsWith("image/")) {
    throw new Error(`Non-image content-type: ${contentType}`);
  }

  const buf = await res.arrayBuffer();
  // Skip obviously corrupt/placeholder images (very small payloads)
  if (buf.byteLength < 2000) {
    throw new Error("Image too small, likely invalid");
  }

  const base64 = Buffer.from(buf).toString("base64");
  const safeType = contentType || "image/jpeg";
  return `data:${safeType};base64,${base64}`;
}

async function videoUrlToDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pyScript = path.join(process.cwd(), "scripts", "video_first_frame.py");
    const proc = spawn(PYTHON, [pyScript, url], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code !== 0) {
        try {
          const err = JSON.parse(stdout || stderr);
          reject(new Error(err.error || "video_first_frame failed"));
        } catch {
          reject(new Error(stderr || stdout || `video_first_frame exited ${code}`));
        }
        return;
      }
      try {
        const data = JSON.parse(stdout) as { dataUrl?: string; error?: string };
        if (!data.dataUrl) {
          reject(new Error(data.error || "No dataUrl from video_first_frame"));
          return;
        }
        resolve(data.dataUrl);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Fetch multiple URLs and return as data URLs. Skips failures and continues.
 */
async function urlsToDataUrls(urls: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const url of urls) {
    try {
      results.push(await urlToDataUrl(url));
    } catch {
      // skip failed fetches
    }
  }
  return results;
}

/**
 * Get N images for a query: run Google Image Search scraper, then fetch each URL as data URL.
 */
export async function fetchGoogleImagesAsDataUrls(
  query: string,
  count: number = DEFAULT_FRAME_COUNT
): Promise<string[]> {
  const urls = await runScraper(query.trim().slice(0, 500), count);
  // Prefer video URLs first so the stitched video starts with motion when available.
  const sorted = [...urls].sort((a, b) => {
    const av = isLikelyVideoUrl(a);
    const bv = isLikelyVideoUrl(b);
    if (av === bv) return 0;
    return av ? -1 : 1;
  });
  return urlsToDataUrls(sorted.slice(0, count));
}

function isLikelyVideoUrl(u: string): boolean {
  const lower = u.split("?")[0].toLowerCase();
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".m4v")
  );
}

/**
 * Get a single image for a query (e.g. for regenerate frame).
 */
export async function fetchOneGoogleImageAsDataUrl(query: string): Promise<string | null> {
  const dataUrls = await fetchGoogleImagesAsDataUrls(query, 1);
  return dataUrls[0] ?? null;
}
