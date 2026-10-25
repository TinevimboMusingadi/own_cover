"""Music service for generating instrumental backing tracks via Google Lyria."""
import os
import time
import uuid
from pathlib import Path
import numpy as np
import scipy.io.wavfile as wavfile

from backend.config import BEATS_DIR, MUSIC_MODEL
from backend.services.gemini_service import get_client

NO_VOX = "Instrumental only, no vocals, clear rhythmic foundation, steady dynamics for a vocal cover to sit on top."

def build_lyria_prompt(genre: str, bpm: int, mood: str, description: str = "") -> str:
    parts = []
    if description:
        parts.append(description)
    else:
        parts.append(f"{genre} backing track with drums, bass, rhythm chords and melody")
    parts.append(f"steady {bpm} BPM")
    if mood:
        parts.append(f"mood: {mood}")
    parts.append(NO_VOX)
    return ", ".join(parts)

def generate_synthetic_backing_track(filepath: Path, bpm: int = 110, duration_s: int = 60, sample_rate: int = 44100):
    """Generate a high-quality groovy acoustic/synth backing track fallback if Lyria is unavailable."""
    total_samples = int(duration_s * sample_rate)
    t = np.linspace(0, duration_s, total_samples, endpoint=False)
    
    # Chord progression: vi - IV - I - V (Am, F, C, G) or I - V - vi - IV
    beat_duration = 60.0 / bpm
    bar_duration = beat_duration * 4
    
    # Bass frequencies (C, G, Am, F)
    bass_freqs = [65.41, 49.00, 55.00, 43.65] # C2, G1, A1, F1
    pad_freqs = [
        [261.63, 329.63, 392.00], # C major
        [196.00, 246.94, 293.66], # G major
        [220.00, 261.63, 329.63], # A minor
        [174.61, 220.00, 261.63]  # F major
    ]

    left = np.zeros(total_samples, dtype=np.float32)
    right = np.zeros(total_samples, dtype=np.float32)

    # Generate chord pads
    for i in range(int(duration_s / bar_duration) + 1):
        bar_start = int(i * bar_duration * sample_rate)
        bar_end = min(total_samples, int((i + 1) * bar_duration * sample_rate))
        if bar_start >= total_samples:
            break
        chord_idx = i % 4
        bar_t = t[bar_start:bar_end] - (i * bar_duration)
        
        # Envelope with soft attack and decay
        env = np.sin(np.pi * (bar_t / bar_duration)) ** 0.5

        # Bass
        bf = bass_freqs[chord_idx]
        bass_wave = 0.35 * np.sin(2 * np.pi * bf * bar_t) + 0.15 * np.sin(2 * np.pi * bf * 2 * bar_t)
        
        # Chord voices
        chord_wave = np.zeros_like(bar_t)
        for cf in pad_freqs[chord_idx]:
            chord_wave += 0.12 * np.sin(2 * np.pi * cf * bar_t)
            chord_wave += 0.05 * np.sin(2 * np.pi * cf * 1.002 * bar_t) # stereo chorus

        left[bar_start:bar_end] += (bass_wave + chord_wave) * env
        right[bar_start:bar_end] += (bass_wave + chord_wave * 0.95) * env

    # Add acoustic rhythm beat (kick on 1 and 3, snare/clap on 2 and 4, hi-hat on eighths)
    beat_samples = int(beat_duration * sample_rate)
    half_beat = int(beat_samples / 2)
    
    for b in range(int(duration_s / beat_duration)):
        pos = int(b * beat_duration * sample_rate)
        beat_in_bar = b % 4
        
        # Kick (beats 0 and 2)
        if beat_in_bar in [0, 2]:
            k_len = min(int(0.2 * sample_rate), total_samples - pos)
            if k_len > 0:
                kt = np.linspace(0, 0.2, k_len)
                k_env = np.exp(-18 * kt)
                k_freq = 140 * np.exp(-35 * kt) + 45
                kick = 0.5 * np.sin(2 * np.pi * k_freq * kt) * k_env
                left[pos:pos+k_len] += kick
                right[pos:pos+k_len] += kick

        # Snare (beats 1 and 3)
        if beat_in_bar in [1, 3]:
            s_len = min(int(0.18 * sample_rate), total_samples - pos)
            if s_len > 0:
                st = np.linspace(0, 0.18, s_len)
                s_env = np.exp(-15 * st)
                snare = 0.35 * (np.random.uniform(-1, 1, s_len) * s_env)
                left[pos:pos+s_len] += snare
                right[pos:pos+s_len] += snare

        # Hi-hat (every eighth note)
        h_len = min(int(0.06 * sample_rate), total_samples - pos)
        if h_len > 0:
            ht = np.linspace(0, 0.06, h_len)
            h_env = np.exp(-50 * ht)
            hh = 0.12 * (np.random.uniform(-1, 1, h_len) * h_env)
            left[pos:pos+h_len] += hh * 0.7
            right[pos:pos+h_len] += hh * 1.1

    # Normalize audio
    peak = max(np.max(np.abs(left)), np.max(np.abs(right)), 0.001)
    stereo = np.column_stack([left / peak * 0.85, right / peak * 0.85])
    int16_stereo = (stereo * 32767).astype(np.int16)
    
    wavfile.write(str(filepath), sample_rate, int16_stereo)
    return str(filepath)

def generate_instrumental_track(genre: str, bpm: int, mood: str, description: str = "", duration_s: int = 90) -> dict[str, str]:
    """Generate instrumental audio using Lyria 3.5, with synthetic fallback."""
    beat_id = f"beat_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    out_path = BEATS_DIR / f"{beat_id}.mp3"
    prompt = build_lyria_prompt(genre, bpm, mood, description)

    try:
        client = get_client()
        response = client.models.generate_content(
            model=MUSIC_MODEL,
            contents=prompt
        )
        audio_data = None
        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.data:
                audio_data = part.inline_data.data
                break

        if audio_data:
            out_path.write_bytes(audio_data)
            return {
                "id": beat_id,
                "url": f"/api/audio/beats/{out_path.name}",
                "path": str(out_path),
                "model": MUSIC_MODEL,
                "prompt": prompt
            }
        else:
            raise RuntimeError("Lyria response contained no inline audio data.")
    except Exception as e:
        print(f"Lyria generation note: {e}. Generating fallback instrumental bed.")
        wav_path = BEATS_DIR / f"{beat_id}.wav"
        generate_synthetic_backing_track(wav_path, bpm=bpm, duration_s=duration_s)
        return {
            "id": beat_id,
            "url": f"/api/audio/beats/{wav_path.name}",
            "path": str(wav_path),
            "model": "synthetic-studio-groove",
            "prompt": prompt
        }
