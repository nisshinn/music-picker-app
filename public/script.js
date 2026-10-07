// ============================================================
// Music Picker - script.js (Hybrid Complete Edition)
// ============================================================

const LIBRARY_PLAYLISTS_KEY = "music_picker_playlists";

let trackEndTimer = null;
let confirmationTimer = null;
let transitionPromise = null;
let playbackPending = false;
let managedTrackConfirmed = false;
let playbackStopped = false;
let playOrder = [];
let nextCycleOrder = null;
let playbackWrite = Promise.resolve();
let infiniteStarting = false;
let orderCursor = 0;
let infiniteMode = false;
let infiniteRequestId = 0;
let infiniteLoading = false;
let infinitePage = 0;
let infiniteRecent = [];
let infiniteCatalog = [];
let infiniteArtist = "";
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

// 再生状態の時計（Spotifyの状態変化は秒ごとには来ないため、自前で進める）
let playerClock = { position: 0, duration: 0, paused: true, ts: Date.now(), trackId: "" };
let isSeeking = false;
let progressTimer = null;
let endHandled = false;
let playlistLoadId = 0;
let playlistDetailLoadId = 0;
let spotifyQueue = [];
let queueStatus = "";
let queueRequestId = 0;
let localPlayback = false;
let fullPlayerFocus = null;

const APP_SETTINGS_DEFAULTS = {
  theme: "ocean",
  background: "default",
  animation: true,
  autoplay: true,
  shuffle: false,
  repeat: "off",
  alwaysShowPlayer: false,
  notifications: true,
  volume: 50,
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
  volume: "music_picker_volume",
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
  initFullPlayer();
  initSpotify();
  initSpotifyLoginButton();
  updateLibraryPage();
  initLibraryAccordion();
  document.getElementById("playlistBack")?.addEventListener("click", () => showPage("favoritesPage"));
  document.getElementById("fpQueueRefresh")?.addEventListener("click", () => refreshSpotifyQueue());
  updateHistoryPage();
  updateMenuPlayerEmptyState();
});

function loadAppSettings() {
  // ocean = ダークモードOFF(白) / night = ダークモードON(黒)。保存値が無ければOFF
  appSettings.theme = localStorage.getItem(STORAGE_KEYS.theme) === "night" ? "night" : "ocean";
  appSettings.animation = localStorage.getItem(STORAGE_KEYS.animation) !== "false";
  appSettings.autoplay = localStorage.getItem(STORAGE_KEYS.autoplay) !== "false";
  appSettings.shuffle = localStorage.getItem(STORAGE_KEYS.shuffle) === "true";
  appSettings.repeat = localStorage.getItem(STORAGE_KEYS.repeat) || "off";
  appSettings.alwaysShowPlayer = localStorage.getItem(STORAGE_KEYS.alwaysShowPlayer) === "true";
  const savedVolume = localStorage.getItem(STORAGE_KEYS.volume);
  const vol = Number(savedVolume);
  appSettings.volume = savedVolume !== null && Number.isFinite(vol) ? Math.min(100, Math.max(0, vol)) : APP_SETTINGS_DEFAULTS.volume;
}

function saveAppSetting(key, value) {
  appSettings[key] = value;
  const storageKey = STORAGE_KEYS[key];
  if (storageKey) localStorage.setItem(storageKey, String(value));
}

function applyAppSettings() {
  const theme = appSettings.theme === "night" ? "night" : "ocean";
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
  document.body.classList.toggle("no-animation", !appSettings.animation);
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
    if (event.origin === window.location.origin && event.data?.type === "SPOTIFY_AUTH_SUCCESS") {
      const token = event.data.tokens?.access_token;
      if (token) {
        localStorage.setItem("spotifyAccessToken", token);
        spotifyToken = token;
        showSpotifyStatus("✓ Spotify接続完了！");
        showToast("🎵 Spotifyにログインしました！");
        setupSpotifyPlayer();
        loadSpotifyPlaylists();
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
  if (!document.getElementById(pageId)) return;
  if (pageId !== "playlistDetailPage") playlistDetailLoadId++;
  const navPage = pageId === "playlistDetailPage" ? "favoritesPage" : pageId;
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active-page"));
  const page = document.getElementById(pageId);
  if (page) page.classList.add("active-page");

  document.querySelectorAll(".menu-link").forEach((l) => l.classList.toggle("active", l.dataset.page === navPage));
  document.querySelectorAll(".bottom-nav-link").forEach((l) => l.classList.toggle("active", l.dataset.page === navPage));

  if (pageId === "favoritesPage") {
    updateLibraryPage();
    loadSpotifyPlaylists();
  }
  if (pageId === "historyPage") updateHistoryPage();
  window.scrollTo(0, 0);
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
            <div class="ai-result-title">✓ AI分析完了: ${escapeHtml(aiMoodAnalysis.summary)}</div>
            <div class="ai-result-meta">エネルギー: ${aiMoodAnalysis.energy}/5 | 明るさ: ${aiMoodAnalysis.positivity}/5 ${kw ? `| タグ: ${escapeHtml(kw)}` : ""}</div>
          `;
        }
        showToast("🤖 気分をAIが分析しました");
      } catch (e) {
        if (aiMoodResult) aiMoodResult.innerHTML = `<div class="ai-result-error">${escapeHtml(e.message)}</div>`;
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
  if (!input || !results) return;

  let artistReq = 0;
  let debounce = null;

  input.addEventListener("input", () => {
    clearTimeout(debounce);
    const keyword = input.value.trim();
    if (!keyword) {
      artistReq++;
      results.innerHTML = "";
      return;
    }
    debounce = setTimeout(async () => {
      const reqId = ++artistReq;
      try {
        const res = await fetch(`/api/artists?q=${encodeURIComponent(keyword)}`);
        const artists = await res.json();
        if (reqId !== artistReq) return;
        results.innerHTML = "";
        if (!Array.isArray(artists) || !artists.length) {
          results.innerHTML = `<div class="artist-result empty">見つかりませんでした</div>`;
          return;
        }
        artists.forEach((a) => {
          const item = document.createElement("div");
          item.className = "artist-result";
          item.innerHTML = `${a.image ? `<img src="${escapeHtml(a.image)}" alt="">` : ""}<span>${escapeHtml(a.name)}</span>`;
          item.addEventListener("click", () => {
            selectedArtistId = a.id;
            selectedArtistName = a.name;
            selectedArtistImage = a.image || "";
            results.innerHTML = "";
            input.value = "";
            renderSelectedArtist();
          });
          results.appendChild(item);
        });
      } catch {}
    }, 250);
  });
}

function renderSelectedArtist() {
  const s = document.getElementById("selectedArtist");
  if (!s) return;
  s.style.display = "flex";
  s.innerHTML = `
    ${selectedArtistImage ? `<img src="${escapeHtml(selectedArtistImage)}" alt="">` : ""}
    <span class="selected-artist-name">✓ 選択中: ${escapeHtml(selectedArtistName)}</span>
    <button type="button" class="selected-artist-clear" aria-label="選択を解除" onclick="clearSelectedArtist()">×</button>
  `;
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
    startTrackList(playlist);
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
    container.appendChild(createTrackCard(track, index, playlist));
  });
}

function createTrackCard(track, index, queue = null, onPlay = null) {
  track = normalizeTrack(track);
  const card = document.createElement("div");
  card.className = "track-card";

  // 一覧の中の曲を押したら、その一覧を再生リストにして次/前の曲に進めるようにする
  const playFromCard = () => {
    if (onPlay) return onPlay();
    startTrackList(queue?.length ? queue : [track], queue?.length ? index : 0);
  };

  const img = document.createElement("img");
  img.className = "track-image";
  img.src = track.image || "";
  img.alt = track.title || "";
  // 画像が無い曲でもカードの列幅が崩れないよう、非表示ではなく透明にする
  img.onerror = () => (img.style.visibility = "hidden");
  if (!track.image) img.style.visibility = "hidden";

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
  playBtn.type = "button";
  playBtn.setAttribute("aria-label", `${track.title}を再生`);
  playBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    playFromCard();
  });

  const favBtn = document.createElement("button");
  favBtn.className = "favorite-button";
  favBtn.type = "button";
  favBtn.dataset.uri = track.uri || "";
  updateFavoriteButton(favBtn, track);
  favBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFavorite(track); // 内部で全画面のハートとライブラリを更新
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
    playFromCard();
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

function shuffleIndices(indices) {
  const result = [...indices];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function rebuildRemainingOrder() {
  nextCycleOrder = null;
  const past = playOrder.slice(0, orderCursor + 1);
  const remaining = playOrder.slice(orderCursor + 1);
  playOrder = [...past, ...(appSettings.shuffle ? shuffleIndices(remaining) : remaining.sort((a, b) => a - b))];
}

function startTrackList(tracks, index = 0) {
  if (!tracks?.length || !tracks[index]?.uri) return;
  playbackGeneration++;
  transitionPromise = null;
  setInfiniteMode(false);
  currentPlaylist = tracks.map(normalizeTrack);
  playOrder = currentPlaylist.map((_, i) => i);
  infinitePage = 0;
  infiniteRecent = [];
  infiniteCatalog = [];
  infiniteArtist = "";
  orderCursor = index;
  rebuildRemainingOrder();
  return playTrack(currentPlaylist[index], index, true);
}

async function playTrack(track, index = 0, playlistMode = false) {
  const requestId = ++playbackRequestId;
  clearTimeout(trackEndTimer);
  clearTimeout(confirmationTimer);
  playbackPending = true;
  managedTrackConfirmed = false;
  playbackStopped = false;
  track = normalizeTrack(track);
  if (!track?.uri) { playbackPending = false; return false; }
  // Must run during the click gesture on mobile browsers.
  spotifyPlayer?.activateElement?.().catch(() => {});
  spotifyToken = await getFreshSpotifyToken(false);
  if (requestId !== playbackRequestId) return false;
  if (!spotifyToken) {
    playbackPending = false;
    playbackStopped = true;
    spotifyPlayer?.pause().catch(() => {});
    showToast("Spotifyにログインしてから再生してください");
    return false;
  }
  if (!spotifyPlayer) setupSpotifyPlayer();
  await waitForDevice();
  if (requestId !== playbackRequestId) return false;
  if (!spotifyPlayer || !spotifyDeviceId) {
    playbackPending = false;
    playbackStopped = true;
    spotifyPlayer?.pause().catch(() => {});
    showToast("このブラウザの再生準備ができていません。Spotifyに再ログインしてお試しください");
    return false;
  }

  localPlayback = true;
  queueRequestId++;
  endHandled = false;
  currentTrackData = track;
  currentTrackIndex = index;
  isPlaylistMode = playlistMode;
  const cursor = playOrder.indexOf(index);
  if (cursor >= 0) orderCursor = cursor;
  resetPlayerClock(track.id);
  renderQueue();
  showPlayerPanel();
  updatePlayerInfo(track);
  updateMediaSession(track);
  // Send only the selected track. The app owns advancement, repeat and shuffle.
  try { await spotifyPlayer.pause(); } catch {
    if (requestId !== playbackRequestId) return false;
    playbackPending = false;
    playbackStopped = true;
    showToast("再生の切り替えに失敗しました。もう一度お試しください");
    return false;
  }
  if (requestId !== playbackRequestId) return false;
  const success = await startPlayback({ uris: [track.uri], position_ms: 0 });
  if (requestId !== playbackRequestId) return false;
  playbackPending = false;
  playbackStopped = !success;
  if (success) {
    saveToHistory([track]);
    const state = await spotifyPlayer.getCurrentState().catch(() => null);
    if (requestId === playbackRequestId && state) onSpotifyPlayerState(state);
    if (requestId === playbackRequestId && !managedTrackConfirmed) {
      confirmationTimer = setTimeout(() => {
        if (requestId !== playbackRequestId || managedTrackConfirmed) return;
        playbackStopped = true;
        spotifyPlayer?.pause().catch(() => {});
        setPlaybackIcon(true);
        showToast("選んだ曲の再生を確認できませんでした。再生ボタンでもう一度お試しください");
      }, 8000);
    }
  }
  return success;
}

// Stop Spotify autoplay (or its saved repeat mode) from changing the app's list.
function onSpotifyPlayerState(state) {
  if (!state) return;
  const track = state.track_window?.current_track;
  if (localPlayback) {
    if (playbackPending) return;
    if (playbackStopped || endHandled) {
      if (!state.paused) spotifyPlayer?.pause().catch(() => {});
      return;
    }
    const matches = track?.uri === currentTrackData?.uri || track?.linked_from?.uri === currentTrackData?.uri;
    if (!matches) {
      // The SDK may still report the old URI just after a successful play request.
      if (!managedTrackConfirmed) return;
      if (!state.paused) spotifyPlayer?.pause().catch(() => {});
      finishManagedTrack();
      return;
    }
    clearTimeout(confirmationTimer);
    managedTrackConfirmed = true;
    updatePlayerState(state);
    return;
  }
  updatePlayerState(state);
  if (track) {
    currentTrackData = normalizeTrack(track);
    showPlayerPanel();
    updatePlayerInfo(currentTrackData);
    updateMediaSession(currentTrackData);
  }
}

function scheduleTrackEnd() {
  clearTimeout(trackEndTimer);
  if (!localPlayback || playbackPending || playbackStopped || playerClock.paused || !playerClock.duration || endHandled) return;
  const generation = playbackGeneration;
  const requestId = playbackRequestId;
  trackEndTimer = setTimeout(() => {
    if (generation === playbackGeneration && requestId === playbackRequestId && !isSeeking) finishManagedTrack();
  }, Math.max(0, playerClock.duration - clockPosition()));
}

function finishManagedTrack() {
  if (endHandled || playbackPending || playbackStopped) return;
  endHandled = true;
  clearTimeout(trackEndTimer);
  const generation = playbackGeneration;
  const requestId = playbackRequestId;
  const pause = spotifyPlayer ? spotifyPlayer.pause() : Promise.resolve();
  return pause.then(() => {
    if (generation !== playbackGeneration || requestId !== playbackRequestId) return;
    playerClock = { ...playerClock, paused: true, position: playerClock.duration, ts: Date.now() };
    setPlaybackIcon(true);
    renderProgress(playerClock.position);
    return handleTrackEnded();
  }).catch(() => {
    if (generation !== playbackGeneration || requestId !== playbackRequestId) return;
    playbackStopped = true;
    showToast("再生を停止できませんでした。通信状況を確認してください");
  });
}

function setPlaybackIcon(paused) {
  const icon = paused ? "▶\uFE0E" : "⏸\uFE0E";
  ["playPauseButton", "menuPlayPauseButton", "fpPlay"].forEach(id => setText(id, icon));
}

function resetPlayerClock(trackId = "") {
  playerClock = { position: 0, duration: 0, paused: true, ts: Date.now(), trackId };
  renderProgress(0);
}

async function waitForDevice(timeout = 4000) {
  const start = Date.now();
  while (!spotifyDeviceId && Date.now() - start < timeout) {
    await new Promise((r) => setTimeout(r, 200));
  }
}

function startPlayback(body) {
  const requestId = playbackRequestId;
  const operation = playbackWrite.then(() => sendPlayback(body, requestId));
  playbackWrite = operation.catch(() => false);
  return operation;
}

async function sendPlayback(body, requestId) {
  if (requestId !== playbackRequestId) return false;
  const send = () =>
    fetch(`https://api.spotify.com/v1/me/player/play${spotifyDeviceId ? `?device_id=${encodeURIComponent(spotifyDeviceId)}` : ""}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${spotifyToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  try {
    let res = await send();
    if (res.status === 401) {
      spotifyToken = await getFreshSpotifyToken(true);
      if (requestId !== playbackRequestId) return false;
      res = await send();
    }
    if (!res.ok && res.status !== 204) {
      console.warn("Spotify再生エラー:", res.status);
      showToast(`再生できませんでした (${res.status})。Spotifyの接続・再生デバイスを確認してください`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Play Track Error:", err);
    showToast("再生できませんでした。通信状況を確認してください");
    return false;
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
    volume: appSettings.volume / 100,
  });

  spotifyPlayer.addListener("ready", ({ device_id }) => {
    spotifyDeviceId = device_id;
    spotifyPlayer.setVolume(appSettings.volume / 100).catch(() => {});
    showSpotifyStatus("✓ Spotify接続済み");
  });

  spotifyPlayer.addListener("player_state_changed", onSpotifyPlayerState);

  spotifyPlayer.addListener("not_ready", () => { spotifyDeviceId = ""; });
  ["initialization_error", "authentication_error", "account_error", "playback_error"].forEach((event) => {
    spotifyPlayer.addListener(event, () => showToast("Spotifyの再生接続を確認してください。ブラウザ再生にはPremiumが必要です"));
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

function updatePlayerVisibility() {
  const panel = document.getElementById("playerPanel");
  if (!panel) return;
  panel.style.display = appSettings.alwaysShowPlayer || currentTrackData ? "block" : "none";
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setNowPlaying(title, artist, image) {
  setText("playerTitle", title);
  setText("playerArtist", artist);
  setText("menuPlayerTitle", title);
  setText("menuPlayerArtist", artist);
  setText("fpTitle", title);
  setText("fpArtist", artist);
  ["playerImage", "menuPlayerImage", "fpImage"].forEach((id) => {
    const img = document.getElementById(id);
    if (img) img.src = image || "";
  });
}

function updatePlayerInfo(track) {
  track = normalizeTrack(track);
  if (!track) return;
  setNowPlaying(track.title || "曲名なし", getArtistText(track), track.image);

  const fav = document.getElementById("fpFav");
  if (fav) {
    fav.dataset.uri = track.uri || "";
    updateFavoriteButton(fav, { uri: track.uri });
  }
}

function clockPosition(c = playerClock) {
  if (c.paused) return c.position;
  const pos = c.position + (Date.now() - c.ts);
  return c.duration ? Math.min(c.duration, pos) : pos;
}

function renderProgress(pos) {
  const dur = playerClock.duration || 0;
  ["progressBar", "menuProgressBar", "fpProgress"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.max = dur;
    if (!isSeeking) el.value = pos;
  });
  const cur = formatTime(pos);
  const total = formatTime(dur);
  setText("currentTime", cur);
  setText("menuCurrentTime", cur);
  setText("duration", total);
  setText("menuDuration", total);
  setText("fpCurrent", cur);
  setText("fpDuration", total);
}

function updatePlayerState(state) {
  const before = playerClock;
  const expected = clockPosition(before);
  const curr = state.track_window?.current_track;
  // Spotify may repeat the same URI without first emitting a paused state.
  const restartedAtEnd = localPlayback && managedTrackConfirmed && !isSeeking && before.duration > 0 &&
    before.trackId === curr?.id && expected >= before.duration - 1500 && state.position < 1000;
  if (restartedAtEnd) { finishManagedTrack(); return; }
  playerClock = {
    position: state.position, duration: state.duration, paused: state.paused,
    ts: Date.now(), trackId: curr?.id || "",
  };
  setPlaybackIcon(state.paused);
  renderProgress(state.position);
  scheduleTrackEnd();
}

function startProgressTimer() {
  if (progressTimer) return;
  let tick = 0;
  progressTimer = setInterval(() => {
    if (isSeeking || playerClock.paused || !playerClock.duration) return;
    renderProgress(clockPosition());
    // 5秒ごとにSpotify本体の位置と合わせてズレを補正
    if (++tick % 20 === 0 && spotifyPlayer) {
      spotifyPlayer
        .getCurrentState()
        .then((st) => {
          if (st && !isSeeking) onSpotifyPlayerState(st);
        })
        .catch(() => {});
    }
  }, 250);
}

function bindSeekBar(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", () => {
    isSeeking = true;
    clearTimeout(trackEndTimer);
    const pos = Number(el.value);
    ["progressBar", "menuProgressBar", "fpProgress"].forEach((bid) => {
      const b = document.getElementById(bid);
      if (b && b !== el) b.value = pos;
    });
    const t = formatTime(pos);
    setText("currentTime", t);
    setText("menuCurrentTime", t);
    setText("fpCurrent", t);
  });
  el.addEventListener("change", async () => {
    const pos = Number(el.value);
    isSeeking = false;
    playerClock = { ...playerClock, position: pos, ts: Date.now() };
    renderProgress(pos);
    try {
      await spotifyPlayer?.seek(pos);
      scheduleTrackEnd();
    } catch { scheduleTrackEnd(); }
  });
}

function setVolume(value) {
  const v = Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
  saveAppSetting("volume", v);
  ["volumeBar", "menuVolumeBar", "fpVolume"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && Number(el.value) !== v) el.value = v;
  });
  setText("volumeValue", `${v}%`);
  setText("menuVolumeValue", `${v}%`);
  if (spotifyPlayer) spotifyPlayer.setVolume(v / 100).catch(() => {});
}

async function togglePlay() {
  if (infiniteLoading) { setInfiniteMode(false); return; }
  if (playbackPending) return;
  if (localPlayback && (playbackStopped || endHandled) && currentTrackData) {
    return playTrack(currentTrackData, currentTrackIndex, isPlaylistMode);
  }
  if (spotifyPlayer && currentTrackData) {
    try { await spotifyPlayer.togglePlay(); } catch { showToast("再生操作に失敗しました。通信状況を確認してください"); }
  } else if (currentPlaylist.length) {
    return startTrackList(currentPlaylist);
  }
}

function playNext() {
  if (!localPlayback || playbackPending || transitionPromise) return;
  const generation = playbackGeneration;
  const operation = advanceTrack(generation);
  transitionPromise = operation;
  const clear = () => { if (transitionPromise === operation) transitionPromise = null; };
  operation.then(clear, clear);
  return operation;
}

function getNextCycleOrder() {
  if (!nextCycleOrder) {
    const indices = currentPlaylist.map((_, index) => index);
    nextCycleOrder = appSettings.shuffle ? shuffleIndices(indices) : indices;
  }
  return nextCycleOrder;
}

async function advanceTrack(generation) {
  if (currentTrackIndex >= 0 && orderCursor + 1 < playOrder.length) {
    const index = playOrder[orderCursor + 1];
    return playTrack(currentPlaylist[index], index, true);
  }
  if (appSettings.repeat === "all" && currentPlaylist.length) {
    playOrder = getNextCycleOrder();
    nextCycleOrder = null;
    orderCursor = 0;
    return playTrack(currentPlaylist[playOrder[0]], playOrder[0], true);
  }
  if (infiniteMode) return playInfiniteTrack(generation);
  playbackStopped = true;
  clearTimeout(trackEndTimer);
  try { await spotifyPlayer?.pause(); } catch { showToast("再生を停止できませんでした。通信状況を確認してください"); }
  if (generation !== playbackGeneration) return;
  playerClock = { ...playerClock, paused: true, ts: Date.now() };
  setPlaybackIcon(true);
  renderQueue();
}

function playPrevious() {
  if (!localPlayback || playbackPending) return;
  playbackGeneration++;
  setInfiniteMode(false);
  if (clockPosition() > 3000 || orderCursor <= 0 || currentTrackIndex < 0) {
    return playTrack(currentTrackData, currentTrackIndex, isPlaylistMode);
  }
  const index = playOrder[orderCursor - 1];
  return playTrack(currentPlaylist[index], index, true);
}

function handleTrackEnded() {
  if (appSettings.repeat === "one" && currentTrackData) return playTrack(currentTrackData, currentTrackIndex, isPlaylistMode);
  if (!appSettings.autoplay) { playbackStopped = true; return; }
  return playNext();
}

function setInfiniteMode(value) {
  infiniteRequestId++;
  infiniteLoading = false;
  infiniteMode = !!value;
  if (!infiniteMode && infiniteStarting && playbackPending) {
    playbackRequestId++;
    playbackPending = false;
    playbackStopped = true;
    spotifyPlayer?.pause().catch(() => {});
  }
  if (infiniteMode) {
    appSettings.autoplay = true;
    saveAppSetting("autoplay", true);
    const autoplay = document.getElementById("autoplayToggle");
    if (autoplay) autoplay.checked = true;
    setRepeat("off");
  }
  renderFpExtras();
  renderQueue();
}

async function playInfiniteTrack(generation) {
  const requestId = ++infiniteRequestId;
  infiniteLoading = true;
  renderQueue();
  const isCurrent = () => infiniteMode && requestId === infiniteRequestId && generation === playbackGeneration;
  try {
    await spotifyPlayer?.pause();
    if (!isCurrent()) return;
    const artist = currentTrackData?.artists?.[0]?.name || getArtistText(currentTrackData) || getArtistText(currentPlaylist[0]);
    if (!artist) throw new Error("次の曲を探すためのアーティスト情報がありません");
    if (artist !== infiniteArtist) {
      infiniteArtist = artist;
      infinitePage = 0;
      infiniteCatalog = [];
    }
    const query = `artist:"${artist.replace(/"/g, "")}"`;
    const data = await spotifyRequest(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10&offset=${infinitePage * 10}`);
    if (!isCurrent()) return;
    infinitePage = data?.tracks?.next ? (infinitePage + 1) % 3 : 0;
    const found = normalizeTracks(data?.tracks?.items || []).filter(t => t.uri?.startsWith("spotify:track:") && !t.is_local && t.is_playable !== false);
    infiniteCatalog = [...new Map([...infiniteCatalog, ...found].map(t => [t.uri, t])).values()].slice(-100);
    const excluded = new Set([...currentPlaylist.map(t => t.uri), currentTrackData?.uri]);
    const available = infiniteCatalog.filter(t => !excluded.has(t.uri));
    const fresh = available.filter(t => !infiniteRecent.slice(-10).includes(t.uri));
    const candidates = fresh.length ? fresh : available;
    if (!candidates.length) throw new Error("続けて再生できる別の曲が見つかりませんでした");
    const track = candidates[Math.floor(Math.random() * candidates.length)];
    infiniteRecent = [...infiniteRecent, track.uri].slice(-30);
    infiniteLoading = false;
    infiniteStarting = true;
    return await playTrack(track, -1, false);
  } catch (error) {
    if (!isCurrent()) return;
    setInfiniteMode(false);
    playbackStopped = true;
    showToast(error.status ? spotifyReadError(error) : error.message);
  } finally {
    if (generation === playbackGeneration) infiniteStarting = false;
    if (requestId === infiniteRequestId && generation === playbackGeneration) {
      infiniteLoading = false;
      renderQueue();
    }
  }
}

function initPlayerControls() {
  ["playPauseButton", "menuPlayPauseButton", "fpPlay"].forEach((id) =>
    document.getElementById(id)?.addEventListener("click", togglePlay)
  );
  ["nextButton", "menuNextButton", "fpNext"].forEach((id) =>
    document.getElementById(id)?.addEventListener("click", () => playNext(false))
  );
  ["previousButton", "menuPreviousButton", "fpPrev"].forEach((id) =>
    document.getElementById(id)?.addEventListener("click", playPrevious)
  );
  bindSeekBar("progressBar");
  bindSeekBar("menuProgressBar");
  bindSeekBar("fpProgress");
  startProgressTimer();
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
      <div id="spotifySaveStatus" class="spotify-save-status"></div>
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
        status.innerHTML = `✓ 保存完了！ <a href="${data.spotifyUrl}" target="_blank" class="spotify-save-link">Spotifyで開く</a>`;
      }
      showToast("🎵 Spotifyに保存しました！");
      loadSpotifyPlaylists();
    } catch (e) {
      if (status) status.innerHTML = `<span class="ai-result-error">${escapeHtml(e.message)}</span>`;
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
  if (!track?.uri) return;
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
  refreshFavoriteViews();
}

function updateFavoriteButton(btn, track) {
  const uri = track?.uri || btn.dataset.uri;
  const exists = getFavorites().some((t) => t.uri === uri);
  btn.textContent = exists ? "❤️" : "♡";
  btn.classList.toggle("favorite-active", exists);
  btn.setAttribute("aria-label", exists ? "お気に入りから削除" : "お気に入りに追加");
}

// 画面上のすべてのハートとライブラリのお気に入り一覧を同期
function refreshFavoriteViews() {
  document.querySelectorAll(".favorite-button").forEach((btn) => updateFavoriteButton(btn, { uri: btn.dataset.uri }));
  updateLibraryPage();
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
    c.innerHTML = `<div class="empty-message">履歴はまだありません</div>`;
    return;
  }
  hist.forEach((t, i) => c.appendChild(createTrackCard(t, i, hist)));
}

function updateLibraryPage() {
  const f = document.getElementById("favoritesList");
  if (!f) return;
  const favs = getFavorites();
  f.innerHTML = "";
  if (!favs.length) {
    f.innerHTML = `<div class="empty-message">お気に入りはまだありません</div>`;
    return;
  }
  favs.forEach((t, i) => f.appendChild(createTrackCard(t, i, favs)));
}

async function loadSpotifyPlaylists() {
  const box = document.getElementById("playlistList");
  if (!box) return;
  const reqId = ++playlistLoadId;

  const token = await getFreshSpotifyToken(false);
  if (reqId !== playlistLoadId) return;
  if (!token) {
    box.innerHTML = `<div class="empty-message">Spotifyにログインするとプレイリストが表示されます</div>`;
    return;
  }
  if (!box.querySelector(".spotify-playlist-card")) {
    box.innerHTML = `<div class="empty-message">🔄 読み込み中...</div>`;
  }

  try {
    const all = await fetchSpotifyPages("https://api.spotify.com/v1/me/playlists?limit=50", () => reqId !== playlistLoadId);
    if (reqId !== playlistLoadId) return;
    renderSpotifyPlaylists(all);
  } catch (e) {
    if (reqId !== playlistLoadId) return;
    const msg =
      e.status === 401 || e.status === 403
        ? "プレイリストを取得できませんでした。Spotifyにログインし直してください"
        : "プレイリストの取得に失敗しました。時間をおいて再度お試しください";
    box.innerHTML = `<div class="empty-message">${msg}</div>`;
  }
}

function renderSpotifyPlaylists(list) {
  const box = document.getElementById("playlistList");
  if (!box) return;
  box.innerHTML = "";
  if (!list.length) {
    box.innerHTML = `<div class="empty-message">プレイリストはまだありません</div>`;
    return;
  }
  list.forEach((p) => {
    const count = p.tracks?.total ?? p.items?.total;
    const img = p.images?.[1]?.url || p.images?.[0]?.url || "";
    const card = document.createElement("div");
    card.className = "spotify-playlist-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.innerHTML = `
      <div class="spotify-playlist-image">${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy">` : ""}</div>
      <div class="spotify-playlist-info">
        <div class="spotify-playlist-name">${escapeHtml(p.name)}</div>
        <div class="spotify-playlist-count">${count != null ? `${count}曲` : ""}</div>
      </div>
      <div class="spotify-playlist-arrow">›</div>
    `;
    const play = () => openSpotifyPlaylist(p);
    card.addEventListener("click", play);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        play();
      }
    });
    box.appendChild(card);
  });
}

// Spotify paging URLs are followed only on Spotify's API origin.
async function spotifyRequest(url, options = {}) {
  const target = new URL(url, "https://api.spotify.com/v1/");
  if (target.origin !== "https://api.spotify.com" || !target.pathname.startsWith("/v1/")) throw new Error("Invalid Spotify URL");
  let token = await getFreshSpotifyToken();
  if (!token) throw Object.assign(new Error("Spotify login required"), { status: 401 });
  const send = () => fetch(target.href, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
  let response = await send();
  if (response.status === 401) {
    token = await getFreshSpotifyToken(true);
    response = await send();
  }
  if (!response.ok) throw Object.assign(new Error(`Spotify ${response.status}`), { status: response.status });
  return response.status === 204 ? null : response.json();
}

async function fetchSpotifyPages(url, cancelled = () => false) {
  const items = [];
  const visited = new Set();
  while (url && !cancelled()) {
    if (visited.has(url)) throw new Error("Repeated Spotify page");
    visited.add(url);
    const data = await spotifyRequest(url);
    items.push(...(data?.items || []).filter(Boolean));
    url = data?.next;
  }
  return items;
}

function spotifyReadError(error) {
  if (error.status === 401) return "Spotifyにログインし直してください。";
  if (error.status === 403) return "この内容へのアクセスが許可されていません。Spotifyの権限やプレイリストの共有設定を確認してください。";
  if (error.status === 404) return "プレイリストが見つからないか、曲の取得に対応していません。Spotifyで開いて確認してください。";
  if (error.status === 429) return "Spotifyへのアクセスが集中しています。時間をおいて再度お試しください。";
  return "取得に失敗しました。通信状況を確認して再度お試しください。";
}

async function openSpotifyPlaylist(playlist) {
  showPage("playlistDetailPage");
  const requestId = ++playlistDetailLoadId;
  const box = document.getElementById("playlistTracks");
  const play = document.getElementById("playlistPlay");
  const retry = document.getElementById("playlistRetry");
  const link = document.getElementById("playlistSpotifyLink");
  setText("playlistName", playlist.name || "プレイリスト");
  const artwork = playlist.images?.[0]?.url || "";
  ["playlistCover", "playlistBackdrop"].forEach((id) => {
    const image = document.getElementById(id);
    if (!image) return;
    image.hidden = !artwork;
    image.onerror = () => { image.hidden = true; };
    if (artwork) image.src = artwork;
  });
  setText("playlistDescription", playlist.description || "");
  setText("playlistMeta", playlist.owner?.display_name || "");
  link.href = `https://open.spotify.com/playlist/${encodeURIComponent(playlist.id)}`;
  play.disabled = true;
  play.onclick = null;
  retry.hidden = true;
  box.innerHTML = '<div class="empty-message" role="status">曲を読み込み中...</div>';
  try {
    const items = await fetchSpotifyPages(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlist.id)}/items?limit=50`, () => requestId !== playlistDetailLoadId);
    if (requestId !== playlistDetailLoadId) return;
    const tracks = items.map((entry, position) => ({ track: entry.item || entry.track, position }))
      .filter(({ track }) => track?.type === "track" && !track.is_local && track.is_playable !== false && track.uri?.startsWith("spotify:track:"));
    setText("playlistMeta", `${items.length}曲・再生可能な曲 ${tracks.length}曲${playlist.owner?.display_name ? ` · ${playlist.owner.display_name}` : ""}`);
    box.innerHTML = "";
    if (!tracks.length) box.innerHTML = '<div class="empty-message">再生できる曲がありません。Spotifyで開いて確認できます。</div>';
    tracks.forEach(({ track, position }, index) => box.appendChild(createTrackCard(track, index, null, () => playSpotifyPlaylist(playlist, position, tracks))));
    play.disabled = !tracks.length;
    play.onclick = () => playSpotifyPlaylist(playlist, tracks[0].position, tracks);
  } catch (error) {
    if (requestId !== playlistDetailLoadId) return;
    box.innerHTML = `<div class="empty-message" role="alert">${escapeHtml(spotifyReadError(error))}</div>`;
    retry.hidden = false;
    retry.onclick = () => openSpotifyPlaylist(playlist);
  }
}

function playSpotifyPlaylist(playlist, position = 0, entries = []) {
  const index = entries.findIndex(entry => entry.position === position);
  if (index < 0) { showToast("プレイリストを開き直してから再生してください"); return; }
  return startTrackList(entries.map(entry => entry.track), index);
}

async function refreshSpotifyQueue() {
  if (localPlayback) return renderQueue();
  const requestId = ++queueRequestId;
  if (!spotifyQueue.length) queueStatus = "再生待ちを読み込み中...";
  renderQueue();
  try {
    const data = await spotifyRequest("https://api.spotify.com/v1/me/player/queue");
    if (requestId !== queueRequestId || localPlayback) return;
    spotifyQueue = (data?.queue || []).filter(Boolean);
    queueStatus = "";
    renderQueue();
  } catch (error) {
    if (requestId !== queueRequestId) return;
    spotifyQueue = [];
    queueStatus = spotifyReadError(error);
    renderQueue();
  }
}

// -------------------------------------------------------------
// Search (Spotify catalog)
// -------------------------------------------------------------
function initSearch() {
  [
    ["songSearchInput", "songSearchButton"],
    ["musicSearchInput", "musicSearchButton"],
  ].forEach(([inputId, btnId]) => {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    const box = document.getElementById("searchResults");
    if (!input || !btn || !box) return;
    const run = () => runSongSearch(input.value.trim(), box);
    btn.addEventListener("click", run);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        run();
      }
    });
  });
}

async function runSongSearch(query, box) {
  if (!query) {
    box.innerHTML = `<div class="empty-message">曲名やアーティスト名を入力してください</div>`;
    return;
  }
  const reqId = ++searchRequestId;
  box.innerHTML = `<div class="empty-message">🔄 検索中...</div>`;

  const token = await getFreshSpotifyToken(false);
  if (reqId !== searchRequestId) return;
  if (!token) {
    box.innerHTML = `<div class="empty-message">Spotifyにログインすると検索できます</div>`;
    return;
  }

  try {
    const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (reqId !== searchRequestId) return;
    if (!res.ok) throw new Error(`検索に失敗しました (${res.status})`);
    const data = await res.json();
    const tracks = normalizeTracks(data.tracks?.items || []);
    box.innerHTML = "";
    if (!tracks.length) {
      box.innerHTML = `<div class="empty-message">「${escapeHtml(query)}」に一致する曲が見つかりませんでした</div>`;
      return;
    }
    tracks.forEach((t, i) => box.appendChild(createTrackCard(t, i, tracks)));
  } catch (e) {
    if (reqId === searchRequestId) box.innerHTML = `<div class="empty-message">${escapeHtml(e.message)}</div>`;
  }
}

// -------------------------------------------------------------
// Settings / Theme / Menu
// -------------------------------------------------------------
function initSettings() {
  const bind = (ids, fn) => ids.forEach((id) => document.getElementById(id)?.addEventListener("click", fn));

  bind(["clearFavorites", "clearFavoritesButton"], () => {
    if (!confirm("お気に入りを全部削除しますか？")) return;
    localStorage.removeItem("music_picker_favorites");
    refreshFavoriteViews();
    showToast("お気に入りを削除しました");
  });
  bind(["clearHistory", "clearHistoryButton"], () => {
    if (!confirm("履歴を全部削除しますか？")) return;
    localStorage.removeItem("music_picker_history");
    updateHistoryPage();
    showToast("履歴を削除しました");
  });

  // 別タブでの変更も反映
  window.addEventListener("storage", (e) => {
    if (e.key === "music_picker_favorites") refreshFavoriteViews();
    if (e.key === "music_picker_history") updateHistoryPage();
  });
}

function initTheme() {
  const toggle = document.getElementById("darkModeToggle");
  if (!toggle) return;
  toggle.checked = appSettings.theme === "night"; // ONのときだけ黒背景
  toggle.addEventListener("change", () => {
    saveAppSetting("theme", toggle.checked ? "night" : "ocean");
    applyAppSettings();
  });
}

function bindSettingToggle(id, key, onChange) {
  const el = document.getElementById(id);
  if (!el) return;
  el.checked = !!appSettings[key];
  el.addEventListener("change", () => {
    saveAppSetting(key, el.checked);
    onChange?.(el.checked);
  });
}

function initMenuSettings() {
  bindSettingToggle("animationToggle", "animation", applyAppSettings);
  bindSettingToggle("autoplayToggle", "autoplay", value => { if (!value) setInfiniteMode(false); });
  const shuffle = document.getElementById("shuffleToggle");
  if (shuffle) {
    shuffle.checked = appSettings.shuffle;
    shuffle.addEventListener("change", () => setShuffle(shuffle.checked));
  }
  bindSettingToggle("alwaysShowPlayerToggle", "alwaysShowPlayer", updatePlayerVisibility);

  const repeat = document.getElementById("repeatMode");
  if (repeat) {
    repeat.value = appSettings.repeat;
    repeat.addEventListener("change", () => setRepeat(repeat.value));
  }

  // 音量：下部プレイヤーとサイドメニューのスライダーを双方向で同期
  ["volumeBar", "menuVolumeBar", "fpVolume"].forEach((id) =>
    document.getElementById(id)?.addEventListener("input", (e) => setVolume(e.target.value))
  );
  setVolume(appSettings.volume);
  updatePlayerVisibility();
  renderFpExtras();
}

function updateMenuPlayerEmptyState() {
  if (currentTrackData) return;
  setText("menuPlayerTitle", "再生中の曲はありません");
  setText("menuPlayerArtist", "");
}

function initLibraryAccordion() {
  document.querySelectorAll(".library-section-header").forEach((header) => {
    header.addEventListener("click", () => {
      const section = header.closest(".library-section");
      if (!section) return;
      const collapsed = section.classList.toggle("collapsed");
      header.setAttribute("aria-expanded", String(!collapsed));
      if (!collapsed && header.dataset.target === "playlistsContent") loadSpotifyPlaylists();
    });
  });
}
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


// -------------------------------------------------------------
// Full Screen Player（下部の再生バーをタップで開く）
// -------------------------------------------------------------
function initFullPlayer() {
  const fp = document.getElementById("fullPlayer");
  if (!fp) return;

  document.getElementById("playerPanel")?.addEventListener("click", (e) => {
    if (e.target.closest("button, input, a")) return; // 操作ボタンはそのまま動かす
    openFullPlayer();
  });

  document.getElementById("playerPanel")?.addEventListener("keydown", (event) => {
    if (event.target.id === "playerPanel" && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openFullPlayer();
    }
  });
  document.getElementById("fpClose")?.addEventListener("click", closeFullPlayer);
  document.getElementById("fpQueueButton")?.addEventListener("click", () => {
    fp.classList.toggle("queue-open");
    renderQueue();
    if (fp.classList.contains("queue-open")) {
      document.getElementById("fpQueueBack")?.focus();
      refreshSpotifyQueue();
    }
  });
  document.getElementById("fpQueueBack")?.addEventListener("click", () => {
    fp.classList.remove("queue-open");
    document.getElementById("fpQueueButton")?.focus();
  });

  document.getElementById("fpFav")?.addEventListener("click", () => {
    if (currentTrackData) toggleFavorite(currentTrackData);
  });
  document.getElementById("fpShuffle")?.addEventListener("click", () => setShuffle(!appSettings.shuffle));
  ["fpInfinite", "menuInfinite"].forEach(id => {
    document.getElementById(id)?.addEventListener("click", () => setInfiniteMode(!infiniteMode));
  });
  document.getElementById("fpRepeat")?.addEventListener("click", () => {
    const order = ["off", "all", "one"];
    setRepeat(order[(order.indexOf(appSettings.repeat) + 1) % order.length]);
  });

  setInterval(() => {
    if (!document.hidden && fp.classList.contains("open") && fp.classList.contains("queue-open")) refreshSpotifyQueue();
  }, 10000);
  document.addEventListener("keydown", (e) => {
    if (!fp.classList.contains("open")) return;
    if (e.key === "Escape") closeFullPlayer();
    if (e.key === "Tab") {
      const controls = [...fp.querySelectorAll("button, input, [tabindex='0']")].filter(el => !el.disabled && el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  });
}

function openFullPlayer() {
  const fp = document.getElementById("fullPlayer");
  if (!fp) return;
  fullPlayerFocus = document.activeElement;
  fp.classList.add("open");
  document.getElementById("fpClose")?.focus();
  setPlayerBackgroundInert(true);
  fp.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  renderFpExtras();
  renderQueue();
}

function closeFullPlayer() {
  const fp = document.getElementById("fullPlayer");
  if (!fp) return;
  fp.classList.remove("open", "queue-open");
  fp.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  setPlayerBackgroundInert(false);
  fullPlayerFocus?.focus();
}

function setPlayerBackgroundInert(inert) {
  ["app", "bottomNav", "sideMenu", "menuButton", "playerPanel"].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.inert = inert;
  });
}

function setShuffle(value) {
  saveAppSetting("shuffle", !!value);
  const toggle = document.getElementById("shuffleToggle");
  if (toggle) toggle.checked = !!value;
  rebuildRemainingOrder();
  renderFpExtras();
  renderQueue();
}

function setRepeat(mode) {
  if (!["off", "all", "one"].includes(mode)) return;
  saveAppSetting("repeat", mode);
  nextCycleOrder = null;
  if (mode !== "off" && infiniteMode) setInfiniteMode(false);
  const select = document.getElementById("repeatMode");
  if (select) select.value = mode;
  renderFpExtras();
  renderQueue();
}

function renderFpExtras() {
  ["fpInfinite", "menuInfinite"].forEach(id => {
    const button = document.getElementById(id);
    if (!button) return;
    button.textContent = `∞ 無限再生 ${infiniteMode ? "ON" : "OFF"}`;
    button.classList.toggle("active", infiniteMode);
    button.setAttribute("aria-pressed", String(infiniteMode));
  });
  const sh = document.getElementById("fpShuffle");
  if (sh) { sh.classList.toggle("active", !!appSettings.shuffle); sh.setAttribute("aria-pressed", String(!!appSettings.shuffle)); }
  const rp = document.getElementById("fpRepeat");
  if (rp) {
    const label = { off: "OFF", all: "全曲", one: "1曲" }[appSettings.repeat] || "OFF";
    rp.textContent = `🔁 ${label}`;
    rp.classList.toggle("active", appSettings.repeat !== "off");
  }
}

function renderQueue() {
  const box = document.getElementById("fpQueueList");
  if (!box) return;
  box.innerHTML = "";

  const remoteQueue = !localPlayback;
  let upcomingIndices = currentTrackIndex >= 0 ? playOrder.slice(orderCursor + 1) : [];
  if (localPlayback && appSettings.repeat === "one" && currentTrackIndex >= 0) upcomingIndices = [currentTrackIndex];
  else if (localPlayback && appSettings.repeat === "all" && !upcomingIndices.length) upcomingIndices = getNextCycleOrder();
  const upcoming = remoteQueue ? spotifyQueue : upcomingIndices.map(index => currentPlaylist[index]);
  if (remoteQueue && queueStatus) {
    box.innerHTML = `<div class="empty-message" role="status">${escapeHtml(queueStatus)}</div>`;
    return;
  }
  if (!upcoming.length) {
    const message = infiniteLoading ? "次の曲を探しています..." : infiniteMode ? "選んだ曲の終了後に、アーティストの別の曲を探して続けます" : "次に再生する曲はありません";
    box.innerHTML = `<div class="empty-message" role="status">${message}</div>`;
    return;
  }
  upcoming.forEach((raw, index) => {
    const track = normalizeTrack(raw);
    const row = document.createElement(remoteQueue ? "div" : "button");
    row.className = "fp-queue-item";
    if (!remoteQueue) {
      row.type = "button";
      row.setAttribute("aria-label", `${track.title}を再生`);
      const position = upcomingIndices[index];
      row.addEventListener("click", () => {
        playbackGeneration++;
        setInfiniteMode(false);
        playTrack(track, position, true);
      });
    }
    row.innerHTML = `
      <img src="${escapeHtml(track.image)}" alt="" loading="lazy">
      <div class="fp-queue-info">
        <div class="fp-queue-title">${escapeHtml(track.title)}</div>
        <div class="fp-queue-artist">${escapeHtml(getArtistText(track) || track.show?.publisher || "")}</div>
      </div>
      <span class="fp-queue-marker">${index + 1}</span>`;
    box.appendChild(row);
  });
}
