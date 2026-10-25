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
  artwork?: string;
  year?: number | null;
  preview_url?: string | null;
}

export interface CatalogTrack {
  id: string;
  source: 'itunes' | 'deezer' | 'spotify';
  title: string;
  artist: string;
  album: string;
  year: number | null;
  genre: string;
  duration: number;
  artwork: string;
  preview_url: string | null;
  explicit: boolean;
}

export interface YouTubeCandidate {
  video_id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
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
  label?: string;
}

export type ReverbType = 'dry' | 'room' | 'plate';

export interface CoverConfig {
  lineSelection: boolean[];
  lineEdits: string[];
  length: 'preview' | 'full';
  vocalGain: number;
  beatGain: number;
  reverb: ReverbType;
  beatOffset: number;
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
  artwork?: string;
  created_at?: number;
}

export interface SavedCover extends CoverResult {
  voice_name: string;
  lines: LyricLine[];
}
