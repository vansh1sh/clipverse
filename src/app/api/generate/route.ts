import { NextRequest, NextResponse } from "next/server";
import {
  fetchGoogleImagesAsDataUrls,
  DEFAULT_FRAME_COUNT,
} from "@/lib/google-images";
import { fetchPexelsImagesAsDataUrls } from "@/lib/pexels-images";

/**
 * Generate clip from prompt. Uses Pexels when PEXELS_API_KEY is set (Vercel-safe);
 * otherwise uses Google Image Search (Python scraper, requires local/VPS).
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
    const pexelsKey = process.env.PEXELS_API_KEY;
    let initialFrames: string[];
    let source: string;

    if (pexelsKey) {
      initialFrames = await fetchPexelsImagesAsDataUrls(
        cleanPrompt,
        DEFAULT_FRAME_COUNT,
        pexelsKey
      );
      source = "pexels";
    } else {
      initialFrames = await fetchGoogleImagesAsDataUrls(
        cleanPrompt,
        DEFAULT_FRAME_COUNT
      );
      source = "google-images";
    }

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
      source,
    });
  } catch (err) {
    console.error("Generate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
