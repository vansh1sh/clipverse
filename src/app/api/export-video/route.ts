import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { searchPixabayVideos } from "@/lib/pixabay-videos";

export async function POST(request: NextRequest) {
  if (process.env.VERCEL === "1") {
    return NextResponse.json(
      {
        error:
          "Video export is not available on this host (requires Python + MoviePy). Export locally or use a server with Python installed.",
      },
      { status: 503 }
    );
  }

  let tmpDir: string | null = null;
  try {
    const body = await request.json();
    const frameDataUrls = body.frameDataUrls as string[] | undefined;
    // Default to 0.5 fps (2 seconds per frame) if not provided
    const fps = typeof body.fps === "number" ? body.fps : 0.5;
    const trimStart = typeof body.trimStart === "number" ? Math.max(0, body.trimStart) : 0;
    const trimEnd =
      typeof body.trimEnd === "number" ? body.trimEnd : frameDataUrls?.length ?? 0;
    const prompt = typeof body.prompt === "string" ? body.prompt : "";

    if (!Array.isArray(frameDataUrls) || frameDataUrls.length === 0) {
      return NextResponse.json(
        { error: "frameDataUrls array required" },
        { status: 400 }
      );
    }

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clip-"));
    const outPath = path.join(tmpDir, "out.mp4");

    for (let i = 0; i < frameDataUrls.length; i++) {
      const dataUrl = frameDataUrls[i];
      if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) continue;
      const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (!match) continue;
      const base64 = match[1];
      const ext = dataUrl.includes("png") ? "png" : "jpg";
      const num = String(i + 1).padStart(4, "0");
      fs.writeFileSync(path.join(tmpDir, `${num}.${ext}`), Buffer.from(base64, "base64"));
    }

    const framesDir = tmpDir;
    const pyScript = path.join(process.cwd(), "scripts", "stitch_video.py");
    const trimEndVal = Math.min(trimEnd, frameDataUrls.length);

    // Background music: pick a random mp3 from public/music if available.
    let audioPath: string | null = null;
    const musicDir = path.join(process.cwd(), "public", "music");
    if (fs.existsSync(musicDir)) {
      const entries = fs.readdirSync(musicDir);
      const mp3s = entries.filter((name) => name.toLowerCase().endsWith(".mp3"));
      if (mp3s.length > 0) {
        const choice = mp3s[Math.floor(Math.random() * mp3s.length)];
        const full = path.join(musicDir, choice);
        if (fs.existsSync(full)) {
          audioPath = full;
        }
      }
    }

    // Optional motion clips from the provider based on the prompt (intro + mid).
    let introVideoPath: string | null = null;
    let midVideoPath: string | null = null;
    if (prompt.trim()) {
      try {
        const results = await searchPixabayVideos(prompt, 3);
        if (results.length > 0) {
          const introUrl = results[0].url;
          const res = await fetch(introUrl);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const introPath = path.join(tmpDir, "intro.mp4");
            fs.writeFileSync(introPath, Buffer.from(arrayBuffer));
            introVideoPath = introPath;
          }
        }
        if (results.length > 1) {
          const midUrl = results[1].url;
          const resMid = await fetch(midUrl);
          if (resMid.ok) {
            const arrayBufferMid = await resMid.arrayBuffer();
            const midPath = path.join(tmpDir, "mid.mp4");
            fs.writeFileSync(midPath, Buffer.from(arrayBufferMid));
            midVideoPath = midPath;
          }
        }
      } catch {
        // ignore Pixabay failures; export will just use frames
      }
    }

    await new Promise<void>((resolve, reject) => {
      const args = [
        pyScript,
        "--frames-dir",
        framesDir,
        "--fps",
        String(fps),
        "--trim-start",
        String(trimStart),
        "--trim-end",
        String(trimEndVal),
        "--output",
        outPath,
      ];
      if (audioPath) {
        args.push("--audio", audioPath);
      }
      if (introVideoPath) {
        args.push("--intro-video", introVideoPath);
      }
      if (midVideoPath) {
        args.push("--mid-video", midVideoPath);
      }
      const py = spawn("python3", args, { cwd: process.cwd() });
      let stderr = "";
      py.stderr.on("data", (d) => (stderr += d.toString()));
      py.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr || `Python exited ${code}`));
      });
      py.on("error", (err) => reject(err));
      setTimeout(() => {
        py.kill();
        reject(new Error("Export timeout"));
      }, 120000);
    });

    if (!fs.existsSync(outPath)) {
      return NextResponse.json({ error: "Video was not created" }, { status: 500 });
    }

    const videoBuffer = fs.readFileSync(outPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;

    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="export.mp4"',
      },
    });
  } catch (err) {
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
