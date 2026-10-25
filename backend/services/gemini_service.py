"""Gemini client service handling LLM, TTS, Voice Management, and synthesis."""
import base64
import io
import re
import wave
import numpy as np
from google import genai
from google.genai import types

from backend.config import GEMINI_API_KEY, TEXT_MODEL, TTS_MODEL, DEFAULT_VOICE_ID, DEFAULT_VOICE_NAME

RATE = 24000

def get_client(api_version: str | None = None, timeout_s: int = 120) -> genai.Client:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY could not be resolved. Please verify your keys configuration.")
    opts = {"timeout": timeout_s * 1000}
    if api_version:
        opts["api_version"] = api_version
    return genai.Client(api_key=GEMINI_API_KEY, http_options=opts)

def list_available_voices():
    """Retrieve all prebuilt and replicated voices accessible via Gemini API."""
    client = get_client()
    voices = []
    
    # Add pre-configured default voice
    voices.append({
        "id": DEFAULT_VOICE_ID,
        "name": DEFAULT_VOICE_NAME,
        "type": "replicated",
        "description": "User Cloned Voice (Tinevimbo Musingadi)",
        "is_default": True
    })

    try:
        raw_list = client.voices.list()
        # raw_list yields tuples like ('voices', [VoiceOutput, ...]) or list of VoiceOutput
        voice_objects = []
        if isinstance(raw_list, list):
            voice_objects = raw_list
        else:
            for item in raw_list:
                if isinstance(item, tuple) and item[0] == "voices" and isinstance(item[1], list):
                    voice_objects.extend(item[1])
                elif hasattr(item, "id"):
                    voice_objects.append(item)

        for v in voice_objects:
            v_id = getattr(v, "id", None) or getattr(v, "name", None)
            if not v_id or v_id == DEFAULT_VOICE_ID:
                continue
            v_type = getattr(v, "type", "prebuilt")
            display_name = getattr(v, "display_name", None) or v_id
            description = getattr(v, "description", None) or f"{v_type.title()} voice"
            
            # Put replicated voices first
            voices.append({
                "id": v_id,
                "name": display_name,
                "type": v_type,
                "description": description,
                "is_default": False
            })
    except Exception as e:
        print(f"Warning fetching voices list from API: {e}")
        # Add basic prebuilt fallbacks
        for name in ["Kore", "Aoede", "Puck", "Charon"]:
            if not any(x["id"] == name.lower() for x in voices):
                voices.append({
                    "id": name.lower(),
                    "name": name,
                    "type": "prebuilt",
                    "description": f"Prebuilt Gemini vocal ({name})",
                    "is_default": False
                })

    return voices

def pcm_to_wav_bytes(pcm_data: np.ndarray, sample_rate: int = RATE) -> bytes:
    """Convert int16 mono numpy PCM to WAV bytes."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm_data.astype(np.int16).tobytes())
    return buf.getvalue()

def wav_bytes_to_pcm(wav_bytes: bytes) -> tuple[np.ndarray, int]:
    """Convert WAV bytes to mono int16 numpy array."""
    with wave.open(io.BytesIO(wav_bytes), "rb") as w:
        rate = w.getframerate()
        channels = w.getnchannels()
        frames = w.readframes(w.getnframes())
        audio = np.frombuffer(frames, dtype=np.int16)
        if channels > 1:
            audio = audio.reshape(-1, channels).mean(axis=1).astype(np.int16)
        return audio, rate

def resample_pcm(audio: np.ndarray, orig_rate: int, target_rate: int = RATE) -> np.ndarray:
    if orig_rate == target_rate:
        return audio
    target_len = int(len(audio) * target_rate / orig_rate)
    indices = np.linspace(0, len(audio) - 1, target_len)
    return np.interp(indices, np.arange(len(audio)), audio).astype(np.int16)

def synthesize_line(text: str, voice_id: str = DEFAULT_VOICE_ID) -> np.ndarray:
    """Synthesize a single vocal line using the selected voice."""
    client = get_client()
    clean_text = text.strip()
    if not clean_text:
        return np.zeros(int(RATE * 0.2), dtype=np.int16)

    # Check if voice is replicated
    if voice_id.startswith("voice_") or voice_id.startswith("voicekey_"):
        # Replicated voice uses interactions API
        response = client.interactions.create(
            model=TTS_MODEL,
            input=clean_text,
            response_format={"type": "audio"},
            generation_config={"speech_config": [{"voice": voice_id}]}
        )
        data_dump = response.model_dump(mode="json", exclude_none=True)
        out_audio = data_dump.get("output_audio", {})
        raw_b64 = out_audio.get("data", "")
        if not raw_b64:
            raise RuntimeError("No audio data returned from replicated voice synthesis")
        raw_bytes = base64.b64decode(raw_b64)
        
        # Check if WAV or raw PCM
        if raw_bytes[:4] == b"RIFF":
            pcm, rate = wav_bytes_to_pcm(raw_bytes)
            return resample_pcm(pcm, rate, RATE)
        else:
            return np.frombuffer(raw_bytes, dtype=np.int16)
    else:
        # Prebuilt voice
        response = client.models.generate_content(
            model=TTS_MODEL,
            contents=clean_text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_id)
                    )
                )
            )
        )
        part = response.candidates[0].content.parts[0]
        raw_bytes = part.inline_data.data
        if raw_bytes[:4] == b"RIFF":
            pcm, rate = wav_bytes_to_pcm(raw_bytes)
            return resample_pcm(pcm, rate, RATE)
        else:
            mime = part.inline_data.mime_type or ""
            m = re.search(r"rate=(\d+)", mime)
            rate = int(m.group(1)) if m else RATE
            pcm = np.frombuffer(raw_bytes, dtype=np.int16)
            return resample_pcm(pcm, rate, RATE)
