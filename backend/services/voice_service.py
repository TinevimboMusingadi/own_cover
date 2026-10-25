"""Voice service for Google Gemini Voice Replication (2-step consent + sample)."""
import base64
import json
import subprocess
import time
import wave
from pathlib import Path
import numpy as np

from backend.config import TTS_MODEL, VOICES_DIR
from backend.services.gemini_service import get_client

RATE = 24000
SILENCE_FILTER = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"

def to_wav(src_path: Path, dst_path: Path, extra_filter: str | None = None) -> np.ndarray:
    """Standardize audio to 24kHz mono int16 with EBU loudness normalization."""
    af = (f"{extra_filter}," if extra_filter else "") + SILENCE_FILTER + ",loudnorm=I=-20:TP=-2:LRA=11"
    cmd = [
        "ffmpeg", "-loglevel", "error", "-y",
        "-i", str(src_path),
        "-map", "0:a:0",
        "-af", af,
        "-ac", "1",
        "-ar", str(RATE),
        "-sample_fmt", "s16",
        str(dst_path)
    ]
    subprocess.run(cmd, check=True)
    with wave.open(str(dst_path), "rb") as w:
        frames = w.readframes(w.getnframes())
        return np.frombuffer(frames, dtype=np.int16)

def cut_at_pause(audio: np.ndarray, max_s: float = 29.5, min_s: float = 12.0) -> np.ndarray:
    """Trim sample cleanly at the quietest 0.25s window between min_s and max_s."""
    if len(audio) <= max_s * RATE:
        return audio
    win = int(0.25 * RATE)
    env = np.sqrt(np.convolve(audio.astype(np.float32) ** 2, np.ones(win) / win, mode="same"))
    lo = int(min_s * RATE)
    hi = min(len(audio), int(max_s * RATE))
    if hi <= lo:
        return audio[:hi]
    score = env[lo:hi] - np.linspace(0, env[lo:hi].mean() * 0.15, hi - lo)
    cut_idx = lo + int(np.argmin(score))
    return audio[:cut_idx]

def save_wav(path: Path, audio: np.ndarray):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(audio.astype(np.int16).tobytes())

def clone_user_voice(consent_audio_path: Path, sample_audio_path: Path, speaker_name: str) -> dict:
    """Create a replicated voice via Google Gemini API from consent and sample audios."""
    timestamp = int(time.time())
    consent_wav = VOICES_DIR / f"consent_{timestamp}.wav"
    sample_wav = VOICES_DIR / f"sample_{timestamp}.wav"

    # Preprocess both audios
    to_wav(consent_audio_path, consent_wav)
    sample_raw = to_wav(sample_audio_path, sample_wav)
    sample_trimmed = cut_at_pause(sample_raw)
    save_wav(sample_wav, sample_trimmed)

    # Encode to Base64
    consent_b64 = base64.b64encode(consent_wav.read_bytes()).decode("utf-8")
    sample_b64 = base64.b64encode(sample_wav.read_bytes()).decode("utf-8")

    client = get_client()
    created_voice = client.voices.create(
        store=True,
        voice={
            "type": "replicated",
            "model": TTS_MODEL,
            "display_name": speaker_name or f"OwnCover Voice {timestamp}",
            "replicated": {
                "source_audio": {"mime_type": "audio/wav", "data": sample_b64},
                "consent_audio": {"mime_type": "audio/wav", "data": consent_b64},
            },
        }
    )

    info = created_voice.model_dump(mode="json", exclude_none=True)
    voice_id = info.get("id") or info.get("key")
    
    # Save metadata locally
    meta_path = VOICES_DIR / f"{voice_id}.json"
    meta_path.write_text(json.dumps(info, indent=2), encoding="utf-8")

    return {
        "id": voice_id,
        "name": info.get("display_name", speaker_name),
        "type": "replicated",
        "description": "Custom Replicated Voice (Google Gemini)",
        "expire_time": info.get("expire_time")
    }
