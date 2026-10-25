"""Configuration module for Own Cover backend.

Resolves GEMINI_API_KEY from environment, local .env, or fallback key files.
Never prints or logs the key.
"""
import os
import re
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent

# Load local .env if present
load_dotenv(BASE_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env")

def _resolve_gemini_key() -> str:
    # 1. Direct environment variable
    key = os.getenv("GEMINI_API_KEY")
    if key and len(key.strip()) > 10:
        return key.strip()

    # 2. Check D:\my-custom_skills\.keys_env
    custom_skills_env = Path(r"D:\my-custom_skills\.keys_env")
    if custom_skills_env.exists():
        try:
            for line in custom_skills_env.read_text(encoding="utf-8", errors="ignore").splitlines():
                m = re.match(r"^\s*(?:gemine_key|GEMINI_API_KEY)\s*=\s*['\"]?([^'\"\r\n]+)", line)
                if m:
                    return m.group(1).strip()
        except Exception:
            pass

    # 3. Check D:\INdaba_video\.env
    indaba_env = Path(r"D:\INdaba_video\.env")
    if indaba_env.exists():
        try:
            for line in indaba_env.read_text(encoding="utf-8", errors="ignore").splitlines():
                m = re.match(r"^\s*GEMINI_API_KEY\s*=\s*['\"]?([^'\"\r\n]+)", line)
                if m:
                    return m.group(1).strip()
        except Exception:
            pass

    return ""

GEMINI_API_KEY = _resolve_gemini_key()

# Model Definitions
TEXT_MODEL = os.getenv("OWNCOVER_TEXT_MODEL", "gemini-3.8-flash")
TTS_MODEL = os.getenv("OWNCOVER_TTS_MODEL", "gemini-3.8-flash-tts")
MUSIC_MODEL = os.getenv("OWNCOVER_MUSIC_MODEL", "lyria-3.5")
LYRIA_REALTIME_MODEL = os.getenv("OWNCOVER_LYRIA_RT_MODEL", "models/lyria-realtime-exp")

# User voice defaults
DEFAULT_VOICE_ID = os.getenv("OWNCOVER_DEFAULT_VOICE", "voice_cerks20cbtia")
DEFAULT_VOICE_NAME = "Tinevimbo Musingadi (DiffEdit)"

# Storage paths
STORAGE_DIR = BACKEND_DIR / "storage"
COVERS_DIR = STORAGE_DIR / "covers"
BEATS_DIR = STORAGE_DIR / "beats"
VOCALS_DIR = STORAGE_DIR / "vocals"
VOICES_DIR = STORAGE_DIR / "voices"

for d in [STORAGE_DIR, COVERS_DIR, BEATS_DIR, VOCALS_DIR, VOICES_DIR]:
    d.mkdir(parents=True, exist_ok=True)
