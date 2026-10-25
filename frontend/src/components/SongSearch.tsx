import React, { useState } from 'react';
import { Search, Music, Clock, Activity, Disc, Sparkles, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { SongInfo } from '../types';

interface SongSearchProps {
  onSongSelected: (song: SongInfo) => void;
  selectedSong: SongInfo | null;
}

const DEMO_PRESETS = [
  "Viva La Vida Coldplay",
  "Bohemian Rhapsody Queen",
  "Imagine John Lennon",
  "Shape of You Ed Sheeran",
  "Blinding Lights The Weeknd"
];

export const SongSearch: React.FC<SongSearchProps> = ({
  onSongSelected,
  selectedSong
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLyricsPreview, setShowLyricsPreview] = useState(true);

  const handleSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const resp = await fetch(`/api/songs/search?query=${encodeURIComponent(searchTerm.trim())}`);
      if (!resp.ok) {
        throw new Error("Could not find lyrics for this song. Please try another title.");
      }
      const data: SongInfo = await resp.json();
      onSongSelected(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-3xl studio-glass border border-studio-border/80 p-6 sm:p-7 relative overflow-hidden">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-studio-yellow mb-1">
            <span className="w-2 h-2 rounded-full bg-studio-yellow animate-ping" />
            <span>Step 1 · Song & Lyrics Lookup</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white font-['Syne']">
            Find Song & Backing Track
          </h2>
          <p className="text-xs text-studio-muted mt-0.5">
            Search any song to pull millisecond-accurate synced lyrics and AI musical analysis
          </p>
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-studio-muted font-mono uppercase mr-1">Presets:</span>
          {DEMO_PRESETS.slice(0, 3).map((p) => (
            <button
              key={p}
              onClick={() => {
                setQuery(p);
                handleSearch(p);
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-studio-dark/60 border border-studio-border/60 hover:border-studio-yellow/50 text-studio-beige/90 transition-all"
            >
              {p.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch(query);
        }}
        className="relative flex items-center"
      >
        <div className="absolute left-4 text-studio-muted pointer-events-none">
          <Search className="w-5 h-5 text-studio-yellow" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter song title, artist, or release year (e.g. Coldplay - Viva La Vida)..."
          className="w-full pl-12 pr-32 py-4 rounded-2xl bg-studio-dark/90 border border-studio-border text-white text-sm placeholder:text-studio-muted/70 focus:outline-none focus:border-studio-yellow focus:ring-1 focus:ring-studio-yellow transition-all shadow-inner"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className={`absolute right-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
            isLoading || !query.trim()
              ? 'bg-studio-border text-studio-muted cursor-not-allowed'
              : 'bg-yellow-gradient text-studio-dark yellow-glow hover:opacity-90 active:scale-95'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center space-x-1.5">
              <div className="w-3.5 h-3.5 border-2 border-studio-dark border-t-transparent rounded-full animate-spin" />
              <span>Searching...</span>
            </div>
          ) : (
            <span>Lookup</span>
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Song Details & Lyrics Preview */}
      {selectedSong && (
        <div className="mt-6 pt-6 border-t border-studio-border/60 animate-in fade-in duration-300">
          
          {/* Metadata Card */}
          <div className="p-4 rounded-2xl bg-studio-dark/70 border border-studio-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-studio-vinyl border border-studio-border flex items-center justify-center text-studio-yellow shrink-0 shadow-lg">
                <Disc className="w-8 h-8 animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-base text-white">{selectedSong.title}</h3>
                  {selectedSong.has_synced && (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Synced LRC
                    </span>
                  )}
                </div>
                <p className="text-xs text-studio-muted font-medium">
                  {selectedSong.artist} {selectedSong.album && `· ${selectedSong.album}`}
                </p>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-studio-card border border-studio-border flex items-center space-x-1.5 text-xs text-studio-beige">
                <Activity className="w-3.5 h-3.5 text-studio-yellow" />
                <span className="font-mono font-bold text-white">{selectedSong.bpm}</span>
                <span className="text-studio-muted text-[10px]">BPM</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-studio-card border border-studio-border flex items-center space-x-1.5 text-xs text-studio-beige">
                <Music className="w-3.5 h-3.5 text-studio-yellow" />
                <span className="font-bold text-white">{selectedSong.key}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-studio-card border border-studio-border flex items-center space-x-1.5 text-xs text-studio-beige">
                <span className="text-[10px] uppercase font-mono text-studio-muted">Genre:</span>
                <span className="font-semibold text-white">{selectedSong.genre}</span>
              </div>
            </div>

          </div>

          {/* Collapsible Lyrics Teleprompter */}
          <div className="mt-4">
            <button
              onClick={() => setShowLyricsPreview(!showLyricsPreview)}
              className="flex items-center justify-between w-full text-xs font-semibold text-studio-muted hover:text-white py-1"
            >
              <span>Lyrics Teleprompter ({selectedSong.lines.length} lines detected)</span>
              {showLyricsPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showLyricsPreview && (
              <div className="mt-2 p-4 rounded-2xl bg-studio-dark/50 border border-studio-border/70 max-h-56 overflow-y-auto space-y-1.5 font-mono text-xs">
                {selectedSong.lines.map((l, i) => (
                  <div key={i} className="flex items-center space-x-3 text-studio-beige/85 hover:text-white py-0.5">
                    <span className="text-[10px] text-studio-yellow/80 w-12 shrink-0 font-bold">
                      {Math.floor(l.start / 60)}:{String(Math.floor(l.start % 60)).padStart(2, '0')}
                    </span>
                    <span className="truncate">{l.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
