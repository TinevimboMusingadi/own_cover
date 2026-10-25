import React, { useEffect, useState } from 'react';
import {
  Mic, Plus, Check, MonitorPlay, Sparkles, Upload, Loader2, Disc, Music, Activity, ArrowRight,
  ArrowLeft, SlidersHorizontal, ListMusic, Play, Download,
} from 'lucide-react';
import { BeatTrack, CoverConfig, ReverbType, SongInfo, Voice, YouTubeCandidate } from '../types';
import { formatTime, linesToSing, pollTask, readError, PREVIEW_SECONDS } from '../api';

interface CoverConfiguratorProps {
  song: SongInfo;
  voices: Voice[];
  activeVoice: Voice | null;
  onSelectVoice: (v: Voice) => void;
  onOpenVoiceStudio: () => void;
  beat: BeatTrack | null;
  onBeatReady: (beat: BeatTrack) => void;
  config: CoverConfig;
  onConfigChange: (config: CoverConfig) => void;
  onBack: () => void;
  onNext: () => void;
}

type BeatTab = 'youtube' | 'lyria' | 'upload';

const Section: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }> = ({
  icon, title, subtitle, children, right,
}) => (
  <div className="rounded-3xl studio-glass p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-studio-yellow/15 text-studio-yellow flex items-center justify-center shrink-0">{icon}</div>
        <div>
          <h3 className="font-bold text-white font-['Syne'] text-lg leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-studio-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
    {children}
  </div>
);

const inputCls =
  'w-full px-3.5 py-2.5 rounded-xl bg-studio-dark border border-studio-border text-white text-sm focus:outline-none focus:border-studio-yellow';

export const CoverConfigurator: React.FC<CoverConfiguratorProps> = ({
  song, voices, activeVoice, onSelectVoice, onOpenVoiceStudio, beat, onBeatReady, config, onConfigChange, onBack, onNext,
}) => {
  const [beatTab, setBeatTab] = useState<BeatTab>('youtube');
  const [beatError, setBeatError] = useState<string | null>(null);

  // YouTube
  const [ytCandidates, setYtCandidates] = useState<YouTubeCandidate[]>([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytPreviewId, setYtPreviewId] = useState<string | null>(null);
  const [ytDownloading, setYtDownloading] = useState<string | null>(null);
  const [ytProgress, setYtProgress] = useState(0);

  // Lyria
  const [bpm, setBpm] = useState(song.bpm || 110);
  const [genre, setGenre] = useState(song.genre || 'Pop');
  const [mood, setMood] = useState(song.mood || 'steady');
  const [description, setDescription] = useState(song.instrumental_description || '');
  const [lyriaLoading, setLyriaLoading] = useState(false);

  const set = <K extends keyof CoverConfig>(key: K, value: CoverConfig[K]) => onConfigChange({ ...config, [key]: value });

  useEffect(() => {
    if (beatTab !== 'youtube' || ytCandidates.length > 0 || ytLoading) return;
    setYtLoading(true);
    const params = new URLSearchParams({ title: song.title, artist: song.artist });
    fetch(`/api/youtube/instrumentals?${params}`)
      .then(async (resp) => {
        if (!resp.ok) throw new Error(await readError(resp, 'YouTube search failed'));
        return resp.json();
      })
      .then((data) => setYtCandidates(data.candidates || []))
      .catch((err) => setBeatError(err.message))
      .finally(() => setYtLoading(false));
  }, [beatTab, song.title, song.artist]);

  const pickYouTube = async (c: YouTubeCandidate) => {
    setYtDownloading(c.video_id);
    setYtProgress(0);
    setBeatError(null);
    try {
      const resp = await fetch('/api/youtube/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: c.video_id }),
      });
      if (!resp.ok) throw new Error(await readError(resp, 'Could not start download'));
      const { task_id } = await resp.json();
      const result = await pollTask<BeatTrack>(task_id, (p) => setYtProgress(p));
      onBeatReady({ ...result, label: c.title });
    } catch (err: any) {
      setBeatError(err.message);
    } finally {
      setYtDownloading(null);
    }
  };

  const generateLyria = async () => {
    setLyriaLoading(true);
    setBeatError(null);
    try {
      const resp = await fetch('/api/music/instrumental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genre, bpm, mood, description, duration: Math.min(120, Math.ceil(song.duration || 90)) }),
      });
      if (!resp.ok) throw new Error(await readError(resp, 'Lyria generation failed'));
      const data: BeatTrack = await resp.json();
      onBeatReady({ ...data, label: `${genre} · ${bpm} BPM (${data.model})` });
    } catch (err: any) {
      setBeatError(err.message);
    } finally {
      setLyriaLoading(false);
    }
  };

  const uploadBeat = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBeatError(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const resp = await fetch('/api/music/upload-beat', { method: 'POST', body: fd });
      if (!resp.ok) throw new Error(await readError(resp, 'Upload failed'));
      const data: BeatTrack = await resp.json();
      onBeatReady({ ...data, label: file.name });
    } catch (err: any) {
      setBeatError(err.message);
    }
  };

  const sung = linesToSing(song, config);
  const allSelected = config.lineSelection.every(Boolean);

  return (
    <section className="space-y-6">
      {/* Song header */}
      <div className="rounded-3xl studio-glass p-5 sm:p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
        <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-studio-vinyl border border-studio-border shrink-0 shadow-2xl">
          {song.artwork ? (
            <img src={song.artwork} alt={song.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Disc className="w-12 h-12 text-studio-yellow animate-spin-slow" /></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono uppercase tracking-wider text-studio-yellow mb-1">Step 2 · Configure your cover</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Syne'] truncate">{song.title}</h2>
          <p className="text-sm text-studio-muted truncate">
            {song.artist}{song.album && ` · ${song.album}`}{song.year && ` · ${song.year}`}
          </p>
          <div className="flex flex-wrap gap-2 mt-3 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-studio-dark border border-studio-border flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-studio-yellow" /><b className="text-white font-mono">{song.bpm}</b> BPM</span>
            <span className="px-2.5 py-1 rounded-lg bg-studio-dark border border-studio-border flex items-center gap-1.5"><Music className="w-3.5 h-3.5 text-studio-yellow" /><b className="text-white">{song.key}</b></span>
            <span className="px-2.5 py-1 rounded-lg bg-studio-dark border border-studio-border text-white">{song.genre}</span>
            <span className={`px-2.5 py-1 rounded-lg border ${song.has_synced ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>
              {song.has_synced ? 'Synced lyrics' : 'Estimated timing'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Voice */}
        <Section
          icon={<Mic className="w-5 h-5" />}
          title="Who's singing?"
          subtitle="Your cloned voice or a Gemini prebuilt voice"
          right={
            <button onClick={onOpenVoiceStudio} className="text-xs font-semibold text-studio-yellow flex items-center gap-1 hover:underline shrink-0">
              <Plus className="w-3.5 h-3.5" /> Clone voice
            </button>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {voices.length === 0 && <div className="text-xs text-studio-muted italic">Loading voices…</div>}
            {voices.map((v) => {
              const selected = activeVoice?.id === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => onSelectVoice(v)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    selected ? 'border-studio-yellow bg-studio-yellow/10' : 'border-studio-border bg-studio-dark/60 hover:border-studio-yellow/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-white truncate">{v.name}</span>
                    {selected && <Check className="w-4 h-4 text-studio-yellow shrink-0" />}
                  </div>
                  <span className={`inline-block mt-1 text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${v.type === 'replicated' ? 'bg-studio-yellow/15 text-studio-yellow' : 'bg-studio-border text-studio-muted'}`}>
                    {v.type === 'replicated' ? 'Your voice' : 'Prebuilt'}
                  </span>
                </button>
              );
            })}
          </div>

        </Section>

        {/* Beat */}
        <Section icon={<Disc className="w-5 h-5" />} title="Pick the beat" subtitle="Grab the instrumental from YouTube, generate one with Lyria, or upload your own">
          <div className="flex p-1 rounded-xl bg-studio-dark border border-studio-border text-xs font-semibold mb-4">
            {([['youtube', 'YouTube', MonitorPlay], ['lyria', 'Lyria AI', Sparkles], ['upload', 'Upload', Upload]] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setBeatTab(id)}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${beatTab === id ? 'bg-studio-yellow text-studio-dark' : 'text-studio-muted hover:text-white'}`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {beatTab === 'youtube' && (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {ytLoading && <div className="flex items-center gap-2 text-xs text-studio-muted py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Searching YouTube for instrumentals…</div>}
              {!ytLoading && ytCandidates.length === 0 && !beatError && <div className="text-xs text-studio-muted italic py-4">No instrumentals found.</div>}
              {ytCandidates.map((c) => {
                const isActive = beat?.id === `beat_yt_${c.video_id}`;
                return (
                  <div key={c.video_id} className={`rounded-xl border p-2 ${isActive ? 'border-studio-yellow bg-studio-yellow/5' : 'border-studio-border bg-studio-dark/60'}`}>
                    <div className="flex gap-3">
                      <button onClick={() => setYtPreviewId(ytPreviewId === c.video_id ? null : c.video_id)} className="relative w-28 aspect-video rounded-lg overflow-hidden shrink-0 bg-studio-vinyl group" title="Preview">
                        <img src={c.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100"><Play className="w-5 h-5 text-white" /></span>
                        <span className="absolute bottom-1 right-1 text-[9px] font-mono bg-black/70 text-white px-1 rounded">{formatTime(c.duration)}</span>
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white line-clamp-2">{c.title}</div>
                        <div className="text-[10px] text-studio-muted truncate">{c.channel}</div>
                        <button
                          onClick={() => pickYouTube(c)}
                          disabled={ytDownloading !== null || isActive}
                          className={`mt-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                            isActive ? 'bg-emerald-500/15 text-emerald-300' : ytDownloading ? 'bg-studio-border text-studio-muted' : 'bg-yellow-gradient text-studio-dark'
                          }`}
                        >
                          {isActive ? <><Check className="w-3 h-3" /> Selected</> : ytDownloading === c.video_id ? <><Loader2 className="w-3 h-3 animate-spin" /> {Math.round(ytProgress)}%</> : <><Download className="w-3 h-3" /> Use this</>}
                        </button>
                      </div>
                    </div>
                    {ytPreviewId === c.video_id && (
                      <iframe
                        className="w-full aspect-video rounded-lg mt-2"
                        src={`https://www.youtube-nocookie.com/embed/${c.video_id}?autoplay=1`}
                        title={c.title}
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {beatTab === 'lyria' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-studio-beige mb-1">BPM</label>
                  <input type="number" min={50} max={200} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className={`${inputCls} font-mono`} />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-studio-beige mb-1">Genre</label>
                  <input value={genre} onChange={(e) => setGenre(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-studio-beige mb-1">Mood</label>
                <input value={mood} onChange={(e) => setMood(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-studio-beige mb-1">Instruments</label>
                <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
              </div>
              <button
                onClick={generateLyria}
                disabled={lyriaLoading}
                className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 ${lyriaLoading ? 'bg-studio-border text-studio-muted' : 'bg-yellow-gradient text-studio-dark yellow-glow'}`}
              >
                {lyriaLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating with Lyria…</> : <><Sparkles className="w-4 h-4" /> Generate instrumental</>}
              </button>
            </div>
          )}

          {beatTab === 'upload' && (
            <label className="flex flex-col items-center justify-center gap-2 py-10 rounded-2xl border-2 border-dashed border-studio-border hover:border-studio-yellow cursor-pointer text-studio-muted hover:text-white transition-colors">
              <Upload className="w-7 h-7" />
              <span className="text-sm font-semibold">Drop or choose an MP3 / WAV</span>
              <input type="file" accept="audio/*" className="hidden" onChange={uploadBeat} />
            </label>
          )}

          {beatError && <div className="mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{beatError}</div>}

          {beat && (
            <div className="mt-4 p-3 rounded-xl bg-studio-dark border border-emerald-500/30">
              <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold mb-2"><Check className="w-3.5 h-3.5" /> Beat ready: <span className="text-white truncate">{beat.label || beat.model}</span></div>
              <audio key={beat.url} src={beat.url} controls className="w-full h-9" />
            </div>
          )}
        </Section>
      </div>

      {/* Lyrics */}
      <Section
        icon={<ListMusic className="w-5 h-5" />}
        title="Lyrics to sing"
        subtitle={`${sung.length} of ${song.lines.length} lines will be sung. Untick lines to skip them, or click a line to edit it.`}
        right={
          <div className="flex p-1 rounded-xl bg-studio-dark border border-studio-border text-[11px] font-semibold shrink-0">
            <button onClick={() => set('length', 'preview')} className={`px-2.5 py-1.5 rounded-lg ${config.length === 'preview' ? 'bg-studio-yellow text-studio-dark' : 'text-studio-muted'}`}>Preview ({PREVIEW_SECONDS}s)</button>
            <button onClick={() => set('length', 'full')} className={`px-2.5 py-1.5 rounded-lg ${config.length === 'full' ? 'bg-studio-yellow text-studio-dark' : 'text-studio-muted'}`}>Full song</button>
          </div>
        }
      >
        <button
          onClick={() => set('lineSelection', config.lineSelection.map(() => !allSelected))}
          className="text-[11px] text-studio-yellow hover:underline mb-2"
        >
          {allSelected ? 'Untick all' : 'Tick all'}
        </button>
        <div className="max-h-80 overflow-y-auto rounded-2xl bg-studio-dark/60 border border-studio-border divide-y divide-studio-border/50">
          {song.lines.map((l, i) => {
            const included = config.lineSelection[i] !== false;
            const inWindow = sung.some((s) => s.start === l.start);
            return (
              <div key={i} className={`flex items-center gap-3 px-3 py-1.5 ${included ? '' : 'opacity-40'}`}>
                <input
                  type="checkbox"
                  checked={included}
                  onChange={() => set('lineSelection', config.lineSelection.map((v, j) => (j === i ? !v : v)))}
                  className="accent-yellow-400 w-4 h-4 shrink-0"
                />
                <span className={`text-[10px] font-mono w-10 shrink-0 ${inWindow ? 'text-studio-yellow' : 'text-studio-muted'}`}>{formatTime(l.start)}</span>
                <input
                  value={config.lineEdits[i] ?? l.text}
                  onChange={(e) => set('lineEdits', config.lineEdits.map((t, j) => (j === i ? e.target.value : t)))}
                  className="flex-1 bg-transparent text-sm text-studio-beige focus:text-white focus:outline-none focus:bg-studio-card rounded px-1 py-0.5"
                />
              </div>
            );
          })}
          {song.lines.length === 0 && <div className="p-4 text-xs text-studio-muted italic">No lyrics found for this song.</div>}
        </div>
      </Section>

      {/* Mix */}
      <Section icon={<SlidersHorizontal className="w-5 h-5" />} title="Mix settings" subtitle="How your vocals sit on the beat">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div>
            <label className="flex justify-between text-xs font-semibold text-studio-beige mb-2">Vocal level <span className="font-mono text-studio-yellow">{config.vocalGain.toFixed(2)}</span></label>
            <input type="range" min={0.3} max={2} step={0.05} value={config.vocalGain} onChange={(e) => set('vocalGain', Number(e.target.value))} className="w-full accent-yellow-400" />
          </div>
          <div>
            <label className="flex justify-between text-xs font-semibold text-studio-beige mb-2">Beat level <span className="font-mono text-studio-yellow">{config.beatGain.toFixed(2)}</span></label>
            <input type="range" min={0.2} max={1.5} step={0.05} value={config.beatGain} onChange={(e) => set('beatGain', Number(e.target.value))} className="w-full accent-yellow-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-studio-beige mb-2">Reverb</label>
            <div className="flex p-1 rounded-xl bg-studio-dark border border-studio-border text-[11px] font-semibold">
              {(['dry', 'room', 'plate'] as ReverbType[]).map((r) => (
                <button key={r} onClick={() => set('reverb', r)} className={`flex-1 py-1.5 rounded-lg capitalize ${config.reverb === r ? 'bg-studio-yellow text-studio-dark' : 'text-studio-muted'}`}>{r}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="flex justify-between text-xs font-semibold text-studio-beige mb-2">Beat offset <span className="font-mono text-studio-yellow">{config.beatOffset > 0 ? '+' : ''}{config.beatOffset.toFixed(1)}s</span></label>
            <input type="range" min={-10} max={30} step={0.5} value={config.beatOffset} onChange={(e) => set('beatOffset', Number(e.target.value))} className="w-full accent-yellow-400" />
            <p className="text-[10px] text-studio-muted mt-1">Positive skips the beat's intro, negative delays it</p>
          </div>
        </div>
      </Section>

      {/* Nav */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className="px-5 py-3 rounded-xl border border-studio-border text-studio-beige text-xs font-semibold flex items-center gap-2 hover:border-studio-yellow/50">
          <ArrowLeft className="w-4 h-4" /> Change song
        </button>
        <button
          onClick={onNext}
          disabled={!activeVoice || !beat || sung.length === 0}
          className={`px-7 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 ${
            !activeVoice || !beat || sung.length === 0 ? 'bg-studio-border text-studio-muted cursor-not-allowed' : 'bg-yellow-gradient text-studio-dark yellow-glow'
          }`}
        >
          {!beat ? 'Pick a beat to continue' : !activeVoice ? 'Pick a voice' : sung.length === 0 ? 'Select some lyrics' : 'Review & confirm'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};
