import React, { useState } from 'react';
import { Play, Sparkles, Mic, Music, Disc3, Check, AlertCircle, Wand2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { SongInfo, Voice, BeatTrack, CoverResult } from '../types';

interface CoverStudioProps {
  selectedSong: SongInfo | null;
  activeVoice: Voice | null;
  activeBeat: BeatTrack | null;
  onCoverComplete: (cover: CoverResult) => void;
  onOpenVoiceStudio: () => void;
}

export const CoverStudio: React.FC<CoverStudioProps> = ({
  selectedSong,
  activeVoice,
  activeBeat,
  onCoverComplete,
  onOpenVoiceStudio
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [coverLength, setCoverLength] = useState<'preview' | 'full'>('preview');

  const canProduce = Boolean(selectedSong && activeVoice && activeBeat);

  const handleStartCover = async () => {
    if (!selectedSong || !activeVoice || !activeBeat) return;
    setIsProcessing(true);
    setProgress(5);
    setProgressMessage("Submitting cover stems to production deck...");
    setError(null);

    // Filter lines if preview mode (first 6 lines or 35 seconds)
    const linesToCover = coverLength === 'preview'
      ? selectedSong.lines.slice(0, Math.min(8, selectedSong.lines.length))
      : selectedSong.lines;

    const maxDuration = coverLength === 'preview' ? 35.0 : Math.min(selectedSong.duration || 120, 150);

    try {
      const resp = await fetch('/api/cover/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selectedSong.title,
          artist: selectedSong.artist,
          voice_id: activeVoice.id,
          beat_path: activeBeat.path,
          lines: linesToCover,
          duration: maxDuration
        })
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.detail || "Failed to start cover production");
      }

      const taskId = data.task_id;
      pollStatus(taskId);
    } catch (err: any) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  const pollStatus = (taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`/api/cover/status/${taskId}`);
        const data = await resp.json();
        
        if (data.status === 'completed') {
          clearInterval(interval);
          setProgress(100);
          setProgressMessage("Master cover production complete!");
          setIsProcessing(false);
          onCoverComplete(data.result);
          // Trigger celebration confetti
          try {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#FACC15', '#FDE047', '#FAF7F2', '#13141B']
            });
          } catch (e) {}
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setError(data.error || "Cover production encountered an error");
          setIsProcessing(false);
        } else {
          setProgress(data.progress || 20);
          setProgressMessage(data.message || "Synthesizing vocals...");
        }
      } catch (err: any) {
        clearInterval(interval);
        setError("Network error polling cover status");
        setIsProcessing(false);
      }
    }, 2000);
  };

  return (
    <div className="rounded-3xl studio-glass border border-studio-border/80 p-6 sm:p-7 relative overflow-hidden">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-studio-yellow mb-1">
            <span className="w-2 h-2 rounded-full bg-studio-yellow animate-ping" />
            <span>Step 3 · Cover Producer & Mixer</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white font-['Syne']">
            Master Audio Production
          </h2>
          <p className="text-xs text-studio-muted mt-0.5">
            Synthesize vocal stems with your Gemini voice and mix down with FFmpeg mastering
          </p>
        </div>

        {/* Length selector */}
        <div className="flex items-center space-x-2 p-1 rounded-xl bg-studio-dark/80 border border-studio-border text-xs font-semibold">
          <button
            onClick={() => setCoverLength('preview')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              coverLength === 'preview'
                ? 'bg-studio-yellow text-studio-dark'
                : 'text-studio-muted hover:text-white'
            }`}
          >
            Studio Preview (35s)
          </button>
          <button
            onClick={() => setCoverLength('full')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              coverLength === 'full'
                ? 'bg-studio-yellow text-studio-dark'
                : 'text-studio-muted hover:text-white'
            }`}
          >
            Full Track Cover
          </button>
        </div>
      </div>

      {/* 3 Pillars Summary Deck */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        
        {/* Pillar 1: Song */}
        <div className={`p-4 rounded-2xl border transition-all ${
          selectedSong ? 'border-studio-border bg-studio-dark/70' : 'border-dashed border-studio-border/60 bg-studio-dark/30'
        }`}>
          <div className="flex items-center space-x-2 text-xs text-studio-muted mb-2 font-mono uppercase">
            <Music className="w-3.5 h-3.5 text-studio-yellow" />
            <span>1. Composition</span>
          </div>
          {selectedSong ? (
            <div>
              <div className="font-bold text-white text-sm truncate">{selectedSong.title}</div>
              <div className="text-xs text-studio-muted truncate">{selectedSong.artist}</div>
              <div className="mt-2 text-[11px] font-mono text-studio-yellow">
                {selectedSong.lines.length} vocal lines
              </div>
            </div>
          ) : (
            <div className="text-xs text-studio-muted italic">Lookup a song in Step 1</div>
          )}
        </div>

        {/* Pillar 2: Voice */}
        <div className={`p-4 rounded-2xl border transition-all ${
          activeVoice ? 'border-studio-border bg-studio-dark/70' : 'border-dashed border-studio-border/60 bg-studio-dark/30'
        }`}>
          <div className="flex items-center justify-between text-xs text-studio-muted mb-2 font-mono uppercase">
            <div className="flex items-center space-x-2">
              <Mic className="w-3.5 h-3.5 text-studio-yellow" />
              <span>2. Singer Voice</span>
            </div>
            <button
              onClick={onOpenVoiceStudio}
              className="text-[10px] text-studio-yellow hover:underline"
            >
              Change
            </button>
          </div>
          {activeVoice ? (
            <div>
              <div className="font-bold text-white text-sm truncate">{activeVoice.name}</div>
              <div className="text-xs text-studio-muted truncate">{activeVoice.description}</div>
              <div className="mt-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-studio-yellow/15 text-studio-yellow border border-studio-yellow/30">
                  {activeVoice.type === 'replicated' ? 'Replicated Voice' : 'Prebuilt Voice'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-studio-muted italic">No voice selected</div>
          )}
        </div>

        {/* Pillar 3: Beat */}
        <div className={`p-4 rounded-2xl border transition-all ${
          activeBeat ? 'border-studio-border bg-studio-dark/70' : 'border-dashed border-studio-border/60 bg-studio-dark/30'
        }`}>
          <div className="flex items-center space-x-2 text-xs text-studio-muted mb-2 font-mono uppercase">
            <Disc3 className="w-3.5 h-3.5 text-studio-yellow" />
            <span>3. Instrumental Beat</span>
          </div>
          {activeBeat ? (
            <div>
              <div className="font-bold text-white text-sm truncate">Ready ({activeBeat.model})</div>
              <div className="text-xs text-studio-muted truncate">Stereo Instrumental Stem</div>
              <div className="mt-2 text-[11px] font-mono text-emerald-400 flex items-center space-x-1">
                <Check className="w-3.5 h-3.5" />
                <span>Stem loaded</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-studio-muted italic">Generate or upload beat in Step 2</div>
          )}
        </div>

      </div>

      {/* Progress Bar & Status */}
      {isProcessing && (
        <div className="mb-6 p-5 rounded-2xl bg-studio-dark/90 border border-studio-yellow/40 yellow-glow space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-studio-yellow font-bold">
              <div className="w-3.5 h-3.5 border-2 border-studio-yellow border-t-transparent rounded-full animate-spin" />
              <span>{progressMessage}</span>
            </div>
            <span className="font-mono font-bold text-white">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-studio-border overflow-hidden">
            <div
              className="h-full bg-yellow-gradient transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Produce Action Button */}
      <button
        onClick={handleStartCover}
        disabled={!canProduce || isProcessing}
        className={`w-full py-4 rounded-2xl font-bold text-sm uppercase tracking-wider flex items-center justify-center space-x-3 transition-all ${
          !canProduce || isProcessing
            ? 'bg-studio-border text-studio-muted cursor-not-allowed'
            : 'bg-yellow-gradient text-studio-dark yellow-glow hover:opacity-95 active:scale-[0.99] shadow-xl'
        }`}
      >
        <Wand2 className="w-5 h-5" />
        <span>
          {isProcessing
            ? "Mixing & Producing Master Audio..."
            : canProduce
            ? `Produce AI Cover with ${activeVoice?.name.split(' ')[0]}`
            : "Complete Steps 1 & 2 to Produce Cover"}
        </span>
      </button>

    </div>
  );
};
