export interface PixabayVideoHit {
  id: number;
  tags: string;
  videos: {
    tiny?: { url: string };
    small?: { url: string };
    medium?: { url: string };
    large?: { url: string };
  };
}

export interface PixabayVideoResponse {
  total: number;
  totalHits: number;
  hits: PixabayVideoHit[];
}

function pickBestVideoUrl(hit: PixabayVideoHit): string | null {
  if (hit.videos.small?.url) return hit.videos.small.url;
  if (hit.videos.tiny?.url) return hit.videos.tiny.url;
  if (hit.videos.medium?.url) return hit.videos.medium.url;
  if (hit.videos.large?.url) return hit.videos.large.url;
  return null;
}

export async function searchPixabayVideos(query: string, perPage = 6) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) {
    console.warn("PIXABAY_API_KEY is not set; skipping Pixabay video search.");
    return [] as { url: string; tags: string }[];
  }
  const q = query.trim() || "cinematic";
  const url = new URL("https://pixabay.com/api/videos/");
  url.searchParams.set("key", key);
  url.searchParams.set("q", q);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("safesearch", "true");

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error("Pixabay videos error:", res.status, await res.text());
    return [];
  }
  const data = (await res.json()) as PixabayVideoResponse;
  if (!data.hits || !Array.isArray(data.hits)) return [];
  return data.hits
    .map((hit) => {
      const url = pickBestVideoUrl(hit);
      if (!url) return null;
      return { url, tags: hit.tags };
    })
    .filter((x): x is { url: string; tags: string } => !!x);
}

