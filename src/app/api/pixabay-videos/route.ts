import { NextRequest, NextResponse } from "next/server";
import { searchPixabayVideos } from "@/lib/pixabay-videos";

/**
 * GET /api/pixabay-videos?q=icono
 * Returns a small set of Pixabay motion clips for the given query.
 * Requires PIXABAY_API_KEY in the environment.
 */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const clips = await searchPixabayVideos(q, 6);
    return NextResponse.json({ clips });
  } catch (err) {
    console.error("pixabay-videos error:", err);
    return NextResponse.json({ clips: [] }, { status: 500 });
  }
}

