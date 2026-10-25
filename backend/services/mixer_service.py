"""Mixer service for vocal synthesis alignment, stem mixing, and FFmpeg mastering."""
import os
import subprocess
import time
import uuid
import wave
from pathlib import Path
from typing import Any, Callable

import numpy as np

from backend.config import COVERS_DIR, VOCALS_DIR
from backend.services.gemini_service import RATE, pcm_to_wav_bytes, synthesize_line

def build_vocal_track(
    lines: list[dict[str, Any]],
    voice_id: str,
    total_duration_s: float,
    progress_callback: Callable[[float, str], None] | None = None
) -> tuple[np.ndarray, Path]:
    """Synthesize vocal lines and lay them out accurately on a time axis."""
    total_samples = int((total_duration_s + 5.0) * RATE)
    vocal_timeline = np.zeros(total_samples, dtype=np.int16)
    
    total_lines = len(lines)
    for idx, item in enumerate(lines):
        text = item.get("text", "").strip()
        start_s = float(item.get("start", 0.0))
        if not text:
            continue

        if progress_callback:
            percent = 10.0 + (idx / max(1, total_lines)) * 50.0
            progress_callback(percent, f"Synthesizing vocal line {idx+1}/{total_lines}: '{text[:25]}...'")

        try:
            line_pcm = synthesize_line(text, voice_id)
            start_sample = int(start_s * RATE)
            end_sample = min(total_samples, start_sample + len(line_pcm))
            actual_len = end_sample - start_sample
            if actual_len > 0:
                # Additive or crossfade placement
                vocal_timeline[start_sample:end_sample] = np.clip(
                    vocal_timeline[start_sample:end_sample].astype(np.int32) + line_pcm[:actual_len].astype(np.int32),
                    -32768, 32767
                ).astype(np.int16)
        except Exception as e:
            print(f"Error synthesizing vocal line {idx} ('{text}'): {e}")

    # Save isolated vocal stem
    vocal_stem_id = f"vocals_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    vocal_stem_path = VOCALS_DIR / f"{vocal_stem_id}.wav"
    with wave.open(str(vocal_stem_path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(vocal_timeline.tobytes())

    return vocal_timeline, vocal_stem_path

def mix_stems_ffmpeg(
    beat_path: Path,
    vocal_path: Path,
    output_mp3_path: Path,
    vocal_gain: float = 1.15,
    beat_gain: float = 0.90
) -> Path:
    """Mix vocal and instrumental stems using FFmpeg with EQ, reverb, and loudness normalization."""
    # FFmpeg complex filter:
    # 1. Vocal: highpass filter 80Hz, light stereo plate reverb, volume boost
    # 2. Beat: volume adjustment
    # 3. Mix stems together with amix
    # 4. Final broadcast loudness normalization
    filter_complex = (
        f"[1:a]highpass=f=80,volume={vocal_gain},"
        f"aecho=0.8:0.88:35|55:0.25|0.18[vox];"
        f"[0:a]volume={beat_gain}[beat];"
        f"[beat][vox]amix=inputs=2:duration=longest:dropout_transition=2,"
        f"loudnorm=I=-14:TP=-1.5:LRA=9[out]"
    )

    cmd = [
        "ffmpeg", "-loglevel", "error", "-y",
        "-i", str(beat_path),
        "-i", str(vocal_path),
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-c:a", "libmp3lame",
        "-b:a", "256k",
        str(output_mp3_path)
    ]

    subprocess.run(cmd, check=True)
    return output_mp3_path

def create_cover_song(
    title: str,
    artist: str,
    beat_path: Path,
    lines: list[dict[str, Any]],
    voice_id: str,
    duration_s: float,
    progress_callback: Callable[[float, str], None] | None = None
) -> dict[str, Any]:
    """Orchestrates end-to-end vocal generation, stem building, and master mixing."""
    cover_id = f"cover_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    
    if progress_callback:
        progress_callback(5.0, "Preparing vocal arrangement and timing...")

    # Step 1: Synthesize vocals on timeline
    _, vocal_stem_path = build_vocal_track(lines, voice_id, duration_s, progress_callback)

    if progress_callback:
        progress_callback(70.0, "Mastering audio stems and applying acoustic space...")

    # Step 2: Mix down via FFmpeg
    master_mp3 = COVERS_DIR / f"{cover_id}.mp3"
    mix_stems_ffmpeg(beat_path, vocal_stem_path, master_mp3)

    if progress_callback:
        progress_callback(100.0, "Cover production complete!")

    return {
        "id": cover_id,
        "title": title,
        "artist": artist,
        "voice_id": voice_id,
        "master_url": f"/api/audio/covers/{master_mp3.name}",
        "vocal_url": f"/api/audio/vocals/{vocal_stem_path.name}",
        "beat_url": f"/api/audio/beats/{beat_path.name}",
        "duration": duration_s
    }
