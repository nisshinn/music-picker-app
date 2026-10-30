const express = require("express");
const dotenv = require("dotenv");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { GoogleGenAI, Type } = require("@google/genai");
const { collectPages } = require("./lib/paging");
const { createRateLimiter } = require("./lib/rate-limit");

dotenv.config();

// Fallback to .env.example if user wrote credentials there directly
if ((!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) && fs.existsSync(".env.example")) {
  try {
    const exampleParsed = dotenv.parse(fs.readFileSync(".env.example"));
    if (!process.env.SPOTIFY_CLIENT_ID && exampleParsed.SPOTIFY_CLIENT_ID) {
      process.env.SPOTIFY_CLIENT_ID = exampleParsed.SPOTIFY_CLIENT_ID;
    }
    if (!process.env.SPOTIFY_CLIENT_SECRET && exampleParsed.SPOTIFY_CLIENT_SECRET) {
      process.env.SPOTIFY_CLIENT_SECRET = exampleParsed.SPOTIFY_CLIENT_SECRET;
    }
    if (!process.env.SPOTIFY_REDIRECT_URI && exampleParsed.SPOTIFY_REDIRECT_URI) {
      process.env.SPOTIFY_REDIRECT_URI = exampleParsed.SPOTIFY_REDIRECT_URI;
    }
    if (!process.env.GEMINI_API_KEY && exampleParsed.GEMINI_API_KEY) {
      process.env.GEMINI_API_KEY = exampleParsed.GEMINI_API_KEY;
    }
  } catch (err) {
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn("Could not read fallback from .env.example:", err.message);
    }
  }
}

const app = express();
const PORT = 3000;

app.set("trust proxy", 1);
app.set("x-powered-by", false);
// 入力サイズを制限（巨大なリクエストでAI枠やメモリを消費されないように）
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  next();
});

function getAppBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : req.protocol);
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`;
}

const CANONICAL_PLACEHOLDER = "https://ais-pre-zm535d3kmvpavtgnurcw7k-547276737603.asia-east1.run.app";

// Dynamic robots.txt tailored to current hosting domain (Render / Custom domain / Preview)
app.get("/robots.txt", (req, res) => {
  const base = getAppBaseUrl(req);
  res.type("text/plain");
  res.send(`User-agent: *
Allow: /
Sitemap: ${base}/sitemap.xml
`);
});

// Dynamic sitemap.xml tailored to current hosting domain
app.get("/sitemap.xml", (req, res) => {
  const base = getAppBaseUrl(req);
  res.type("application/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${base}/search.html</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${base}/top-tracks.html</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${base}/favorites.html</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>${base}/history.html</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`);
});

// HTML canonical URL & OpenGraph rewriting middleware so search engines index the exact current domain
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const reqPath = req.path;
  const fileName = reqPath === "/" ? "index.html" : reqPath.replace(/^\//, "");
  if (fileName.endsWith(".html") || reqPath === "/") {
    const fullPath = path.join(__dirname, "public", fileName.endsWith(".html") ? fileName : `${fileName}.html`);
    if (fs.existsSync(fullPath)) {
      try {
        let content = fs.readFileSync(fullPath, "utf-8");
        const currentOrigin = getAppBaseUrl(req);
        content = content.split(CANONICAL_PLACEHOLDER).join(currentOrigin);
        res.set({
          "Content-Type": "text/html; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "SAMEORIGIN",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        });
        return res.send(content);
      } catch (err) {
        return next();
      }
    }
  }
  next();
});

app.use(express.static("public"));

// 呼び出しコストの高いAPIにはレート制限をかける
app.use("/api/gemini", createRateLimiter({ windowMs: 60_000, max: 20 }));
app.use("/api/search", createRateLimiter({ windowMs: 60_000, max: 240 }));
app.use("/api/artist-details", createRateLimiter({ windowMs: 60_000, max: 60 }));

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

async function spotifyFetch(url, options = {}, attempt = 0) {
  const response = await fetch(url, options);
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  // 429(混雑)のときは Retry-After に従って短く待ち、1回だけ自動で再試行する
  if (response.status === 429 && attempt < 1) {
    const wait = Math.min(Number(response.headers?.get?.("retry-after")) || 1, 3);
    await new Promise((resolve) => setTimeout(resolve, wait * 1000));
    return spotifyFetch(url, options, attempt + 1);
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

// APIエラーを原因別の日本語メッセージにして返す（内部エラーの文面をそのまま見せない）
function friendlyErrorMessage(error) {
  const status = error?.status;
  if (status === 401) return "Spotifyの認証が切れました。ログインし直してください。";
  if (status === 403) return "Spotifyの権限が足りないため取得できませんでした。";
  if (status === 404) return "見つかりませんでした。";
  if (status === 429) return "Spotifyが混み合っています。少し待ってからもう一度お試しください。";
  if (status >= 500) return "Spotify側で一時的な問題が起きています。しばらくしてからお試しください。";
  return "取得に失敗しました。通信状況を確認してもう一度お試しください。";
}
function sendApiError(res, error) {
  const status = error?.status && error.status >= 400 && error.status < 600 ? error.status : 500;
  res.status(status).json({ error: friendlyErrorMessage(error) });
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
  const all = await collectPages({
    maxItems: 80,
    maxPages: 8,
    fetchPage: async (offset) => (await searchSpotifyTracks(token, query, 10, offset)).tracks || { items: [] },
  });
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
        "playlist-read-collaborative",
        "playlist-modify-private",
        "playlist-modify-public",
        "streaming",
        "user-read-email",
        "user-read-private",
        "user-read-playback-state",
        "user-read-currently-playing",
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
      "playlist-read-collaborative",
      "playlist-modify-private",
      "playlist-modify-public",
      "streaming",
      "user-read-email",
      "user-read-private",
      "user-read-playback-state",
      "user-read-currently-playing",
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

// -------------------------------------------------------------
// Artist Details: Biography, Insights & Top Tracks
// -------------------------------------------------------------
const artistDetailsCache = new Map();

app.get("/api/artist-details", async (req, res) => {
  try {
    const artistId = String(req.query.id || "").trim();
    let artistName = String(req.query.name || "").trim();
    if (!artistId && !artistName) {
      return res.status(400).json({ error: "artist id or name is required" });
    }

    const cacheKey = `${artistId || "no-id"}:${artistName.toLowerCase()}`;
    const cached = artistDetailsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600_000) {
      return res.json(cached.data);
    }

    let genres = [];
    let image = "";
    let spotifyUrl = "";
    let followers = 0;
    let popularity = 0;
    let topTracks = [];
    let latestRelease = null;
    let albums = [];
    let cleanId = "";
    let token = "";

    // 1. Fetch Spotify data if available
    try {
      token = await getSpotifyToken();
      let resolvedId = artistId;

      // If no valid artistId, resolve by searching
      if (!resolvedId && artistName) {
        const searchRes = await spotifyFetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1&market=JP`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const found = searchRes.artists?.items?.[0];
        if (found) {
          resolvedId = found.id;
          image = found.images?.[0]?.url || "";
        }
      }

      if (resolvedId && /^[a-zA-Z0-9]+$/.test(resolvedId.replace(/^spotify:artist:/, ""))) {
        cleanId = resolvedId.replace(/^spotify:artist:/, "");
        const [artistRes, topTracksRes] = await Promise.allSettled([
          spotifyFetch(`https://api.spotify.com/v1/artists/${encodeURIComponent(cleanId)}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          spotifyFetch(`https://api.spotify.com/v1/artists/${encodeURIComponent(cleanId)}/top-tracks?market=JP`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        if (artistRes.status === "fulfilled" && artistRes.value && !artistRes.value.error) {
          const a = artistRes.value;
          artistName = a.name || artistName;
          genres = a.genres || [];
          image = a.images?.[0]?.url || image;
          spotifyUrl = a.external_urls?.spotify || `https://open.spotify.com/artist/${cleanId}`;
          followers = a.followers?.total || 0;
          popularity = a.popularity || 0;
        }

        // Fetch up to 30 albums/singles using limit=10 (Spotify rejects limit>20 on /v1/artists/{id}/albums)
        let rawAlbumItems = [];
        try {
          const albumPages = await Promise.allSettled([
            spotifyFetch(`https://api.spotify.com/v1/artists/${encodeURIComponent(cleanId)}/albums?include_groups=album,single&market=JP&limit=10&offset=0`, {
              headers: { Authorization: `Bearer ${token}` }
            }),
            spotifyFetch(`https://api.spotify.com/v1/artists/${encodeURIComponent(cleanId)}/albums?include_groups=album,single&market=JP&limit=10&offset=10`, {
              headers: { Authorization: `Bearer ${token}` }
            }),
            spotifyFetch(`https://api.spotify.com/v1/artists/${encodeURIComponent(cleanId)}/albums?include_groups=album,single&market=JP&limit=10&offset=20`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          ]);
          for (const pageRes of albumPages) {
            if (pageRes.status === "fulfilled" && Array.isArray(pageRes.value?.items)) {
              rawAlbumItems.push(...pageRes.value.items);
            }
          }
        } catch (albErr) {
          console.warn("Spotify artist albums fetch non-fatal:", albErr.message);
        }

        // Process albums (deduplicated, sorted newest first)
        if (rawAlbumItems.length > 0) {
          const seenNames = new Set();
          albums = rawAlbumItems
            .map((alb) => ({
              id: alb.id,
              name: alb.name,
              releaseDate: alb.release_date || "",
              totalTracks: alb.total_tracks || 1,
              type: alb.album_type === "single" ? "Single" : (alb.album_type === "compilation" ? "Compilation" : "Album"),
              albumType: alb.album_type || "album",
              image: alb.images?.[0]?.url || alb.images?.[1]?.url || "",
              spotifyUrl: alb.external_urls?.spotify || `https://open.spotify.com/album/${alb.id}`,
            }))
            .filter((alb) => {
              const key = alb.name.toLowerCase().trim();
              if (seenNames.has(key)) return false;
              seenNames.add(key);
              return true;
            });

          albums.sort((a, b) => new Date(b.releaseDate || "1970") - new Date(a.releaseDate || "1970"));

          if (albums.length > 0) {
            const first = albums[0];
            latestRelease = {
              id: first.id,
              name: first.name,
              releaseDate: first.releaseDate || "",
              totalTracks: first.totalTracks || 1,
              type: first.type || "Album",
              image: first.image || image || "",
              spotifyUrl: first.spotifyUrl || spotifyUrl,
            };
          }
        }

        // Fetch up to 20 top tracks for this artist
        const collectedTracks = [];
        const seenTrackIds = new Set();
        const seenNormTitles = new Map();

        const normalizeSongTitle = (t) => {
          if (!t) return "";
          return t
            .toLowerCase()
            .replace(/[\(（\[【].*?[\)）\]】]/g, "")
            .replace(/\s*[-–~〜].*$/, "")
            .trim();
        };

        const isJunkTrackTitle = (title) => {
          const lower = (title || "").toLowerCase().trim();
          if (/^audio\s*\d+/i.test(lower)) return true;
          if (/^(intro|outro|interlude|skit|prologue|epilogue)\b/i.test(lower)) return true;
          return false;
        };

        const isLiveRecordingTrack = (trackName, albumName) => {
          const combined = `${trackName || ""} ${albumName || ""}`.toLowerCase();
          return /live|tour|dome tour|selection from|in tokyo|live selection|at budokan|acoustic live|arena tour/i.test(combined);
        };

        const addCandidateTrack = (t, defaultAlbum = null) => {
          if (!t || !t.id || seenTrackIds.has(t.id)) return false;
          if (isJunkTrackTitle(t.name)) return false;

          const artList = Array.isArray(t.artists) ? t.artists : [];
          const matches = !artistName || artList.some((a) =>
            (cleanId && a.id === cleanId) ||
            (a.name && a.name.toLowerCase().includes(artistName.toLowerCase())) ||
            (artistName && artistName.toLowerCase().includes((a.name || "").toLowerCase()))
          );
          if (!matches && artList.length > 0) return false;

          const albObj = t.album || defaultAlbum;
          const normTitle = normalizeSongTitle(t.name);
          const isLive = isLiveRecordingTrack(t.name, albObj?.name);

          const trackObj = {
            id: t.id,
            name: t.name,
            artists: artList.map((art) => art.name).filter(Boolean).join(", ") || artistName,
            albumName: albObj?.name || "",
            image: albObj?.images?.[0]?.url || albObj?.images?.[1]?.url || image || "",
            previewUrl: t.preview_url || "",
            uri: t.uri || `spotify:track:${t.id}`,
            spotifyUrl: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
            durationMs: t.duration_ms || 0,
            popularity: typeof t.popularity === "number" ? t.popularity : 50,
          };

          if (normTitle && seenNormTitles.has(normTitle)) {
            const existingIdx = seenNormTitles.get(normTitle);
            const existing = collectedTracks[existingIdx];
            const existingIsLive = isLiveRecordingTrack(existing.name, existing.albumName);

            // If existing track was a live version and candidate is studio version, upgrade it
            if (existingIsLive && !isLive) {
              seenTrackIds.delete(existing.id);
              seenTrackIds.add(t.id);
              collectedTracks[existingIdx] = trackObj;
              return true;
            }
            return false;
          }

          seenTrackIds.add(t.id);
          if (normTitle) {
            seenNormTitles.set(normTitle, collectedTracks.length);
          }
          collectedTracks.push(trackObj);
          return true;
        };

        // 1. Try Spotify top-tracks endpoint (official top tracks if available)
        if (topTracksRes.status === "fulfilled" && Array.isArray(topTracksRes.value?.tracks)) {
          for (const t of topTracksRes.value.tracks) {
            addCandidateTrack(t);
          }
        }

        // 2. Fetch popular tracks via Spotify track search (Spotify search algorithm ranks tracks by popularity/relevance)
        if (collectedTracks.length < 20 && artistName) {
          const searchQueries = [
            artistName.replace(/["\\]/g, ""),
            `artist:"${artistName.replace(/["\\]/g, "")}"`
          ];
          for (const q of searchQueries) {
            if (collectedTracks.length >= 20) break;
            try {
              const offsets = [0, 10, 20, 30, 40];
              const pages = await Promise.allSettled(
                offsets.map((off) =>
                  spotifyFetch(
                    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=10&offset=${off}&market=JP`,
                    { headers: { Authorization: `Bearer ${token}` } }
                  )
                )
              );
              for (const pageRes of pages) {
                if (collectedTracks.length >= 20) break;
                if (pageRes.status === "fulfilled" && Array.isArray(pageRes.value?.tracks?.items)) {
                  for (const t of pageRes.value.tracks.items) {
                    addCandidateTrack(t);
                    if (collectedTracks.length >= 20) break;
                  }
                }
              }
            } catch (searchErr) {
              console.warn("Spotify artist track search non-fatal:", searchErr.message);
            }
          }
        }

        topTracks = collectedTracks.slice(0, 20).map((t, idx) => ({ ...t, rank: idx + 1 }));
      }
    } catch (spotifyErr) {
      console.warn("Spotify artist fetch non-fatal:", spotifyErr.message);
    }

    // 2. AI Biography, Representative 20 Songs & Albums via Gemini
    let bio = "";
    let summary = "";
    let highlights = [];
    let representativeSongs = [];
    let representativeAlbums = [];

    if (process.env.GEMINI_API_KEY && artistName) {
      try {
        const systemInstruction = "あなたは音楽キュレーター・音楽評論家です。指定されたアーティストについて、リスナーがその魅力・個性をすぐに理解できる洗練された日本語の紹介文、代表曲20曲、代表アルバム・シングルを作成し、JSON形式で返してください。";
        const prompt = `アーティスト名: 「${artistName}」
ジャンル: ${genres.length ? genres.join(", ") : "J-POP / ポップス / ロック"}
以下のJSON形式で回答してください:
{
  "summary": "1文で表すアーティストのキャッチコピー（例: 叙情的なメロディと圧倒的な表現力で時代を牽引するフロントランナー）",
  "bio": "生い立ちや音楽的特徴、魅力や現在の音楽シーンでの立ち位置を簡潔かつ魅力的にまとめた紹介文（150〜220文字程度、2〜3文）",
  "highlights": ["音楽的特徴や魅力のキーワード1", "キーワード2", "キーワード3"],
  "representativeSongs": ["代表曲1", "代表曲2", "代表曲3", "代表曲4", "代表曲5", "代表曲6", "代表曲7", "代表曲8", "代表曲9", "代表曲10", "代表曲11", "代表曲12", "代表曲13", "代表曲14", "代表曲15", "代表曲16", "代表曲17", "代表曲18", "代表曲19", "代表曲20"],
  "representativeAlbums": [
    { "name": "代表アルバム1", "releaseDate": "2023", "type": "Album", "totalTracks": 10 },
    { "name": "代表アルバム2", "releaseDate": "2022", "type": "Album", "totalTracks": 12 },
    { "name": "代表シングル1", "releaseDate": "2024", "type": "Single", "totalTracks": 2 }
  ]
}`;
        const raw = await generateContentWithRetry(prompt, systemInstruction);
        const parsed = JSON.parse(raw.replace(/^```json/i, "").replace(/```$/i, "").trim());
        bio = parsed.bio || "";
        summary = parsed.summary || "";
        highlights = Array.isArray(parsed.highlights) ? parsed.highlights : [];
        representativeSongs = Array.isArray(parsed.representativeSongs) ? parsed.representativeSongs : [];
        representativeAlbums = Array.isArray(parsed.representativeAlbums) ? parsed.representativeAlbums : [];
      } catch (geminiErr) {
        console.warn("Gemini artist bio generation non-fatal:", geminiErr.message);
      }
    }

    // Fallbacks if AI bio empty
    if (!bio) {
      const genreLabel = genres.slice(0, 3).join("・") || "J-POP / ロック";
      bio = `${artistName}は、${genreLabel}を中心に多くのリスナーから高い評価と支持を集めている注目のアーティストです。独自のメロディセンスと心に響くサウンドが魅力です。`;
      summary = `${artistName}のアーティストプロファイル`;
      highlights = genres.length ? genres.slice(0, 3) : ["メロディセンス", "独自の世界観", "注目アーティスト"];
    }

    // If top tracks empty, populate from representative songs (up to 20)
    if (topTracks.length === 0 && representativeSongs.length > 0) {
      topTracks = representativeSongs.slice(0, 20).map((songTitle, idx) => ({
        id: `song-${idx + 1}`,
        rank: idx + 1,
        name: songTitle,
        artists: artistName,
        albumName: "Popular Track",
        image: image || "",
        previewUrl: "",
        uri: "",
        spotifyUrl: spotifyUrl || `https://open.spotify.com/search/${encodeURIComponent(`${artistName} ${songTitle}`)}`,
        durationMs: 0,
        popularity: Math.max(20, 95 - idx * 3),
      }));
    }

    // If albums empty, populate from representative albums
    if (albums.length === 0 && representativeAlbums.length > 0) {
      albums = representativeAlbums.map((alb, idx) => ({
        id: `album-${idx + 1}`,
        name: alb.name,
        releaseDate: alb.releaseDate || "",
        totalTracks: alb.totalTracks || 10,
        type: alb.type || "Album",
        image: image || "",
        spotifyUrl: spotifyUrl || `https://open.spotify.com/search/${encodeURIComponent(`${artistName} ${alb.name}`)}`,
      }));
    }

    if (!latestRelease && albums.length > 0) {
      const first = albums[0];
      latestRelease = {
        id: first.id,
        name: first.name,
        releaseDate: first.releaseDate || "",
        totalTracks: first.totalTracks || 1,
        type: first.type || "Album",
        image: first.image || image || "",
        spotifyUrl: first.spotifyUrl || spotifyUrl,
      };
    } else if (!latestRelease && topTracks.length > 0) {
      const first = topTracks[0];
      latestRelease = {
        id: first.id,
        name: first.albumName || first.name,
        releaseDate: "",
        totalTracks: 1,
        type: "Single",
        image: first.image || image || "",
        spotifyUrl: first.spotifyUrl || spotifyUrl,
      };
    }

    const payload = {
      id: artistId || cleanId,
      name: artistName,
      image,
      genres,
      followers,
      popularity,
      spotifyUrl: spotifyUrl || (artistId ? `https://open.spotify.com/artist/${artistId}` : ""),
      bio,
      summary,
      highlights,
      topTracks,
      latestRelease,
      albums,
    };

    artistDetailsCache.set(cacheKey, { timestamp: Date.now(), data: payload });
    if (artistDetailsCache.size > 200) {
      const firstKey = artistDetailsCache.keys().next().value;
      artistDetailsCache.delete(firstKey);
    }

    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// Album Details: Metadata & Tracklist
// -------------------------------------------------------------
const albumDetailsCache = new Map();

app.get("/api/album-details", async (req, res) => {
  try {
    const albumId = String(req.query.id || "").trim();
    const albumName = String(req.query.name || "").trim();
    const artistName = String(req.query.artist || "").trim();

    if (!albumId && !albumName) {
      return res.status(400).json({ error: "album id or name is required" });
    }

    const cacheKey = `${albumId || "no-id"}:${albumName.toLowerCase()}:${artistName.toLowerCase()}`;
    const cached = albumDetailsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600_000) {
      return res.json(cached.data);
    }

    let token = "";
    try {
      token = await getSpotifyToken();
    } catch {}

    let resolvedAlbumId = albumId;
    let albumData = null;

    if (token) {
      // 1. If no valid Spotify ID, search for the album
      if (!resolvedAlbumId && albumName) {
        try {
          const q = artistName ? `album:${albumName} artist:${artistName}` : albumName;
          const searchRes = await spotifyFetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=album&limit=1&market=JP`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          resolvedAlbumId = searchRes.albums?.items?.[0]?.id || "";
        } catch {}
      }

      // 2. Fetch full album from Spotify
      if (resolvedAlbumId && /^[a-zA-Z0-9]+$/.test(resolvedAlbumId.replace(/^spotify:album:/, ""))) {
        const cleanAlbumId = resolvedAlbumId.replace(/^spotify:album:/, "");
        try {
          albumData = await spotifyFetch(
            `https://api.spotify.com/v1/albums/${encodeURIComponent(cleanAlbumId)}?market=JP`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (e) {
          console.warn("Spotify album detail fetch failed:", e.message);
        }
      }
    }

    let payload = null;
    if (albumData && !albumData.error) {
      const artists = (albumData.artists || []).map((a) => ({
        id: a.id,
        name: a.name,
        spotifyUrl: a.external_urls?.spotify || "",
      }));
      const primaryArtist = artists[0]?.name || artistName || "";
      const primaryArtistId = artists[0]?.id || "";

      // Try to get artist avatar if token available
      let primaryArtistImage = "";
      if (token && primaryArtistId) {
        try {
          const artRes = await spotifyFetch(
            `https://api.spotify.com/v1/artists/${encodeURIComponent(primaryArtistId)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          primaryArtistImage = artRes?.images?.[0]?.url || "";
        } catch {}
      }

      const rawTracks = albumData.tracks?.items || [];
      let totalDurationMs = 0;
      const tracks = rawTracks.map((t, idx) => {
        const dur = t.duration_ms || 0;
        totalDurationMs += dur;
        const mins = Math.floor(dur / 60000);
        const secs = Math.floor((dur % 60000) / 1000);
        const durationStr = `${mins}:${String(secs).padStart(2, "0")}`;
        const tArtists = (t.artists || []).map((a) => a.name).join(", ") || primaryArtist;
        const albumImg = albumData.images?.[0]?.url || "";

        return {
          id: t.id,
          trackNumber: t.track_number || idx + 1,
          name: t.name,
          title: t.name,
          artist: tArtists,
          artists: tArtists,
          albumName: albumData.name,
          albumId: albumData.id,
          durationMs: dur,
          durationStr,
          previewUrl: t.preview_url || "",
          uri: t.uri || `spotify:track:${t.id}`,
          spotifyUrl: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
          image: albumImg,
        };
      });

      const totalMins = Math.floor(totalDurationMs / 60000);
      const totalSecs = Math.floor((totalDurationMs % 60000) / 1000);
      const typeLabel =
        albumData.album_type === "single"
          ? (albumData.total_tracks > 1 && albumData.total_tracks <= 6 ? "シングルとEP" : "シングル")
          : "アルバム";

      payload = {
        id: albumData.id,
        name: albumData.name,
        type: typeLabel,
        albumType: albumData.album_type || "album",
        releaseDate: albumData.release_date || "",
        releaseYear: (albumData.release_date || "").slice(0, 4),
        totalTracks: albumData.total_tracks || tracks.length,
        durationMs: totalDurationMs,
        durationText: `${albumData.total_tracks || tracks.length}曲, ${totalMins}分 ${totalSecs}秒`,
        image: albumData.images?.[0]?.url || albumData.images?.[1]?.url || "",
        spotifyUrl: albumData.external_urls?.spotify || `https://open.spotify.com/album/${albumData.id}`,
        label: albumData.label || "",
        copyrights: (albumData.copyrights || []).map((c) => c.text),
        artists,
        primaryArtist,
        primaryArtistId,
        primaryArtistImage,
        tracks,
      };
    } else {
      payload = {
        id: albumId || `album-${Date.now()}`,
        name: albumName || "アルバム",
        type: "アルバム",
        albumType: "album",
        releaseDate: new Date().getFullYear().toString(),
        releaseYear: new Date().getFullYear().toString(),
        totalTracks: 0,
        durationMs: 0,
        durationText: "0曲",
        image: "",
        spotifyUrl: albumId ? `https://open.spotify.com/album/${albumId}` : "",
        label: "",
        copyrights: [],
        artists: artistName ? [{ id: "", name: artistName }] : [],
        primaryArtist: artistName || "アーティスト",
        primaryArtistId: "",
        primaryArtistImage: "",
        tracks: [],
      };
    }

    albumDetailsCache.set(cacheKey, { timestamp: Date.now(), data: payload });
    if (albumDetailsCache.size > 200) {
      const firstKey = albumDetailsCache.keys().next().value;
      albumDetailsCache.delete(firstKey);
    }

    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Spotify has no recording-type flag. Use explicit version annotations, not
// bare words in song titles such as "Live Forever" or "Living on a Prayer".
function isLiveRecording(track) {
  const title = String(track.name || track.title || "");
  const album = String(track.album?.name || "");
  const version = /(?:[([{（【]|\s[-–—:]\s)\s*(?:[^)\]】）]*?\s)?live\b|\blive\s+(?:at|from|in|on)\b|ライブ(?:版|音源|バージョン)|ライヴ(?:版|音源|バージョン)|[（(【]\s*(?:ライブ|ライヴ)/i;
  return version.test(title) || version.test(album) || /^(?:live|ライブ|ライヴ)(?:$|\s|[!:(（-])/i.test(album);
}
function matchesRecordingVersion(track, version) {
  return version === "live" ? isLiveRecording(track) : version === "studio" ? !isLiveRecording(track) : true;
}

// Accept bilingual titles while preserving recording/version annotations.
function normalizeLyricName(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase() : "";
}
function lyricTitleAliases(value) {
  const title = normalizeLyricName(value);
  const aliases = [title];
  const parts = title.split(/\s[-–—]\s/);
  const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
  const latin = /^[\p{Script=Latin}\s'’]+$/u;
  const version = /\b(?:live|remix|mix|remaster(?:ed)?|acoustic|instrumental|karaoke|edit|version|demo|session|mono|stereo|sped|slowed|cover|radio)\b/i;
  if (parts.length === 2 && cjk.test(parts[0]) && latin.test(parts[1]) && !version.test(parts[1])) aliases.push(parts[0]);
  return aliases;
}
function matchesLyricRecording(item, { title, artist, album, duration }) {
  if (!item || !normalizeLyricName(item.trackName) || normalizeLyricName(item.artistName) !== normalizeLyricName(artist)) return false;
  if (!Number.isFinite(item.duration) || Math.abs(item.duration - duration) > 2) return false;
  const aliases = lyricTitleAliases(title);
  if (!lyricTitleAliases(item.trackName).some(name => aliases.includes(name))) return false;
  return isLiveRecording({ name: title, album: { name: album } }) === isLiveRecording({ name: item.trackName, album: { name: item.albumName } });
}
function lyricPayload(item) {
  const plainLyrics = typeof item.plainLyrics === "string" ? item.plainLyrics.slice(0, 100000) : "";
  const syncedLyrics = typeof item.syncedLyrics === "string" ? item.syncedLyrics.slice(0, 100000) : "";
  return { status: item.instrumental ? "instrumental" : plainLyrics || syncedLyrics ? "found" : "unavailable", plainLyrics, syncedLyrics };
}

// Keep the upstream fixed and cache a bounded amount of public lyric data.
const lyricsCache = new Map();
app.get("/api/lyrics", async (req, res) => {
  const text = (key) => typeof req.query[key] === "string" ? req.query[key].trim() : "";
  const title = text("title"), artist = text("artist"), album = text("album");
  const duration = Number(req.query.duration);
  if (!title || !artist || !album || [title, artist, album].some(v => v.length > 300) || !Number.isFinite(duration) || duration < 1 || duration > 3600) {
    return res.status(400).json({ error: "歌詞を探すための曲情報が不足しています。" });
  }
  const params = new URLSearchParams({ track_name: title, artist_name: artist, album_name: album, duration: String(duration) });
  const key = params.toString();
  const cached = lyricsCache.get(key);
  if (cached && cached.until > Date.now()) return res.json(cached.data);
  try {
    // Both requests share one deadline, including response body reads.
    const options = {
      headers: { "User-Agent": "MusicPicker/1.0 (https://github.com/nisshinn/music-picker-app)" },
      signal: AbortSignal.timeout(8000),
    };
    const query = { title, artist, album, duration };
    const upstream = await fetch(`https://lrclib.net/api/get?${params}`, options);
    let data = { status: "unavailable" };
    if (upstream.status !== 404) {
      if (!upstream.ok) return res.status(502).json({ error: "歌詞を取得できませんでした。時間をおいて再度お試しください。" });
      const item = await upstream.json();
      if (matchesLyricRecording(item, query)) data = lyricPayload(item);
    }
    if (data.status === "unavailable") {
      // Album names vary across regions/releases. Search without the album,
      // but retain title/version, artist and LRCLIB's ±2-second duration check.
      const searchParams = new URLSearchParams({ track_name: title, artist_name: artist });
      const search = await fetch(`https://lrclib.net/api/search?${searchParams}`, options);
      if (search.status !== 404) {
        if (!search.ok) return res.status(502).json({ error: "歌詞を取得できませんでした。時間をおいて再度お試しください。" });
        const results = await search.json();
        if (!Array.isArray(results)) throw new Error("Invalid lyric search response");
        const candidates = results.filter(item => matchesLyricRecording(item, query) && lyricPayload(item).status !== "unavailable");
        const score = item => (normalizeLyricName(item.albumName) === normalizeLyricName(album) ? 8 : 0)
          + (item.syncedLyrics ? 4 : 0) - Math.abs(item.duration - duration);
        candidates.sort((a, b) => score(b) - score(a));
        if (candidates.length) data = lyricPayload(candidates[0]);
      }
    }
    if (lyricsCache.size >= 100) lyricsCache.delete(lyricsCache.keys().next().value);
    lyricsCache.set(key, { data, until: Date.now() + (data.status === "unavailable" ? 60000 : 3600000) });
    res.json(data);
  } catch {
    res.status(502).json({ error: "歌詞サービスに接続できませんでした。再読み込みをお試しください。" });
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
    let tracks = items
      .filter((track) => track.artists?.some((a) => a.id === artistId) && matchesRecordingVersion(track, req.query.recordingVersion))
      .map(formatTrack);
    tracks = uniqueTracks(tracks);

    const excludedParam = req.query.excluded ? req.query.excluded.split(",").filter((u) => u.startsWith("spotify:track:")) : [];
    if (excludedParam.length > 0) {
      const excSet = new Set(excludedParam);
      const remaining = tracks.filter((t) => !excSet.has(t.uri));
      if (remaining.length >= 5) {
        tracks = remaining;
      }
    }

    const mood = String(req.query.mood || "").trim();
    if (mood && tracks.length >= 5 && process.env.GEMINI_API_KEY) {
      try {
        const candidateSubset = tracks.slice(0, 30);
        const rankPrompt = `ユーザーの今の気分・シチュエーション: 「${mood}」
アーティスト: 「${artist.name}」

候補曲リスト（インデックス付き）:
${JSON.stringify(candidateSubset.map((c, i) => ({ index: i, title: c.title })))}

上記候補曲リストの中から、今の気分「${mood}」に最もよく合う5曲を厳選してください。
気分が「楽しい」「テンション高い」ならアップテンポや明るい・盛り上がる曲、「落ち着きたい」なら静かでリラックスできる曲・バラード、「しんみり」なら切ない曲・心に染みる曲など、気分の感情・テンポ・世界観に最もふさわしい曲を選んで、その順に並べてください。
各曲について、今の気分に合う推薦理由(reason: 日本語で2〜3文)と雰囲気タグ(vibeKeywords: 3つ)をつけて、以下のJSONフォーマットのみで出力してください:
{
  "curatorNote": "気分の特徴と選曲理由のメッセージ（1〜2文）",
  "selected": [
    {
      "index": 候補のインデックス番号,
      "reason": "推薦理由",
      "vibeKeywords": ["タグ1", "タグ2", "タグ3"]
    }
  ]
}`;

        const raw = await generateContentWithRetry(rankPrompt, "あなたはプロの音楽キュレーターAIです。必ず提示された候補曲リストから、今の気分に最も調和する5曲を選定してください。");
        const parsed = JSON.parse(raw.replace(/^```json/i, "").replace(/```$/i, "").trim());
        if (Array.isArray(parsed.selected) && parsed.selected.length > 0) {
          const selectedTracks = [];
          const usedUris = new Set();
          for (const item of parsed.selected) {
            const cand = candidateSubset[item.index];
            if (cand && !usedUris.has(cand.uri)) {
              usedUris.add(cand.uri);
              cand.reason = item.reason || `「${mood}」の気分に調和するおすすめの曲です。`;
              cand.vibeKeywords = item.vibeKeywords || [];
              selectedTracks.push(cand);
            }
            if (selectedTracks.length >= 5) break;
          }
          if (selectedTracks.length > 0) {
            const remaining = tracks.filter((t) => !usedUris.has(t.uri));
            tracks = [...selectedTracks, ...remaining];
          }
        }
      } catch (aiError) {
        console.warn("AI mood selection for artist tracks error:", aiError.message);
      }
    }

    res.json(tracks.slice(0, 80));
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
    const q = String(req.query.q || "").trim().slice(0, 200);
    if (!q) return res.json({ tracks: [], artists: [], albums: [], next: false });
    const offset = Math.min(Math.max(parseInt(req.query.offset, 10) || 0, 0), 1000);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 10); // Spotifyは1回10件まで
    const token = await getSpotifyToken();
    const type = offset === 0 ? "track,artist,album" : "track";
    const data = await spotifyFetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}&offset=${offset}&market=JP`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    res.json({
      tracks: (data.tracks?.items || []).filter(Boolean).map(formatTrack),
      artists: (data.artists?.items || []).map((a) => ({
        id: a.id,
        name: a.name,
        image: a.images?.[0]?.url || "",
        spotifyUrl: a.external_urls?.spotify || "",
      })),
      albums: (data.albums?.items || []).map((alb) => ({
        id: alb.id,
        name: alb.name,
        releaseDate: alb.release_date || "",
        totalTracks: alb.total_tracks || 1,
        type: alb.album_type === "single" ? "Single" : "Album",
        artistName: (alb.artists || []).map(a => a.name).join(", "),
        image: alb.images?.[0]?.url || alb.images?.[1]?.url || "",
        spotifyUrl: alb.external_urls?.spotify || `https://open.spotify.com/album/${alb.id}`,
      })),
      next: Boolean(data.tracks?.next),
      offset,
    });
  } catch (error) {
    sendApiError(res, error);
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
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(req.params.playlistId)}/items?limit=50`,
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

    await spotifyFetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlist.id)}/items`, {
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
  const models = ["gemini-flash-latest", "gemini-3.8-flash", "gemini-3.1-flash-lite"];

  for (const model of models) {
    try {
      const call = ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction || undefined,
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Gemini request timed out")), 5000)
      );
      const response = await Promise.race([call, timeoutPromise]);
      if (response && response.text) return response.text.trim();
    } catch (err) {
      console.warn(`Model ${model} failed or timed out:`, err?.message || err);
      continue;
    }
  }
  throw new Error("Gemini AI APIが現在混み合っています。少し時間をおいて再試行してください。");
}

app.post("/api/gemini/analyze-mood", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim().slice(0, 300);
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

    let parsed;
    try {
      const raw = await generateContentWithRetry(prompt, systemInstruction);
      parsed = JSON.parse(raw.replace(/^```json/i, "").replace(/```$/i, "").trim());
    } catch (err) {
      console.warn("Analyze mood fallback:", err.message);
      parsed = {
        summary: `「${text}」の気分にぴったりの曲を選曲します`,
        mood: text,
        energy: 3,
        positivity: 3,
        keywords: [text, "人気曲", "おすすめ"],
        searchQueries: [text]
      };
    }
    res.json({ success: true, analysis: parsed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/recommend-from-mood", async (req, res) => {
  try {
    const { artistId, artistName, genre } = req.body;
    const text = String(req.body.text || "").trim().slice(0, 300);
    if (!text) return res.status(400).json({ error: "気分を入力してください。" });

    const excluded = new Set((Array.isArray(req.body.excludedTrackUris) ? req.body.excludedTrackUris : [])
      .slice(0, 100).filter((uri) => typeof uri === "string" && /^spotify:track:[a-zA-Z0-9]+$/.test(uri)));
    const version = ["live", "studio"].includes(req.body.recordingVersion) ? req.body.recordingVersion : "all";
    const eligible = (track) => matchesRecordingVersion(track, version) && !excluded.has(track.uri || `spotify:track:${track.id}`) && !excluded.has(track.linked_from?.uri);
    let analysis = req.body?.analysis;
    if (!analysis) {
      try {
        const raw = await generateContentWithRetry(`気分:「${text}」を分析してJSONを出力してください: {"summary":"...","mood":"楽しい/落ち着きたい/等","energy":3,"positivity":3,"keywords":["..."],"searchQueries":["..."]}`);
        analysis = JSON.parse(raw.replace(/^```json/i, "").replace(/```$/i, "").trim());
      } catch (err) {
        console.warn("Mood analysis inline fallback:", err.message);
        analysis = {
          summary: `${text}の気分`,
          mood: text,
          energy: 3,
          positivity: 3,
          keywords: [text, "J-Pop", "人気"],
          searchQueries: [text]
        };
      }
    }

    const token = await getSpotifyToken();
    let rawTracks = [];
    const genreName = String(genre || "").trim().slice(0, 80).replace(/["\\]/g, "");
    const genreFilter = genreName ? ` genre:"${genreName}"` : "";

    const artists = Array.isArray(req.body.artists) && req.body.artists.length > 0
      ? req.body.artists
      : (artistId ? [{ id: artistId, name: artistName }] : []);

    if (artists.length > 0) {
      if (artists.length === 1) {
        const items = await get80Tracks(token, `artist:"${String(artists[0].name || "").replace(/["\\]/g, "")}"${genreFilter}`);
        rawTracks = items.filter((t) => !artists[0].id || t.artists?.some((a) => a.id === artists[0].id));
      } else {
        const results = await Promise.all(
          artists.map(async (art) => {
            try {
              const items = await get80Tracks(token, `artist:"${String(art.name || "").replace(/["\\]/g, "")}"${genreFilter}`);
              return items.filter((t) => !art.id || t.artists?.some((a) => a.id === art.id));
            } catch {
              return [];
            }
          })
        );
        rawTracks = results.flat();
      }
    } else {
      const qList = [
        `${genreFilter || "J-Pop"} ${(analysis.keywords || []).join(" ")}`,
        ...(analysis.searchQueries || []).map((q) => `${genreFilter} ${q}`),
      ];
      for (const q of qList.slice(0, 3)) {
        for (let offset = 0; offset < (excluded.size || version !== "all" ? 80 : 10); offset += 10) {
          const data = await searchSpotifyTracks(token, q.trim(), 10, offset);
          const items = data.tracks?.items || [];
          rawTracks.push(...items);
          if (items.length < 10 || uniqueTracks(rawTracks).filter(eligible).length >= 30) break;
        }
      }
    }

    let candidates = uniqueTracks(rawTracks).filter(eligible).map(formatTrack).filter((t) => t.uri).slice(0, 30);
    if (candidates.length < 5 && version === "all" && !excluded.size) {
      try {
        const fbRes = await searchSpotifyTracks(token, "J-Pop", 10, 0);
        const fbItems = (fbRes.tracks?.items || []).filter(eligible).map(formatTrack).filter((t) => t.uri);
        candidates = uniqueTracks([...candidates, ...fbItems]).slice(0, 30);
      } catch {}
    }

    if (candidates.length < 5) {
      return res.status(404).json({ error: version !== "all" ? "指定したバージョンの候補が不足しています。条件を変えるか、曲のバージョンを「指定なし」にしてください。" : excluded.size ? "最近聴いた曲を除くと候補が不足しています。条件を変えるか、「最近聴いた曲を除外」をオフにしてください。" : "候補曲が不足しています。ジャンルを「おまかせ」に戻すか、別の気分やアーティストをお試しください。" });
    }

    const artistMixLabel = artists.length > 1 ? `希望アーティスト（ミックス）: 「${artists.map((a) => a.name).join(" × ")}」\n` : (artists.length === 1 ? `希望アーティスト: 「${artists[0].name}」\n` : "");
    const rankPrompt = `ユーザーの気分: 「${text}」
希望ジャンル: ${genreName || "指定なし"}
${artistMixLabel}分析データ: ${JSON.stringify(analysis)}
Spotify候補曲リスト:
${JSON.stringify(candidates.map((c, i) => ({ index: i, title: c.title, artist: c.artist })))}

上記候補曲リストの中から、今の気分に最も合う5曲を厳選し、${artists.length > 1 ? "指定されたアーティストの楽曲をできるだけバランスよくミックスして選定し、" : ""}各曲の推薦理由(reason: 日本語で2〜3文)と雰囲気タグ(vibeKeywords: 3つ)をつけて以下のJSONのみで出力してください:
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

    let rankData;
    try {
      const rawRank = await generateContentWithRetry(rankPrompt, "あなたはプロの音楽キュレーターです。候補曲リストにある曲のみを選んでください。");
      rankData = JSON.parse(rawRank.replace(/^```json/i, "").replace(/```$/i, "").trim());
    } catch (e) {
      console.warn("Gemini AI ranking fallback used:", e.message);
      rankData = {
        curatorNote: `「${text}」の気分に合わせて、人気楽曲からバランス良く5曲をセレクトしました。`,
        selected: candidates.slice(0, 5).map((c, i) => ({
          index: i,
          reason: `今の「${text}」な気分に心地よく寄り添うおすすめのナンバーです。`,
          genre: c.genre || "J-Pop",
          tempo: "ミディアム",
          vibeKeywords: analysis?.keywords || ["おすすめ", "人気曲"]
        }))
      };
    }

    const selectedTracks = [];
    const reasons = [];

    for (const item of rankData?.selected || []) {
      const cand = candidates[item.index];
      if (cand && !selectedTracks.some((track) => track.uri === cand.uri)) {
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
