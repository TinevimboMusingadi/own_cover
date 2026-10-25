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

def search_song_and_lyrics(query: str) -> dict[str, Any]:
    """Search LRCLIB for lyrics and metadata, with Gemini musical intelligence."""
    encoded = urllib.parse.quote_plus(query.strip())
    url = f"https://lrclib.net/api/search?q={encoded}"
    
    results = []
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "OwnCover/1.0 (contact@owncover.ai)"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, list):
                results = data
    except Exception as e:
        print(f"LRCLIB lookup failed: {e}")

    if results:
        # Choose the best match (prefer synced lyrics)
        best = None
        for item in results:
            if item.get("syncedLyrics"):
                best = item
                break
        if not best:
            best = results[0]

        title = best.get("trackName") or best.get("name") or query
        artist = best.get("artistName") or ""
        duration = float(best.get("duration") or 180.0)
        
        # Parse lines
        if best.get("syncedLyrics"):
            lines = parse_synced_lyrics(best["syncedLyrics"], duration)
            has_synced = True
        elif best.get("plainLyrics"):
            lines = synthesize_plain_lyrics_timing(best["plainLyrics"])
            has_synced = False
        else:
            lines = []
            has_synced = False

        # Enrich with musical info from Gemini
        meta = enrich_song_metadata_with_gemini(title, artist)

        return {
            "title": title,
            "artist": artist,
            "album": best.get("albumName", ""),
            "duration": duration,
            "has_synced": has_synced,
            "bpm": meta.get("bpm", 110),
            "key": meta.get("key", "C Major"),
            "genre": meta.get("genre", "Pop"),
            "mood": meta.get("mood", "steady"),
            "instrumental_description": meta.get("instrumental_description", ""),
            "lines": lines
        }

    # Fallback to Gemini if no LRCLIB match found
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
