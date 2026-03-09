export interface FrameData {
  id: string;
  timestamp: number; // seconds
  imageDataUrl: string;
  replaced?: boolean; // user replaced this frame
  replacementDataUrl?: string;
  prompt?: string; // prompt used for this segment (if regenerated)
  /** When true, this frame came from a video clip – skip Ken Burns (pan/zoom) so video stays still. */
  fromVideo?: boolean;
}

export interface VideoProject {
  videoUrl: string;
  duration: number;
  prompt: string;
  frames: FrameData[];
}
