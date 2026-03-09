import { NextRequest, NextResponse } from "next/server";

const PEXELS_API = "https://api.pexels.com/v1/search";

const json = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim();
    if (!query) {
      return json({ error: "Missing query param 'q'" }, 400);
    }

    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      return json(
        { error: "Set PEXELS_API_KEY in .env (get one at https://www.pexels.com/api)" },
        503
      );
    }

    const res = await fetch(
      `${PEXELS_API}?${new URLSearchParams({ query, per_page: "10", page: "1" })}`,
      { headers: { Authorization: apiKey } }
    );
    const raw = await res.text();
    if (!res.ok) {
      let msg = `Pexels API error: ${res.status}`;
      try {
        const body = JSON.parse(raw) as { error?: string };
        if (body?.error && typeof body.error === "string") msg = body.error;
      } catch {
        if (raw.startsWith("<") || raw.length > 200) msg = `Pexels API error: ${res.status}`;
      }
      return json({ error: msg }, 502);
    }
    let data: { photos?: Array<{ src?: { medium?: string; large?: string; original?: string }; alt?: string; photographer?: string }> };
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      return json({ error: "Pexels returned invalid JSON" }, 502);
    }
    const photos = data?.photos ?? [];
    const out = photos.map((p) => {
      const src = p.src ?? {};
      const url = src.medium ?? src.large ?? src.original ?? "";
      return {
        url,
        alt: p.alt ?? query,
        photographer: p.photographer ?? "",
      };
    }).filter((x) => x.url);
    return json(out);
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Search failed" },
      500
    );
  }
}
