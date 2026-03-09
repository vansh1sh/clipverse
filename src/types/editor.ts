export interface FrameData {
  id: string;
  timestamp: number; // seconds
  imageDataUrl: string;
  replaced?: boolean; // user replaced this frame
  replacementDataUrl?: string;
  prompt?: string; // prompt used for this segment (if regenerated)
}

export interface VideoProject {
  videoUrl: string;
  duration: number;
  prompt: string;
  frames: FrameData[];
}
