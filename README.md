# Own Cover — AI Song Cover Studio

**Own Cover** is an AI song cover generator web application that turns any song into a personalized vocal cover using **Google Gemini Replicated Voice**, **Google Lyria 3.5 Music Generation**, **LRCLIB Synced Lyrics**, and **FFmpeg Stem Mastering**.

---

## Key Capabilities

1. **Song & Synced Lyrics Search**:
   - Searches any song by title, artist, or year.
   - Retrieves millisecond-precise synced lyrics via open LRCLIB database.
   - Enriches musical attributes (BPM, musical key, genre, rhythm style) with **Gemini 3.8 Flash**.

2. **Instrumental Backing Track Generator**:
   - Generates authentic backing tracks with **Google Lyria 3.5** (`models/lyria-3.5`).
   - Supports user drag-and-drop custom beat upload (MP3/WAV).

3. **Google Voice Studio (2-Step Replication)**:
   - Utilizes user's pre-cloned Google Gemini voice (`Tinevimbo Musingadi - voice_cerks20cbtia`).
   - Integrated in-browser recording / upload for Google's 2 required audio inputs:
     1. Spoken Consent Statement (`"I [Name] give Google permission..."`).
     2. 15-30s Vocal Sample.
   - Automatically clones and stores new voices via `c.voices.create(store=True, ...)`.

4. **FFmpeg Stem Mixing & Mastering**:
   - Lays vocal clips onto song time axis.
   - Applies acoustic space (stereo plate reverb), vocal highpass EQ, and EBU R128 loudness normalization (`loudnorm`).
   - Exports high-fidelity master MP3 with separate vocal and beat stem access.

5. **Groovy Grainy-Gradient Aesthetic**:
   - Snappy studio interface featuring warm sunshine yellow (`#FACC15`), sand beige (`#F5F0E6`), crisp white, and obsidian black (`#0B0C10`).
   - Real-time animated canvas audio waveform visualizer.
   - Live teleprompter lyrics that scroll and highlight in sync with playback.

6. **Firebase & Google Authentication**:
   - "Continue with Google" Firebase Auth.
   - Pre-configured for GCP project `serious-unison-452122-i2`.

---

## Project Structure

```
├── backend/
│   ├── config.py              # Key resolution & model configuration
│   ├── main.py                # FastAPI endpoints & audio static server
│   ├── requirements.txt       # Python dependencies
│   ├── services/
│   │   ├── gemini_service.py  # GenAI client, voice listing & synthesis
│   │   ├── lyrics_service.py  # LRCLIB synced lyrics & Gemini metadata
│   │   ├── music_service.py   # Lyria 3.5 instrumental generator
│   │   ├── voice_service.py   # 2-step Google Voice Cloning pipeline
│   │   └── mixer_service.py   # FFmpeg stem mixing & mastering
│   └── storage/               # Output audio stems & covers
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx            # Header & Google Auth
│   │   │   ├── SongSearch.tsx        # Step 1: Song & lyrics lookup
│   │   │   ├── BeatGenerator.tsx     # Step 2: Lyria beat generator
│   │   │   ├── CoverStudio.tsx       # Step 3: Production mixer deck
│   │   │   ├── KaraokePlayer.tsx     # Waveform player & teleprompter
│   │   │   └── VoiceStudioModal.tsx  # 2-step Voice Cloning modal
│   │   ├── types.ts                  # Shared data definitions
│   │   ├── firebase.ts               # Firebase Auth setup
│   │   └── App.tsx                   # Main layout & studio flow
│   ├── package.json
│   └── vite.config.ts
│
├── Dockerfile                 # Cloud Run containerization
├── firebase.json              # Firebase Hosting configuration
└── .gitignore                 # Safe credentials & audio stem protection
```

---

## Quickstart

### 1. Prerequisites
- Python 3.13+
- Node.js 20+
- FFmpeg (on PATH)

### 2. Backend Setup
```powershell
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### 3. Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Deployment

### Deploy to Google Cloud Run
```powershell
gcloud run deploy own-cover-backend --source . --region us-central1 --allow-unauthenticated
```

### Deploy to Firebase Hosting
```powershell
npm --prefix frontend run build
firebase deploy --only hosting
```
