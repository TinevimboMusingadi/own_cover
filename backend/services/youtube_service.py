"""YouTube instrumental lookup and audio download via yt-dlp (personal/local use)."""
import re
from pathlib import Path
from typing import Any, Callable

import yt_dlp

from backend.config import BEATS_DIR

VIDEO_ID_RE = re.compile(r"^[\w-]{11}$")
MAX_DURATION_S = 8 * 60

def search_instrumentals(title: str, artist: str = "", limit: int = 6) -> list[dict[str, Any]]:
    """Search YouTube for instrumental / karaoke versions of a song. No API key needed."""
    query = f"{artist} {title} instrumental".strip()
    opts = {"quiet": True, "no_warnings": True, "extract_flat": True, "skip_download": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)

    candidates = []
    for entry in (info or {}).get("entries", []) or []:
        video_id = entry.get("id")
        if not video_id or not VIDEO_ID_RE.match(video_id):
            continue
        thumbs = entry.get("thumbnails") or []
        candidates.append({
            "video_id": video_id,
            "title": entry.get("title", ""),
            "channel": entry.get("channel") or entry.get("uploader") or "",
            "duration": float(entry.get("duration") or 0),
            "thumbnail": thumbs[-1]["url"] if thumbs else f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        })
    return candidates

def download_audio(video_id: str, progress_callback: Callable[[float, str], None] | None = None) -> dict[str, Any]:
    """Download a YouTube video's audio as MP3 into the beats folder."""
    if not VIDEO_ID_RE.match(video_id):
        raise ValueError("Invalid YouTube video id")

    beat_id = f"beat_yt_{video_id}"
    out_file = BEATS_DIR / f"{beat_id}.mp3"
    if out_file.exists():
        return _beat_result(beat_id, out_file)

    def hook(d: dict[str, Any]):
        if not progress_callback:
            return
        if d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            done = d.get("downloaded_bytes") or 0
            pct = (done / total * 80.0) if total else 30.0
            progress_callback(5.0 + pct, "Downloading instrumental audio...")
        elif d.get("status") == "finished":
            progress_callback(88.0, "Converting to MP3...")

    def length_filter(info: dict[str, Any], *, incomplete: bool) -> str | None:
        if (info.get("duration") or 0) > MAX_DURATION_S:
            return f"Video is longer than {MAX_DURATION_S // 60} minutes"
        return None

    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "noprogress": True,
        "format": "bestaudio/best",
        "outtmpl": str(BEATS_DIR / f"{beat_id}.%(ext)s"),
        "match_filter": length_filter,
        "progress_hooks": [hook],
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}],
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([f"https://www.youtube.com/watch?v={video_id}"])

    if not out_file.exists():
        raise RuntimeError("Download finished but no MP3 was produced (video may be too long or unavailable)")
    return _beat_result(beat_id, out_file)

def _beat_result(beat_id: str, out_file: Path) -> dict[str, Any]:
    return {
        "id": beat_id,
        "url": f"/api/audio/beats/{out_file.name}",
        "path": str(out_file),
        "model": "youtube",
    }
