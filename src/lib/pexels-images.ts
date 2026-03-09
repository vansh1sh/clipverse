/**
 * Fetch images from Pexels API and return as data URLs.
 * Used when PEXELS_API_KEY is set so generate/regenerate work on Vercel (no Python).
 */

const PEXELS_API = "https://api.pexels.com/v1/search";

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "ClipVerse/1.0" } });
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error(`Non-image: ${contentType}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 2000) throw new Error("Image too small");
  const base64 = Buffer.from(buf).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

export async function fetchPexelsImagesAsDataUrls(
  query: string,
  count: number,
  apiKey: string
): Promise<string[]> {
  const res = await fetch(
    `${PEXELS_API}?${new URLSearchParams({ query: query.trim().slice(0, 500), per_page: String(Math.min(count, 15)), page: "1" })}`,
    { headers: { Authorization: apiKey } }
  );
  if (!res.ok) {
    const text = await res.text();
    let msg = `Pexels API error: ${res.status}`;
    try {
      const body = JSON.parse(text) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {
      if (text.length < 200) msg = text;
    }
    throw new Error(msg);
  }
  const data = (await res.json()) as { photos?: Array<{ src?: { medium?: string; large?: string; original?: string } }> };
  const photos = data?.photos ?? [];
  const urls = photos
    .map((p) => p.src?.medium ?? p.src?.large ?? p.src?.original ?? "")
    .filter(Boolean)
    .slice(0, count);
  const results: string[] = [];
  for (const url of urls) {
    try {
      results.push(await fetchImageAsDataUrl(url));
    } catch {
      // skip failed fetches
    }
  }
  return results;
}

export async function fetchOnePexelsImageAsDataUrl(
  query: string,
  apiKey: string
): Promise<string | null> {
  const dataUrls = await fetchPexelsImagesAsDataUrls(query, 1, apiKey);
  return dataUrls[0] ?? null;
}
