import { NextRequest, NextResponse } from "next/server";
import {
  fetchGoogleImagesAsDataUrls,
  DEFAULT_FRAME_COUNT,
} from "@/lib/google-images";

/**
 * Generate clip from prompt.
 * Uses Google Image Search (Node scraper on Vercel, Python optional locally).
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
