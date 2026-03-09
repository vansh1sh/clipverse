// LLM-generated narration for frames (optional).
// In the deployed build we keep this as a no-op helper so it never
// blocks or breaks the build when OPENROUTER_API_KEY is unset.

export async function generateTranscriptLinesWithLLM(): Promise<string[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  // If you want to enable LLM narration, implement the API call here.
  return null;
}

