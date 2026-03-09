import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * TTS via local Piper engine (no API key).
 *
 * Requires:
 * - `pip install piper-tts` (or piper installed so `piper` is on PATH)
 * - A voice model, with path set in PIPER_MODEL_PATH (e.g. /path/to/en_US-amy-medium.onnx)
 *
 * Request body:
 * { transcript: { segments: { text: string }[] } }
 */
export async function POST(req: NextRequest) {
  let tmpDir: string | null = null;
  try {
    const { transcript } = await req.json();
    if (
      !transcript ||
      !Array.isArray(transcript.segments) ||
      transcript.segments.length === 0
    ) {
      return NextResponse.json(
        { error: "Transcript with segments is required" },
        { status: 400 }
      );
    }

    const modelPath = process.env.PIPER_MODEL_PATH;
    if (!modelPath) {
      return NextResponse.json(
        {
          error:
            "PIPER_MODEL_PATH is not set. Install Piper and a voice model, then set PIPER_MODEL_PATH to the .onnx file.",
        },
        { status: 500 }
      );
    }

    const text = transcript.segments.map((s: { text: string }) => s.text).join(" ");

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tts-"));
    const outPath = path.join(tmpDir, "narration.wav");

    await new Promise<void>((resolve, reject) => {
      const p = spawn(
        "piper",
        ["--model", modelPath, "--output_file", outPath],
        { cwd: process.cwd() }
      );

      let stderr = "";
      p.stderr.on("data", (d) => {
        stderr += d.toString();
      });

      p.on("error", (err) => reject(err));
      p.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr || `piper exited with code ${code}`));
      });

      p.stdin.write(text);
      p.stdin.end();
    });

    if (!fs.existsSync(outPath)) {
      throw new Error("Piper did not create an audio file");
    }

    const audioBuffer = fs.readFileSync(outPath);

    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Disposition": 'attachment; filename="narration.wav"',
      },
    });
  } catch (err) {
    console.error("TTS error:", err);
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS failed" },
      { status: 500 }
    );
  }
}

