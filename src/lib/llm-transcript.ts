import fetch from "node-fetch";

export async function generateTranscriptLinesWithLLM(
  prompt: string,
  frameCount: number
): Promise<string[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const model =
    process.env.OPENROUTER_MODEL ?? "google/gemma-3-4b-it:free";

  const systemPrompt =
    "You are a brief, cinematic narrator. Write short, natural sentences (8-14 words) describing a video. Avoid scene numbers or headings.";

  const userPrompt = `
Write ${frameCount} narration sentences for a short video about:
"${prompt}"

Each sentence should:
- be understandable on its own
- sound like a human voice-over
- avoid labels like "scene", "frame" or numbering

Return ONLY a valid JSON array of strings, like:
["First sentence", "Second sentence", ...]
`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-OpenRouter-Title": "ClipVerse",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [{ type: "text", text: userPrompt }],
          },
        ],
        max_tokens: frameCount * 32,
        temperature: 0.8,
      }),
    });

    if (!res.ok) {
      console.error("LLM transcript error:", await res.text());
      return null;
    }

    const data = await res.json();
    const msg = data?.choices?.[0]?.message;

    let rawContent: unknown = msg?.content;
    let contentText: string | null = null;

    if (typeof rawContent === "string") {
      contentText = rawContent;
    } else if (Array.isArray(rawContent)) {
      // OpenRouter may return an array of content parts
      const textParts = rawContent
        .filter(
          (part: any) =>
            part &&
            (part.type === "text" || typeof part.text === "string")
        )
        .map((part: any) => part.text ?? "")
        .filter((t: string) => t && t.trim().length > 0);
      contentText = textParts.join("\n");
    }

    if (!contentText || typeof contentText !== "string") {
      console.error("LLM transcript: unexpected response shape", data);
      return null;
    }

    let sentences: string[] | null = null;
    try {
      const parsed = JSON.parse(contentText);
      if (Array.isArray(parsed)) {
        sentences = parsed
          .map((s) => (typeof s === "string" ? s.trim() : ""))
          .filter(Boolean);
      }
    } catch {
      // Fallback: try splitting on newlines if not valid JSON
      sentences = contentText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (!sentences || sentences.length === 0) {
      console.error("LLM transcript: no usable sentences from content:", content);
      return null;
    }

    const lines: string[] = [];
    for (let i = 0; i < frameCount; i++) {
      lines.push(sentences[i] ?? sentences[sentences.length - 1]);
    }
    return lines;
  } catch (err) {
    console.error("LLM transcript exception:", err);
    return null;
  }
}

