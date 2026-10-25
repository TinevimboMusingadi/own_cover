import React, { useEffect, useRef, useState } from 'react';
import { Search, Play, Pause, Disc, Calendar, Clock, Loader2, Music } from 'lucide-react';
import { CatalogTrack, SongInfo } from '../types';
import { formatTime, readError } from '../api';

interface CatalogSearchProps {
  onSongPrepared: (song: SongInfo) => void;
}

const PRESETS = ['Viva La Vida Coldplay', 'Blinding Lights', 'Imagine John Lennon', 'Shape of You'];

const SOURCE_STYLES: Record<CatalogTrack['source'], string> = {
  itunes: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  deezer: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  spotify: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

export const CatalogSearch: React.FC<CatalogSearchProps> = ({ onSongPrepared }) => {
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('');
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const runSearch = async (term: string) => {
    if (!term.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: term.trim() });
      if (/^\d{4}$/.test(year)) params.set('year', year);
      const resp = await fetch(`/api/catalog/search?${params}`);
      if (!resp.ok) throw new Error(await readError(resp, 'Search failed'));
      const data = await resp.json();
      setTracks(data.tracks || []);
      setHasSearched(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const togglePreview = (track: CatalogTrack) => {
    const key = `${track.source}-${track.id}`;
    if (playingId === key) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (!track.preview_url) return;
    audioRef.current?.pause();
    const audio = new Audio(track.preview_url);
    audio.onended = () => setPlayingId(null);
    audio.play().catch(() => setPlayingId(null));
    audioRef.current = audio;
    setPlayingId(key);
  };

  const selectTrack = async (track: CatalogTrack) => {
    const key = `${track.source}-${track.id}`;
    setPreparingId(key);
    setError(null);
    audioRef.current?.pause();
    setPlayingId(null);
    try {
      const resp = await fetch('/api/songs/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: track.title,
          artist: track.artist,
          album: track.album,
          duration: track.duration || null,
          artwork: track.artwork,
          year: track.year,
          preview_url: track.preview_url,
          source: track.source,
          source_id: track.id,
        }),
      });
      if (!resp.ok) throw new Error(await readError(resp, 'Could not pull lyrics for this song'));
      onSongPrepared(await resp.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPreparingId(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-3xl studio-glass p-6 sm:p-7">
        <div className="mb-5">
          <div className="text-xs font-mono uppercase tracking-wider text-studio-yellow mb-1">Step 1 · Find your song</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Syne']">What are we covering today?</h2>
          <p className="text-sm text-studio-muted mt-1">Search millions of tracks. Preview them, then pick the exact version you want.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-studio-yellow pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Song title, artist…"
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-studio-dark/90 border border-studio-border text-white text-sm placeholder:text-studio-muted/70 focus:outline-none focus:border-studio-yellow focus:ring-1 focus:ring-studio-yellow"
            />
          </div>
          <div className="relative sm:w-32">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-studio-muted pointer-events-none" />
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
              placeholder="Year"
              className="w-full pl-10 pr-3 py-4 rounded-2xl bg-studio-dark/90 border border-studio-border text-white text-sm font-mono placeholder:text-studio-muted/70 focus:outline-none focus:border-studio-yellow"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className={`px-7 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              isSearching || !query.trim()
                ? 'bg-studio-border text-studio-muted cursor-not-allowed'
                : 'bg-yellow-gradient text-studio-dark yellow-glow hover:opacity-90 active:scale-95'
            }`}
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search</span>
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className="text-[10px] text-studio-muted font-mono uppercase mr-1">Try:</span>
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setQuery(p);
                runSearch(p);
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-studio-dark/60 border border-studio-border/60 hover:border-studio-yellow/50 text-studio-beige/90"
            >
              {p}
            </button>
          ))}
        </div>

        {error && <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{error}</div>}
      </div>

      {hasSearched && tracks.length === 0 && !isSearching && (
        <div className="text-center py-12 text-studio-muted text-sm">
          <Music className="w-10 h-10 mx-auto mb-3 opacity-40" />
          No songs found. Try a different title or clear the year.
        </div>
      )}

      {tracks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {tracks.map((t) => {
            const key = `${t.source}-${t.id}`;
            const isPlaying = playingId === key;
            const isPreparing = preparingId === key;
            return (
              <article
                key={key}
                className={`group rounded-2xl bg-studio-card border overflow-hidden flex flex-col studio-glass-hover ${
                  isPreparing ? 'border-studio-yellow yellow-glow' : 'border-studio-border'
                }`}
              >
                <div className="relative aspect-square bg-studio-vinyl">
                  {t.artwork ? (
                    <img src={t.artwork} alt={t.album || t.title} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Disc className="w-12 h-12 text-studio-border" />
                    </div>
                  )}
                  {t.preview_url && (
                    <button
                      onClick={() => togglePreview(t)}
                      title="Play 30s preview"
                      className={`absolute bottom-2 right-2 w-10 h-10 rounded-full flex items-center justify-center shadow-xl transition-all ${
                        isPlaying ? 'bg-studio-yellow text-studio-dark' : 'bg-studio-dark/80 text-studio-yellow opacity-90 sm:opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                  )}
                  <span className={`absolute top-2 left-2 text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${SOURCE_STYLES[t.source]}`}>
                    {t.source}
                  </span>
                  {t.explicit && (
                    <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-studio-dark/80 text-studio-beige">E</span>
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="font-bold text-sm text-white leading-tight line-clamp-2">{t.title}</h3>
                  <p className="text-xs text-studio-muted truncate mt-0.5">{t.artist}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] font-mono text-studio-muted">
                    {t.year && <span>{t.year}</span>}
                    {t.duration > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {formatTime(t.duration)}
                      </span>
                    )}
                    {t.genre && <span className="truncate">{t.genre}</span>}
                  </div>
                  <button
                    onClick={() => selectTrack(t)}
                    disabled={preparingId !== null}
                    className={`mt-3 w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      isPreparing
                        ? 'bg-studio-yellow text-studio-dark'
                        : preparingId
                        ? 'bg-studio-border text-studio-muted cursor-not-allowed'
                        : 'bg-studio-dark border border-studio-border text-studio-beige hover:bg-yellow-gradient hover:text-studio-dark hover:border-transparent'
                    }`}
                  >
                    {isPreparing ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Pulling lyrics…
                      </span>
                    ) : (
                      'Cover this'
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
