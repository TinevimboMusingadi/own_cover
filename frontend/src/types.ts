export interface LyricLine {
  start: number;
  end: number;
  text: string;
}

export interface SongInfo {
  title: string;
  artist: string;
  album?: string;
  duration: number;
  bpm: number;
  key: string;
  genre: string;
  mood: string;
  instrumental_description?: string;
  has_synced: boolean;
  lines: LyricLine[];
}

export interface Voice {
  id: string;
  name: string;
  type: "replicated" | "prebuilt";
  description: string;
  is_default?: boolean;
}

export interface BeatTrack {
  id: string;
  url: string;
  path: string;
  model: string;
  prompt?: string;
}

export interface CoverResult {
  id: string;
  title: string;
  artist: string;
  voice_id: string;
  master_url: string;
  vocal_url: string;
  beat_url: string;
  duration: number;
}
