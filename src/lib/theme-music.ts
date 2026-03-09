/**
 * Map a prompt to a theme for background music selection.
 * Themes correspond to filenames in public/music/ (e.g. calm.mp3, cinematic.mp3).
 */
const THEME_KEYWORDS: Record<string, string[]> = {
  calm: [
    "calm", "serene", "peaceful", "quiet", "meditation", "zen", "relax", "soft",
    "gentle", "sunset", "sunrise", "ocean", "waves", "beach", "nature", "forest",
    "rain", "mist", "morning", "evening", "sleep", "dream",
  ],
  cinematic: [
    "cinematic", "movie", "film", "epic", "dramatic", "story", "adventure",
    "journey", "hero", "quest", "battle", "war", "space", "planet", "galaxy",
  ],
  nature: [
    "nature", "wildlife", "animal", "bird", "mountain", "river", "lake", "tree",
    "flower", "garden", "landscape", "forest", "jungle", "safari", "outdoor",
  ],
  upbeat: [
    "happy", "fun", "party", "celebration", "dance", "energy", "summer", "joy",
    "playful", "funny", "comedy", "bright", "cheerful", "upbeat",
  ],
  dramatic: [
    "dramatic", "tense", "suspense", "thriller", "dark", "mystery", "storm",
    "lightning", "intense", "action", "chase", "danger",
  ],
};

const THEMES = Object.keys(THEME_KEYWORDS);
const DEFAULT_THEME = "calm";

export function getThemeFromPrompt(prompt: string): string {
  const lower = prompt.toLowerCase().replace(/\s+/g, " ");
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return theme;
  }
  return DEFAULT_THEME;
}

export function getThemeMusicPath(theme: string): string {
  return `/music/${theme}.mp3`;
}
