"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface CreateClipProps {
  onGenerated: (data: {
    videoUrl: string;
    duration: number;
    prompt: string;
    initialFrames?: string[];
  }) => void;
}

export default function CreateClip({ onGenerated }: CreateClipProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      onGenerated({
        videoUrl: data.videoUrl ?? "",
        duration: data.duration ?? 30,
        prompt: data.prompt || prompt,
        initialFrames: data.initialFrames,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col items-center mb-10">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-2">
          ClipVerse
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-md">
          Turn a prompt into a short cinematic video. Edit and branch in the editor.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Describe your video
        </label>
        <textarea
          data-testid="create-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. A serene sunset over the ocean with waves gently rolling onto the shore..."
          className="w-full h-28 px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-black/50 focus:border-black dark:focus:ring-white/50 dark:focus:border-white resize-none"
          disabled={loading}
        />
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <button
          type="submit"
          data-testid="generate-btn"
          disabled={loading}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-black hover:bg-gray-800 disabled:bg-gray-500 text-white font-medium transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating…
            </>
          ) : (
            "Generate clip"
          )}
        </button>
      </form>
    </div>
  );
}
