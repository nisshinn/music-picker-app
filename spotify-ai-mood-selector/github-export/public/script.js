// ============================================================
// Music Picker - script.js (Hybrid Complete Edition)
// ============================================================

const LIBRARY_PLAYLISTS_KEY = "music_picker_playlists";

let trackEndTimer = null;
let trackChangeLock = false;
let playbackGeneration = 0;
let selectedMood = "";
let aiMoodText = "";
let aiMoodAnalysis = null;
let aiCuratorNote = "";
let selectedGenre = "all";

let selectedArtistId = "";
let selectedArtistName = "";
let selectedArtistImage = "";

let previousSongs = [];
let currentPlaylist = [];
let currentTrackIndex = 0;
let isPlaylistMode = false;
let currentTrackData = null;

let spotifyPlayer = null;
let spotifyDeviceId = "";
let spotifyToken = "";

let searchRequestId = 0;
let playbackRequestId = 0;
let volumeInitialized = false;

const APP_SETTINGS_DEFAULTS = {
  theme: "ocean",
  background: "default",
  animation: true,
  autoplay: true,
  shuffle: false,
  repeat: "off",
  alwaysShowPlayer: false,
  notifications: true,
};

let appSettings = { ...APP_SETTINGS_DEFAULTS };

const STORAGE_KEYS = {
  theme: "music_picker_theme",
  background: "music_picker_background",
  animation: "music_picker_animation",
  autoplay: "music_picker_autoplay",
  shuffle: "music_picker_shuffle",
  repeat: "music_picker_repeat",
  alwaysShowPlayer: "music_picker_player_always_visible",
  notifications: "music_picker_notifications",
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("Music Picker Hybrid Script Initialized");

  initLogout();
  try {
    previousSongs = JSON.parse(localStorage.getItem("previousSongs") || "[]");
    if (!Array.isArray(previousSongs)) previousSongs = [];
  } catch (_) {
    previousSongs = [];
  }

  loadAppSettings();
  applyAppSettings();
  initMenu();
  initBottomNav();
  initHome();
  initSearch();
  initSettings();
  initTheme();
  initMenuSettings();
  initPlayerControls();
  initSpotify();
  initSpotifyLoginButton();
  updateLibraryPage();
  initLibraryAccordion();
  updateHistoryPage();
  updateMenuPlayerEmptyState();
});

function loadAppSettings() {
  appSettings.theme = localStorage.getItem(STORAGE_KEYS.theme) || APP_SETTINGS_DEFAULTS.theme;
  appSettings.animation = localStorage.getItem(STORAGE_KEYS.animation) !== "false";
  appSettings.autoplay = localStorage.getItem(STORAGE_KEYS.autoplay) !== "false";
  appSettings.shuffle = localStorage.getItem(STORAGE_KEYS.shuffle) === "true";
  appSettings.repeat = localStorage.getItem(STORAGE_KEYS.repeat) || "off";
  appSettings.alwaysShowPlayer = localStorage.getItem(STORAGE_KEYS.alwaysShowPlayer) === "true";
}

function saveAppSetting(key, value) {
  appSettings[key] = value;
  const storageKey = STORAGE_KEYS[key];
  if (storageKey) localStorage.setItem(storageKey, String(value));
}

function applyAppSettings() {
  document.body.dataset.theme = appSettings.theme;
}

// -------------------------------------------------------------
// Spotify Popup & Redirect Login Handling
// -------------------------------------------------------------
function initSpotifyLoginButton() {
  const btn = document.getElementById("spotifyLoginButton");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    // Open popup immediately to avoid browser popup blockers
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      "about:blank",
      "spotify_login_popup",
      `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no`
    );

    try {
      const res = await fetch(`/api/auth/spotify/url?origin=${encodeURIComponent(window.location.origin)}`);
      const data = await res.json();

      if (data?.url) {
        if (popup && !popup.closed) {
          popup.location.href = data.url;
        } else {
          window.location.href = data.url;
        }
      } else {
        window.location.href = "/auth/login";
      }
    } catch {
      window.location.href = "/auth/login";
    }
  });

  window.addEventListener("message", (event) => {
    if (event.data?.type === "SPOTIFY_AUTH_SUCCESS") {
      const token = event.data.tokens?.access_token;
      if (token) {
        localStorage.setItem("spotifyAccessToken", token);
        spotifyToken = token;
        showSpotifyStatus("✓ Spotify接続完了！");
        showToast("🎵 Spotifyにログインしました！");
        setupSpotifyPlayer();
      }
    }
  });
}

function initBottomNav() {
  document.querySelectorAll(".bottom-nav-link").forEach((link) => {
    link.addEventListener("click", () => showPage(link.dataset.page));
  });
}

function initMenu() {
  const menuButton = document.getElementById("menuButton");
  const closeButton = document.getElementById("menuCloseButton");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("menuOverlay");

  if (!menuButton || !sideMenu) return;

  menuButton.addEventListener("click", () => {
    sideMenu.classList.toggle("open");
    overlay?.classList.toggle("open");
  });

  closeButton?.addEventListener("click", () => {
    sideMenu.classList.remove("open");
    overlay?.classList.remove("open");
  });

  overlay?.addEventListener("click", () => {
    sideMenu.classList.remove("open");
    overlay?.classList.remove("open");
  });

  document.querySelectorAll(".menu-link").forEach((link) => {
    link.addEventListener("click", () => {
      showPage(link.dataset.page);
      sideMenu.classList.remove("open");
      overlay?.classList.remove("open");
    });
  });
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active-page"));
  const page = document.getElementById(pageId);
  if (page) page.classList.add("active-page");

  document.querySelectorAll(".menu-link").forEach((l) => l.classList.toggle("active", l.dataset.page === pageId));
  document.querySelectorAll(".bottom-nav-link").forEach((l) => l.classList.toggle("active", l.dataset.page === pageId));

  if (pageId === "favoritesPage") updateLibraryPage();
  if (pageId === "historyPage") updateHistoryPage();
}

// -------------------------------------------------------------
// Home Screen (Mood, Artist, Genre, Gemini AI integration)
// -------------------------------------------------------------
function initHome() {
  const moodButtons = document.querySelectorAll(".moods button");
  moodButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      moodButtons.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedMood = btn.dataset.mood || btn.textContent.trim();
      const freeInput = document.getElementById("freeMoodInput");
      if (freeInput) freeInput.value = "";
      aiMoodText = "";
      aiMoodAnalysis = null;
    });
  });

  const genre = document.getElementById("genre");
  if (genre) {
    selectedGenre = genre.value || "all";
    genre.addEventListener("change", () => {
      selectedGenre = genre.value;
    });
  }

  const freeMoodInput = document.getElementById("freeMoodInput");
  const aiMoodButton = document.getElementById("aiMoodButton");
  const aiMoodResult = document.getElementById("aiMoodResult");

  if (freeMoodInput) {
    freeMoodInput.addEventListener("input", () => {
      aiMoodText = freeMoodInput.value.trim();
      if (aiMoodText) {
        moodButtons.forEach((b) => b.classList.remove("selected"));
        selectedMood = "";
      }
    });
  }

  if (aiMoodButton) {
    aiMoodButton.addEventListener("click", async () => {
      const text = freeMoodInput?.value.trim() || "";
      if (!text) {
        alert("今の気分を入力してください。");
        freeMoodInput?.focus();
        return;
      }
      aiMoodText = text;
      aiMoodButton.disabled = true;
      aiMoodButton.textContent = "🤖 AIが分析中...";
      if (aiMoodResult) aiMoodResult.innerHTML = `<div class="loading">気分を分析しています...</div>`;

      try {
        const res = await fetch("/api/gemini/analyze-mood", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (!res.ok || !data.analysis) throw new Error(data.error || "分析に失敗しました。");

        aiMoodAnalysis = data.analysis;
        selectedMood = aiMoodAnalysis.mood || "その他";

        if (aiMoodResult) {
          const kw = (aiMoodAnalysis.keywords || []).join(" ・ ");
          aiMoodResult.innerHTML = `
            <div style="font-weight:bold;color:#00e676;margin-top:8px;">✓ AI分析完了: ${escapeHtml(aiMoodAnalysis.summary)}</div>
            <div style="font-size:11px;color:#a8b5b5;margin-top:3px;">エネルギー: ${aiMoodAnalysis.energy}/5 | 明るさ: ${aiMoodAnalysis.positivity}/5 ${kw ? `| タグ: ${escapeHtml(kw)}` : ""}</div>
          `;
        }
        showToast("🤖 気分をAIが分析しました");
      } catch (e) {
        if (aiMoodResult) aiMoodResult.innerHTML = `<div style="color:#ff5252;font-size:11px;margin-top:6px;">${escapeHtml(e.message)}</div>`;
      } finally {
        aiMoodButton.disabled = false;
        aiMoodButton.textContent = "🤖 AIに気分を分析してもらう";
      }
    });
  }

  initArtistSearch();

  const makeButton = document.getElementById("makePlaylist");
  if (makeButton) makeButton.addEventListener("click", makePlaylist);
}

function initArtistSearch() {
  const input = document.getElementById("artistSearch");
  const results = document.getElementById("artistResults");
  const selected = document.getElementById("selectedArtist");
  if (!input || !results) return;

  input.addEventListener("input", async () => {
    const keyword = input.value.trim();
    if (!keyword) {
      results.innerHTML = "";
      return;
    }
    try {
      const res = await fetch(`/api/artists?q=${encodeURIComponent(keyword)}`);
      const artists = await res.json();
      results.innerHTML = "";
      if (!Array.isArray(artists) || !artists.length) {
        results.innerHTML = `<div style="padding:8px;font-size:11px;color:#888;">見つかりませんでした</div>`;
        return;
      }
      artists.forEach((a) => {
        const item = document.createElement("div");
        item.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px;cursor:pointer;border-bottom:1px solid #222;";
        item.innerHTML = `
          ${a.image ? `<img src="${a.image}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">` : ""}
          <span style="font-size:12px;">${escapeHtml(a.name)}</span>
        `;
        item.addEventListener("click", () => {
          selectedArtistId = a.id;
          selectedArtistName = a.name;
          selectedArtistImage = a.image;
          results.innerHTML = "";
          input.value = "";
          if (selected) {
            selected.style.display = "flex";
            selected.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:8px;padding:6px 10px;background:#18221e;border:1px solid #00e676;border-radius:8px;";
            selected.innerHTML = `
              <span style="font-size:12px;color:#00e676;font-weight:bold;">✓ 選択中: ${escapeHtml(a.name)}</span>
              <button type="button" style="margin-left:auto;background:none;border:none;color:#aaa;cursor:pointer;" onclick="clearSelectedArtist()">×</button>
            `;
          }
        });
        results.appendChild(item);
      });
    } catch {}
  });
}

window.clearSelectedArtist = function () {
  selectedArtistId = "";
  selectedArtistName = "";
  selectedArtistImage = "";
  const s = document.getElementById("selectedArtist");
  if (s) {
    s.innerHTML = "";
    s.style.display = "none";
  }
};

// -------------------------------------------------------------
// Make Playlist: AI Curator & Hybrid Logic
// -------------------------------------------------------------
async function makePlaylist() {
  const text = aiMoodText || selectedMood;
  if (!text) {
    alert("気分を選択するか、自由に入力してください。");
    return;
  }

  const btn = document.getElementById("makePlaylist");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "🎵 Gemini AIが曲を厳選中...";
  }

  try {
    let tracks = [];
    aiCuratorNote = "";

    // 1. If user entered free text mood, use Hybrid Gemini Recommendation
    if (aiMoodText || !selectedArtistId) {
      const res = await fetch("/api/gemini/recommend-from-mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          analysis: aiMoodAnalysis,
          artistId: selectedArtistId,
          artistName: selectedArtistName,
          genre: selectedGenre !== "all" ? selectedGenre : "",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "選曲に失敗しました。");
      tracks = data.tracks || [];
      aiCuratorNote = data.curatorNote || "";
    } else if (selectedArtistId) {
      // 2. Direct artist catalogue query
      const res = await fetch(`/api/artist-tracks?id=${encodeURIComponent(selectedArtistId)}&mood=${encodeURIComponent(text)}`);
      tracks = await res.json();
    }

    tracks = normalizeTracks(tracks).slice(0, 5);

    if (tracks.length === 0) {
      throw new Error("条件に合う曲が見つかりませんでした。別の気分やアーティストをお試しください。");
    }

    currentPlaylist = tracks;
    currentTrackIndex = 0;
    isPlaylistMode = true;

    saveToHistory(tracks);
    displayPlaylist(tracks);
    showToast("🎵 新しいおすすめ5曲を作りました！");
  } catch (err) {
    alert(err.message || "プレイリスト作成に失敗しました。");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "🎵 おすすめ5曲を選ぶ";
    }
  }
}

function displayPlaylist(playlist) {
  const container = document.getElementById("playlist");
  if (!container) return;
  container.innerHTML = "";

  if (aiCuratorNote) {
    const note = document.createElement("div");
    note.className = "ai-curator-note";
    note.innerHTML = `
      <div class="ai-curator-note-title">✨ Gemini AI キュレーターのメッセージ</div>
      <div>${escapeHtml(aiCuratorNote)}</div>
    `;
    container.appendChild(note);
  }

  const header = document.createElement("div");
  header.className = "playlist-header";
  header.innerHTML = `
    <h2 style="font-size:16px;margin:0;">🎵 ${escapeHtml(selectedMood || "AIおすすめ")} プレイリスト</h2>
  `;
  const playAll = document.createElement("button");
  playAll.className = "play-all-button";
  playAll.textContent = "▶ まとめて再生";
  playAll.style.cssText = "background:#00e676;color:#000;border:0;border-radius:999px;padding:6px 14px;font-weight:bold;cursor:pointer;";
  playAll.addEventListener("click", () => {
    currentPlaylist = playlist;
    currentTrackIndex = 0;
    isPlaylistMode = true;
    playTrack(playlist[0], 0, true);
  });
  header.appendChild(playAll);
  container.appendChild(header);

  // Spotify 一括保存ボタン
  const saveBtn = document.createElement("button");
  saveBtn.className = "spotify-save-button";
  saveBtn.textContent = "🎵 Spotifyのプレイリストに一括保存";
  saveBtn.addEventListener("click", () => openSpotifySaveModal(playlist));
  container.appendChild(saveBtn);

  // 曲カード
  playlist.forEach((track, index) => {
    container.appendChild(createTrackCard(track, index));
  });
}

function createTrackCard(track, index) {
  track = normalizeTrack(track);
  const card = document.createElement("div");
  card.className = "track-card";

  const img = document.createElement("img");
  img.className = "track-image";
  img.src = track.image || "";
  img.alt = track.title || "";
  img.onerror = () => (img.style.display = "none");

  const info = document.createElement("div");
  info.className = "track-info";
  info.innerHTML = `
    <div class="track-title">${escapeHtml(track.title)}</div>
    <div class="track-artist">${escapeHtml(getArtistText(track))}</div>
    ${track.reason ? `<div class="track-reason">💡 ${escapeHtml(track.reason)}</div>` : ""}
    ${
      track.vibeKeywords && track.vibeKeywords.length
        ? `<div class="track-tags">${track.vibeKeywords
            .map((k) => `<span class="track-tag">#${escapeHtml(k)}</span>`)
            .join("")}</div>`
        : ""
    }
  `;

  const actions = document.createElement("div");
  actions.className = "track-actions";

  const playBtn = document.createElement("button");
  playBtn.className = "track-play-button";
  playBtn.textContent = "▶";
  playBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    currentPlaylist = [track];
    currentTrackIndex = 0;
    isPlaylistMode = false;
    playTrack(track, 0, false);
  });

  const favBtn = document.createElement("button");
  favBtn.className = "favorite-button";
  updateFavoriteButton(favBtn, track);
  favBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFavorite(track);
    updateFavoriteButton(favBtn, track);
  });

  const spotLink = document.createElement("a");
  spotLink.className = "spotify-button";
  spotLink.textContent = "Spotify";
  spotLink.target = "_blank";
  spotLink.rel = "noopener noreferrer";
  spotLink.href = track.spotifyUrl || `https://open.spotify.com/track/${track.id}`;
  spotLink.addEventListener("click", (e) => e.stopPropagation());

  actions.appendChild(playBtn);
  actions.appendChild(favBtn);
  actions.appendChild(spotLink);

  card.appendChild(img);
  card.appendChild(info);
  card.appendChild(actions);

  card.addEventListener("click", () => {
    currentPlaylist = [track];
    currentTrackIndex = 0;
    isPlaylistMode = false;
    playTrack(track, 0, false);
  });

  return card;
}

// -------------------------------------------------------------
// Playback Engine & Spotify Web Playback SDK
// -------------------------------------------------------------
async function getFreshSpotifyToken(force = false) {
  try {
    const res = await fetch(`/api/spotify-token${force ? "?force=1" : ""}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.accessToken) {
      spotifyToken = localStorage.getItem("spotifyAccessToken") || "";
      return spotifyToken;
    }
    spotifyToken = data.accessToken;
    localStorage.setItem("spotifyAccessToken", spotifyToken);
    return spotifyToken;
  } catch {
    return localStorage.getItem("spotifyAccessToken") || "";
  }
}

async function playTrack(track, index = 0, playlistMode = false) {
  track = normalizeTrack(track);
  if (!track || !track.uri) {
    alert("この曲は再生できません。");
    return;
  }

  spotifyToken = await getFreshSpotifyToken(false);
  if (!spotifyToken) {
    alert("SpotifyにログインするとWebブラウザ上でフル再生ができます。");
    const loginBtn = document.getElementById("spotifyLoginButton");
    loginBtn?.click();
    return;
  }

  if (!spotifyPlayer) setupSpotifyPlayer();

  currentTrackData = track;
  currentTrackIndex = index;
  isPlaylistMode = playlistMode;

  showPlayerPanel();
  updatePlayerInfo(track);
  updateMediaSession(track);

  try {
    const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(spotifyDeviceId)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${spotifyToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: [track.uri], position_ms: 0 }),
    });

    if (!res.ok && res.status !== 204) {
      console.warn("Spotify再生エラー:", res.status);
    }
  } catch (err) {
    console.error("Play Track Error:", err);
  }
}

function setupSpotifyPlayer() {
  if (spotifyPlayer || !window.Spotify) return;

  spotifyToken = localStorage.getItem("spotifyAccessToken") || "";
  if (!spotifyToken) return;

  spotifyPlayer = new Spotify.Player({
    name: "Music Picker",
    getOAuthToken: async (cb) => {
      const t = (await getFreshSpotifyToken(false)) || localStorage.getItem("spotifyAccessToken") || "";
      cb(t);
    },
    volume: 0.5,
  });

  spotifyPlayer.addListener("ready", ({ device_id }) => {
    spotifyDeviceId = device_id;
    showSpotifyStatus("✓ Spotify接続済み");
  });

  spotifyPlayer.addListener("player_state_changed", (state) => {
    if (!state) return;
    updatePlayerState(state);
    const curr = state.track_window?.current_track;
    if (curr) {
      currentTrackData = normalizeTrack(curr);
      updatePlayerInfo(currentTrackData);
      updateMediaSession(currentTrackData);
    }
  });

  spotifyPlayer.connect();
}

window.onSpotifyWebPlaybackSDKReady = () => {
  setupSpotifyPlayer();
};

function initSpotify() {
  if (window.Spotify) setupSpotifyPlayer();
}

function showPlayerPanel() {
  const panel = document.getElementById("playerPanel");
  if (panel) panel.style.display = "block";
}

function updatePlayerInfo(track) {
  track = normalizeTrack(track);
  if (!track) return;
  const title = document.getElementById("playerTitle");
  const artist = document.getElementById("playerArtist");
  const img = document.getElementById("playerImage");

  if (title) title.textContent = track.title || "曲名なし";
  if (artist) artist.textContent = getArtistText(track);
  if (img) img.src = track.image || "";
}

function updatePlayerState(state) {
  const btn = document.getElementById("playPauseButton");
  if (btn) btn.textContent = state.paused ? "▶" : "⏸";

  const prog = document.getElementById("progressBar");
  if (prog && state.duration > 0) {
    prog.max = state.duration;
    prog.value = state.position;
  }
  const cur = document.getElementById("currentTime");
  const dur = document.getElementById("duration");
  if (cur) cur.textContent = formatTime(state.position);
  if (dur) dur.textContent = formatTime(state.duration);
}

function initPlayerControls() {
  document.getElementById("playPauseButton")?.addEventListener("click", () => {
    spotifyPlayer?.togglePlay();
  });
  document.getElementById("nextButton")?.addEventListener("click", () => {
    if (currentPlaylist.length > currentTrackIndex + 1) {
      currentTrackIndex++;
      playTrack(currentPlaylist[currentTrackIndex], currentTrackIndex, true);
    }
  });
  document.getElementById("previousButton")?.addEventListener("click", () => {
    if (currentTrackIndex > 0) {
      currentTrackIndex--;
      playTrack(currentPlaylist[currentTrackIndex], currentTrackIndex, true);
    }
  });
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function normalizeTrack(track) {
  if (!track) return null;
  const artists = Array.isArray(track.artists) ? track.artists : [];
  const artistName =
    track.artist ||
    track.artistName ||
    artists.map((a) => a?.name).filter(Boolean).join(", ") ||
    "";
  const title = track.title || track.name || "曲名なし";
  const id = track.id || (track.uri ? track.uri.replace("spotify:track:", "") : "");
  const uri = track.uri || (id ? `spotify:track:${id}` : "");
  const image =
    track.image ||
    track.albumArt ||
    track.album?.images?.[0]?.url ||
    track.album?.images?.[1]?.url ||
    track.images?.[0]?.url ||
    "";
  return {
    ...track,
    id,
    uri,
    title,
    artist: artistName,
    artists,
    image,
    spotifyUrl: track.spotifyUrl || `https://open.spotify.com/track/${id}`,
  };
}

function normalizeTracks(tracks) {
  return (Array.isArray(tracks) ? tracks : []).map(normalizeTrack).filter(Boolean);
}

function getArtistText(t) {
  return t?.artist || t?.artistName || (t?.artists || []).map((a) => a.name).join(", ") || "";
}

function showSpotifyStatus(msg) {
  const s = document.getElementById("spotifyStatus");
  if (s) s.textContent = msg;
}

function showToast(msg) {
  let t = document.getElementById("musicPickerToast");
  if (!t) {
    t = document.createElement("div");
    t.id = "musicPickerToast";
    t.style.cssText = "position:fixed;left:50%;bottom:95px;transform:translateX(-50%);z-index:99999;background:rgba(20,20,20,0.92);color:#fff;padding:10px 18px;border-radius:999px;font-size:12px;font-weight:bold;pointer-events:none;transition:opacity 0.2s;";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.style.opacity = "0"), 2000);
}

// -------------------------------------------------------------
// Spotify Playlist Save Modal
// -------------------------------------------------------------
function openSpotifySaveModal(playlist) {
  if (!playlist || !playlist.length) return;
  const old = document.getElementById("spotifySaveModal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "spotifySaveModal";
  modal.className = "spotify-save-modal";
  modal.innerHTML = `
    <div class="spotify-save-box">
      <button class="spotify-save-close" onclick="document.getElementById('spotifySaveModal').remove()">×</button>
      <h2>🎵 Spotifyに保存</h2>
      <p>このおすすめ5曲をあなたのSpotify公式アカウントに新しいプレイリストとして追加します。</p>
      <input type="text" id="spotifyPlaylistName" value="${escapeHtml(selectedMood ? `${selectedMood}のおすすめ5曲` : "Music Picker Favorites")}">
      <div class="spotify-public-options">
        <label><input type="radio" name="spotifyPub" value="false" checked> 🔒 非公開</label>
        <label><input type="radio" name="spotifyPub" value="true"> 🌎 公開</label>
      </div>
      <div class="spotify-save-actions">
        <button class="spotify-cancel-button" onclick="document.getElementById('spotifySaveModal').remove()">キャンセル</button>
        <button class="spotify-confirm-button" id="confirmSaveSpotify">🎵 保存する</button>
      </div>
      <div id="spotifySaveStatus" style="font-size:11px;color:#00e676;margin-top:8px;"></div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("confirmSaveSpotify")?.addEventListener("click", async () => {
    const name = document.getElementById("spotifyPlaylistName")?.value || "Music Picker";
    const isPublic = document.querySelector('input[name="spotifyPub"]:checked')?.value === "true";
    const status = document.getElementById("spotifySaveStatus");
    if (status) status.textContent = "Spotifyに保存中...";

    try {
      const res = await fetch("/api/create-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, public: isPublic, tracks: playlist.map((t) => t.uri) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存に失敗しました。");

      if (status) {
        status.innerHTML = `✓ 保存完了！ <a href="${data.spotifyUrl}" target="_blank" style="color:#00e676;text-decoration:underline;">Spotifyで開く</a>`;
      }
      showToast("🎵 Spotifyに保存しました！");
    } catch (e) {
      if (status) status.innerHTML = `<span style="color:#ff5252;">${escapeHtml(e.message)}</span>`;
    }
  });
}

function updateMediaSession(track) {
  if (!("mediaSession" in navigator) || !track) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: getArtistText(track),
      artwork: track.image ? [{ src: track.image, sizes: "512x512", type: "image/jpeg" }] : [],
    });
  } catch {}
}

function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem("music_picker_favorites") || "[]");
  } catch {
    return [];
  }
}

function toggleFavorite(track) {
  let favs = getFavorites();
  const exists = favs.some((t) => t.uri === track.uri);
  if (exists) {
    favs = favs.filter((t) => t.uri !== track.uri);
    showToast("お気に入りから削除しました");
  } else {
    favs.unshift(track);
    showToast("❤️ お気に入りに追加しました");
  }
  localStorage.setItem("music_picker_favorites", JSON.stringify(favs));
}

function updateFavoriteButton(btn, track) {
  const exists = getFavorites().some((t) => t.uri === track.uri);
  btn.textContent = exists ? "❤️" : "♡";
  btn.classList.toggle("favorite-active", exists);
}

function saveToHistory(tracks) {
  let hist = [];
  try {
    hist = JSON.parse(localStorage.getItem("music_picker_history") || "[]");
  } catch {}
  tracks.forEach((t) => {
    hist = hist.filter((h) => h.uri !== t.uri);
    hist.unshift(t);
  });
  localStorage.setItem("music_picker_history", JSON.stringify(hist.slice(0, 50)));
}

function updateHistoryPage() {
  const c = document.getElementById("historyList");
  if (!c) return;
  let hist = [];
  try {
    hist = JSON.parse(localStorage.getItem("music_picker_history") || "[]");
  } catch {}
  c.innerHTML = "";
  if (!hist.length) {
    c.innerHTML = `<div style="padding:14px;color:#888;font-size:12px;">履歴はまだありません</div>`;
    return;
  }
  hist.forEach((t, i) => c.appendChild(createTrackCard(t, i)));
}

function updateLibraryPage() {
  const f = document.getElementById("favoritesList");
  if (f) {
    const favs = getFavorites();
    f.innerHTML = "";
    if (!favs.length) {
      f.innerHTML = `<div style="padding:14px;color:#888;font-size:12px;">お気に入りはまだありません</div>`;
    } else {
      favs.forEach((t, i) => f.appendChild(createTrackCard(t, i)));
    }
  }
}

function initSearch() {}
function initSettings() {}
function initTheme() {}
function initMenuSettings() {}
function initLibraryAccordion() {}
function updateMenuPlayerEmptyState() {}
function initLogout() {
  document.getElementById("logoutButton")?.addEventListener("click", async () => {
    if (!confirm("Spotifyからログアウトしますか？")) return;
    try {
      await fetch("/api/spotify-logout", { method: "POST" });
    } catch {}
    localStorage.removeItem("spotifyAccessToken");
    spotifyToken = "";
    spotifyDeviceId = "";
    spotifyPlayer?.disconnect();
    location.reload();
  });
}
