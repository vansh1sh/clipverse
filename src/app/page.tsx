"use client";

import { useState } from "react";
import CreateClip from "@/components/CreateClip";
import FrameEditor from "@/components/FrameEditor";

export default function Home() {
  const [generated, setGenerated] = useState<{
    videoUrl: string;
    duration: number;
    prompt: string;
    initialFrames?: string[];
  } | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100 to-zinc-200 dark:from-zinc-950 dark:to-zinc-900">
      <div className="container mx-auto px-4 py-8">
        {generated ? (
          <FrameEditor
            videoUrl={generated.videoUrl}
            duration={generated.duration}
            prompt={generated.prompt}
            onBack={() => setGenerated(null)}
            initialFrames={generated.initialFrames}
          />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[80vh]">
            <CreateClip onGenerated={setGenerated} />
          </div>
        )}
      </div>
    </div>
  );
}
