import React, { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { Disc, Sparkles, Mic, Music2, SlidersHorizontal, ShieldAlert, Radio, Globe } from 'lucide-react';

import { auth, loginWithGoogle, logoutUser } from './firebase';
import { SongInfo, Voice, BeatTrack, CoverResult } from './types';
import { Navbar } from './components/Navbar';
import { SongSearch } from './components/SongSearch';
import { BeatGenerator } from './components/BeatGenerator';
import { CoverStudio } from './components/CoverStudio';
import { KaraokePlayer } from './components/KaraokePlayer';
import { VoiceStudioModal } from './components/VoiceStudioModal';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [activeVoice, setActiveVoice] = useState<Voice | null>(null);
  const [selectedSong, setSelectedSong] = useState<SongInfo | null>(null);
  const [activeBeat, setActiveBeat] = useState<BeatTrack | null>(null);
  const [coverResult, setCoverResult] = useState<CoverResult | null>(null);
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState(false);

  // Monitor Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Fetch available voices on load
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const resp = await fetch('/api/voices');
        const data = await resp.json();
        if (data.voices && data.voices.length > 0) {
          setVoices(data.voices);
          // Set default voice (Tinevimbo Musingadi) or first replicated
          const defaultV = data.voices.find((v: Voice) => v.is_default) || data.voices[0];
          setActiveVoice(defaultV);
        }
      } catch (err) {
        console.warn("Could not fetch voices list:", err);
      }
    };
    fetchVoices();
  }, []);

  const handleLogin = async () => {
    const u = await loginWithGoogle();
    if (u) setUser(u);
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
  };

  return (
    <div className="relative min-h-screen bg-studio-dark text-studio-beige overflow-hidden">
      
      {/* Groovy Grain Noise Overlay */}
      <div className="grain-overlay" />

      {/* Decorative Gradient Flares */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-studio-yellow/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[30rem] h-[30rem] bg-amber-500/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Navigation Bar */}
      <Navbar
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        activeVoice={activeVoice}
        onOpenVoiceStudio={() => setIsVoiceStudioOpen(true)}
      />

      {/* Hero Studio Banner */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8 text-center sm:text-left">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 pb-8 border-b border-studio-border/60">
          
          <div className="max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-studio-card border border-studio-border text-xs font-mono text-studio-yellow mb-4 shadow-sm">
              <Radio className="w-3.5 h-3.5 text-studio-yellow animate-pulse" />
              <span>LIVE ON GCP · serious-unison-452122-i2</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white font-['Syne'] tracking-tight leading-[1.08]">
              Turn Any Song Into <br />
              <span className="text-transparent bg-clip-text bg-yellow-gradient underline decoration-studio-yellow/30">
                Your Own AI Cover.
              </span>
            </h1>

            <p className="mt-4 text-sm sm:text-base text-studio-muted leading-relaxed">
              Lookup any song by title or year. We pull millisecond-timed lyrics, produce an instrumental backing track with Google Lyria 3.5, and clone your voice using Gemini Replicated Voice for a studio-quality cover.
            </p>
          </div>

          {/* Retro Vinyl Badge Card */}
          <div className="relative group cursor-pointer" onClick={() => setIsVoiceStudioOpen(true)}>
            <div className="p-6 rounded-3xl bg-studio-card border border-studio-border/80 shadow-2xl flex items-center space-x-5 studio-glass-hover">
              <div className="w-20 h-20 rounded-full bg-studio-vinyl border-4 border-studio-yellow/60 flex items-center justify-center yellow-glow shrink-0 animate-spin-slow">
                <div className="w-7 h-7 rounded-full bg-studio-yellow flex items-center justify-center text-studio-dark font-extrabold text-xs">
                  AI
                </div>
              </div>
              <div className="text-left">
                <div className="text-[11px] font-mono text-studio-yellow uppercase tracking-wider">
                  Active Vocalist
                </div>
                <div className="text-base font-bold text-white truncate max-w-[180px]">
                  {activeVoice ? activeVoice.name : "Tinevimbo Musingadi"}
                </div>
                <div className="text-xs text-studio-muted mt-0.5">
                  Gemini Replicated Voice (24kHz)
                </div>
                <div className="mt-2 text-[11px] text-studio-yellow flex items-center space-x-1 font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Configure Voice Studio</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Main Studio Pipeline */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Step 1: Song Search & Lyrics */}
        <SongSearch
          onSongSelected={(song) => setSelectedSong(song)}
          selectedSong={selectedSong}
        />

        {/* Step 2: Beat & Instrumental Lab */}
        <BeatGenerator
          selectedSong={selectedSong}
          onBeatReady={(beat) => setActiveBeat(beat)}
          activeBeat={activeBeat}
        />

        {/* Step 3: Cover Production Deck */}
        <CoverStudio
          selectedSong={selectedSong}
          activeVoice={activeVoice}
          activeBeat={activeBeat}
          onCoverComplete={(cover) => setCoverResult(cover)}
          onOpenVoiceStudio={() => setIsVoiceStudioOpen(true)}
        />

        {/* Playback & Karaoke Deck (when cover is ready) */}
        {coverResult && (
          <div id="karaoke-section" className="pt-4">
            <KaraokePlayer
              cover={coverResult}
              song={selectedSong}
            />
          </div>
        )}

      </main>

      {/* 2-Step Voice Studio Modal */}
      <VoiceStudioModal
        isOpen={isVoiceStudioOpen}
        onClose={() => setIsVoiceStudioOpen(false)}
        voices={voices}
        activeVoice={activeVoice}
        onSelectVoice={(v) => setActiveVoice(v)}
        onVoiceCreated={(v) => {
          setVoices((prev) => [v, ...prev]);
          setActiveVoice(v);
        }}
      />

      {/* Studio Footer */}
      <footer className="border-t border-studio-border/60 bg-studio-vinyl/60 mt-16 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-studio-muted">
          <div className="flex items-center space-x-3">
            <span className="font-extrabold text-white font-['Syne']">OWN COVER</span>
            <span>·</span>
            <span>Google Gemini 3.8 Flash TTS & Lyria 3.5 AI Studio</span>
          </div>

          <div className="flex items-center space-x-6">
            <a
              href="https://github.com/TinevimboMusingadi/own_cover.git"
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 hover:text-studio-yellow transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span>GitHub Repository</span>
            </a>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-studio-card border border-studio-border text-studio-yellow">
              v1.0.0-prod
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
};
