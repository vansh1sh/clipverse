"use client";

import { useState } from "react";
import { Play, Check, X } from "lucide-react";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  const setter = el instanceof HTMLTextAreaElement ? nativeTextAreaValueSetter : nativeInputValueSetter;
  if (setter) {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

export default function TestRunner() {
  const [status, setStatus] = useState<"idle" | "running" | "passed" | "failed">("idle");
  const [log, setLog] = useState<string[]>([]);

  const runTest = async () => {
    setStatus("running");
    setLog([]);
    const append = (msg: string) => setLog((prev) => [...prev, msg]);

    try {
      append("1. Checking current view…");
      const createPrompt = document.querySelector<HTMLTextAreaElement>("[data-testid='create-prompt']");
      const generateBtn = document.querySelector<HTMLButtonElement>("[data-testid='generate-btn']");

      if (createPrompt && generateBtn) {
        append("2. On home: filling prompt and generating…");
        setInputValue(createPrompt, "A calm ocean at sunset");
        await delay(100);
        generateBtn.click();
        append("3. Waiting for editor (up to 25s)…");
        for (let i = 0; i < 50; i++) {
          await delay(500);
          if (document.querySelector("[data-testid='frame-0']")) break;
          if (i === 49) throw new Error("Editor did not load in time");
        }
        append("4. Editor loaded.");
      }

      append("5. Waiting for first frame…");
      let frame0 = document.querySelector<HTMLElement>("[data-testid='frame-0']");
      for (let i = 0; i < 60; i++) {
        if (frame0) break;
        await delay(500);
        frame0 = document.querySelector<HTMLElement>("[data-testid='frame-0']");
      }
      if (!frame0) throw new Error("First frame not found");
      append("6. Clicking first frame…");
      frame0.click();
      await delay(400);

      const regenInput = document.querySelector<HTMLInputElement>("[data-testid='regenerate-prompt']");
      const regenBtn = document.querySelector<HTMLButtonElement>("[data-testid='regenerate-btn']");
      if (!regenInput || !regenBtn) throw new Error("Regenerate controls not found");
      append("7. Filling regenerate prompt and clicking Regenerate…");
      setInputValue(regenInput, "golden sunset sky");
      await delay(200);
      regenBtn.click();

      append("8. Waiting for 'Frame updated!' (up to 15s)…");
      for (let i = 0; i < 30; i++) {
        await delay(500);
        const hasSuccess = Array.from(document.querySelectorAll("*")).some(
          (n) => n.textContent?.trim() === "Frame updated!"
        );
        if (hasSuccess) {
          append("9. Frame updated! Test passed.");
          setStatus("passed");
          return;
        }
      }
      throw new Error("'Frame updated!' did not appear in time");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      append(`Failed: ${msg}`);
      setStatus("failed");
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={runTest}
        disabled={status === "running"}
        className="flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-medium shadow-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-60"
        title="Run automated E2E test flow"
      >
        {status === "running" && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-black dark:border-white border-t-transparent" />
        )}
        {status === "passed" && <Check className="h-4 w-4 text-green-500" />}
        {status === "failed" && <X className="h-4 w-4 text-red-500" />}
        {status === "idle" && <Play className="h-4 w-4 text-black dark:text-white" />}
        {status === "running" ? "Test running…" : status === "passed" ? "Passed" : status === "failed" ? "Failed" : "Run test"}
      </button>
      {log.length > 0 && (
        <div className="max-h-48 w-72 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-800/95 p-2 text-xs font-mono shadow-lg">
          {log.map((line, i) => (
            <div key={i} className="text-zinc-600 dark:text-zinc-400">
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
