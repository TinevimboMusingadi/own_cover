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

MAX_TEMPO = 1.6       # fastest we speed a line up before trimming it
LINE_GAP_S = 0.08     # breath between consecutive lines
SILENCE_THRESHOLD = 400

def trim_silence(pcm: np.ndarray, threshold: int = SILENCE_THRESHOLD) -> np.ndarray:
    """Strip leading/trailing near-silence so a line starts exactly on its timestamp."""
    loud = np.flatnonzero(np.abs(pcm.astype(np.int32)) > threshold)
    if loud.size == 0:
        return pcm[:0]
    pad = int(0.03 * RATE)
    return pcm[max(0, loud[0] - pad): loud[-1] + pad]

def time_stretch(pcm: np.ndarray, tempo: float) -> np.ndarray:
    """Speed up speech without changing pitch (FFmpeg atempo)."""
    proc = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-f", "s16le", "-ar", str(RATE), "-ac", "1", "-i", "pipe:0",
         "-af", f"atempo={tempo:.3f}", "-f", "s16le", "-ar", str(RATE), "-ac", "1", "pipe:1"],
        input=pcm.astype(np.int16).tobytes(), capture_output=True, check=True,
    )
    return np.frombuffer(proc.stdout, dtype=np.int16)

def fit_to_slot(pcm: np.ndarray, slot_s: float) -> np.ndarray:
    """Make a synthesized line fit before the next lyric starts: speed up, then fade-trim."""
    slot = max(int(slot_s * RATE), int(0.3 * RATE))
    if len(pcm) > slot:
        tempo = min(len(pcm) / slot, MAX_TEMPO)
        try:
            pcm = time_stretch(pcm, tempo)
        except Exception as e:
            print(f"Time-stretch failed, trimming instead: {e}")
    if len(pcm) > slot:
        pcm = pcm[:slot].copy()
        fade = min(int(0.08 * RATE), slot)
        pcm[-fade:] = (pcm[-fade:].astype(np.float32) * np.linspace(1, 0, fade)).astype(np.int16)
    return pcm

def build_vocal_track(
    lines: list[dict[str, Any]],
    voice_id: str,
    total_duration_s: float,
    progress_callback: Callable[[float, str], None] | None = None
) -> tuple[np.ndarray, Path]:
    """Synthesize vocal lines and lay them out on the time axis, one line at a time (no overlaps)."""
    total_samples = int((total_duration_s + 5.0) * RATE)
    vocal_timeline = np.zeros(total_samples, dtype=np.int16)

    ordered = sorted((l for l in lines if l.get("text", "").strip()), key=lambda l: float(l.get("start", 0.0)))
    total_lines = len(ordered)
    for idx, item in enumerate(ordered):
        text = item["text"].strip()
        start_s = float(item.get("start", 0.0))
        if idx + 1 < total_lines:
            slot_end = float(ordered[idx + 1]["start"]) - LINE_GAP_S
        else:
            slot_end = max(float(item.get("end", start_s + 4.0)) + 1.5, start_s + 3.0)

        if progress_callback:
            percent = 10.0 + (idx / max(1, total_lines)) * 50.0
            progress_callback(percent, f"Synthesizing vocal line {idx+1}/{total_lines}: '{text[:25]}...'")

        try:
            line_pcm = trim_silence(synthesize_line(text, voice_id))
            line_pcm = fit_to_slot(line_pcm, slot_end - start_s)
            start_sample = int(start_s * RATE)
            end_sample = min(total_samples, start_sample + len(line_pcm))
            if end_sample > start_sample:
                vocal_timeline[start_sample:end_sample] = line_pcm[: end_sample - start_sample]
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

REVERB_FILTERS = {
    "dry": "",
    "room": "aecho=0.8:0.7:20|35:0.2|0.12,",
    "plate": "aecho=0.8:0.88:35|55:0.25|0.18,",
}

def mix_stems_ffmpeg(
    beat_path: Path,
    vocal_path: Path,
    output_mp3_path: Path,
    vocal_gain: float = 1.15,
    beat_gain: float = 0.90,
    reverb: str = "plate",
    beat_offset_s: float = 0.0,
    max_duration_s: float | None = None
) -> Path:
    """Mix vocal and instrumental stems using FFmpeg with EQ, reverb, and loudness normalization.

    beat_offset_s > 0 skips that much of the beat's intro; < 0 delays the beat.
    """
    # FFmpeg complex filter:
    # 1. Vocal: highpass filter 80Hz, optional reverb, volume boost
    # 2. Beat: alignment offset + volume adjustment
    # 3. Mix stems together with amix
    # 4. Final broadcast loudness normalization
    reverb_filter = REVERB_FILTERS.get(reverb, REVERB_FILTERS["plate"])
    if beat_offset_s > 0:
        beat_align = f"atrim=start={beat_offset_s:.2f},asetpts=PTS-STARTPTS,"
    elif beat_offset_s < 0:
        delay_ms = int(-beat_offset_s * 1000)
        beat_align = f"adelay={delay_ms}|{delay_ms},"
    else:
        beat_align = ""
    # Trim + fade so a full-length beat doesn't run past a short preview
    tail = ""
    if max_duration_s:
        tail = f",atrim=end={max_duration_s:.2f},afade=t=out:st={max(0.0, max_duration_s - 2):.2f}:d=2"
    filter_complex = (
        f"[1:a]highpass=f=80,volume={vocal_gain},{reverb_filter}anull[vox];"
        f"[0:a]{beat_align}volume={beat_gain}[beat];"
        f"[beat][vox]amix=inputs=2:duration=longest:dropout_transition=2,"
        f"loudnorm=I=-14:TP=-1.5:LRA=9{tail}[out]"
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
    progress_callback: Callable[[float, str], None] | None = None,
    vocal_gain: float = 1.15,
    beat_gain: float = 0.90,
    reverb: str = "plate",
    beat_offset_s: float = 0.0,
    artwork: str = ""
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
    mix_stems_ffmpeg(
        beat_path, vocal_stem_path, master_mp3,
        vocal_gain=vocal_gain, beat_gain=beat_gain, reverb=reverb,
        beat_offset_s=beat_offset_s, max_duration_s=duration_s
    )

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
        "duration": duration_s,
        "artwork": artwork,
        "created_at": int(time.time())
    }
