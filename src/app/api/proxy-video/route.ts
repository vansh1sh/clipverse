import { NextRequest, NextResponse } from "next/server";

// Proxy external video so the client can load it same-origin and extract frames (no CORS taint).
const ALLOWED_ORIGINS = [
  "https://commondatastorage.googleapis.com",
  "http://commondatastorage.googleapis.com",
];

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  const origin = `${parsed.protocol}//${parsed.host}`;
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }
  const res = await fetch(url, {
    headers: { Range: request.headers.get("Range") || "bytes=0-" },
  });
  if (!res.ok) {
    return new NextResponse(res.body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "video/mp4",
        "Accept-Ranges": "bytes",
      },
    });
  }
  const headers = new Headers();
  headers.set("Content-Type", res.headers.get("Content-Type") || "video/mp4");
  const contentRange = res.headers.get("Content-Range");
  if (contentRange) headers.set("Content-Range", contentRange);
  headers.set("Accept-Ranges", "bytes");
  return new NextResponse(res.body, { status: res.status, headers });
}
