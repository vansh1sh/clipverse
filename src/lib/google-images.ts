/**
 * Fetch image URLs via Google Image Search, then return as data URLs.
 * Uses a Node (fetch + regex) scraper so it runs on Vercel; falls back to
 * Python script locally when available for consistency with the original scraper.
 */

import { spawn } from "child_process";
import path from "path";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "google_image_scraper.py");
const PYTHON = "python3";
const GOOGLE_IMAGE_SEARCH_URL = "https://www.google.com/search";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const DEFAULT_FRAME_COUNT = 15;

function decodeGoogleUrl(s: string): string {
  return s.replace(/\\u003d/g, "=").replace(/\\u0026/g, "&");
}

function looksLikeImageUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (
    u.includes("gstatic.com/safe_image") ||
    u.includes("encrypted-tbn0.gstatic.com") ||
    u.includes("images?q=tbn:") ||
    u.includes("favicon") ||
    u.endsWith(".js") ||
    u.endsWith(".css")
  )
    return false;
  return true;
}

function extractImageUrls(html: string, limit: number): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  const add = (u: string) => {
    const decoded = decodeGoogleUrl(u);
    if (seen.has(decoded) || !looksLikeImageUrl(decoded)) return;
    seen.add(decoded);
    urls.push(decoded);
  };

  let m: RegExpExecArray | null;
  const re1 = /"ou"\s*:\s*"(https?:\/\/[^"]+)"/g;
  while ((m = re1.exec(html)) !== null && urls.length < limit) add(m[1]);

  const re2 = /\[\s*"(https:\/\/[^"]+)"\s*,\s*\d+\s*,\s*\d+\s*\]/g;
  while ((m = re2.exec(html)) !== null && urls.length < limit) add(m[1]);

  const re3 = /,\s*"(https:\/\/[^"]+)"\s*,/g;
  while ((m = re3.exec(html)) !== null && urls.length < limit) {
    if (!m[1].toLowerCase().includes("google")) add(m[1]);
  }

  const re4 = /"(\d+)"\s*,\s*"(https?:\/\/[^"]+)"/g;
  while ((m = re4.exec(html)) !== null && urls.length < limit) {
    const u = m[2];
    if (u.length > 20 && !u.includes("gstatic.com/safe_image") && !u.includes("favicon")) add(u);
  }

  return urls;
}

/**
 * Fetch one page of Google Image Search results.
 * Uses browser-like headers to reduce bot blocking.
 */
async function fetchSearchPage(query: string, pageIndex: number): Promise<string> {
  const params = new URLSearchParams({
    q: query.trim().slice(0, 500),
    tbm: "isch",
    ijn: String(pageIndex),
  });
  const url = `${GOOGLE_IMAGE_SEARCH_URL}?${params}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Referer: "https://www.google.com/",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Upgrade-Insecure-Requests": "1",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google search failed: ${res.status}`);
  return res.text();
}

/**
 * Fetch Google Image Search results using Node (no Python). Works on Vercel.
 */
async function fetchGoogleImageSearchUrlsNode(
  query: string,
  count: number
): Promise<string[]> {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (let page = 0; page < 2 && urls.length < count; page++) {
    const html = await fetchSearchPage(query, page);
    const pageUrls = extractImageUrls(html, count - urls.length);
    for (const u of pageUrls) {
      if (seen.has(u)) continue;
      seen.add(u);
      urls.push(u);
      if (urls.length >= count) break;
    }
    if (page < 1 && urls.length < count) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return urls.slice(0, count);
}

/**
 * Run the Python scraper and return raw image URLs (local only).
 */
function runScraperPython(query: string, count: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const args = [SCRIPT_PATH, query, "--count", String(count)];
    const proc = spawn(PYTHON, args, {
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
          const err = JSON.parse(stderr || stdout) as { error?: string };
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

const SERPAPI_BASE = "https://serpapi.com/search.json";

/**
 * Fetch image URLs via SerpApi (reliable in prod; requires SERPAPI_KEY).
 * Free tier: 100 searches/month. Get key at https://serpapi.com
 */
async function fetchGoogleImageSearchUrlsSerpApi(
  query: string,
  count: number
): Promise<string[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  const urls: string[] = [];
  for (let ijn = 0; ijn <= 1 && urls.length < count; ijn++) {
    const params = new URLSearchParams({
      engine: "google_images",
      q: query.trim().slice(0, 500),
      api_key: apiKey,
      ijn: String(ijn),
    });
    const res = await fetch(`${SERPAPI_BASE}?${params}`);
    if (!res.ok) return urls;
    const data = (await res.json()) as {
      images_results?: Array<{ original?: string; thumbnail?: string }>;
    };
    const results = data?.images_results ?? [];
    for (const img of results) {
      const u = img.original || img.thumbnail;
      if (typeof u === "string" && u.startsWith("http")) {
        urls.push(u);
        if (urls.length >= count) break;
      }
    }
  }
  return urls.slice(0, count);
}

/**
 * Get image URLs from Google Image Search.
 * In prod (Vercel): use SerpApi if SERPAPI_KEY set, else Node scrape.
 * Locally: try Python, then Node; SerpApi used when key is set.
 */
async function fetchGoogleImageSearchUrls(
  query: string,
  count: number
): Promise<string[]> {
  const isVercel = process.env.VERCEL === "1";

  if (process.env.SERPAPI_KEY) {
    const serp = await fetchGoogleImageSearchUrlsSerpApi(query, count);
    if (serp.length > 0) return serp;
  }

  if (isVercel) {
    return fetchGoogleImageSearchUrlsNode(query, count);
  }
  try {
    return await runScraperPython(query, count);
  } catch {
    return fetchGoogleImageSearchUrlsNode(query, count);
  }
}

/**
 * Fetch a single URL and return as data URL (base64).
 */
async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);

  const contentType = res.headers.get("content-type") || "";
  // Video URLs need Python (video_first_frame.py) locally; on Vercel skip them
  if (contentType.startsWith("video/")) {
    if (process.env.VERCEL === "1") throw new Error("Video URLs not supported on this host");
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
  const urls = await fetchGoogleImageSearchUrls(query.trim().slice(0, 500), count);
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
