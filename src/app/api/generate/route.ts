import { NextRequest, NextResponse } from "next/server";
import {
  fetchGoogleImagesAsDataUrls,
  DEFAULT_FRAME_COUNT,
} from "@/lib/google-images";

/**
 * Generate clip from prompt.
 * Uses the local Google Image Search scraper (Python) and therefore
 * only works in environments where Python is installed.
 */
export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const cleanPrompt = prompt.trim();
    const isVercel = process.env.VERCEL === "1";

    // On Vercel (no Python runtime), generation is disabled.
    if (isVercel) {
      return NextResponse.json(
        {
          error:
            "Prompt-to-clip generation is only available when running locally (requires Python for Google Image Search).",
        },
        { status: 503 }
      );
    }

    const initialFrames = await fetchGoogleImagesAsDataUrls(
      cleanPrompt,
      DEFAULT_FRAME_COUNT
    );

    if (initialFrames.length === 0) {
      return NextResponse.json(
        { error: "No images found for this query. Try a different prompt." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      videoUrl: "",
      duration: initialFrames.length * 2,
      prompt: cleanPrompt,
      initialFrames,
      source: "google-images",
    });
  } catch (err) {
    console.error("Generate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
