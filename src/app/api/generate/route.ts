import { NextRequest, NextResponse } from "next/server";
import { fetchGoogleImagesAsDataUrls } from "@/lib/google-images";
import { searchPixabayVideos } from "@/lib/pixabay-videos";

/** Number of short video clips in the timeline (each sampled to ~4 sec). */
const NUM_VIDEO_CLIPS = 3;
/** Number of static images in the timeline. */
const NUM_IMAGES = 10;
/** Frames to sample per video clip (2 frames × 2s = 4 sec per clip). */
const FRAMES_PER_VIDEO_CLIP = 2;

export type GenerateSegment =
  | { type: "video"; url: string }
  | { type: "image"; dataUrl: string };

/**
 * Generate a mixed timeline: 2–3 short video clips (under 5 sec each) + ~10 images.
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

    const [pixabayClips, imageDataUrls] = await Promise.all([
      searchPixabayVideos(cleanPrompt, NUM_VIDEO_CLIPS),
      fetchGoogleImagesAsDataUrls(cleanPrompt, NUM_IMAGES),
    ]);

    const segments: GenerateSegment[] = [];

    // Add 2–3 video segments (client will sample 2 frames each ≈ 4 sec)
    for (let i = 0; i < Math.min(pixabayClips.length, NUM_VIDEO_CLIPS); i++) {
      segments.push({ type: "video", url: pixabayClips[i].url });
    }

    // Add up to 10 image segments
    for (let i = 0; i < Math.min(imageDataUrls.length, NUM_IMAGES); i++) {
      segments.push({ type: "image", dataUrl: imageDataUrls[i] });
    }

    if (segments.length === 0) {
      return NextResponse.json(
        { error: "No images or videos found for this query. Try a different prompt." },
        { status: 502 }
      );
    }

    const totalFrames =
      segments.filter((s) => s.type === "video").length * FRAMES_PER_VIDEO_CLIP +
      segments.filter((s) => s.type === "image").length;
    const duration = totalFrames * 2;

    return NextResponse.json({
      prompt: cleanPrompt,
      segments,
      duration,
      videoUrl: "",
      initialFrames: undefined,
      source: "mixed",
    });
  } catch (err) {
    console.error("Generate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
