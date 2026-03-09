import { NextRequest, NextResponse } from "next/server";
import { fetchGoogleImagesAsDataUrls } from "@/lib/google-images";

const MAX_PROPAGATE = 60;

/**
 * Propagate frames from a given point (e.g. multiverse branch) using Google Image Search.
 * Returns new frame images as data URLs for the rest of the timeline.
 */
export async function POST(request: NextRequest) {
  try {
    const { prompt, numFrames } = await request.json();
    const count = Math.min(
      MAX_PROPAGATE,
      Math.max(1, parseInt(String(numFrames), 10) || 5)
    );
    const searchQuery = (prompt || "continued scene").trim().slice(0, 500);

    const frameDataUrls = await fetchGoogleImagesAsDataUrls(searchQuery, count);

    return NextResponse.json({
      videoUrl: null,
      frameDataUrls,
      demo: false,
    });
  } catch (err) {
    console.error("Propagate frames error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Propagation failed" },
      { status: 500 }
    );
  }
}
