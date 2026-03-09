import { NextRequest, NextResponse } from "next/server";
import { fetchOneGoogleImageAsDataUrl } from "@/lib/google-images";
import { fetchOnePexelsImageAsDataUrl } from "@/lib/pexels-images";

/**
 * Regenerate a single frame. Uses Pexels when PEXELS_API_KEY is set (Vercel-safe);
 * otherwise uses Google Image Search (Python scraper).
 */
export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    const searchQuery = (prompt || "scene").trim().slice(0, 500);
    if (!searchQuery) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const pexelsKey = process.env.PEXELS_API_KEY;
    const imageDataUrl = pexelsKey
      ? await fetchOnePexelsImageAsDataUrl(searchQuery, pexelsKey)
      : await fetchOneGoogleImageAsDataUrl(searchQuery);

    if (!imageDataUrl) {
      return NextResponse.json(
        { error: "No image found for this query" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      imageDataUrl,
      videoUrl: null,
      demo: false,
    });
  } catch (err) {
    console.error("Regenerate frame error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Regeneration failed" },
      { status: 500 }
    );
  }
}
