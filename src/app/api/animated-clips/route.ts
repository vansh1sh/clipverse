import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * GET /api/animated-clips
 * Lists MP4 files under public/animated so the editor can show "Animated inserts".
 */
export async function GET(_req: NextRequest) {
  try {
    const dir = path.join(process.cwd(), "public", "animated");
    if (!fs.existsSync(dir)) {
      return NextResponse.json({ clips: [] });
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const clips = entries
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".mp4"))
      .map((d) => ({
        name: d.name,
        url: `/animated/${encodeURIComponent(d.name)}`,
      }));
    return NextResponse.json({ clips });
  } catch (err) {
    console.error("animated-clips error:", err);
    return NextResponse.json({ clips: [] });
  }
}

