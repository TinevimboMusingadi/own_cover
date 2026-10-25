import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Download, Volume2, Sliders, Mic, Disc3, Sparkles, RotateCcw } from 'lucide-react';
import { CoverResult, SongInfo } from '../types';

interface KaraokePlayerProps {
  cover: CoverResult;
  song: SongInfo | null;
  voiceName?: string;
}

export const KaraokePlayer: React.FC<KaraokePlayerProps> = ({
  cover,
  song,
  voiceName
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(cover.duration || 60);
  
  // Stem gain states
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [vocalVolume, setVocalVolume] = useState(1.0);
  const [beatVolume, setBeatVolume] = useState(1.0);

  // Audio references
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize Audio
  useEffect(() => {
    const audio = new Audio(cover.master_url);
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onloadedmetadata = () => {
      setDuration(audio.duration || cover.duration);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [cover]);

  // Handle master volume change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = masterVolume;
    }
  }, [masterVolume]);

  // Toggle playback
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      startVisualizer();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = Number(e.target.value);
    setCurrentTime(target);
    if (audioRef.current) {
      audioRef.current.currentTime = target;
    }
  };

  // Simple animated waveform on canvas
  const startVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const bars = 48;
      const barWidth = canvas.width / bars - 2;

      for (let i = 0; i < bars; i++) {
        // Pseudo dynamic height based on playback state and sine oscillation
        const wave = isPlaying
          ? Math.abs(Math.sin((currentTime * 3) + (i * 0.25))) * 0.7 + 0.3
          : 0.15;
        const barHeight = wave * (canvas.height * 0.85);
        const x = i * (barWidth + 2);
        const y = (canvas.height - barHeight) / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, '#FDE047');
        grad.addColorStop(1, '#EAB308');

        ctx.fillStyle = isPlaying ? grad : '#2A2D3C';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
  };

  // Highlight active lyric line based on currentTime
  const activeLineIndex = song?.lines.findIndex((l, i) => {
    const nextLine = song.lines[i + 1];
    if (nextLine) {
      return currentTime >= l.start && currentTime < nextLine.start;
    }
    return currentTime >= l.start;
  }) ?? -1;

  // Auto-scroll lyrics
  useEffect(() => {
    if (activeLineIndex !== -1 && lyricsContainerRef.current) {
      const activeEl = lyricsContainerRef.current.children[activeLineIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="rounded-3xl studio-glass border-2 border-studio-yellow/40 yellow-glow p-6 sm:p-8 relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      
      {/* Badge Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-studio-yellow mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-studio-yellow animate-ping" />
            <span>Master Cover Ready · Playback & Karaoke</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-['Syne']">
            {cover.title} <span className="text-studio-yellow">(AI Cover)</span>
          </h2>
          <p className="text-xs text-studio-muted mt-0.5">
            Original: {cover.artist || song?.artist} · Vocalist: {voiceName || "Gemini Voice"}
          </p>
        </div>

        {/* Action Downloads */}
        <div className="flex items-center space-x-2">
          <a
            href={cover.master_url}
            download={`${cover.title}_Cover_Master.mp3`}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-yellow-gradient text-studio-dark font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-all shadow-md active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download Master MP3</span>
          </a>
        </div>
      </div>

      {/* Main Deck Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Player & Waveform & Console (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Waveform Canvas */}
          <div className="p-4 rounded-2xl bg-studio-dark/90 border border-studio-border relative overflow-hidden">
            <canvas
              ref={canvasRef}
              width={560}
              height={90}
              className="w-full h-24 object-contain"
            />
          </div>

          {/* Time Scrubber */}
          <div className="space-y-1.5">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 rounded-full bg-studio-border appearance-none cursor-pointer accent-studio-yellow"
            />
            <div className="flex items-center justify-between text-xs font-mono text-studio-muted">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Player Transport Controls */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-studio-vinyl/70 border border-studio-border">
            
            <div className="flex items-center space-x-3">
              <button
                onClick={togglePlay}
                className="w-14 h-14 rounded-2xl bg-yellow-gradient text-studio-dark flex items-center justify-center yellow-glow hover:scale-105 active:scale-95 transition-transform"
              >
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
              </button>
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  {isPlaying ? 'Playing Master Track' : 'Paused'}
                </div>
                <div className="text-[11px] text-studio-muted">
                  EBU R128 Normalized · Stereo Master
                </div>
              </div>
            </div>

            {/* Master Volume */}
            <div className="flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-studio-yellow" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={masterVolume}
                onChange={(e) => setMasterVolume(Number(e.target.value))}
                className="w-24 h-1.5 rounded-full bg-studio-border appearance-none cursor-pointer accent-studio-yellow"
                title="Master Volume"
              />
            </div>

          </div>

          {/* Multi-Stem Mixdown Console */}
          <div className="p-4 rounded-2xl bg-studio-dark/70 border border-studio-border space-y-3">
            <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-studio-yellow">
              <Sliders className="w-3.5 h-3.5" />
              <span>Stem Audio Balancer & Isolator</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              
              {/* Vocal Stem Slider */}
              <div className="p-3 rounded-xl bg-studio-card border border-studio-border">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-white flex items-center space-x-1">
                    <Mic className="w-3.5 h-3.5 text-studio-yellow" />
                    <span>Vocals Stem</span>
                  </span>
                  <a
                    href={cover.vocal_url}
                    download="Vocals_Stem.wav"
                    className="text-[10px] text-studio-yellow hover:underline"
                  >
                    Stem WAV
                  </a>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={vocalVolume}
                  onChange={(e) => setVocalVolume(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full bg-studio-border appearance-none cursor-pointer accent-studio-yellow"
                />
              </div>

              {/* Beat Stem Slider */}
              <div className="p-3 rounded-xl bg-studio-card border border-studio-border">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-white flex items-center space-x-1">
                    <Disc3 className="w-3.5 h-3.5 text-studio-yellow" />
                    <span>Instrumental</span>
                  </span>
                  <a
                    href={cover.beat_url}
                    download="Instrumental_Stem.mp3"
                    className="text-[10px] text-studio-yellow hover:underline"
                  >
                    Beat MP3
                  </a>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={beatVolume}
                  onChange={(e) => setBeatVolume(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full bg-studio-border appearance-none cursor-pointer accent-studio-yellow"
                />
              </div>

            </div>
          </div>

        </div>

        {/* Right Column: Live Karaoke Teleprompter (5 cols) */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-studio-yellow flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Live Synced Teleprompter</span>
            </span>
            <span className="text-[11px] font-mono text-studio-muted">
              {song?.lines.length || 0} Lines
            </span>
          </div>

          <div
            ref={lyricsContainerRef}
            className="flex-1 p-5 rounded-2xl bg-studio-dark/95 border border-studio-border max-h-[380px] overflow-y-auto space-y-3 relative shadow-inner"
          >
            {song?.lines && song.lines.length > 0 ? (
              song.lines.map((l, idx) => {
                const isActive = idx === activeLineIndex;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = l.start;
                        setCurrentTime(l.start);
                      }
                    }}
                    className={`p-3 rounded-xl transition-all cursor-pointer ${
                      isActive
                        ? 'bg-studio-yellow/20 border border-studio-yellow yellow-glow text-white font-bold scale-[1.02]'
                        : 'text-studio-muted/70 hover:text-studio-beige hover:bg-studio-card/40'
                    }`}
                  >
                    <div className="flex items-center space-x-2 text-[10px] font-mono mb-0.5">
                      <span className={isActive ? 'text-studio-yellow' : 'text-studio-muted'}>
                        {formatTime(l.start)}
                      </span>
                      {isActive && (
                        <span className="px-1.5 py-0.2 rounded-full bg-studio-yellow text-studio-dark text-[9px] uppercase font-bold">
                          Singing Now
                        </span>
                      )}
                    </div>
                    <div className="text-sm leading-snug">
                      {l.text}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-xs text-studio-muted">
                No timed lyrics lines found for teleprompter
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
