# AGENTS.md

## Project Overview
Music Picker — a Node.js Express app that helps users discover music via Spotify and Google Gemini AI. Serves static frontend from `public/` and a JSON API from `server.js`.

## Stack
- **Runtime:** Node.js (CommonJS), Express 5
- **Frontend:** Vanilla HTML/JS/CSS in `public/` (served statically by Express)
- **AI:** Google Gemini (`@google/genai`)
- **External API:** Spotify Web API (PKCE + Client Credentials flows)

## Running
```bash
docker compose -f docker-compose.base44.yml up -d
```
- App listens on `0.0.0.0:3000`.
- Uses `node --watch server.js` for live reload on file changes.
- `npm install` runs automatically at container start.
- Health check: `GET /` returns 200.

## Environment Variables (external credentials)
All three are **optional for boot** — the server starts and serves the frontend without them. They are **required for full functionality**:
- `SPOTIFY_CLIENT_ID` — Spotify Developer Dashboard
- `SPOTIFY_CLIENT_SECRET` — Spotify Developer Dashboard
- `GEMINI_API_KEY` — Google AI Studio
- `SPOTIFY_REDIRECT_URI` — defaults to `http://127.0.0.1:3000/auth/callback`; must be set to the preview's public URL and registered in the Spotify dashboard for auth to work.

## Notes
- `server.js` is a single ~2450-line file containing all routes and logic.
- Spotify auth uses cookies (`spotify_refresh_token`, HttpOnly/Secure/SameSite=Lax).
- The Spotify "re-auth required" errors in logs are normal when credentials are absent.
