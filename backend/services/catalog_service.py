"""Music catalog service: unified song search across iTunes, Deezer and (optionally) Spotify."""
import asyncio
import base64
import re
import time
from typing import Any

import httpx

from backend.config import SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET

TIMEOUT = httpx.Timeout(8.0)
HEADERS = {"User-Agent": "OwnCover/2.0"}

_spotify_token: dict[str, Any] = {"value": "", "expires": 0.0}

def spotify_enabled() -> bool:
    return bool(SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET)

def _year(date_str: str | None) -> int | None:
    m = re.match(r"(\d{4})", date_str or "")
    return int(m.group(1)) if m else None

def _norm_key(title: str, artist: str) -> str:
    """Dedupe key: strip remaster/feat suffixes and punctuation."""
    t = re.sub(r"\s*[\(\[-].*?(remaster|version|feat|edit|live|mono|stereo).*$", "", title, flags=re.I)
    return re.sub(r"[^a-z0-9]", "", f"{t}{artist}".lower())

async def _search_itunes(client: httpx.AsyncClient, query: str, limit: int) -> list[dict[str, Any]]:
    resp = await client.get(
        "https://itunes.apple.com/search",
        params={"term": query, "entity": "song", "media": "music", "limit": limit},
    )
    resp.raise_for_status()
    tracks = []
    for item in resp.json().get("results", []):
        if item.get("kind") != "song":
            continue
        artwork = (item.get("artworkUrl100") or "").replace("100x100bb", "600x600bb")
        tracks.append({
            "id": str(item.get("trackId")),
            "source": "itunes",
            "title": item.get("trackName", ""),
            "artist": item.get("artistName", ""),
            "album": item.get("collectionName", ""),
            "year": _year(item.get("releaseDate")),
            "genre": item.get("primaryGenreName", ""),
            "duration": round((item.get("trackTimeMillis") or 0) / 1000.0, 1),
            "artwork": artwork,
            "preview_url": item.get("previewUrl"),
            "explicit": item.get("trackExplicitness") == "explicit",
        })
    return tracks

async def _search_deezer(client: httpx.AsyncClient, query: str, limit: int) -> list[dict[str, Any]]:
    resp = await client.get("https://api.deezer.com/search", params={"q": query, "limit": limit})
    resp.raise_for_status()
    tracks = []
    for item in resp.json().get("data", []):
        album = item.get("album") or {}
        tracks.append({
            "id": str(item.get("id")),
            "source": "deezer",
            "title": item.get("title", ""),
            "artist": (item.get("artist") or {}).get("name", ""),
            "album": album.get("title", ""),
            "year": None,  # Deezer search omits release date; filled in by get_track_details
            "genre": "",
            "duration": float(item.get("duration") or 0),
            "artwork": album.get("cover_xl") or album.get("cover_big") or "",
            "preview_url": item.get("preview") or None,
            "explicit": bool(item.get("explicit_lyrics")),
        })
    return tracks

async def _spotify_access_token(client: httpx.AsyncClient) -> str:
    if _spotify_token["value"] and _spotify_token["expires"] > time.time() + 30:
        return _spotify_token["value"]
    basic = base64.b64encode(f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}".encode()).decode()
    resp = await client.post(
        "https://accounts.spotify.com/api/token",
        data={"grant_type": "client_credentials"},
        headers={"Authorization": f"Basic {basic}"},
    )
    resp.raise_for_status()
    data = resp.json()
    _spotify_token["value"] = data["access_token"]
    _spotify_token["expires"] = time.time() + float(data.get("expires_in", 3600))
    return _spotify_token["value"]

async def _search_spotify(client: httpx.AsyncClient, query: str, limit: int) -> list[dict[str, Any]]:
    if not spotify_enabled():
        return []
    token = await _spotify_access_token(client)
    resp = await client.get(
        "https://api.spotify.com/v1/search",
        params={"q": query, "type": "track", "limit": min(limit, 50)},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp.raise_for_status()
    tracks = []
    for item in resp.json().get("tracks", {}).get("items", []):
        album = item.get("album") or {}
        images = album.get("images") or []
        tracks.append({
            "id": item.get("id", ""),
            "source": "spotify",
            "title": item.get("name", ""),
            "artist": ", ".join(a.get("name", "") for a in item.get("artists", [])),
            "album": album.get("name", ""),
            "year": _year(album.get("release_date")),
            "genre": "",
            "duration": round((item.get("duration_ms") or 0) / 1000.0, 1),
            "artwork": images[0]["url"] if images else "",
            "preview_url": item.get("preview_url"),
            "explicit": bool(item.get("explicit")),
        })
    return tracks

async def search_catalog(query: str, year: int | None = None, limit: int = 20) -> list[dict[str, Any]]:
    """Search all catalog sources concurrently, merge and dedupe. Each source fails soft."""
    async with httpx.AsyncClient(timeout=TIMEOUT, headers=HEADERS) as client:
        results = await asyncio.gather(
            _search_itunes(client, query, max(limit * 2, 25)),
            _search_deezer(client, query, limit),
            _search_spotify(client, query, limit),
            return_exceptions=True,
        )

    merged: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for source_result in results:
        if isinstance(source_result, Exception):
            print(f"Catalog source failed: {source_result}")
            continue
        for track in source_result:
            key = _norm_key(track["title"], track["artist"])
            existing = merged.get(key)
            if not existing:
                merged[key] = track
                order.append(key)
                continue
            # Fill gaps on the first-seen track from later sources
            for field in ("year", "genre", "artwork", "preview_url", "album"):
                if not existing.get(field) and track.get(field):
                    existing[field] = track[field]

    tracks = [merged[k] for k in order]
    if year:
        # Deezer search results carry no year, so keep unknown-year tracks after exact matches
        exact = [t for t in tracks if t.get("year") == year]
        unknown = [t for t in tracks if t.get("year") is None]
        tracks = exact + unknown
    return tracks[: limit * 2]

async def get_track_details(source: str, track_id: str) -> dict[str, Any]:
    """Fetch extra details for a selected track (Deezer gives BPM and release date)."""
    if source != "deezer":
        return {}
    async with httpx.AsyncClient(timeout=TIMEOUT, headers=HEADERS) as client:
        resp = await client.get(f"https://api.deezer.com/track/{track_id}")
        resp.raise_for_status()
        data = resp.json()
    bpm = data.get("bpm") or 0
    return {
        "bpm": round(bpm) if bpm and bpm > 0 else None,
        "year": _year(data.get("release_date")),
    }

async def find_deezer_bpm(title: str, artist: str) -> int | None:
    """Best-effort BPM lookup for a track found on any source."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, headers=HEADERS) as client:
            resp = await client.get(
                "https://api.deezer.com/search",
                params={"q": f'artist:"{artist}" track:"{title}"', "limit": 1},
            )
            resp.raise_for_status()
            hits = resp.json().get("data", [])
        if not hits:
            return None
        details = await get_track_details("deezer", str(hits[0]["id"]))
        return details.get("bpm")
    except Exception as e:
        print(f"Deezer BPM lookup failed: {e}")
        return None
