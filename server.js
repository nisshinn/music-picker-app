const express = require("express");
const dotenv = require("dotenv");
const crypto = require("crypto");
const { GoogleGenAI, Type } = require("@google/genai");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);
app.use(express.json());
app.use(express.static("public"));

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI ||
  `http://127.0.0.1:${PORT}/auth/callback`;

// Spotify User Authentication Sessions
let pkceVerifier = "";
let spotifyAccessToken = "";
let spotifyRefreshToken = "";
let spotifyAccessTokenExpiresAt = 0;

// Spotify Client Credentials Cache
let clientCredentialsToken = "";
let clientCredentialsExpiresAt = 0;

// Gemini AI Client Lazy-Init
let aiClient = null;
function getGeminiAI() {
  if (aiClient) return aiClient;
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set.");
  }
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "music-picker-gemini",
      },
    },
  });
  return aiClient;
}

console.log("----------------------------------------");
console.log("🎵 Music Picker - Good-Parts Hybrid Server");
console.log("----------------------------------------");
console.log("PORT:", PORT);
console.log("CLIENT_ID:", CLIENT_ID ? "設定済み" : "未設定");
console.log("CLIENT_SECRET:", CLIENT_SECRET ? "設定済み" : "未設定");
console.log("GEMINI_API_KEY:", GEMINI_API_KEY ? "設定済み" : "未設定");
console.log("REDIRECT_URI:", REDIRECT_URI);
console.log("----------------------------------------");

function base64url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function clearSpotifySession() {
  spotifyAccessToken = "";
  spotifyRefreshToken = "";
  spotifyAccessTokenExpiresAt = 0;
}

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = {};
  cookieHeader.split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index === -1) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
  });
  return cookies[name] || "";
}

function setRefreshTokenCookie(res, refreshToken) {
  if (!refreshToken) return;
  res.setHeader(
    "Set-Cookie",
    `spotify_refresh_token=${encodeURIComponent(
      refreshToken
    )}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=15552000`
  );
}

function clearRefreshTokenCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "spotify_refresh_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
  );
}

// Client Credentials Token for App-level Spotify API requests
async function getSpotifyToken() {
  if (clientCredentialsToken && Date.now() < clientCredentialsExpiresAt) {
    return clientCredentialsToken;
  }
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Spotify Client ID / Client Secret が未設定です。");
  }

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error?.message || "Spotify App Token取得失敗");
  }

  clientCredentialsToken = data.access_token;
  const expiresIn = Number(data.expires_in || 3600);
  clientCredentialsExpiresAt = Date.now() + Math.max(expiresIn - 60, 60) * 1000;
  return clientCredentialsToken;
}

// User-level Token Refresh with exponential fallback
async function refreshSpotifyAccessToken(force = false) {
  if (spotifyAccessToken && !force && Date.now() < spotifyAccessTokenExpiresAt - 60_000) {
    return spotifyAccessToken;
  }

  if (!spotifyRefreshToken) {
    const error = new Error("Spotifyの再認証が必要です");
    error.status = 401;
    error.reason = "NO_REFRESH_TOKEN";
    throw error;
  }

  const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: spotifyRefreshToken,
    }).toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Spotify Refresh Token Error:", response.status, data);
    if (data?.error === "invalid_grant") {
      clearSpotifySession();
    }
    const error = new Error(data?.error_description || "Spotifyアクセストークンの更新に失敗しました");
    error.status = 401;
    error.reason = data?.error || "REFRESH_FAILED";
    throw error;
  }

  spotifyAccessToken = data.access_token || "";
  if (data.refresh_token) {
    spotifyRefreshToken = data.refresh_token;
  }
  spotifyAccessTokenExpiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return spotifyAccessToken;
}

async function getValidSpotifyAccessToken() {
  return refreshSpotifyAccessToken(false);
}

function getUserAccessToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

async function spotifyFetch(url, options = {}) {
  const response = await fetch(url, options);
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    const message = data?.error?.message || data?.error_description || `Spotify API Error ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.reason = data?.error?.reason;
    throw error;
  }
  return data;
}

function formatTrack(track) {
  if (!track) return null;
  const artists = Array.isArray(track.artists) ? track.artists : [];
  const artistName =
    track.artist ||
    track.artistName ||
    artists.map((a) => a?.name).filter(Boolean).join(", ") ||
    "";
  const artistId = track.artistId || artists[0]?.id || "";
  const image =
    track.image ||
    track.albumArt ||
    track.album?.images?.[0]?.url ||
    track.album?.images?.[1]?.url ||
    track.images?.[0]?.url ||
    "";
  const title = track.title || track.name || "曲名なし";
  const uri = track.uri || (track.id ? `spotify:track:${track.id}` : "");
  const id = track.id || (uri.startsWith("spotify:track:") ? uri.replace("spotify:track:", "") : "");
  const spotifyUrl =
    track.spotifyUrl || track.external_urls?.spotify || (id ? `https://open.spotify.com/track/${id}` : "");

  return {
    ...track,
    id,
    uri,
    title,
    name: title,
    artist: artistName,
    artistId,
    artists: artists.length ? artists : artistName ? [{ id: artistId, name: artistName }] : [],
    image,
    spotifyUrl,
    previewUrl: track.previewUrl || track.preview_url || null,
    reason: track.reason || "",
    genre: track.genre || "",
    tempo: track.tempo || "",
    vibeKeywords: track.vibeKeywords || [],
  };
}

function uniqueTracks(tracks) {
  return Array.from(
    new Map(
      tracks.filter((t) => t && (t.id || t.uri)).map((t) => [t.uri || t.id, t])
    ).values()
  );
}

// Spotify Catalog search for enrichment
async function searchSpotifyTracks(token, query, limit = 10, offset = 0) {
  const params = new URLSearchParams({
    q: query,
    type: "track",
    market: "JP",
    limit: String(limit),
    offset: String(offset),
  });
  return await spotifyFetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function get80Tracks(token, query) {
  const all = [];
  for (let offset = 0; offset < 80; offset += 10) {
    try {
      const data = await searchSpotifyTracks(token, query, 10, offset);
      const tracks = data.tracks?.items || [];
      all.push(...tracks);
      if (offset < 70) {
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (e) {
      if (e.status === 429) throw e;
      break;
    }
  }
  return uniqueTracks(all).slice(0, 80);
}

// -------------------------------------------------------------
// Spotify OAuth Routes (Popup + Direct + PKCE Hybrid)
// -------------------------------------------------------------
app.get("/auth/login", (req, res) => {
  try {
    if (!CLIENT_ID) {
      return res.status(500).send("SPOTIFY_CLIENT_ID が設定されていません。");
    }
    const verifier = base64url(crypto.randomBytes(64));
    const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
    pkceVerifier = verifier;

    const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : req.protocol);
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `${proto}://${host}/auth/callback`;

    const statePayload = Buffer.from(JSON.stringify({ redirectUri, ts: Date.now() })).toString("base64url");

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: redirectUri,
      code_challenge_method: "S256",
      code_challenge: challenge,
      show_dialog: "true",
      state: statePayload,
      scope: [
        "playlist-read-private",
        "playlist-modify-private",
        "playlist-modify-public",
        "streaming",
        "user-read-email",
        "user-read-private",
        "user-read-playback-state",
        "user-modify-playback-state",
        "user-read-recently-played",
        "user-top-read",
        "user-library-read",
        "user-library-modify",
      ].join(" "),
    });

    res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
  } catch (error) {
    res.status(500).send("Spotifyログインの準備に失敗しました。");
  }
});

app.get("/api/auth/spotify/url", (req, res) => {
  const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : req.protocol);
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const fallback = `${proto}://${host}`;
  const base = process.env.APP_URL || req.query.origin || fallback;
  const redirectUri = `${String(base).replace(/\/$/, "")}/auth/callback`;

  const verifier = base64url(crypto.randomBytes(64));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  pkceVerifier = verifier;

  const statePayload = Buffer.from(JSON.stringify({ redirectUri, ts: Date.now() })).toString("base64url");

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state: statePayload,
    show_dialog: "true",
    scope: [
      "playlist-read-private",
      "playlist-modify-private",
      "playlist-modify-public",
      "streaming",
      "user-read-email",
      "user-read-private",
      "user-read-playback-state",
      "user-modify-playback-state",
      "user-read-recently-played",
      "user-top-read",
      "user-library-read",
      "user-library-modify",
    ].join(" "),
  });

  res.json({
    url: `https://accounts.spotify.com/authorize?${params.toString()}`,
    redirectUri,
  });
});

app.get("/auth/callback", async (req, res) => {
  const { code, error, state } = req.query;

  if (error || !code) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"/><title>Spotify 認証エラー</title></head>
        <body style="background:#121212;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;padding:24px;background:#181818;border-radius:12px;border:1px solid #333;">
            <h2 style="color:#e91429;">認証がキャンセルされました</h2>
            <p>このウィンドウは自動的に閉じます...</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${error || "cancelled"}' }, '*');
                setTimeout(() => window.close(), 1200);
              } else {
                window.location.href = '/';
              }
            </script>
          </div>
        </body>
      </html>
    `);
  }

  try {
    let redirectUri = "";
    if (state) {
      try {
        const parsed = JSON.parse(Buffer.from(String(state), "base64url").toString("utf-8"));
        if (parsed?.redirectUri) redirectUri = parsed.redirectUri;
      } catch {}
    }
    if (!redirectUri) {
      const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : req.protocol);
      const host = req.headers["x-forwarded-host"] || req.get("host");
      redirectUri = process.env.SPOTIFY_REDIRECT_URI || `${proto}://${host}/auth/callback`;
    }

    const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
    const bodyParams = new URLSearchParams({
      grant_type: "authorization_code",
      code: String(code),
      redirect_uri: redirectUri,
    });
    if (pkceVerifier) {
      bodyParams.append("code_verifier", pkceVerifier);
    }

    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      const failureReason = tokenData.error_description || tokenData.error || "Token exchange failed";
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <body style="background:#121212;color:white;font-family:sans-serif;padding:32px;text-align:center;">
            <h2 style="color:#e91429;">Spotify認証トークン交換エラー</h2>
            <p>${failureReason}</p>
            <p>Redirect URI: <code>${redirectUri}</code></p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${failureReason}', redirectUri: '${redirectUri}' }, '*');
                setTimeout(() => window.close(), 3000);
              }
            </script>
          </body>
        </html>
      `);
    }

    spotifyAccessToken = tokenData.access_token;
    spotifyRefreshToken = tokenData.refresh_token || spotifyRefreshToken;
    setRefreshTokenCookie(res, spotifyRefreshToken);
    spotifyAccessTokenExpiresAt = Date.now() + Number(tokenData.expires_in || 3600) * 1000;

    let userProfile = null;
    try {
      const profRes = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${spotifyAccessToken}` },
      });
      if (profRes.ok) userProfile = await profRes.json();
    } catch {}

    const payload = {
      type: "SPOTIFY_AUTH_SUCCESS",
      tokens: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type,
        obtained_at: Date.now(),
      },
      user: userProfile,
    };

    res.send(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"/><title>Spotify 認証完了</title></head>
        <body style="background:#121212;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;padding:30px;background:#181818;border-radius:16px;">
            <h2 style="color:#1DB954;">✓ Spotify 接続完了！</h2>
            <p>Music Pickerに戻っています...</p>
            <script>
              localStorage.setItem("spotifyAccessToken", ${JSON.stringify(tokenData.access_token)});
              const authData = ${JSON.stringify(payload)};
              if (window.opener) {
                window.opener.postMessage(authData, '*');
                setTimeout(() => window.close(), 700);
              } else {
                window.location.href = '/';
              }
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`<h2>認証エラー: ${err.message}</h2>`);
  }
});

// Validate manual token input
app.post("/api/auth/spotify/validate-token", async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: "accessToken is required" });
  try {
    const profRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken.trim()}` },
    });
    if (!profRes.ok) {
      return res.status(401).json({ error: "トークンが無効または有効期限切れです" });
    }
    const user = await profRes.json();
    spotifyAccessToken = accessToken.trim();
    spotifyAccessTokenExpiresAt = Date.now() + 3600 * 1000;
    return res.json({
      valid: true,
      user,
      tokens: { access_token: spotifyAccessToken, expires_in: 3600, obtained_at: Date.now() },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get("/api/spotify-token", async (req, res) => {
  try {
    if (!spotifyRefreshToken) {
      spotifyRefreshToken = getCookie(req, "spotify_refresh_token");
    }
    const force = req.query.force === "1";
    const accessToken = await refreshSpotifyAccessToken(force);
    setRefreshTokenCookie(res, spotifyRefreshToken);
    res.json({ success: true, accessToken });
  } catch (error) {
    res.status(error.status === 401 ? 401 : 500).json({
      error: error.message || "Spotifyトークン取得に失敗しました",
      reason: error.reason || "TOKEN_ERROR",
    });
  }
});

app.post("/api/spotify-logout", (req, res) => {
  clearSpotifySession();
  clearRefreshTokenCookie(res);
  res.json({ success: true });
});

// -------------------------------------------------------------
// Spotify Catalog & Library APIs
// -------------------------------------------------------------
app.get("/api/artists", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);
    const token = await getSpotifyToken();
    const data = await spotifyFetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=artist&limit=10&market=JP`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const artists = (data.artists?.items || []).map((artist) => ({
      id: artist.id,
      name: artist.name,
      image: artist.images?.[0]?.url || "",
      spotifyUrl: artist.external_urls?.spotify || "",
    }));
    res.json(artists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/artist-tracks", async (req, res) => {
  try {
    const artistId = String(req.query.id || "").trim();
    if (!artistId) return res.status(400).json({ error: "artist id is required" });
    const token = await getSpotifyToken();

    const artist = await spotifyFetch(`https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const items = await get80Tracks(token, `artist:"${artist.name}"`);
    const tracks = items
      .filter((track) => track.artists?.some((a) => a.id === artistId))
      .map(formatTrack);
    res.json(uniqueTracks(tracks).slice(0, 80));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/genre-tracks", async (req, res) => {
  try {
    const genre = String(req.query.genre || "").trim();
    if (!genre || genre === "all") return res.json([]);
    const token = await getSpotifyToken();
    const items = await get80Tracks(token, `genre:${genre}`);
    const tracks = items.map(formatTrack);
    res.json(uniqueTracks(tracks).slice(0, 80));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ tracks: [], artists: [] });
    const token = await getSpotifyToken();
    const data = await spotifyFetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track,artist&limit=10&market=JP`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    res.json({
      tracks: (data.tracks?.items || []).map(formatTrack),
      artists: (data.artists?.items || []).map((a) => ({
        id: a.id,
        name: a.name,
        image: a.images?.[0]?.url || "",
        spotifyUrl: a.external_urls?.spotify || "",
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/top-tracks", async (req, res) => {
  try {
    const accessToken = await getValidSpotifyAccessToken();
    const data = await spotifyFetch("https://api.spotify.com/v1/me/top/tracks?limit=50", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    res.json((data.items || []).map(formatTrack));
  } catch (error) {
    res.status(error.status === 401 ? 401 : 500).json({ error: error.message });
  }
});

app.get("/api/my-playlists", async (req, res) => {
  try {
    const accessToken = getUserAccessToken(req) || (await getValidSpotifyAccessToken());
    const data = await spotifyFetch("https://api.spotify.com/v1/me/playlists?limit=50", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const playlists = (data.items || []).filter(Boolean).map((p) => ({
      id: p.id,
      name: p.name,
      image: p.images?.[0]?.url || "",
      description: p.description || "",
      tracksTotal: p.items?.total ?? p.tracks?.total ?? 0,
      spotifyUrl: p.external_urls?.spotify || "",
      owner: p.owner?.display_name || "",
    }));
    res.json({ success: true, playlists });
  } catch (error) {
    res.status(error.status === 401 ? 401 : 500).json({ error: error.message });
  }
});

app.get("/api/my-playlists/:playlistId/items", async (req, res) => {
  try {
    const accessToken = getUserAccessToken(req) || (await getValidSpotifyAccessToken());
    const data = await spotifyFetch(
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(req.params.playlistId)}/tracks?limit=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const tracks = (data.items || [])
      .map((item) => item.track || item.item)
      .filter((t) => t && t.type === "track")
      .map(formatTrack);
    res.json({ success: true, tracks });
  } catch (error) {
    res.status(error.status === 401 ? 401 : 500).json({ error: error.message });
  }
});

app.post("/api/create-playlist", async (req, res) => {
  try {
    const accessToken = await getValidSpotifyAccessToken();
    const { name, public: isPublic, tracks } = req.body;
    const playlistName = String(name || "Music Picker").trim();

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return res.status(400).json({ error: "追加する曲がありません" });
    }

    const uris = [
      ...new Set(
        tracks
          .map((t) => (typeof t === "string" ? t : t?.uri || ""))
          .filter((u) => u.startsWith("spotify:track:"))
      ),
    ].slice(0, 100);

    const playlist = await spotifyFetch("https://api.spotify.com/v1/me/playlists", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: playlistName,
        public: Boolean(isPublic),
        description: "Created by Music Picker powered by Gemini AI",
      }),
    });

    await spotifyFetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlist.id)}/tracks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris }),
    });

    res.json({
      success: true,
      playlistId: playlist.id,
      playlistName: playlist.name,
      spotifyUrl: playlist.external_urls?.spotify || "",
      addedTracks: uris.length,
    });
  } catch (error) {
    res.status(error.status === 401 ? 401 : 500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// Gemini AI Mood Analysis & Smart Ranking with Multi-Model Retry
// -------------------------------------------------------------
async function generateContentWithRetry(prompt, systemInstruction = "") {
  const ai = getGeminiAI();
  const models = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];

  for (const model of models) {
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: systemInstruction || undefined,
            temperature: 0.7,
            responseMimeType: "application/json",
          },
        });
        if (response.text) return response.text.trim();
      } catch (err) {
        const status = err?.status || err?.statusCode;
        const msg = String(err?.message || "");
        const isTransient = status === 503 || status === 429 || status === 500 || msg.includes("503") || msg.includes("overloaded");
        if (isTransient && attempt < 2) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 800));
          continue;
        }
        break; // try next model
      }
    }
  }
  throw new Error("Gemini AI APIが現在混み合っています。少し時間をおいて再試行してください。");
}

app.post("/api/gemini/analyze-mood", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "今の気分を入力してください。" });

    const systemInstruction = `あなたは音楽推薦AIです。ユーザーの気分・シチュエーションを分析し、JSON形式で返してください。`;
    const prompt = `ユーザーの入力: 「${text}」
以下のJSONフォーマットのみを出力してください:
{
  "summary": "気分を日本語で1文で要約",
  "mood": "楽しい / テンション高い / 落ち着きたい / しんみり / その他 のいずれか",
  "energy": 1から5の数値,
  "positivity": 1から5の数値,
  "keywords": ["雰囲気タグ1", "雰囲気タグ2", "雰囲気タグ3"],
  "searchQueries": ["Spotify検索に使えるワード1", "ワード2"]
}`;

    const raw = await generateContentWithRetry(prompt, systemInstruction);
    const parsed = JSON.parse(raw.replace(/^```json/i, "").replace(/```$/i, "").trim());
    res.json({ success: true, analysis: parsed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/recommend-from-mood", async (req, res) => {
  try {
    const { text, artistId, artistName, genre } = req.body;
    if (!text) return res.status(400).json({ error: "気分を入力してください。" });

    let analysis = req.body?.analysis;
    if (!analysis) {
      const raw = await generateContentWithRetry(`気分:「${text}」を分析してJSONを出力してください: {"summary":"...","mood":"楽しい/落ち着きたい/等","energy":3,"positivity":3,"keywords":["..."],"searchQueries":["..."]}`);
      analysis = JSON.parse(raw.replace(/^```json/i, "").replace(/```$/i, "").trim());
    }

    const token = await getSpotifyToken();
    let rawTracks = [];

    if (artistId) {
      const items = await get80Tracks(token, `artist:"${artistName}"`);
      rawTracks = items.filter((t) => t.artists?.some((a) => a.id === artistId));
    } else {
      const qList = [
        `${genre || "J-Pop"} ${(analysis.keywords || []).join(" ")}`,
        ...(analysis.searchQueries || []).map((q) => `${genre || ""} ${q}`),
      ];
      for (const q of qList.slice(0, 3)) {
        const data = await searchSpotifyTracks(token, q.trim(), 10, 0);
        rawTracks.push(...(data.tracks?.items || []));
      }
    }

    const candidates = uniqueTracks(rawTracks).map(formatTrack).filter((t) => t.uri).slice(0, 30);
    if (candidates.length < 5) {
      return res.status(404).json({ error: "候補曲が不足しています。別の気分やアーティストをお試しください。" });
    }

    const rankPrompt = `ユーザーの気分: 「${text}」
分析データ: ${JSON.stringify(analysis)}
Spotify候補曲リスト:
${JSON.stringify(candidates.map((c, i) => ({ index: i, title: c.title, artist: c.artist })))}

上記候補曲リストの中から、今の気分に最も合う5曲を厳選し、各曲の推薦理由(reason: 日本語で2〜3文)と雰囲気タグ(vibeKeywords: 3つ)をつけて以下のJSONのみで出力してください:
{
  "curatorNote": "この選曲がリスナーにもたらす効果についての短いメッセージ",
  "selected": [
    {
      "index": 候補のインデックス番号,
      "reason": "推薦理由",
      "genre": "曲のジャンル",
      "tempo": "テンポ感 (例: アップテンポ, ミディアム, スロー)",
      "vibeKeywords": ["タグ1", "タグ2", "タグ3"]
    }
  ]
}`;

    const rawRank = await generateContentWithRetry(rankPrompt, "あなたはプロの音楽キュレーターです。候補曲リストにある曲のみを選んでください。");
    const rankData = JSON.parse(rawRank.replace(/^```json/i, "").replace(/```$/i, "").trim());

    const selectedTracks = [];
    const reasons = [];

    for (const item of rankData.selected || []) {
      const cand = candidates[item.index];
      if (cand) {
        cand.reason = item.reason;
        cand.genre = item.genre || cand.genre;
        cand.tempo = item.tempo || cand.tempo;
        cand.vibeKeywords = item.vibeKeywords || [];
        selectedTracks.push(cand);
        reasons.push(item.reason);
      }
      if (selectedTracks.length >= 5) break;
    }

    // Fallback if AI selected fewer than 5
    for (let i = 0; i < candidates.length && selectedTracks.length < 5; i++) {
      if (!selectedTracks.some((t) => t.uri === candidates[i].uri)) {
        candidates[i].reason = "気分のトーンに調和するおすすめのナンバーです。";
        selectedTracks.push(candidates[i]);
        reasons.push(candidates[i].reason);
      }
    }

    res.json({
      success: true,
      analysis,
      curatorNote: rankData.curatorNote || `「${text}」の気分にぴったりの5曲を厳選しました。`,
      tracks: selectedTracks.slice(0, 5),
      reasons: reasons.slice(0, 5),
    });
  } catch (error) {
    console.error("Gemini Hybrid Recommendation Error:", error);
    res.status(500).json({ error: error.message || "AIおすすめの生成に失敗しました。" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n========================================`);
  console.log(`Music Picker サーバー起動完了！`);
  console.log(`URL: http://127.0.0.1:${PORT}`);
  console.log(`========================================\n`);
});
