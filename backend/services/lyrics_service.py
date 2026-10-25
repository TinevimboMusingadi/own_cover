"""Lyrics service for fetching synced/plain lyrics and song musical metadata."""
import json
import re
import urllib.parse
import urllib.request
from typing import Any

from google.genai import types
from backend.config import TEXT_MODEL
from backend.services.gemini_service import get_client

def parse_lrc_timestamp(tag: str) -> float:
    """Convert [mm:ss.xx] or [mm:ss] to float seconds."""
    m = re.match(r"\[(\d+):(\d+(?:\.\d+)?)\]", tag)
    if not m:
        return 0.0
    minutes = int(m.group(1))
    seconds = float(m.group(2))
    return minutes * 60.0 + seconds

def parse_synced_lyrics(synced_text: str, default_duration: float = 180.0) -> list[dict[str, Any]]:
    """Parse LRC format string into structured lines with start and end times."""
    raw_lines = synced_text.splitlines()
    parsed = []
    
    for line in raw_lines:
        line = line.strip()
        if not line:
            continue
        # match tag and text
        m = re.match(r"^(\[\d+:\d+(?:\.\d+)?\])+(.*)$", line)
        if m:
            tag = m.group(1)
            text = m.group(2).strip()
            # clean bracketed notes
            clean_text = re.sub(r"\[.*?\]", "", text).strip()
            if clean_text:
                start_time = parse_lrc_timestamp(tag)
                parsed.append({"start": round(start_time, 2), "text": clean_text})

    # Sort by start time
    parsed.sort(key=lambda x: x["start"])

    # Calculate end times
    for i in range(len(parsed)):
        if i + 1 < len(parsed):
            # end time is next line's start minus 0.3s breath gap, capped to 6s
            gap = parsed[i + 1]["start"] - parsed[i]["start"]
            parsed[i]["end"] = round(parsed[i]["start"] + min(gap - 0.2, 6.0), 2)
            if parsed[i]["end"] <= parsed[i]["start"]:
                parsed[i]["end"] = round(parsed[i]["start"] + 2.5, 2)
        else:
            parsed[i]["end"] = round(parsed[i]["start"] + 4.0, 2)

    return parsed

def synthesize_plain_lyrics_timing(plain_text: str, bpm: int = 100) -> list[dict[str, Any]]:
    """Synthesize line start times from plain lyrics based on BPM."""
    lines = [re.sub(r"\[.*?\]", "", l).strip() for l in plain_text.splitlines()]
    clean_lines = [l for l in lines if l and not l.startswith("#")]
    
    seconds_per_bar = (60.0 / bpm) * 4 # 4/4 time
    current_time = 4.0 # 1 bar intro
    parsed = []

    for line in clean_lines:
        # line length dictates bars (approx 1 bar per 4-6 words)
        words = len(line.split())
        bars = max(1, round(words / 4.5))
        duration = bars * seconds_per_bar
        parsed.append({
            "start": round(current_time, 2),
            "end": round(current_time + duration - 0.4, 2),
            "text": line
        })
        current_time += duration

    return parsed

def enrich_song_metadata_with_gemini(title: str, artist: str = "") -> dict[str, Any]:
    """Use Gemini Flash to infer musical properties: BPM, musical key, genre, mood, prompt."""
    client = get_client()
    prompt = f"""You are an expert music producer and DJ.
Provide musical metadata for the song:
Title: {title}
Artist: {artist}

Respond ONLY with a JSON object matching this schema:
{{
  "bpm": 115,
  "key": "A Minor",
  "genre": "Synthpop / Indie Rock",
  "mood": "energetic, driving, warm nostalgia",
  "instrumental_description": "driving analog synth bass, 80s drum machine, shimmering guitar arpeggios, atmospheric pads"
}}
"""
    try:
        response = client.models.generate_content(
            model=TEXT_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        data = json.loads(response.text)
        return data
    except Exception as e:
        print(f"Error enriching metadata with Gemini: {e}")
        return {
            "bpm": 110,
            "key": "C Major",
            "genre": "Pop / Modern Rock",
            "mood": "uplifting, steady groove",
            "instrumental_description": "warm rhythm acoustic guitar, tight drums, melodic bassline, subtle keyboard pads"
        }

LRCLIB_HEADERS = {"User-Agent": "OwnCover/2.0 (https://github.com/TinevimboMusingadi/own_cover)"}

def _lrclib_get(path: str, params: dict[str, Any]) -> Any:
    url = f"https://lrclib.net/api/{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers=LRCLIB_HEADERS)
    with urllib.request.urlopen(req, timeout=8) as resp:
        return json.loads(resp.read().decode("utf-8"))

def _lines_from_record(record: dict[str, Any], bpm: int = 100) -> tuple[list[dict[str, Any]], bool]:
    duration = float(record.get("duration") or 180.0)
    if record.get("syncedLyrics"):
        return parse_synced_lyrics(record["syncedLyrics"], duration), True
    if record.get("plainLyrics"):
        return synthesize_plain_lyrics_timing(record["plainLyrics"], bpm), False
    return [], False

def fetch_lyrics_record(title: str, artist: str = "", duration: float | None = None) -> dict[str, Any] | None:
    """Find the best LRCLIB record: exact signature match first, then closest-duration search hit."""
    if artist and duration:
        try:
            record = _lrclib_get("get", {
                "track_name": title, "artist_name": artist, "duration": round(duration),
            })
            if isinstance(record, dict) and (record.get("syncedLyrics") or record.get("plainLyrics")):
                return record
        except Exception as e:
            print(f"LRCLIB exact lookup missed: {e}")

    params = {"track_name": title, "artist_name": artist} if artist else {"q": title}
    try:
        results = _lrclib_get("search", params)
    except Exception as e:
        print(f"LRCLIB lookup failed: {e}")
        return None
    if not isinstance(results, list) or not results:
        return None

    def score(item: dict[str, Any]) -> tuple[int, float]:
        # Prefer synced lyrics, then the closest duration to the catalog track
        dur_gap = abs(float(item.get("duration") or 0) - duration) if duration else 0.0
        return (0 if item.get("syncedLyrics") else 1, dur_gap)

    return min(results, key=score)

def prepare_song(
    title: str,
    artist: str = "",
    duration: float | None = None,
    album: str = "",
    known_bpm: int | None = None,
) -> dict[str, Any]:
    """Build a SongInfo for a catalog track the user picked: lyrics + musical metadata."""
    meta = enrich_song_metadata_with_gemini(title, artist)
    bpm = int(known_bpm or meta.get("bpm") or 110)

    record = fetch_lyrics_record(title, artist, duration)
    if record:
        lines, has_synced = _lines_from_record(record, bpm)
        if lines:
            return {
                "title": title,
                "artist": artist,
                "album": album or record.get("albumName", ""),
                "duration": float(duration or record.get("duration") or 180.0),
                "has_synced": has_synced,
                "bpm": bpm,
                "key": meta.get("key", "C Major"),
                "genre": meta.get("genre", "Pop"),
                "mood": meta.get("mood", "steady"),
                "instrumental_description": meta.get("instrumental_description", ""),
                "lines": lines,
            }

    song = generate_lyrics_with_gemini(f"{title} {artist}".strip())
    song.update({"title": title, "artist": artist or song.get("artist", ""), "bpm": bpm, "has_synced": False})
    if album:
        song["album"] = album
    if duration:
        song["duration"] = float(duration)
    return song

def search_song_and_lyrics(query: str) -> dict[str, Any]:
    """Legacy free-text lookup: auto-picks the best LRCLIB match for a query."""
    record = fetch_lyrics_record(query)
    if record:
        return prepare_song(
            title=record.get("trackName") or record.get("name") or query,
            artist=record.get("artistName") or "",
            duration=float(record.get("duration") or 180.0),
            album=record.get("albumName", ""),
        )
    return generate_lyrics_with_gemini(query)

def generate_lyrics_with_gemini(query: str) -> dict[str, Any]:
    """Fallback when LRCLIB has no lyrics: ask Gemini for lyrics with estimated timing."""
    client = get_client()
    prompt = f"""Search your musical knowledge for song: "{query}".
Return JSON with the complete lyrics with estimated start and end timestamps (in seconds), musical key, BPM, and genre:
{{
  "title": "{query}",
  "artist": "Original Artist",
  "album": "Album",
  "duration": 180,
  "bpm": 112,
  "key": "G Major",
  "genre": "Pop / Rock",
  "mood": "emotional and driving",
  "instrumental_description": "clear piano chords, acoustic bass, drums",
  "lines": [
    {{"start": 8.0, "end": 12.0, "text": "First line of the song"}},
    {{"start": 12.5, "end": 16.5, "text": "Second line of the song"}}
  ]
}}
"""
    try:
        resp = client.models.generate_content(
            model=TEXT_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        return json.loads(resp.text)
    except Exception as e:
        print(f"Fallback Gemini lyrics generation failed: {e}")
        return {
            "title": query,
            "artist": "Unknown",
            "album": "",
            "duration": 120,
            "bpm": 100,
            "key": "C Major",
            "genre": "Pop",
            "mood": "mellow",
            "instrumental_description": "guitar and drums",
            "lines": [
                {"start": 4.0, "end": 8.0, "text": f"Singing a cover of {query}"},
                {"start": 9.0, "end": 13.0, "text": "Own Cover with Gemini voice studio"}
            ]
        }
