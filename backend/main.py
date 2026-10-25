"""Main FastAPI application for Own Cover AI Song Studio."""
import os
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict, Literal

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.config import BEATS_DIR, COVERS_DIR, GEMINI_API_KEY, STORAGE_DIR, VOCALS_DIR, VOICES_DIR
from backend.services.catalog_service import find_deezer_bpm, get_track_details, search_catalog, spotify_enabled
from backend.services.gemini_service import list_available_voices
from backend.services.lyrics_service import prepare_song, search_song_and_lyrics
from backend.services.mixer_service import create_cover_song
from backend.services.music_service import generate_instrumental_track
from backend.services.voice_service import clone_user_voice
from backend.services.youtube_service import download_audio, search_instrumentals

app = FastAPI(title="Own Cover API", version="2.0.0")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static audio directories
app.mount("/api/audio/covers", StaticFiles(directory=str(COVERS_DIR)), name="covers")
app.mount("/api/audio/vocals", StaticFiles(directory=str(VOCALS_DIR)), name="vocals")
app.mount("/api/audio/beats", StaticFiles(directory=str(BEATS_DIR)), name="beats")

# In-memory task tracker
tasks: Dict[str, Dict[str, Any]] = {}

class CoverCreateRequest(BaseModel):
    title: str
    artist: str = ""
    voice_id: str
    beat_path: str
    lines: list[dict[str, Any]]
    duration: float = 60.0
    artwork: str = ""
    vocal_gain: float = 1.15
    beat_gain: float = 0.90
    reverb: Literal["dry", "room", "plate"] = "plate"
    beat_offset_s: float = 0.0

class SongPrepareRequest(BaseModel):
    title: str
    artist: str = ""
    album: str = ""
    duration: float | None = None
    artwork: str = ""
    year: int | None = None
    preview_url: str | None = None
    source: str = ""
    source_id: str = ""

class YouTubeDownloadRequest(BaseModel):
    video_id: str

class InstrumentalRequest(BaseModel):
    genre: str = "Pop / Rock"
    bpm: int = 110
    mood: str = "energetic"
    description: str = ""
    duration: int = 90

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "has_gemini_key": bool(GEMINI_API_KEY and len(GEMINI_API_KEY) > 10),
        "catalog_sources": ["itunes", "deezer"] + (["spotify"] if spotify_enabled() else []),
        "service": "Own Cover AI Audio Engine"
    }

@app.get("/api/voices")
def get_voices():
    """List all available prebuilt and replicated voices."""
    try:
        voices = list_available_voices()
        return {"voices": voices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/voices/clone")
async def clone_voice_endpoint(
    speaker_name: str = Form(...),
    consent_file: UploadFile = File(...),
    sample_file: UploadFile = File(...)
):
    """Google 2-step Voice Cloning endpoint (Consent statement + Vocal sample)."""
    temp_dir = STORAGE_DIR / "temp"
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    consent_tmp = temp_dir / f"consent_{uuid.uuid4().hex}_{consent_file.filename}"
    sample_tmp = temp_dir / f"sample_{uuid.uuid4().hex}_{sample_file.filename}"

    try:
        with open(consent_tmp, "wb") as f:
            shutil.copyfileobj(consent_file.file, f)
        with open(sample_tmp, "wb") as f:
            shutil.copyfileobj(sample_file.file, f)

        voice_info = clone_user_voice(consent_tmp, sample_tmp, speaker_name)
        return {"status": "success", "voice": voice_info}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice replication failed: {e}")
    finally:
        for p in [consent_tmp, sample_tmp]:
            if p.exists():
                try:
                    p.unlink()
                except Exception:
                    pass

@app.get("/api/songs/search")
def search_song(query: str):
    """Search for song lyrics, timing, BPM, and musical key."""
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query parameter cannot be empty")
    try:
        result = search_song_and_lyrics(query)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/catalog/search")
async def catalog_search(q: str, year: int | None = None, limit: int = 20):
    """Search iTunes, Deezer (and Spotify if configured) for songs with artwork and previews."""
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query parameter cannot be empty")
    tracks = await search_catalog(q.strip(), year=year, limit=max(1, min(limit, 50)))
    return {"tracks": tracks}

@app.get("/api/catalog/track/{source}/{track_id}")
async def catalog_track(source: str, track_id: str):
    """Extra details for a selected track (BPM, release year)."""
    try:
        return await get_track_details(source, track_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@app.post("/api/songs/prepare")
async def prepare_song_endpoint(req: SongPrepareRequest):
    """Pull synced lyrics + musical analysis for the catalog track the user picked."""
    known_bpm = None
    if req.source == "deezer" and req.source_id:
        try:
            known_bpm = (await get_track_details("deezer", req.source_id)).get("bpm")
        except Exception:
            pass
    if not known_bpm and req.artist:
        known_bpm = await find_deezer_bpm(req.title, req.artist)
    try:
        song = await run_in_threadpool(
            prepare_song, req.title, req.artist, req.duration, req.album, known_bpm
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    song.update({"artwork": req.artwork, "year": req.year, "preview_url": req.preview_url})
    return song

@app.get("/api/youtube/instrumentals")
def youtube_instrumentals(title: str, artist: str = ""):
    """Find instrumental versions of a song on YouTube."""
    try:
        return {"candidates": search_instrumentals(title, artist)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"YouTube search failed: {e}")

def run_youtube_task(task_id: str, video_id: str):
    def update_progress(percent: float, message: str):
        tasks[task_id]["progress"] = percent
        tasks[task_id]["message"] = message

    try:
        result = download_audio(video_id, update_progress)
        tasks[task_id].update(status="completed", result=result, progress=100.0, message="Instrumental ready!")
    except Exception as e:
        tasks[task_id].update(status="failed", error=str(e), message=f"Download failed: {e}")

@app.post("/api/youtube/download")
def youtube_download(req: YouTubeDownloadRequest, bg: BackgroundTasks):
    """Download a YouTube instrumental as the cover's beat (poll /api/cover/status/{task_id})."""
    task_id = f"task_yt_{uuid.uuid4().hex[:8]}"
    tasks[task_id] = {
        "id": task_id,
        "status": "processing",
        "progress": 0.0,
        "message": "Starting download...",
        "result": None,
        "error": None
    }
    bg.add_task(run_youtube_task, task_id, req.video_id)
    return {"task_id": task_id, "status": "processing"}

@app.post("/api/music/instrumental")
def generate_instrumental(req: InstrumentalRequest):
    """Generate instrumental backing track via Lyria 3.5."""
    try:
        result = generate_instrumental_track(
            genre=req.genre,
            bpm=req.bpm,
            mood=req.mood,
            description=req.description,
            duration_s=req.duration
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/music/upload-beat")
async def upload_beat(file: UploadFile = File(...)):
    """Upload custom user beat or backing track."""
    beat_id = f"beat_custom_{uuid.uuid4().hex[:8]}"
    ext = Path(file.filename or "beat.mp3").suffix or ".mp3"
    out_file = BEATS_DIR / f"{beat_id}{ext}"
    
    with open(out_file, "wb") as f:
        shutil.copyfileobj(file.file, f)

    return {
        "id": beat_id,
        "url": f"/api/audio/beats/{out_file.name}",
        "path": str(out_file),
        "model": "user-uploaded"
    }

def run_cover_task(task_id: str, req: CoverCreateRequest):
    def update_progress(percent: float, message: str):
        tasks[task_id]["progress"] = percent
        tasks[task_id]["message"] = message

    try:
        beat_file = Path(req.beat_path)
        if not beat_file.exists():
            # Check relative to BEATS_DIR
            candidate = BEATS_DIR / Path(req.beat_path).name
            if candidate.exists():
                beat_file = candidate
            else:
                raise FileNotFoundError(f"Beat audio file not found: {req.beat_path}")

        result = create_cover_song(
            title=req.title,
            artist=req.artist,
            beat_path=beat_file,
            lines=req.lines,
            voice_id=req.voice_id,
            duration_s=req.duration,
            progress_callback=update_progress,
            vocal_gain=req.vocal_gain,
            beat_gain=req.beat_gain,
            reverb=req.reverb,
            beat_offset_s=req.beat_offset_s,
            artwork=req.artwork
        )
        tasks[task_id]["status"] = "completed"
        tasks[task_id]["result"] = result
        tasks[task_id]["progress"] = 100.0
        tasks[task_id]["message"] = "Cover ready for playback!"
    except Exception as e:
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error"] = str(e)
        tasks[task_id]["message"] = f"Error during production: {e}"

@app.post("/api/cover/create")
def start_cover_generation(req: CoverCreateRequest, bg: BackgroundTasks):
    """Start asynchronous cover generation pipeline."""
    task_id = f"task_{uuid.uuid4().hex[:8]}"
    tasks[task_id] = {
        "id": task_id,
        "status": "processing",
        "progress": 0.0,
        "message": "Initializing cover generator...",
        "result": None,
        "error": None
    }
    bg.add_task(run_cover_task, task_id, req)
    return {"task_id": task_id, "status": "processing"}

@app.get("/api/cover/status/{task_id}")
def get_cover_status(task_id: str):
    """Check progress of cover generation task."""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return tasks[task_id]

# Mount frontend production build if available
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")

