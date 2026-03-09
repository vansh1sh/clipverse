import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * GET /api/theme-music
 * Returns a random background music track from public/music/*.mp3.
 * Response: { url } where url is /music/<file>.mp3 or null if none exist.
 */
export async function GET(_request: NextRequest) {
  try {
    const musicDir = path.join(process.cwd(), "public", "music");
    if (!fs.existsSync(musicDir)) {
      return NextResponse.json({ url: null });
    }
    const entries = fs.readdirSync(musicDir);
    const mp3s = entries.filter((name) =>
      name.toLowerCase().endsWith(".mp3")
    );
    if (mp3s.length === 0) {
      return NextResponse.json({ url: null });
    }
    const choice = mp3s[Math.floor(Math.random() * mp3s.length)];
    return NextResponse.json({ url: `/music/${choice}` });
  } catch (err) {
    console.error("Theme music error:", err);
    return NextResponse.json(
      { error: "Failed to get theme music" },
      { status: 500 }
    );
  }
}
