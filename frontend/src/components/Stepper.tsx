import React from 'react';
import { Check } from 'lucide-react';

export const STEPS = ['Find song', 'Configure', 'Confirm', 'Studio'] as const;

interface StepperProps {
  current: number;
  maxReached: number;
  onStep: (index: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({ current, maxReached, onStep }) => (
  <nav className="sticky top-20 z-30 -mx-4 px-4 py-3 bg-studio-dark/85 backdrop-blur-xl border-b border-studio-border/60">
    <ol className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-2 overflow-x-auto">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = i <= maxReached;
        return (
          <li key={label} className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={() => reachable && onStep(i)}
              disabled={!reachable}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                active
                  ? 'bg-yellow-gradient text-studio-dark yellow-glow'
                  : reachable
                  ? 'bg-studio-card border border-studio-border text-studio-beige hover:border-studio-yellow/50'
                  : 'text-studio-muted/60 cursor-not-allowed'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                  active ? 'bg-studio-dark text-studio-yellow' : done ? 'bg-studio-yellow text-studio-dark' : 'bg-studio-border text-studio-muted'
                }`}
              >
                {done ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <span>{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="w-4 sm:w-8 h-px bg-studio-border" />}
          </li>
        );
      })}
    </ol>
  </nav>
);
