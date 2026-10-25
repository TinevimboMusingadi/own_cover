import React, { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { Globe, RotateCcw, Library } from 'lucide-react';

import { auth, loginWithGoogle, logoutUser, saveCover } from './firebase';
import { SongInfo, Voice, BeatTrack, CoverResult, CoverConfig, SavedCover } from './types';
import { linesToSing } from './api';
import { Navbar, AppView } from './components/Navbar';
import { Stepper } from './components/Stepper';
import { CatalogSearch } from './components/CatalogSearch';
import { CoverConfigurator } from './components/CoverConfigurator';
import { ConfirmCover } from './components/ConfirmCover';
import { KaraokePlayer } from './components/KaraokePlayer';
import { MyCovers } from './components/MyCovers';
import { VoiceStudioModal } from './components/VoiceStudioModal';

const defaultConfig = (song: SongInfo): CoverConfig => ({
  lineSelection: song.lines.map(() => true),
  lineEdits: song.lines.map((l) => l.text),
  length: 'preview',
  vocalGain: 1.15,
  beatGain: 0.9,
  reverb: 'plate',
  beatOffset: 0,
});

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>('studio');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [activeVoice, setActiveVoice] = useState<Voice | null>(null);
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState(false);

  // Wizard state
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [song, setSong] = useState<SongInfo | null>(null);
  const [config, setConfig] = useState<CoverConfig | null>(null);
  const [beat, setBeat] = useState<BeatTrack | null>(null);
  const [cover, setCover] = useState<CoverResult | null>(null);
  const [coverSong, setCoverSong] = useState<SongInfo | null>(null);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  useEffect(() => {
    fetch('/api/voices')
      .then((r) => r.json())
      .then((data) => {
        if (data.voices?.length) {
          setVoices(data.voices);
          setActiveVoice(data.voices.find((v: Voice) => v.is_default) || data.voices[0]);
        }
      })
      .catch((err) => console.warn('Could not fetch voices list:', err));
  }, []);

  const goTo = (i: number) => {
    setStep(i);
    setMaxStep((m) => Math.max(m, i));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSongPrepared = (s: SongInfo) => {
    setSong(s);
    setConfig(defaultConfig(s));
    setBeat(null);
    setCover(null);
    setMaxStep(1);
    goTo(1);
  };

  const handleCoverComplete = (result: CoverResult) => {
    if (!song || !config) return;
    const sung = linesToSing(song, config);
    // Karaoke shows exactly what was sung, including lyric edits
    setCoverSong({ ...song, lines: sung });
    setCover(result);
    goTo(3);
    saveCover({ ...result, voice_name: activeVoice?.name || result.voice_id, lines: sung }).catch((e) =>
      console.warn('Could not save cover:', e)
    );
  };

  const playSaved = (saved: SavedCover) => {
    setCover(saved);
    setCoverSong({
      title: saved.title, artist: saved.artist, duration: saved.duration, bpm: 0, key: '', genre: '', mood: '',
      has_synced: true, lines: saved.lines || [], artwork: saved.artwork,
    });
    setView('studio');
    setMaxStep((m) => Math.max(m, 3));
    goTo(3);
  };

  const startOver = () => {
    setSong(null);
    setConfig(null);
    setBeat(null);
    setCover(null);
    setMaxStep(0);
    setView('studio');
    goTo(0);
  };

  return (
    <div className="relative min-h-screen bg-studio-dark text-studio-beige overflow-x-hidden">
      <div className="grain-overlay" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-studio-yellow/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[30rem] h-[30rem] bg-amber-500/10 rounded-full blur-[160px] pointer-events-none" />

      <Navbar
        user={user}
        onLogin={async () => {
          const u = await loginWithGoogle();
          if (u) setUser(u);
        }}
        onLogout={async () => {
          await logoutUser();
          setUser(null);
        }}
        activeVoice={activeVoice}
        onOpenVoiceStudio={() => setIsVoiceStudioOpen(true)}
        view={view}
        onViewChange={setView}
      />

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {view === 'library' ? (
          <div className="pt-8">
            <MyCovers userKey={user?.uid || 'local'} onPlay={playSaved} onNewCover={startOver} />
          </div>
        ) : (
          <>
            <Stepper current={step} maxReached={maxStep} onStep={goTo} />
            <div className="pt-8">
              {step === 0 && (
                <>
                  {!song && (
                    <div className="mb-8 max-w-3xl">
                      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white font-['Syne'] tracking-tight leading-[1.05]">
                        Any song.{' '}
                        <span className="text-transparent bg-clip-text bg-yellow-gradient">Your voice.</span>
                      </h1>
                      <p className="mt-3 text-sm sm:text-base text-studio-muted">
                        Find a track, grab the instrumental, and let your Gemini-cloned voice sing the cover.
                      </p>
                    </div>
                  )}
                  <CatalogSearch onSongPrepared={handleSongPrepared} />
                </>
              )}

              {step === 1 && song && config && (
                <CoverConfigurator
                  song={song}
                  voices={voices}
                  activeVoice={activeVoice}
                  onSelectVoice={setActiveVoice}
                  onOpenVoiceStudio={() => setIsVoiceStudioOpen(true)}
                  beat={beat}
                  onBeatReady={setBeat}
                  config={config}
                  onConfigChange={setConfig}
                  onBack={() => goTo(0)}
                  onNext={() => goTo(2)}
                />
              )}

              {step === 2 && song && config && beat && activeVoice && (
                <ConfirmCover song={song} voice={activeVoice} beat={beat} config={config} onEdit={() => goTo(1)} onComplete={handleCoverComplete} />
              )}

              {step === 3 && cover && (
                <div className="space-y-6">
                  <KaraokePlayer cover={cover} song={coverSong} voiceName={'voice_name' in cover ? (cover as SavedCover).voice_name : activeVoice?.name} />
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button onClick={() => goTo(1)} disabled={!song} className="px-5 py-3 rounded-xl border border-studio-border text-studio-beige text-xs font-semibold flex items-center justify-center gap-2 hover:border-studio-yellow/50 disabled:opacity-40">
                      <RotateCcw className="w-4 h-4" /> Tweak & re-record
                    </button>
                    <button onClick={() => setView('library')} className="px-5 py-3 rounded-xl border border-studio-border text-studio-beige text-xs font-semibold flex items-center justify-center gap-2 hover:border-studio-yellow/50">
                      <Library className="w-4 h-4" /> My Covers
                    </button>
                    <button onClick={startOver} className="px-5 py-3 rounded-xl bg-yellow-gradient text-studio-dark text-xs font-bold uppercase tracking-wider yellow-glow">
                      Cover another song
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <VoiceStudioModal
        isOpen={isVoiceStudioOpen}
        onClose={() => setIsVoiceStudioOpen(false)}
        voices={voices}
        activeVoice={activeVoice}
        onSelectVoice={setActiveVoice}
        onVoiceCreated={(v) => {
          setVoices((prev) => [v, ...prev]);
          setActiveVoice(v);
        }}
      />

      <footer className="border-t border-studio-border/60 bg-studio-vinyl/60 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-studio-muted">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-white font-['Syne']">OWN COVER</span>
            <span>Gemini voice · Lyria · LRCLIB · iTunes · Deezer</span>
          </div>
          <a href="https://github.com/TinevimboMusingadi/own_cover" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-studio-yellow">
            <Globe className="w-4 h-4" /> GitHub
          </a>
        </div>
      </footer>
    </div>
  );
};
