import React, { useState } from 'react';
import { ArrowLeft, Wand2, Mic, Disc, ListMusic, SlidersHorizontal, Clock, AlertCircle, Pencil } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BeatTrack, CoverConfig, CoverResult, SongInfo, Voice } from '../types';
import { coverDuration, formatTime, linesToSing, pollTask, readError } from '../api';

interface ConfirmCoverProps {
  song: SongInfo;
  voice: Voice;
  beat: BeatTrack;
  config: CoverConfig;
  onEdit: () => void;
  onComplete: (cover: CoverResult) => void;
}

const Row: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode; onEdit?: () => void }> = ({ icon, label, children, onEdit }) => (
  <div className="flex items-start gap-4 py-4">
    <div className="w-9 h-9 rounded-xl bg-studio-yellow/15 text-studio-yellow flex items-center justify-center shrink-0">{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="text-[10px] font-mono uppercase tracking-wider text-studio-muted">{label}</div>
      <div className="text-sm text-white mt-0.5">{children}</div>
    </div>
    {onEdit && (
      <button onClick={onEdit} className="text-xs text-studio-yellow flex items-center gap-1 hover:underline shrink-0">
        <Pencil className="w-3 h-3" /> Edit
      </button>
    )}
  </div>
);

export const ConfirmCover: React.FC<ConfirmCoverProps> = ({ song, voice, beat, config, onEdit, onComplete }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const lines = linesToSing(song, config);
  const duration = coverDuration(song, lines);

  const create = async () => {
    setIsProcessing(true);
    setProgress(3);
    setMessage('Sending your cover to the studio…');
    setError(null);
    try {
      const resp = await fetch('/api/cover/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: song.title,
          artist: song.artist,
          voice_id: voice.id,
          beat_path: beat.path,
          lines,
          duration,
          artwork: song.artwork || '',
          vocal_gain: config.vocalGain,
          beat_gain: config.beatGain,
          reverb: config.reverb,
          beat_offset_s: config.beatOffset,
        }),
      });
      if (!resp.ok) throw new Error(await readError(resp, 'Failed to start cover production'));
      const { task_id } = await resp.json();
      const result = await pollTask<CoverResult>(task_id, (p, m) => {
        setProgress(p);
        setMessage(m);
      }, 2000);
      setProgress(100);
      try {
        confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 }, colors: ['#FACC15', '#FDE047', '#FAF7F2', '#13141B'] });
      } catch {
        /* confetti is decorative */
      }
      onComplete(result);
    } catch (err: any) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  return (
    <section className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <div className="text-xs font-mono uppercase tracking-wider text-studio-yellow mb-1">Step 3 · Confirm</div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Syne']">Ready to record?</h2>
        <p className="text-sm text-studio-muted mt-1">Check everything below. Generation takes about a minute for a preview.</p>
      </div>

      <div className="rounded-3xl studio-glass overflow-hidden">
        <div className="relative p-6 flex items-center gap-5 bg-grain-pattern border-b border-studio-border">
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-studio-vinyl border border-studio-border shrink-0 shadow-2xl">
            {song.artwork ? <img src={song.artwork} alt="" className="w-full h-full object-cover" /> : <Disc className="w-full h-full p-6 text-studio-yellow" />}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-studio-muted">Your cover of</div>
            <h3 className="text-xl font-bold text-white font-['Syne'] truncate">{song.title}</h3>
            <p className="text-sm text-studio-muted truncate">{song.artist}</p>
          </div>
        </div>

        <div className="px-6 divide-y divide-studio-border/60">
          <Row icon={<Mic className="w-4 h-4" />} label="Voice" onEdit={onEdit}>
            {voice.name}
          </Row>
          <Row icon={<Disc className="w-4 h-4" />} label="Beat" onEdit={onEdit}>
            <span className="block truncate">{beat.label || beat.model}</span>
            <audio src={beat.url} controls className="w-full h-8 mt-2" />
          </Row>
          <Row icon={<ListMusic className="w-4 h-4" />} label="Lyrics" onEdit={onEdit}>
            {lines.length} lines · {config.length === 'preview' ? 'Preview' : 'Full song'}
            <span className="block text-xs text-studio-muted truncate">“{lines[0]?.text}” … “{lines[lines.length - 1]?.text}”</span>
          </Row>
          <Row icon={<SlidersHorizontal className="w-4 h-4" />} label="Mix" onEdit={onEdit}>
            Vocals {config.vocalGain.toFixed(2)} · Beat {config.beatGain.toFixed(2)} · <span className="capitalize">{config.reverb}</span> reverb
            {config.beatOffset !== 0 && ` · Beat offset ${config.beatOffset > 0 ? '+' : ''}${config.beatOffset}s`}
          </Row>
          <Row icon={<Clock className="w-4 h-4" />} label="Length">{formatTime(duration)}</Row>
        </div>
      </div>

      {isProcessing && (
        <div className="p-5 rounded-2xl bg-studio-dark/90 border border-studio-yellow/40 yellow-glow space-y-3">
          <div className="flex items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-2 text-studio-yellow font-bold min-w-0">
              <div className="w-3.5 h-3.5 border-2 border-studio-yellow border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="truncate">{message}</span>
            </div>
            <span className="font-mono font-bold text-white">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-studio-border overflow-hidden">
            <div className="h-full bg-yellow-gradient transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <button onClick={onEdit} disabled={isProcessing} className="px-5 py-4 rounded-2xl border border-studio-border text-studio-beige text-xs font-semibold flex items-center justify-center gap-2 hover:border-studio-yellow/50">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={create}
          disabled={isProcessing}
          className={`flex-1 py-4 rounded-2xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-3 ${
            isProcessing ? 'bg-studio-border text-studio-muted cursor-not-allowed' : 'bg-yellow-gradient text-studio-dark yellow-glow hover:opacity-95 active:scale-[0.99]'
          }`}
        >
          <Wand2 className="w-5 h-5" />
          {isProcessing ? 'Recording your cover…' : 'Create my cover'}
        </button>
      </div>
    </section>
  );
};
