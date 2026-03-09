import { NextRequest, NextResponse } from "next/server";
import { fetchGoogleImagesAsDataUrls } from "@/lib/google-images";
import { searchPixabayVideos } from "@/lib/pixabay-videos";

const MAX_PROPAGATE = 60;

/**
 * Propagate frames from a given point (e.g. multiverse branch).
 * Prefers Pixabay video clips when available so more of the timeline is video; falls back to Google Image Search.
 */
export async function POST(request: NextRequest) {
  try {
    const { prompt, numFrames } = await request.json();
    const count = Math.min(
      MAX_PROPAGATE,
      Math.max(1, parseInt(String(numFrames), 10) || 5)
    );
    const baseQuery = (prompt || "continued scene").trim().slice(0, 450);

    // When we need many frames (alternate ending), use only images so each frame is different.
    // One video would give many similar frames; images give one distinct image per frame.
    const useOnlyImages = count > 2;
    if (!useOnlyImages) {
      const pixabayClips = await searchPixabayVideos(baseQuery, 5);
      if (pixabayClips.length > 0) {
        return NextResponse.json({
          videoUrl: pixabayClips[0].url,
          frameDataUrls: [],
          demo: false,
        });
      }
    }

    // Add variation so results differ from original timeline (alternate ending, different take)
    const searchQuery = baseQuery
      ? `${baseQuery} alternate ending different scene cinematic`
      : "cinematic scene variation";
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
