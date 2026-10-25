import React from 'react';
import { Disc3, Mic, LogIn, LogOut, CheckCircle2, Wand2, Library } from 'lucide-react';
import { User } from 'firebase/auth';
import { Voice } from '../types';

export type AppView = 'studio' | 'library';

interface NavbarProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  activeVoice: Voice | null;
  onOpenVoiceStudio: () => void;
  view: AppView;
  onViewChange: (view: AppView) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogin,
  onLogout,
  activeVoice,
  onOpenVoiceStudio,
  view,
  onViewChange
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-studio-border/60 bg-studio-dark/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand Logo & Tag */}
        <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0">
          <div className="relative group cursor-pointer">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-yellow-gradient flex items-center justify-center yellow-glow transition-transform group-hover:scale-105">
              <Disc3 className="w-6 h-6 text-studio-dark animate-spin-slow" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-studio-dark" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-extrabold text-base sm:text-2xl tracking-tight text-white font-['Syne']">
                OWN<span className="text-studio-yellow">COVER</span>
              </h1>
              <span className="hidden md:inline text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-studio-yellow/15 text-studio-yellow border border-studio-yellow/30">
                Studio AI
              </span>
            </div>
            <p className="text-xs text-studio-muted hidden sm:block">
              AI Cover Studio & Gemini Voice Replication
            </p>
          </div>
        </div>

        {/* Center / Right Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">

          {/* View switch: Studio wizard / My Covers library */}
          <div className="flex p-1 rounded-xl bg-studio-card border border-studio-border text-xs font-semibold">
            {([['studio', 'Studio', Wand2], ['library', 'My Covers', Library]] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => onViewChange(id)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  view === id ? 'bg-studio-yellow text-studio-dark' : 'text-studio-muted hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden lg:inline whitespace-nowrap">{label}</span>
              </button>
            ))}
          </div>
          
          {/* Active Voice Pill / Trigger */}
          <button
            onClick={onOpenVoiceStudio}
            className="hidden sm:flex items-center space-x-2.5 px-3.5 py-2 rounded-xl bg-studio-card border border-studio-border hover:border-studio-yellow/50 transition-all text-xs text-studio-beige group"
            title="Click to configure or clone a voice"
          >
            <div className="w-7 h-7 rounded-lg bg-studio-yellow/15 text-studio-yellow flex items-center justify-center group-hover:scale-110 transition-transform">
              <Mic className="w-4 h-4" />
            </div>
            <div className="text-left hidden md:block">
              <div className="text-[10px] text-studio-muted flex items-center space-x-1">
                <span>Active Voice</span>
                <CheckCircle2 className="w-2.5 h-2.5 text-studio-yellow inline" />
              </div>
              <div className="font-semibold text-white truncate max-w-[150px]">
                {activeVoice ? activeVoice.name : "Tinevimbo (DiffEdit)"}
              </div>
            </div>
          </button>

          {/* User Auth: Continue with Google */}
          {user ? (
            <div className="flex items-center space-x-3 pl-2 border-l border-studio-border">
              <img
                src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.displayName || 'user'}`}
                alt={user.displayName || "User"}
                className="w-9 h-9 rounded-xl border border-studio-yellow/40 p-0.5 object-cover"
              />
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-white leading-tight">
                  {user.displayName || "Producer"}
                </div>
                <div className="text-[10px] text-studio-muted leading-tight truncate max-w-[120px]">
                  {user.email || "Google Account"}
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-2 rounded-xl hover:bg-studio-border text-studio-muted hover:text-white transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center space-x-2 px-3 sm:px-4 py-2.5 rounded-xl bg-studio-beige text-studio-dark font-semibold text-xs hover:bg-white hover:shadow-lg hover:shadow-studio-beige/10 transition-all active:scale-95"
            >
              <LogIn className="w-4 h-4 text-studio-dark" />
              <span className="hidden sm:inline">Continue with Google</span>
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
