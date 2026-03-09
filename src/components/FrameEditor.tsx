"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  Download,
  Play,
  Pause,
  Film,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";
import type { FrameData } from "@/types/editor";
import type { GenerateSegment } from "@/components/CreateClip";

const FRAME_INTERVAL = 2; // seconds per frame during editor playback
/** Frames sampled per video segment in mixed timeline (~4 sec per clip at 2s/frame). */
const FRAMES_PER_VIDEO_SEGMENT = 2;
const FRAME_TRANSITION_MS = 400;
const TIMELINE_THUMB_GAP = 8; // gap-2 in Tailwind
const THUMB_SIZES = [40, 56, 72] as const;
const DEFAULT_THUMB_INDEX = 1; // 56px

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

interface FrameEditorProps {
  videoUrl: string;
  duration: number;
  prompt: string;
  onBack: () => void;
  /** When provided, use these as initial frames (no video); videoUrl can be empty. */
  initialFrames?: string[];
  /** Mixed timeline: 2–3 video clips + images. Expanded to frames on load. */
  initialSegments?: GenerateSegment[];
}

export default function FrameEditor({
  videoUrl,
  duration,
  prompt,
  onBack,
  initialFrames,
  initialSegments,
}: FrameEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const timelineStripRef = useRef<HTMLDivElement>(null);
  const [scrubberDragging, setScrubberDragging] = useState(false);
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [replacePrompt, setReplacePrompt] = useState("");
  const [replaceImage, setReplaceImage] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [regenSuccess, setRegenSuccess] = useState(false);
  const [propagateNextFrames, setPropagateNextFrames] = useState(true);
  const [propagating, setPropagating] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<{ url: string; alt: string; photographer: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewGenerating, setPreviewGenerating] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [displayFrameIndex, setDisplayFrameIndex] = useState(0);
  const [multiverses, setMultiverses] = useState<
    { id: string; name: string; frames: FrameData[]; editFromIndex?: number }[]
  >([]);
  const [saveAsMultiverseBeforeChange, setSaveAsMultiverseBeforeChange] = useState(true);
  /** Which timeline is shown in the main video + strip: 'main' or a multiverse id */
  const [activeSource, setActiveSource] = useState<"main" | string>("main");
  /** Timeline frame thumbnail size (px width); 16:9 height */
  const [thumbSizeIndex, setThumbSizeIndex] = useState(DEFAULT_THUMB_INDEX);
  const thumbSize = THUMB_SIZES[thumbSizeIndex];

  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const introVideoRef = useRef<HTMLVideoElement | null>(null);
  const [animatedClips, setAnimatedClips] = useState<{ name: string; url: string }[]>([]);
  const [pixabayClips, setPixabayClips] = useState<{ url: string; tags: string }[]>([]);

  const isImageSequence =
    !!(initialFrames && initialFrames.length > 0) ||
    !!(initialSegments && initialSegments.length > 0);
  const hasPreviewVideo = !!previewVideoUrl;

  // Use proxy for external videos so frame extraction works (no CORS taint)
  const rawVideoSrc =
    videoUrl && (videoUrl.startsWith("http://") || videoUrl.startsWith("https://"))
      ? `/api/proxy-video?url=${encodeURIComponent(videoUrl)}`
      : videoUrl;
  const videoSrc = previewVideoUrl ?? rawVideoSrc;

  // Frames and duration for the currently selected timeline (main or a multiverse)
  const displayFrames =
    activeSource === "main"
      ? frames
      : multiverses.find((m) => m.id === activeSource)?.frames ?? frames;
  const effectiveDuration =
    activeSource === "main"
      ? (videoDuration ?? duration)
      : displayFrames.length * FRAME_INTERVAL;

  // Map currentTime (0..effectiveDuration) to frame index so the scrubber reaches 100% at end of video
  const currentFrameIndex =
    displayFrames.length > 0
      ? effectiveDuration > 0
        ? Math.min(
            displayFrames.length - 1,
            Math.max(0, Math.floor((currentTime / effectiveDuration) * displayFrames.length))
          )
        : Math.min(displayFrames.length - 1, Math.floor(currentTime / FRAME_INTERVAL))
      : 0;

  const extractFrames = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const result: FrameData[] = [];
    const count = Math.min(
      Math.ceil(duration / FRAME_INTERVAL),
      Math.floor(duration)
    );

    const capture = (i: number) => {
      return new Promise<void>((resolve) => {
        const t = i * FRAME_INTERVAL;
        const handler = () => {
          video.onseeked = null; // only capture once per seek (onseeked can fire multiple times)
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          result.push({
            id: generateId(),
            timestamp: t,
            imageDataUrl: dataUrl,
          });
          resolve();
        };
        video.onseeked = handler;
        video.currentTime = t;
      });
    };

    const run = async () => {
      for (let i = 0; i < count; i++) {
        await capture(i);
      }
      // Only set if we got the expected count (avoids duplicate frames from multiple onseeked events)
      if (result.length <= count) {
        setFrames(result);
      } else {
        setFrames(result.slice(0, count));
      }
      setLoading(false);
    };

    run();
  }, [duration]);

  useEffect(() => {
    if (initialFrames && initialFrames.length > 0) {
      setFrames(
        initialFrames.map((url, i) => ({
          id: generateId(),
          timestamp: i * FRAME_INTERVAL,
          imageDataUrl: url,
        }))
      );
      setVideoDuration(initialFrames.length * FRAME_INTERVAL);
      setLoading(false);
      return;
    }
    setVideoDuration(null);
    const video = videoRef.current;
    if (!video) return;
    const onLoaded = () => extractFrames();
    const onLoadedMetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setVideoDuration(video.duration);
      }
    };
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    if (video.readyState >= 2) onLoaded();
    if (video.readyState >= 1 && Number.isFinite(video.duration)) setVideoDuration(video.duration);
    return () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [videoUrl, initialFrames, extractFrames]);

  // Keep timeline duration in sync with frame count only for image sequences (so insert/reorder stays in sync).
  // For video source, keep the video's real duration so the scrubber reaches 100%.
  useEffect(() => {
    if (isImageSequence && frames.length > 0 && !hasPreviewVideo) {
      const durationFromFrames = frames.length * FRAME_INTERVAL;
      setVideoDuration(durationFromFrames);
      setCurrentTime((prev) => Math.min(prev, durationFromFrames));
    }
  }, [isImageSequence, frames.length, hasPreviewVideo]);

  // When switching to a shorter timeline, clamp currentTime
  useEffect(() => {
    if (currentTime > effectiveDuration && effectiveDuration > 0) {
      setCurrentTime(effectiveDuration);
    }
  }, [activeSource, effectiveDuration]);

  // Sync displayFrameIndex after crossfade so we only keep two layers during transition
  useEffect(() => {
    if (currentFrameIndex !== displayFrameIndex) {
      const t = setTimeout(
        () => setDisplayFrameIndex(currentFrameIndex),
        FRAME_TRANSITION_MS
      );
      return () => clearTimeout(t);
    }
  }, [currentFrameIndex, displayFrameIndex]);

  // When frames first load, align display index with current
  useEffect(() => {
    if (displayFrames.length > 0 && displayFrameIndex >= displayFrames.length) {
      setDisplayFrameIndex(currentFrameIndex);
    }
  }, [displayFrames.length, displayFrameIndex, currentFrameIndex]);

  // Keep selectedIndex in sync with displayed frame so strip highlight and edit panel match the main view (e.g. after video seek)
  useEffect(() => {
    if (!playing && displayFrames.length > 0 && currentFrameIndex >= 0) {
      setSelectedIndex(currentFrameIndex);
    }
  }, [playing, displayFrames.length, currentFrameIndex]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const t = setInterval(() => {
      if (playing) setCurrentTime(video.currentTime);
    }, 100);
    return () => clearInterval(t);
  }, [playing]);

  const seekTo = (t: number) => {
    const safeT = Math.max(0, Math.min(effectiveDuration, t));
    setCurrentTime(safeT);
    if (!isImageSequence) {
      const video = videoRef.current;
      if (video) {
        video.currentTime = safeT;
        setPlaying(false);
        video.pause();
      }
    } else {
      setPlaying(false);
    }
    // Select frame at this time and keep main view in sync immediately (no crossfade delay)
    if (displayFrames.length > 0 && effectiveDuration > 0) {
      const idx = Math.min(
        displayFrames.length - 1,
        Math.max(0, Math.floor((safeT / effectiveDuration) * displayFrames.length))
      );
      setSelectedIndex(idx);
      setDisplayFrameIndex(idx);
    }
  };

  // Scrubber position: always by time (0–100%) so the bar reaches 100% at end of video
  const scrubberPercent =
    effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  // Pixel position of scrubber line in the frame strip: center of the current frame thumbnail.
  const scrubberLineLeftPx =
    displayFrames.length > 0
      ? currentFrameIndex * (thumbSize + TIMELINE_THUMB_GAP) + thumbSize / 2
      : 0;
  // Total width of the frame strip content (so progress bar can match it).
  const totalStripWidth =
    displayFrames.length > 0
      ? displayFrames.length * (thumbSize + TIMELINE_THUMB_GAP) - TIMELINE_THUMB_GAP
      : 0;
  // Progress bar uses same scale as strip so the two vertical lines align.
  const progressBarPercent =
    totalStripWidth > 0 ? (scrubberLineLeftPx / totalStripWidth) * 100 : scrubberPercent;

  // Map a click/drag clientX to timeline time. Uses strip layout + scroll so the frame under the cursor is selected.
  const getScrubTime = useCallback(
    (clientX: number) => {
      if (displayFrames.length > 0 && timelineStripRef.current) {
        const strip = timelineStripRef.current;
        const rect = strip.getBoundingClientRect();
        const paddingLeft = 16; // px-4 on scroll container
        const contentX = clientX - rect.left - paddingLeft + strip.scrollLeft;
        const frameSpan = thumbSize + TIMELINE_THUMB_GAP;
        const frameIndex = Math.min(
          displayFrames.length - 1,
          Math.max(0, Math.floor(contentX / frameSpan))
        );
        // Map frame index to time so last frame = end of video (scrubber reaches 100%)
        if (displayFrames.length <= 1) return 0;
        return (frameIndex / (displayFrames.length - 1)) * effectiveDuration;
      }
      const el = scrubberRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return fraction * effectiveDuration;
    },
    [effectiveDuration, displayFrames.length, thumbSize]
  );

  const handleScrubberMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      seekTo(getScrubTime(e.clientX));
      setScrubberDragging(true);
    },
    [getScrubTime, effectiveDuration]
  );

  useEffect(() => {
    if (!scrubberDragging) return;
    const onMove = (e: MouseEvent) => seekTo(getScrubTime(e.clientX));
    const onUp = () => setScrubberDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [scrubberDragging, getScrubTime]);

  const togglePlay = () => {
    // When a multiverse is selected, always play the edited frames (frame-by-frame), not the original video
    const useFramePlayback =
      displayFrames.length > 0 &&
      ((isImageSequence && !hasPreviewVideo) || activeSource !== "main");
    // Video source (original or stitched preview), main timeline: use real video for smooth playback
    if (videoSrc && activeSource === "main" && (!isImageSequence || hasPreviewVideo)) {
      const video = videoRef.current;
      if (video) {
        if (playing) {
          video.pause();
          setPlaying(false);
        } else {
          setSelectedIndex(null);
          setPlaying(true);
          video.currentTime = currentTime;
          video.play().catch(() => setPlaying(false));
        }
        return;
      }
    }
    // Image sequence or multiverse selected: advance currentTime via interval (play edited frames)
    if (useFramePlayback) {
      if (playing) {
        setPlaying(false);
      } else {
        setSelectedIndex(null);
        setPlaying(true);
      }
      return;
    }
    // No frames yet: use video element if present
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setSelectedIndex(null);
      setPlaying(true);
      video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  // Fetch background music: pick a random track from public/music/*.mp3
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/theme-music");
        const data = await res.json();
        if (!cancelled && data?.url) setMusicUrl(data.url);
      } catch {
        if (!cancelled) setMusicUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Automatically generate a stitched preview video from current frames (uses /api/export-video → stitch_video.py).
  useEffect(() => {
    if (!isImageSequence) return;
    if (frames.length === 0) return;
    if (previewVideoUrl || previewGenerating) return;
    let cancelled = false;
    setPreviewGenerating(true);
    (async () => {
      try {
        const frameDataUrls = frames.map(
          (f) => f.replacementDataUrl || f.imageDataUrl
        );
        const res = await fetch("/api/export-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frameDataUrls,
            fps: 0.5,
            prompt,
          }),
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setPreviewVideoUrl(url);
      } catch {
        // ignore preview errors
      } finally {
        if (!cancelled) setPreviewGenerating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isImageSequence, frames, previewVideoUrl, previewGenerating]);

  // Fetch animated inserts (public/animated/*.mp4) to show helper clips
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/animated-clips");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.clips && Array.isArray(data.clips)) {
          setAnimatedClips(data.clips);
        }
      } catch {
        if (!cancelled) setAnimatedClips([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch motion clips from Pixabay based on the main prompt (optional inserts to make the sequence feel more like video).
  useEffect(() => {
    if (!prompt.trim()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/pixabay-videos?q=${encodeURIComponent(prompt)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.clips && Array.isArray(data.clips)) {
          // We store them alongside animatedClips as client-side suggestions (not auto-inserted into export yet).
          // To keep things simple, we don't merge lists; animatedClips stays for local inserts, Pixabay clips for motion refs.
          // Here we just show Pixabay clips in their own section below.
          setPixabayClips(
            data.clips.map((c: { url: string; tags?: string }) => ({
              url: c.url,
              tags: c.tags ?? "",
            }))
          );
        }
      } catch {
        if (!cancelled) {
          setPixabayClips([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prompt]);

  // Keep intro video in sync when user scrubs (only when not playing to avoid fighting onTimeUpdate)
  useEffect(() => {
    if (playing || !introVideoRef.current || hasPreviewVideo || currentTime >= 5) return;
    introVideoRef.current.currentTime = Math.min(currentTime, 5);
  }, [currentTime, hasPreviewVideo, playing]);

  // Play/pause intro overlay when in intro window
  useEffect(() => {
    const inIntroWindow = activeSource === "main" && !hasPreviewVideo && pixabayClips.length > 0 && currentTime < 5;
    if (!introVideoRef.current || !inIntroWindow) return;
    if (playing) introVideoRef.current.play().catch(() => {});
    else introVideoRef.current.pause();
  }, [playing, activeSource, hasPreviewVideo, pixabayClips.length, currentTime]);

  // Keep background music in sync with play/pause
  useEffect(() => {
    const audio = backgroundMusicRef.current;
    if (!audio || !musicUrl) return;
    if (playing) {
      audio.play().catch(() => { /* ignore autoplay errors */ });
    } else {
      audio.pause();
    }
  }, [playing, musicUrl]);

  // When we switch to showing the video for playback (main timeline only), seek and play
  useEffect(() => {
    if (!playing || !videoSrc || activeSource !== "main") return;
    if (isImageSequence && !hasPreviewVideo) return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = currentTime;
    video.play().catch(() => setPlaying(false));
  }, [playing, videoSrc, isImageSequence, activeSource]); // currentTime read when effect runs; do not deps to avoid seeking during playback

  // Use interval for frame playback: image-only mode or when a multiverse (edited timeline) is selected.
  // When on main with intro clip (no stitched preview yet), only run after intro window (0–5s).
  // Depend on "past intro" boolean so we don't re-run on every currentTime tick during intro (would hang).
  const pastIntroOrNoPixabay = currentTime >= 5 || pixabayClips.length === 0;
  useEffect(() => {
    const inIntroWindow = activeSource === "main" && !hasPreviewVideo && pixabayClips.length > 0 && currentTime < 5;
    const useFramePlayback =
      ((isImageSequence && !hasPreviewVideo && pastIntroOrNoPixabay) || activeSource !== "main") &&
      displayFrames.length > 0 &&
      playing;
    if (!useFramePlayback) return;
    const id = setInterval(() => {
      setCurrentTime((t) => {
        const next = t + FRAME_INTERVAL;
        if (next >= effectiveDuration) {
          setPlaying(false);
          return effectiveDuration;
        }
        return next;
      });
    }, FRAME_INTERVAL * 1000);
    return () => clearInterval(id);
  }, [isImageSequence, hasPreviewVideo, activeSource, displayFrames.length, playing, effectiveDuration, pixabayClips.length, pastIntroOrNoPixabay]);

  const updateCurrentSourceFrames = useCallback(
    (updater: (prev: FrameData[]) => FrameData[]) => {
      if (activeSource === "main") {
        setFrames(updater);
      } else {
        setMultiverses((prev) =>
          prev.map((mv) =>
            mv.id === activeSource ? { ...mv, frames: updater(mv.frames) } : mv
          )
        );
      }
    },
    [activeSource]
  );

  const replaceFrame = (index: number, dataUrl: string) => {
    updateCurrentSourceFrames((prev) =>
      prev.map((f, i) =>
        i === index
          ? { ...f, replaced: true, replacementDataUrl: dataUrl }
          : f
      )
    );
    setReplaceImage(null);
    setReplacePrompt("");
    setSelectedIndex(null);
  };

  const copyFramesToMultiverse = useCallback((sourceFrames: FrameData[], editFromIndex?: number) => {
    if (sourceFrames.length === 0) return;
    setMultiverses((prev) => {
      const name = `Multiverse ${prev.length + 1}`;
      const copy: FrameData[] = sourceFrames.map((f, i) => ({
        id: generateId(),
        timestamp: i * FRAME_INTERVAL,
        imageDataUrl: f.replacementDataUrl ?? f.imageDataUrl,
        fromVideo: f.fromVideo,
      }));
      return [...prev, { id: generateId(), name, frames: copy, editFromIndex }];
    });
  }, []);

  const createMultiverseFromCurrent = useCallback(
    (editFromIndex?: number) => {
      const source = frames;
      if (source.length === 0) return;
      const newId = generateId();
      setMultiverses((prev) => {
        const name = `Multiverse ${prev.length + 1}`;
        const copy: FrameData[] = source.map((f, i) => ({
          id: generateId(),
          timestamp: i * FRAME_INTERVAL,
          imageDataUrl: f.replacementDataUrl ?? f.imageDataUrl,
          fromVideo: f.fromVideo,
        }));
        return [...prev, { id: newId, name, frames: copy, editFromIndex }];
      });
      setActiveSource(newId);
    },
    [frames]
  );

  const addMultiverse = () => copyFramesToMultiverse(displayFrames);

  const removeMultiverse = (id: string) => {
    setMultiverses((prev) => prev.filter((mv) => mv.id !== id));
    if (activeSource === id) setActiveSource("main");
  };

  const searchImages = async () => {
    setSearchError("Keyword image search has been disabled.");
    setSearchResults([]);
  };

  const handleReplaceWithImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setReplaceImage(dataUrl);
      const idx = selectedIndex;
      if (idx === null) return;
      const currentFrames = displayFrames;
      if (saveAsMultiverseBeforeChange) copyFramesToMultiverse(currentFrames, idx);
      replaceFrame(idx, dataUrl);
      const shouldPropagateRight =
        (propagateNextFrames || activeSource !== "main") && idx < currentFrames.length - 1;
      if (shouldPropagateRight) {
        setPropagating(true);
        try {
          const numNext = currentFrames.length - 1 - idx;
          const propRes = await fetch("/api/propagate-frames", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageDataUrl: dataUrl, prompt, numFrames: numNext }),
          });
          const propData = await propRes.json();
          const nextImages: string[] = propData.frameDataUrls
            ? propData.frameDataUrls.slice(0, numNext)
            : propData.videoUrl
              ? await videoUrlToFrameDataUrls(propData.videoUrl, Math.min(numNext, 30))
              : [];
          if (nextImages.length > 0) {
            const fill = nextImages;
            const startIndex = idx + 1;
            updateCurrentSourceFrames((prev) =>
              prev.map((f, i) => {
                const offset = i - startIndex;
                if (offset >= 0 && offset < fill.length) {
                  const newUrl = fill[offset];
                  return {
                    ...f,
                    imageDataUrl: newUrl,
                    replacementDataUrl: newUrl,
                    replaced: true,
                    fromVideo: false,
                  };
                }
                return f;
              })
            );
          }
        } catch {
          /* ignore */
        } finally {
          setPropagating(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const videoUrlToFirstFrameDataUrl = useCallback(
    (url: string): Promise<string> =>
      new Promise((resolve, reject) => {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.muted = true;
        video.playsInline = true;
        video.onloadeddata = () => {
          video.currentTime = 0;
        };
        video.onseeked = () => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("No canvas context"));
            return;
          }
          ctx.drawImage(video, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
          video.remove();
        };
        video.onerror = () => reject(new Error("Video failed to load"));
        video.src = url;
      }),
    []
  );

  const videoUrlToFrameDataUrls = useCallback(
    (url: string, numFrames: number): Promise<string[]> =>
      new Promise((resolve, reject) => {
        // Use proxy for external URLs so frame extraction works (no CORS taint on canvas)
        const effectiveUrl =
          url.startsWith("http://") || url.startsWith("https://")
            ? `/api/proxy-video?url=${encodeURIComponent(url)}`
            : url;
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.muted = true;
        video.playsInline = true;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No canvas context"));
          return;
        }
        const results: string[] = [];
        let index = 0;
        video.onloadedmetadata = () => {
          const duration = video.duration;
          const step = duration <= 0 ? 0 : (duration - 0.01) / Math.max(1, numFrames - 1);
          const capture = () => {
            if (index >= numFrames) {
              video.remove();
              resolve(results);
              return;
            }
            const t = index === 0 ? 0 : Math.min(index * step, duration - 0.01);
            video.currentTime = t;
          };
          video.onseeked = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            results.push(canvas.toDataURL("image/jpeg", 0.85));
            index++;
            capture();
          };
          capture();
        };
        video.onerror = () => reject(new Error("Video failed to load"));
        video.src = effectiveUrl;
      }),
    []
  );

  // Expand mixed timeline (2–3 video clips + images) into frames
  useEffect(() => {
    if (!initialSegments?.length) return;
    let cancelled = false;
    const run = async () => {
      const allFrames: FrameData[] = [];
      for (const seg of initialSegments) {
        if (cancelled) return;
        if (seg.type === "video") {
          try {
            const dataUrls = await videoUrlToFrameDataUrls(
              seg.url,
              FRAMES_PER_VIDEO_SEGMENT
            );
            dataUrls.forEach((imageDataUrl, i) => {
              allFrames.push({
                id: generateId(),
                timestamp: (allFrames.length + i) * FRAME_INTERVAL,
                imageDataUrl,
                fromVideo: true,
              });
            });
          } catch {
            // If one video fails, skip it and continue
          }
        } else {
          allFrames.push({
            id: generateId(),
            timestamp: allFrames.length * FRAME_INTERVAL,
            imageDataUrl: seg.dataUrl,
            fromVideo: false,
          });
        }
      }
      if (!cancelled) {
        setFrames(allFrames);
        setVideoDuration(allFrames.length * FRAME_INTERVAL);
        setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [initialSegments, videoUrlToFrameDataUrls]);

  const useSearchResultAsFrame = useCallback(
    async (imageUrl: string) => {
      const idx = selectedIndex;
      if (idx === null) return;
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      try {
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error("Failed to load image");
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const currentFrames = displayFrames;
        if (saveAsMultiverseBeforeChange) copyFramesToMultiverse(currentFrames, idx);
        replaceFrame(idx, dataUrl);
        const shouldPropagateRight =
          (propagateNextFrames || activeSource !== "main") && idx < currentFrames.length - 1;
        if (shouldPropagateRight) {
          setPropagating(true);
          try {
            const numNext = currentFrames.length - 1 - idx;
            const propRes = await fetch("/api/propagate-frames", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageDataUrl: dataUrl, prompt: searchKeyword.trim() || prompt, numFrames: numNext }),
            });
            const propData = await propRes.json();
            const nextImages: string[] = propData.frameDataUrls
              ? propData.frameDataUrls.slice(0, numNext)
              : propData.videoUrl
                ? await videoUrlToFrameDataUrls(propData.videoUrl, Math.min(numNext, 30))
                : [];
            if (nextImages.length > 0) {
              const fill = nextImages;
              updateCurrentSourceFrames((prev) =>
                prev.map((f, i) => {
                  const offset = i - (idx + 1);
                  if (offset >= 0 && offset < fill.length) {
                    const newUrl = fill[offset];
                    return {
                      ...f,
                      imageDataUrl: newUrl,
                      replacementDataUrl: newUrl,
                      replaced: true,
                      fromVideo: false,
                    };
                  }
                  return f;
                })
              );
            }
          } catch {
            /* ignore */
          } finally {
            setPropagating(false);
          }
        }
      } catch {
        setSearchError("Could not load image");
      }
    },
    [selectedIndex, propagateNextFrames, activeSource, displayFrames, prompt, searchKeyword, replaceFrame, videoUrlToFrameDataUrls, saveAsMultiverseBeforeChange, copyFramesToMultiverse, updateCurrentSourceFrames]
  );

  const handleReplaceWithPrompt = async () => {
    const indexToReplace = selectedIndex;
    const framePrompt = replacePrompt.trim();
    if (indexToReplace === null || !framePrompt) return;
    if (activeSource === "main") {
      setRegenError("Master timeline is locked. Create a multiverse branch to edit this frame.");
      return;
    }
    setRegenerating(true);
    setRegenError(null);
    setRegenSuccess(false);
    try {
      const res = await fetch("/api/regenerate-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: framePrompt,
          imageDataUrl: displayFrames[indexToReplace]?.imageDataUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegenError(data.error || "Regeneration failed");
        return;
      }
      let newImage: string | null = data.imageDataUrl ?? null;
      if (!newImage && data.videoUrl) {
        newImage = await videoUrlToFirstFrameDataUrl(data.videoUrl);
      }
      if (!newImage) {
        newImage =
          displayFrames[indexToReplace]?.replacementDataUrl ??
          displayFrames[indexToReplace]?.imageDataUrl ??
          null;
      }
      if (newImage != null) {
        const frameCount = displayFrames.length;
        // Edit current timeline (main or multiverse) in place from this frame onward; do not create a new multiverse
        updateCurrentSourceFrames((prev) =>
          prev.map((f, i) =>
            i === indexToReplace
              ? { ...f, replaced: true, replacementDataUrl: newImage! }
              : f
          )
        );
        setReplacePrompt("");
        setRegenSuccess(true);
        setTimeout(() => setRegenSuccess(false), 2500);

        // When using frame prompt, always change all clips to the right (alternate ending)
        const shouldPropagateRight = indexToReplace < frameCount - 1;
        if (shouldPropagateRight) {
          const numNext = frameCount - 1 - indexToReplace;
          setPropagating(true);
          try {
            const propRes = await fetch("/api/propagate-frames", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imageDataUrl: newImage,
                prompt: framePrompt,
                numFrames: numNext,
              }),
            });
            const propData = await propRes.json();
            const nextImages: string[] = propData.frameDataUrls
              ? propData.frameDataUrls.slice(0, numNext)
              : propData.videoUrl
                ? await videoUrlToFrameDataUrls(propData.videoUrl, Math.min(numNext, 30))
                : [];
            if (nextImages.length > 0) {
              const fill = nextImages;
              const startIndex = indexToReplace + 1;
              updateCurrentSourceFrames((prev) =>
                prev.map((f, i) => {
                  const offset = i - startIndex;
                  if (offset >= 0 && offset < fill.length) {
                    const newUrl = fill[offset];
                    return {
                      ...f,
                      imageDataUrl: newUrl,
                      replacementDataUrl: newUrl,
                      replaced: true,
                      fromVideo: false,
                    };
                  }
                  return f;
                })
              );
            }
          } catch {
            // ignore propagation errors
          } finally {
            setPropagating(false);
          }
        }
      }
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRegenerating(false);
    }
  };

  const moveFrame = (from: number, to: number) => {
    if (to < 0 || to >= frames.length || from === to) return;
    setFrames((prev) => {
      const next = [...prev];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);
      return next;
    });
    setSelectedIndex(to);
    setDraggedIndex(null);
    setDropTarget(null);
  };

  const exportFrames = () => {
    frames.forEach((f, i) => {
      const url = f.replacementDataUrl || f.imageDataUrl;
      const a = document.createElement("a");
      a.href = url;
      a.download = `frame_${String(i).padStart(2, "0")}.jpg`;
      a.click();
    });
  };

  const exportVideo = async () => {
    const slice = frames;
    const frameDataUrls = slice.map((f) => f.replacementDataUrl || f.imageDataUrl);
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/export-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frameDataUrls,
          fps: 0.5,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Export failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "export.mp4";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const isViewingMain = activeSource === "main";

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto">
      {React.createElement("canvas", { ref: canvasRef, className: "hidden" })}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportFrames}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export frames
          </button>
          <button
            onClick={exportVideo}
            disabled={exporting || frames.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium"
          >
            <Film className="w-4 h-4" />
            {exporting ? "Exporting…" : "Export video"}
          </button>
        </div>
      </div>
      {exportError && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-2">{exportError}</p>
      )}
      {musicUrl && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-600 dark:text-gray-400">
            Background music
          </span>
          <audio
            controls
            src={musicUrl}
            className="max-w-xs h-8"
            ref={backgroundMusicRef}
          />
        </div>
      )}

      <header className="mb-6 text-center lg:text-left">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          Ready to create your own multiverse?
        </h1>
        <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400 max-w-2xl">
          Pick your frame and create an alternative verse if you don&apos;t like the original. Create and recreate using your creativity — video has never been so magical and easy.
        </p>
      </header>

      <div className="flex flex-col gap-6 flex-1 min-h-0">
        {/* Top row: main video (left) | generate prompt, image search, edit tools, animated inserts (right). Timeline + multiverse only below. */}
        <div className="grid w-full gap-6 items-stretch min-h-0" style={{ gridTemplateColumns: "1fr minmax(300px, 380px)" }}>
          {/* Main frame video – left – aspect-video drives row height so right column matches */}
          <div className="rounded-2xl overflow-hidden bg-gray-900 shadow-xl w-full min-w-0 aspect-video p-6">
            <div className="relative w-full h-full rounded-lg overflow-hidden">
            {/* Show stitched video (intro + frames) when we have it; otherwise show frame images */}
            {videoSrc && (!isImageSequence || hasPreviewVideo) && (
              <video
                ref={videoRef}
                src={videoSrc}
                className={`absolute inset-0 w-full h-full object-contain pointer-events-none ${
                  activeSource === "main" && (displayFrames.length === 0 || hasPreviewVideo || playing)
                    ? "opacity-100 z-10"
                    : "opacity-0 z-0 pointer-events-none"
                }`}
                playsInline
                onTimeUpdate={() => {
                  if (videoRef.current)
                    setCurrentTime(videoRef.current.currentTime);
                }}
                onSeeked={() => {
                  if (videoRef.current)
                    setCurrentTime(videoRef.current.currentTime);
                }}
                onEnded={() => setPlaying(false)}
                crossOrigin="anonymous"
              />
            )}
            {/* When stitched preview isn't ready, show intro clip in main area for first 5s so it matches timeline */}
            {activeSource === "main" && !hasPreviewVideo && pixabayClips.length > 0 && currentTime < 5 && (
              <video
                ref={introVideoRef}
                src={pixabayClips[0].url}
                className="absolute inset-0 w-full h-full object-contain z-10"
                muted
                playsInline
                autoPlay={false}
                onTimeUpdate={() => {
                  if (introVideoRef.current)
                    setCurrentTime(Math.min(introVideoRef.current.currentTime, 5));
                }}
                onEnded={() => {
                  setCurrentTime(5);
                }}
              />
            )}
            {displayFrames.length > 0 && (
              <div
                className={`absolute inset-0 z-0 overflow-hidden ${
                  activeSource === "main" && (hasPreviewVideo || (pixabayClips.length > 0 && currentTime < 5))
                    ? "opacity-0 pointer-events-none"
                    : "opacity-100"
                }`}
              >
                {/* Previous frame (fading out) – static or end state */}
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    src={
                      (displayFrames[displayFrameIndex] as FrameData)
                        ?.replacementDataUrl ||
                      (displayFrames[displayFrameIndex] as FrameData)?.imageDataUrl
                    }
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                {/* Current frame – crossfade; Ken Burns (pan/zoom) only for image frames, not video clips */}
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    key={currentFrameIndex}
                    src={
                      (displayFrames[currentFrameIndex] as FrameData)
                        ?.replacementDataUrl ||
                      (displayFrames[currentFrameIndex] as FrameData)?.imageDataUrl
                    }
                    alt=""
                    className={`absolute inset-0 w-full h-full object-cover animate-frame-fade-in ${
                      (displayFrames[currentFrameIndex] as FrameData)?.fromVideo
                        ? ""
                        : currentFrameIndex % 3 === 0
                          ? "animate-ken-burns"
                          : currentFrameIndex % 3 === 1
                            ? "animate-ken-burns-alt"
                            : "animate-ken-burns-zoom"
                    }`}
                  />
                </div>
              </div>
            )}
            {displayFrames.length === 0 && initialFrames && initialFrames.length > 0 && (
              <img
                src={initialFrames[0]}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
              />
            )}
            {/* Clickable overlay so play/pause works when clicking anywhere on video */}
            <div
              className="absolute inset-0 z-20 cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                togglePlay();
              }}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  togglePlay();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={playing ? "Pause" : "Play"}
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                togglePlay();
              }}
              className="absolute bottom-3 left-3 z-30 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer"
            >
              {playing ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </button>
            <span className="absolute bottom-3 right-3 z-20 text-white/90 text-sm font-mono pointer-events-none">
              {Math.floor(currentTime)}s / {Math.floor(effectiveDuration)}s
            </span>
            </div>
          </div>

        {/* Right column: generate prompt, image search, upload, regenerate – always visible so layout is clear */}
        <div className="flex flex-col gap-5 overflow-y-auto min-h-full min-w-[300px] rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 shadow-lg p-6 shrink-0">
          {loading && (
            <div className="text-gray-500 dark:text-gray-400 text-sm py-4">
              Extracting frames…
            </div>
          )}

          {!loading && selectedIndex === null && (frames.length > 0 || multiverses.some((m) => m.frames.length > 0)) && (
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <p className="font-semibold text-gray-900 dark:text-gray-100">Edit frame</p>
              <p>Select a frame from the timeline below to replace it with an image (upload or search) or regenerate with a prompt.</p>
            </div>
          )}

          {!loading && selectedIndex === null && frames.length === 0 && !multiverses.some((m) => m.frames.length > 0) && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Your clip will appear above. Add a video or images to get started, then use the timeline below to select and edit frames.
            </div>
          )}

          {selectedIndex !== null && !loading && (
            <div className="space-y-3">
              {!isViewingMain && (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Editing in <strong className="text-black dark:text-white">{multiverses.find((m) => m.id === activeSource)?.name ?? "branch"}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveSource("main")}
                    className="px-3 py-1.5 rounded-lg bg-black hover:bg-gray-800 text-white text-sm font-semibold"
                  >
                    Switch to Main
                  </button>
                </div>
              )}
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {activeSource === "main"
                  ? "Master timeline (read-only)"
                  : `Edit frame at ${selectedIndex * FRAME_INTERVAL}s`}
              </p>
              {activeSource === "main" && (
                <div className="flex flex-col gap-2 mb-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    The master (reality) timeline is locked. Create a multiverse branch from this frame to start editing.
                  </p>
                  <button
                    type="button"
                    onClick={() => createMultiverseFromCurrent(selectedIndex ?? undefined)}
                    className="px-3 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-semibold"
                  >
                    Create multiverse from this frame
                  </button>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500">
                  Frame prompt
                </label>
                <div className="flex gap-2">
                  <input
                    data-testid="regenerate-prompt"
                    type="text"
                    value={replacePrompt}
                    onChange={(e) => {
                      setReplacePrompt(e.target.value);
                      setRegenError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && replacePrompt.trim() && !regenerating) {
                        e.preventDefault();
                        handleReplaceWithPrompt();
                      }
                    }}
                    placeholder="Describe what should happen from this frame onward..."
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                    disabled={regenerating || activeSource === "main"}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!replacePrompt.trim() || regenerating || activeSource === "main") return;
                      handleReplaceWithPrompt();
                    }}
                    className="px-3 py-2 rounded-lg bg-black hover:bg-gray-800 text-white text-sm font-semibold disabled:opacity-50"
                    disabled={!replacePrompt.trim() || regenerating || activeSource === "main"}
                  >
                    Enter
                  </button>
                </div>
                {regenError && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {regenError}
                  </p>
                )}
              </div>
            </div>
          )}

          {!loading && animatedClips.length > 0 && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Animated inserts
              </p>
              <div className="flex flex-col gap-3 max-h-48 overflow-y-auto">
                {animatedClips.map((clip) => (
                  <div key={clip.url} className="flex items-center gap-3">
                    <video
                      src={clip.url}
                      className="w-24 h-16 rounded-md bg-black object-cover flex-shrink-0"
                      muted
                      controls
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-700 dark:text-gray-200 line-clamp-2">
                        {clip.name}
                      </span>
                      <a
                        href={clip.url}
                        download
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Download clip
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
        </div>

        {/* Timeline + multiverse only – full width below main video */}

        {!loading && (frames.length > 0 || multiverses.some((m) => m.frames.length > 0)) && (
            <div className="rounded-2xl overflow-hidden bg-gray-800/95 border-2 border-gray-700/60 shadow-xl">
            <div className="timeline-track overflow-hidden">
              <div className="px-5 pt-4 pb-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Frames</span>
                  <span className="text-sm font-mono text-gray-300 tabular-nums">
                    {Math.floor(currentTime)}s <span className="text-gray-500">/</span> {Math.floor(effectiveDuration)}s
                  </span>
                  <span className="text-gray-500">·</span>
                  <div className="flex items-center gap-0.5" title="Frame size">
                    <button
                      type="button"
                      onClick={() => setThumbSizeIndex((i) => Math.max(0, i - 1))}
                      disabled={thumbSizeIndex === 0}
                      className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-600 disabled:opacity-40 disabled:pointer-events-none"
                      aria-label="Decrease frame size"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] text-gray-500 w-5 text-center tabular-nums">{thumbSize}px</span>
                    <button
                      type="button"
                      onClick={() => setThumbSizeIndex((i) => Math.min(THUMB_SIZES.length - 1, i + 1))}
                      disabled={thumbSizeIndex === THUMB_SIZES.length - 1}
                      className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-600 disabled:opacity-40 disabled:pointer-events-none"
                      aria-label="Increase frame size"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Switch which timeline is shown – Main (green) vs Multiverse (blue) */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveSource("main")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeSource === "main" ? "bg-black text-white shadow-md" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                  >
                    Main
                  </button>
                  {multiverses.map((mv) => (
                    <button
                      key={mv.id}
                      type="button"
                      onClick={() => setActiveSource(mv.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeSource === mv.id ? "bg-black text-white shadow-md" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                    >
                      {mv.name}
                    </button>
                  ))}
                </div>
              </div>
              <div
                ref={scrubberRef}
                role="slider"
                aria-label="Timeline scrubber"
                aria-valuemin={0}
                aria-valuemax={effectiveDuration}
                aria-valuenow={currentTime}
                tabIndex={0}
                onMouseDown={handleScrubberMouseDown}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 5 : 1;
                  if (e.key === "ArrowLeft") seekTo(currentTime - step);
                  if (e.key === "ArrowRight") seekTo(currentTime + step);
                }}
                className="relative cursor-pointer select-none"
              >
                <p className="text-[10px] text-gray-500 px-4 pb-1">Drag pieces to reorder · Click to select</p>
                <div
                  ref={timelineStripRef}
                  className={`overflow-x-auto overflow-y-hidden scrollbar-thin px-4 ${displayFrames.length > 0 ? "py-2" : "py-3"}`}
                  style={{
                    minHeight: "var(--track-height, 76px)",
                    ...(displayFrames.length > 0 && totalStripWidth > 0 ? { paddingBottom: 2 } : {}),
                  }}
                >
                  {displayFrames.length > 0 && totalStripWidth > 0 ? (
                    <div className="flex flex-col gap-0.5" style={{ width: totalStripWidth, minWidth: totalStripWidth }}>
                      <div className="relative flex flex-shrink-0 overflow-visible gap-2" style={{ minHeight: thumbSize * (9 / 16) }}>
                        {/* Scrubber line: same position as progress bar tick so the two lines match */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 -ml-px z-10 pointer-events-none bg-black shadow-[0_0_6px_rgba(0,0,0,0.4)]"
                          style={{ left: `${scrubberLineLeftPx - 1}px` }}
                          aria-hidden
                        />
                        <div
                          className="absolute top-0 bottom-0 w-4 -ml-2 z-20 cursor-ew-resize"
                          style={{ left: `${scrubberLineLeftPx - 8}px` }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setScrubberDragging(true);
                          }}
                        />
                        {/* Optional intro video tile shown as real video, sized like other thumbnails */}
                        {activeSource === "main" && pixabayClips.length > 0 && (
                          <div
                            className="relative flex-shrink-0 rounded-lg overflow-hidden bg-black border border-gray-700"
                            style={{ width: thumbSize, height: thumbSize * (9 / 16) }}
                          >
                            <video
                              src={pixabayClips[0].url}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              autoPlay
                            />
                            <span className="absolute bottom-1 left-1 right-1 px-1 py-0.5 rounded bg-black/70 text-[10px] text-gray-100 text-center">
                              Intro clip
                            </span>
                          </div>
                        )}
                        {displayFrames.map((frame, index) => (
                    <div
                      key={frame.id}
                      data-testid={index === 0 ? "frame-0" : undefined}
                      data-frame-index={index}
                      draggable={isViewingMain}
                      onDragStart={() => isViewingMain && setDraggedIndex(index)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (isViewingMain && draggedIndex !== null && draggedIndex !== index) setDropTarget(index);
                      }}
                      onDragLeave={() => setDropTarget(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (isViewingMain && draggedIndex !== null && dropTarget !== null) {
                          copyFramesToMultiverse(frames, Math.min(draggedIndex, dropTarget));
                          moveFrame(draggedIndex, dropTarget);
                        }
                        setDraggedIndex(null);
                        setDropTarget(null);
                      }}
                      onDragEnd={() => {
                        setDraggedIndex(null);
                        setDropTarget(null);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        const n = displayFrames.length;
                        if (n <= 1) {
                          setSelectedIndex(0);
                          setDisplayFrameIndex(0);
                          setCurrentTime(0);
                          return;
                        }
                        // Use time that maps exactly to this frame so main view and scrubber stay in sync
                        const t =
                          index >= n - 1
                            ? effectiveDuration
                            : ((index + 0.5) / n) * effectiveDuration;
                        seekTo(t);
                        setSelectedIndex(index);
                        setDisplayFrameIndex(index);
                      }}
                      className={`timeline-frame relative flex-shrink-0 rounded-xl overflow-hidden border-2 cursor-grab active:cursor-grabbing select-none ${
                        currentFrameIndex === index
                          ? "selected border-black"
                          : "border-gray-600 hover:border-gray-500"
                      } ${draggedIndex === index ? "opacity-50 scale-95" : ""} ${
                        dropTarget === index ? "drop-target border-black ring-2 ring-gray-400/50" : ""
                      }`}
                      style={{ width: thumbSize, height: thumbSize * (9 / 16) }}
                    >
                      <img
                        src={frame.replacementDataUrl || frame.imageDataUrl}
                        alt={`Frame ${index + 1}`}
                        className="w-full h-full object-cover pointer-events-none"
                      />
                      {frame.replaced && (
                        <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-black rounded-bl-lg shadow-sm" />
                      )}
                    </div>
                        ))}
                      </div>
                      <div className="flex-shrink-0 relative pb-1 pt-0.5">
                        <div className="h-1.5 w-full rounded-full bg-gray-700 overflow-visible relative">
                          <div
                            className="timeline-fill h-full rounded-full"
                            style={{ width: `${progressBarPercent}%` }}
                          />
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-0.5 -ml-px h-3.5 bg-black rounded-full pointer-events-none z-10"
                            style={{ left: `${progressBarPercent}%` }}
                            aria-hidden
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 pb-3 pt-1 flex-shrink-0 relative">
                      <div className="h-1.5 w-full rounded-full bg-gray-700 overflow-visible relative">
                        <div
                          className="timeline-fill h-full rounded-full"
                          style={{ width: `${scrubberPercent}%` }}
                        />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-0.5 -ml-px h-3.5 bg-black rounded-full pointer-events-none z-10"
                          style={{ left: `${scrubberPercent}%` }}
                          aria-hidden
                        />
                      </div>
                      <div
                        className="absolute top-0 bottom-0 w-4 -ml-2 z-20 cursor-ew-resize"
                        style={{ left: `${scrubberPercent}%` }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setScrubberDragging(true);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Multiverses inside same circular rectangle as frames */}
            {frames.length > 0 && (
            <div className="px-5 pb-5 pt-2 space-y-3 border-t border-gray-600/50">
              {multiverses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 pt-1 uppercase tracking-wider">Alternate branches</p>
                  {multiverses.map((mv) => (
                    <div
                      key={mv.id}
                      className={`flex items-center gap-2 rounded-lg p-2.5 -mx-1 transition-colors ${
                        activeSource === mv.id
                          ? "bg-gray-700/90 ring-2 ring-gray-400 border border-gray-500 shadow-md"
                          : "border border-transparent"
                      }`}
                    >
                      <div className="w-24 shrink-0 flex flex-col gap-0.5">
                        <span className={`text-xs font-medium ${activeSource === mv.id ? "text-white font-semibold" : "text-gray-300"}`}>
                          {activeSource === mv.id ? "● " : ""}{mv.name}
                        </span>
                        {mv.editFromIndex != null && (
                          <span className="text-[10px] text-gray-500 font-medium">
                            From frame {mv.editFromIndex + 1} → end
                          </span>
                        )}
                      </div>
                      <div className="flex-1 relative h-12 rounded-xl overflow-hidden bg-gray-800/80 flex overflow-x-auto overflow-y-hidden scrollbar-thin min-w-0 border border-gray-600/40">
                        {mv.frames.map((frame, index) => {
                          const isAlternateEnding = mv.editFromIndex != null && index >= mv.editFromIndex;
                          const isAlternateStart = mv.editFromIndex != null && index === mv.editFromIndex;
                          return (
                            <button
                              key={frame.id}
                              type="button"
                              onClick={() => {
                                setActiveSource(mv.id);
                                const n = mv.frames.length;
                                if (n <= 1) {
                                  setCurrentTime(0);
                                  setSelectedIndex(0);
                                  setDisplayFrameIndex(0);
                                  return;
                                }
                                const dur = n * FRAME_INTERVAL;
                                const t = index >= n - 1 ? dur : ((index + 0.5) / n) * dur;
                                setCurrentTime(t);
                                setSelectedIndex(index);
                                setDisplayFrameIndex(index);
                                setPlaying(false);
                              }}
                              className={`flex-shrink-0 h-full aspect-video border-r border-gray-600/50 cursor-pointer transition-all hover:opacity-95 relative rounded-sm overflow-hidden ${activeSource === mv.id && currentFrameIndex === index ? "ring-2 ring-black ring-inset" : ""} ${isAlternateEnding ? "bg-black/10" : ""} ${isAlternateStart ? "border-l-2 border-l-black shadow-[inset_2px_0_8px_rgba(0,0,0,0.15)]" : ""}`}
                              style={{ minWidth: 48 }}
                              title={isAlternateStart && mv.editFromIndex != null ? `Alternate ending: frames ${mv.editFromIndex + 1}–${mv.frames.length} differ from main` : isAlternateEnding ? "Part of this alternate ending" : undefined}
                            >
                              <img
                                src={frame.replacementDataUrl || frame.imageDataUrl}
                                alt=""
                                className="w-full h-full object-cover pointer-events-none"
                              />
                            </button>
                          );
                        })}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-black/80 pointer-events-none z-10"
                          style={{
                            left: `${
                              mv.frames.length > 0 && activeSource === mv.id
                                ? (currentFrameIndex / Math.max(1, mv.frames.length - 1)) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMultiverse(mv.id)}
                        title="Delete this multiverse"
                        className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={addMultiverse}
                  disabled={loading || frames.length === 0}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black hover:bg-gray-800 disabled:opacity-50 text-white text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add multiverse
                </button>
                <p className="text-xs text-gray-400">
                  Build alternate endings: edit from a frame and changes apply to that frame and every frame after. Each branch keeps the original before the change.
                </p>
              </div>
            </div>
            )}
            </div>
          )}
        </div>
    </div>
  );
}
