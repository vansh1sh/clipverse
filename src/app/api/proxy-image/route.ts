import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "https://images.pexels.com",
  "http://images.pexels.com",
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
  const res = await fetch(url, { headers: { "User-Agent": "ClipStudio/1.0" } });
  if (!res.ok) {
    return new NextResponse(res.body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") || "image/jpeg" },
    });
  }
  const contentType = res.headers.get("Content-Type") || "image/jpeg";
  return new NextResponse(res.body, {
    status: 200,
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600" },
  });
}
