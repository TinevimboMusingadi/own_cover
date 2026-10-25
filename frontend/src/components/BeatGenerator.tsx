import React, { useState, useEffect } from 'react';
import { Sliders, Sparkles, Upload, Play, Pause, Volume2, CheckCircle2, Music2 } from 'lucide-react';
import { SongInfo, BeatTrack } from '../types';

interface BeatGeneratorProps {
  selectedSong: SongInfo | null;
  onBeatReady: (beat: BeatTrack) => void;
  activeBeat: BeatTrack | null;
}

export const BeatGenerator: React.FC<BeatGeneratorProps> = ({
  selectedSong,
  onBeatReady,
  activeBeat
}) => {
  const [bpm, setBpm] = useState(115);
  const [genre, setGenre] = useState('Pop / Modern Rock');
  const [mood, setMood] = useState('energetic, driving groove');
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Sync with selected song
  useEffect(() => {
    if (selectedSong) {
      setBpm(selectedSong.bpm || 110);
      setGenre(selectedSong.genre || 'Pop');
      setMood(selectedSong.mood || 'steady');
      setDescription(selectedSong.instrumental_description || '');
    }
  }, [selectedSong]);

  const handleGenerateLyria = async () => {
    setIsGenerating(true);
    try {
      const resp = await fetch('/api/music/instrumental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genre,
          bpm,
          mood,
          description,
          duration: Math.min(120, selectedSong?.duration ? Math.ceil(selectedSong.duration) : 90)
        })
      });
      const data: BeatTrack = await resp.json();
      if (!resp.ok) {
        throw new Error("Failed to generate instrumental backing track");
      }
      onBeatReady(data);
    } catch (err: any) {
      alert("Lyria beat generator error: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUploadCustomBeat = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append('file', file);

    try {
      const resp = await fetch('/api/music/upload-beat', {
        method: 'POST',
        body: fd
      });
      const data: BeatTrack = await resp.json();
      onBeatReady(data);
    } catch (err: any) {
      alert("Beat upload error: " + err.message);
    }
  };

  const togglePlay = () => {
    if (!activeBeat) return;
    if (!audioElement) {
      const audio = new Audio(activeBeat.url);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setAudioElement(audio);
      setIsPlaying(true);
    } else {
      if (isPlaying) {
        audioElement.pause();
        setIsPlaying(false);
      } else {
        audioElement.play();
        setIsPlaying(true);
      }
    }
  };

  return (
    <div className="rounded-3xl studio-glass border border-studio-border/80 p-6 sm:p-7 relative overflow-hidden">
      
      {/* Step Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-studio-yellow mb-1">
            <span className="w-2 h-2 rounded-full bg-studio-yellow animate-ping" />
            <span>Step 2 · Beat & Instrumental Lab</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white font-['Syne']">
            Instrumental Backing Track
          </h2>
          <p className="text-xs text-studio-muted mt-0.5">
            Generate with Google Lyria 3.5 AI or upload custom stems
          </p>
        </div>

        {activeBeat && (
          <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Instrumental Ready ({activeBeat.model})</span>
          </div>
        )}
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div>
          <label className="block text-xs font-semibold text-studio-beige mb-1.5">
            Tempo (BPM)
          </label>
          <input
            type="number"
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            min={50}
            max={200}
            className="w-full px-4 py-2.5 rounded-xl bg-studio-dark border border-studio-border text-white text-sm focus:outline-none focus:border-studio-yellow font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-studio-beige mb-1.5">
            Genre & Style
          </label>
          <input
            type="text"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-studio-dark border border-studio-border text-white text-sm focus:outline-none focus:border-studio-yellow"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-studio-beige mb-1.5">
            Mood & Energy
          </label>
          <input
            type="text"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-studio-dark border border-studio-border text-white text-sm focus:outline-none focus:border-studio-yellow"
          />
        </div>
      </div>

      <div className="mb-5">
        <label className="block text-xs font-semibold text-studio-beige mb-1.5">
          Instrumentation Prompt Details
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. driving analog bass, tight acoustic drums, warm piano arpeggios, atmospheric synth pads..."
          className="w-full px-4 py-2.5 rounded-xl bg-studio-dark border border-studio-border text-white text-sm focus:outline-none focus:border-studio-yellow"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        
        <button
          onClick={handleGenerateLyria}
          disabled={isGenerating}
          className={`px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition-all ${
            isGenerating
              ? 'bg-studio-border text-studio-muted cursor-not-allowed'
              : 'bg-yellow-gradient text-studio-dark yellow-glow hover:opacity-95 active:scale-95'
          }`}
        >
          {isGenerating ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-studio-dark border-t-transparent rounded-full animate-spin" />
              <span>Generating Beat via Lyria 3.5...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate Lyria 3.5 Backing Track</span>
            </>
          )}
        </button>

        <label className="px-5 py-3 rounded-xl bg-studio-card border border-studio-border hover:border-studio-yellow text-studio-beige font-semibold text-xs uppercase tracking-wider flex items-center space-x-2 cursor-pointer transition-colors active:scale-95">
          <Upload className="w-4 h-4 text-studio-muted" />
          <span>Upload Custom Beat (MP3/WAV)</span>
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleUploadCustomBeat}
          />
        </label>

        {/* Live Audio Preview */}
        {activeBeat && (
          <button
            onClick={togglePlay}
            className="px-4 py-3 rounded-xl bg-studio-vinyl border border-studio-border hover:border-studio-yellow text-studio-yellow text-xs font-semibold flex items-center space-x-2 transition-colors ml-auto"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isPlaying ? 'Pause Beat' : 'Preview Beat'}</span>
          </button>
        )}

      </div>

    </div>
  );
};
