import { NextRequest, NextResponse } from "next/server";
import { fetchOneGoogleImageAsDataUrl } from "@/lib/google-images";

/**
 * Regenerate a single frame using the local Google Image Search scraper.
 * Requires Python, so this is disabled on Vercel.
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

    const isVercel = process.env.VERCEL === "1";

    if (isVercel) {
      return NextResponse.json(
        {
          error:
            "Regenerate frame is only available when running locally (requires Python for Google Image Search).",
        },
        { status: 503 }
      );
    }

    const imageDataUrl = await fetchOneGoogleImageAsDataUrl(searchQuery);

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
