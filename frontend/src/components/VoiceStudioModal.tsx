import React, { useState, useRef } from 'react';
import { X, Mic, Upload, Check, AlertCircle, Sparkles, Volume2, ShieldCheck, Play, Square } from 'lucide-react';
import { Voice } from '../types';

interface VoiceStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  voices: Voice[];
  activeVoice: Voice | null;
  onSelectVoice: (voice: Voice) => void;
  onVoiceCreated: (newVoice: Voice) => void;
}

export const VoiceStudioModal: React.FC<VoiceStudioModalProps> = ({
  isOpen,
  onClose,
  voices,
  activeVoice,
  onSelectVoice,
  onVoiceCreated
}) => {
  const [tab, setTab] = useState<'select' | 'clone'>('select');
  const [speakerName, setSpeakerName] = useState('');
  const [consentFile, setConsentFile] = useState<File | null>(null);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [cloneSuccess, setCloneSuccess] = useState<string | null>(null);

  // Audio Recording States
  const [recordingTarget, setRecordingTarget] = useState<'consent' | 'sample' | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  if (!isOpen) return null;

  const startRecording = async (target: 'consent' | 'sample') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const file = new File([audioBlob], `${target}_recording.wav`, { type: 'audio/wav' });
        if (target === 'consent') setConsentFile(file);
        else setSampleFile(file);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setRecordingTarget(target);
    } catch (err: any) {
      alert("Microphone access error: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecordingTarget(null);
  };

  const handleCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!speakerName.trim() || !consentFile || !sampleFile) {
      setCloneError("Please provide your name, spoken consent audio, and 15-30s vocal sample.");
      return;
    }

    setIsCloning(true);
    setCloneError(null);
    setCloneSuccess(null);

    const formData = new FormData();
    formData.append("speaker_name", speakerName.trim());
    formData.append("consent_file", consentFile);
    formData.append("sample_file", sampleFile);

    try {
      const resp = await fetch("/api/voices/clone", {
        method: "POST",
        body: formData
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.detail || "Voice cloning request failed");
      }

      setCloneSuccess(`Successfully created voice: ${data.voice.name}`);
      onVoiceCreated(data.voice);
      onSelectVoice(data.voice);
      setTimeout(() => {
        setTab('select');
        setCloneSuccess(null);
      }, 1500);
    } catch (err: any) {
      setCloneError(err.message);
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl rounded-3xl bg-studio-card border border-studio-border/80 shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-studio-border/60 bg-studio-vinyl/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-gradient flex items-center justify-center text-studio-dark font-bold shadow-md">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-['Syne']">Gemini Voice Studio</h2>
              <p className="text-xs text-studio-muted">Manage replicated cloned voices and prebuilt singer profiles</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-studio-muted hover:text-white hover:bg-studio-border/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-studio-border/60 px-7 bg-studio-vinyl/30">
          <button
            onClick={() => setTab('select')}
            className={`py-3 px-4 font-semibold text-xs border-b-2 transition-all ${
              tab === 'select'
                ? 'border-studio-yellow text-studio-yellow'
                : 'border-transparent text-studio-muted hover:text-studio-beige'
            }`}
          >
            Available Voices ({voices.length})
          </button>
          <button
            onClick={() => setTab('clone')}
            className={`py-3 px-4 font-semibold text-xs border-b-2 transition-all flex items-center space-x-1.5 ${
              tab === 'clone'
                ? 'border-studio-yellow text-studio-yellow'
                : 'border-transparent text-studio-muted hover:text-studio-beige'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Clone New Voice (2-Step Google Replicate)</span>
          </button>
        </div>

        {/* Tab 1: Voice Selector */}
        {tab === 'select' && (
          <div className="p-7 max-h-[460px] overflow-y-auto space-y-3">
            <div className="text-xs text-studio-muted mb-2">
              Select which voice should sing the cover song:
            </div>
            {voices.map((v) => {
              const isSelected = activeVoice?.id === v.id;
              const isCloned = v.type === 'replicated' || v.id.startsWith('voice_');

              return (
                <div
                  key={v.id}
                  onClick={() => onSelectVoice(v)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-studio-yellow bg-studio-yellow/10 yellow-glow'
                      : 'border-studio-border/80 bg-studio-dark/50 hover:border-studio-yellow/40 hover:bg-studio-dark/80'
                  }`}
                >
                  <div className="flex items-center space-x-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      isCloned ? 'bg-yellow-gradient text-studio-dark' : 'bg-studio-border text-studio-beige'
                    }`}>
                      {isCloned ? <Sparkles className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-sm text-white">{v.name}</span>
                        {isCloned && (
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-studio-yellow/20 text-studio-yellow border border-studio-yellow/40">
                            Replicated Clone
                          </span>
                        )}
                        {v.is_default && (
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-studio-muted mt-0.5">{v.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isSelected ? (
                      <span className="w-7 h-7 rounded-full bg-studio-yellow text-studio-dark flex items-center justify-center">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="text-xs text-studio-muted hover:text-white px-3 py-1.5 rounded-lg border border-studio-border">
                        Select
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: 2-Step Voice Cloning */}
        {tab === 'clone' && (
          <form onSubmit={handleCloneSubmit} className="p-7 max-h-[460px] overflow-y-auto space-y-5">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-3">
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-studio-yellow" />
              <div>
                <span className="font-bold">Google Voice Replication Requirements:</span>
                <p className="mt-0.5 text-studio-beige/80">
                  Google Gemini requires 2 verified audio clips from the same speaker: (1) A spoken consent statement and (2) A 15-30 second vocal sample.
                </p>
              </div>
            </div>

            {/* Speaker Name */}
            <div>
              <label className="block text-xs font-semibold text-studio-beige mb-1.5">
                Speaker Name / Voice Label
              </label>
              <input
                type="text"
                value={speakerName}
                onChange={(e) => setSpeakerName(e.target.value)}
                placeholder="e.g. Tinevimbo Musingadi (Singing Tone)"
                className="w-full px-4 py-2.5 rounded-xl bg-studio-dark border border-studio-border text-white text-sm focus:outline-none focus:border-studio-yellow transition-colors"
                required
              />
            </div>

            {/* Audio 1: Spoken Consent Statement */}
            <div className="p-4 rounded-2xl bg-studio-dark/70 border border-studio-border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Audio 1 · Spoken Consent Statement
                  </span>
                  <p className="text-[11px] text-studio-muted">
                    Read the exact statement below aloud:
                  </p>
                </div>
                {consentFile && (
                  <span className="text-[11px] text-emerald-400 flex items-center space-x-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Captured</span>
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-studio-vinyl border border-studio-border text-xs text-studio-yellow font-mono italic">
                "I [Your Name] give Google permission to create a synthetic version of my voice for use with Gemini API."
              </div>

              <div className="flex items-center space-x-3 pt-1">
                {recordingTarget === 'consent' ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold animate-pulse"
                  >
                    <Square className="w-4 h-4" />
                    <span>Stop Recording</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startRecording('consent')}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-studio-card border border-studio-border hover:border-studio-yellow text-studio-beige text-xs font-semibold transition-colors"
                  >
                    <Mic className="w-4 h-4 text-studio-yellow" />
                    <span>Record Consent</span>
                  </button>
                )}

                <label className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-studio-card border border-studio-border hover:border-studio-yellow text-studio-beige text-xs font-semibold cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-studio-muted" />
                  <span>Upload Audio File</span>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && setConsentFile(e.target.files[0])}
                  />
                </label>
              </div>
              {consentFile && (
                <div className="text-[11px] text-studio-muted">
                  Attached: {consentFile.name} ({(consentFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            {/* Audio 2: 15-30s Vocal Sample */}
            <div className="p-4 rounded-2xl bg-studio-dark/70 border border-studio-border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Audio 2 · Vocal Sample (15 - 30 seconds)
                  </span>
                  <p className="text-[11px] text-studio-muted">
                    Speak or sing naturally in a quiet room:
                  </p>
                </div>
                {sampleFile && (
                  <span className="text-[11px] text-emerald-400 flex items-center space-x-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Captured</span>
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-3 pt-1">
                {recordingTarget === 'sample' ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold animate-pulse"
                  >
                    <Square className="w-4 h-4" />
                    <span>Stop Recording</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startRecording('sample')}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-studio-card border border-studio-border hover:border-studio-yellow text-studio-beige text-xs font-semibold transition-colors"
                  >
                    <Mic className="w-4 h-4 text-studio-yellow" />
                    <span>Record Vocal Sample</span>
                  </button>
                )}

                <label className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-studio-card border border-studio-border hover:border-studio-yellow text-studio-beige text-xs font-semibold cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-studio-muted" />
                  <span>Upload Audio File</span>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && setSampleFile(e.target.files[0])}
                  />
                </label>
              </div>
              {sampleFile && (
                <div className="text-[11px] text-studio-muted">
                  Attached: {sampleFile.name} ({(sampleFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            {/* Messages */}
            {cloneError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cloneError}</span>
              </div>
            )}
            {cloneSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{cloneSuccess}</span>
              </div>
            )}

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isCloning || !consentFile || !sampleFile || !speakerName}
              className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all ${
                isCloning || !consentFile || !sampleFile || !speakerName
                  ? 'bg-studio-border text-studio-muted cursor-not-allowed'
                  : 'bg-yellow-gradient text-studio-dark yellow-glow hover:opacity-95 active:scale-[0.98]'
              }`}
            >
              {isCloning ? (
                <>
                  <div className="w-4 h-4 border-2 border-studio-dark border-t-transparent rounded-full animate-spin" />
                  <span>Replicating Voice on Google Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Clone My Voice Now</span>
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
