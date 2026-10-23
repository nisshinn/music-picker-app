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
let selectedArtists = [];

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
let volumeApplying = null;
let queuedVolume = null;
let confirmedVolume = 50;

// 再生状態の時計（Spotifyの状態変化は秒ごとには来ないため、自前で進める）
let playerClock = { position: 0, duration: 0, paused: true, ts: Date.now(), trackId: "" };
let isSeeking = false;
let seekPreview = null;
let queuedSeek = null;
let seekApplying = null;
let seekRevision = 0;
let progressTimer = null;
let endHandled = false;
let playlistLoadId = 0;
let spotifyPlaylistCache = [];
let playlistSourcePage = "favoritesPage";
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
  initPlaybackIcons();
  initPlayerControls();
  initFullPlayer();
  initSpotify();
  initSpotifyLoginButton();
  updateLibraryPage();
  initLibraryAccordion();
  loadSpotifyPlaylists();
  document.getElementById("playlistBack")?.addEventListener("click", () => showPage(playlistSourcePage));
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

  const mobileMenu = window.matchMedia("(max-width: 900px)");
  const setMenuOpen = (open, restoreFocus = false) => {
    sideMenu.classList.toggle("open", open);
    overlay?.classList.toggle("open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    if (open) closeButton?.focus();
    else if (restoreFocus && mobileMenu.matches) menuButton.focus();
  };

  menuButton.addEventListener("click", () => setMenuOpen(true));
  closeButton?.addEventListener("click", () => setMenuOpen(false, true));
  overlay?.addEventListener("click", () => setMenuOpen(false, true));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sideMenu.classList.contains("open")) {
      setMenuOpen(false, true);
    }
  });
  mobileMenu.addEventListener("change", () => setMenuOpen(false));

  document.querySelectorAll(".menu-link").forEach((link) => {
    link.addEventListener("click", () => {
      showPage(link.dataset.page);
      setMenuOpen(false, true);
    });
  });
}

let lastPageBeforeArtistDetail = "homePage";

function showPage(pageId) {
  if (!document.getElementById(pageId)) return;
  if (pageId !== "playlistDetailPage") playlistDetailLoadId++;
  if (pageId !== "artistDetailPage") {
    lastPageBeforeArtistDetail = pageId;
    if (typeof stopArtistPagePreview === "function") stopArtistPagePreview();
  }
  const navPage = pageId === "playlistDetailPage" ? "favoritesPage" : (pageId === "artistDetailPage" ? (lastPageBeforeArtistDetail || "homePage") : pageId);
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active-page"));
  const page = document.getElementById(pageId);
  if (page) page.classList.add("active-page");

  document.querySelectorAll(".menu-link").forEach((l) => l.classList.toggle("active", l.dataset.page === navPage));
  document.querySelectorAll(".bottom-nav-link").forEach((l) => l.classList.toggle("active", l.dataset.page === navPage));

  if (pageId === "favoritesPage") {
    updateLibraryPage();
    loadSpotifyPlaylists();
  }
  if (pageId === "homePage" && spotifyPlaylistCache.length) renderHomePlaylists();
  if (pageId === "historyPage") updateHistoryPage();
  window.scrollTo(0, 0);
}

// -------------------------------------------------------------
// Home Screen (Mood, Artist, Genre, Gemini AI integration)
// -------------------------------------------------------------
const SELECTION_PRESETS_KEY = "music_picker_selection_presets";
const EXCLUDE_RECENT_KEY = "music_picker_exclude_recent";
const PRESET_MOODS = ["楽しい", "テンション高い", "落ち着きたい", "しんみり"];
let excludeRecent = false;
let recordingVersion = "all";
let moodAnalysisRequestId = 0;
let artistSearchRequestId = 0;
let artistSearchTimer = null;

function readSelectionPresets() {
  try {
    const value = JSON.parse(localStorage.getItem(SELECTION_PRESETS_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((p) => p && typeof p.id === "string" && typeof p.name === "string" && p.name.trim())
      .slice(0, 20).map((p) => ({
        id: p.id.slice(0, 100), name: p.name.slice(0, 40),
        mood: PRESET_MOODS.includes(p.mood) ? p.mood : "",
        freeMood: typeof p.freeMood === "string" ? p.freeMood.slice(0, 300) : "",
        artistId: typeof p.artistId === "string" ? p.artistId.slice(0, 100) : "",
        artistName: typeof p.artistName === "string" ? p.artistName.slice(0, 200) : "",
        genre: typeof p.genre === "string" ? p.genre.slice(0, 80) : "all",
        excludeRecent: p.excludeRecent === true,
        recordingVersion: ["studio", "live"].includes(p.recordingVersion) ? p.recordingVersion : "all",
      }));
  } catch { return []; }
}

function presetStatus(message) {
  setText("presetStatus", message);
}

function renderSelectionPresets(selectedId = "") {
  const select = document.getElementById("savedPreset");
  if (!select) return;
  const presets = readSelectionPresets();
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = presets.length ? "保存した条件を選択" : "保存した条件はありません";
  select.appendChild(placeholder);
  presets.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.name;
    select.appendChild(option);
  });
  select.value = presets.some((p) => p.id === selectedId) ? selectedId : "";
  updatePresetActions();
}

function updatePresetActions() {
  const selected = !!document.getElementById("savedPreset")?.value;
  for (const id of ["loadPreset", "deletePreset"]) {
    const button = document.getElementById(id);
    if (button) button.disabled = !selected;
  }
}

function saveSelectionPreset() {
  const name = document.getElementById("presetName").value.trim().slice(0, 40);
  if (!name) { presetStatus("保存する名前を入力してください。"); return; }
  if (!aiMoodText && !selectedMood) { presetStatus("気分を選ぶか入力してから保存してください。"); return; }
  const presets = readSelectionPresets();
  const existing = presets.findIndex((p) => p.name === name);
  if (existing < 0 && presets.length >= 20) { presetStatus("保存できる条件は20件までです。不要な条件を削除してください。"); return; }
  const preset = {
    id: existing >= 0 ? presets[existing].id : Date.now().toString(36) + Math.random().toString(36).slice(2, 10),
    name, mood: aiMoodText ? "" : selectedMood, freeMood: aiMoodText,
    artistId: selectedArtistId, artistName: selectedArtistName, genre: selectedGenre, excludeRecent, recordingVersion,
  };
  if (existing >= 0) presets[existing] = preset;
  else presets.push(preset);
  try {
    localStorage.setItem(SELECTION_PRESETS_KEY, JSON.stringify(presets));
    renderSelectionPresets(preset.id);
    presetStatus(`「${name}」を${existing >= 0 ? "上書き" : "保存"}しました。`);
  } catch { presetStatus("保存できませんでした。ブラウザの保存容量・設定を確認してください。"); }
}

function resetMoodAnalysis() {
  moodAnalysisRequestId++;
  aiMoodAnalysis = null;
  setText("aiMoodResult", "");
  const button = document.getElementById("aiMoodButton");
  if (button) { button.disabled = false; button.textContent = "気分を分析"; }
}

function applySelectionPreset(preset) {
  resetMoodAnalysis();
  aiMoodText = preset.freeMood || "";
  selectedMood = aiMoodText ? "" : preset.mood;
  document.getElementById("freeMoodInput").value = aiMoodText;
  document.querySelectorAll(".moods button").forEach((button) => {
    const selected = button.dataset.mood === selectedMood;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  artistSearchRequestId++;
  clearTimeout(artistSearchTimer);
  document.getElementById("artistSearch").value = "";
  document.getElementById("artistResults").innerHTML = "";
  selectedArtistId = preset.artistId;
  selectedArtistName = preset.artistName;
  selectedArtistImage = "";
  if (selectedArtistId) {
    selectedArtists = [{ id: selectedArtistId, name: selectedArtistName || "Artist", image: "" }];
    renderSelectedArtist();
  } else {
    window.clearSelectedArtist();
  }
  const genres = [...document.querySelectorAll('input[name="detailedGenre"]')];
  setSelectedGenre(genres.some((o) => o.value === preset.genre) ? preset.genre : "all");
  recordingVersion = ["studio", "live"].includes(preset.recordingVersion) ? preset.recordingVersion : "all";
  document.querySelectorAll('input[name="recordingVersion"]').forEach(input => { input.checked = input.value === recordingVersion; });
  excludeRecent = preset.excludeRecent;
  document.getElementById("excludeRecent").checked = excludeRecent;
  updateExclusionHint();
  try { localStorage.setItem(EXCLUDE_RECENT_KEY, String(excludeRecent)); } catch {}
  document.getElementById("presetName").value = preset.name;
  presetStatus(`「${preset.name}」を呼び出しました。「5曲を選ぶ」で選曲できます。`);
}

function updateExclusionHint() {
  setText("selectionHint", excludeRecent
    ? "再生履歴の直近50曲を除いて、5曲を選びます。"
    : "気分を選ぶか入力して、「5曲を選ぶ」を押してください。");
  const hint = document.getElementById("selectionHint");
  if (hint && recordingVersion !== "all") hint.textContent += recordingVersion === "live" ? " ライブ版のみが対象です。" : " 通常版のみが対象です。";
}

function initSelectionPresets() {
  try { excludeRecent = localStorage.getItem(EXCLUDE_RECENT_KEY) === "true"; } catch {}
  const checkbox = document.getElementById("excludeRecent");
  if (checkbox) {
    checkbox.checked = excludeRecent;
    updateExclusionHint();
    checkbox.addEventListener("change", () => {
      excludeRecent = checkbox.checked;
      updateExclusionHint();
      try { localStorage.setItem(EXCLUDE_RECENT_KEY, String(excludeRecent)); } catch {}
    });
  }
  renderSelectionPresets();
  document.getElementById("savedPreset")?.addEventListener("change", updatePresetActions);
  document.getElementById("savePreset")?.addEventListener("click", saveSelectionPreset);
  document.getElementById("loadPreset")?.addEventListener("click", () => {
    const preset = readSelectionPresets().find((p) => p.id === document.getElementById("savedPreset").value);
    if (preset) applySelectionPreset(preset);
  });
  document.getElementById("deletePreset")?.addEventListener("click", () => {
    const id = document.getElementById("savedPreset").value;
    if (!id) return;
    try {
      localStorage.setItem(SELECTION_PRESETS_KEY, JSON.stringify(readSelectionPresets().filter((p) => p.id !== id)));
      renderSelectionPresets();
      presetStatus("保存した条件を削除しました。");
    } catch { presetStatus("削除できませんでした。ブラウザの保存設定を確認してください。"); }
  });
}

function getRecentTrackUris() {
  if (!excludeRecent) return [];
  try {
    const history = JSON.parse(localStorage.getItem("music_picker_history") || "[]");
    if (!Array.isArray(history)) return [];
    return [...new Set(history.slice(0, 50).flatMap((t) => [t?.uri || (t?.id ? `spotify:track:${t.id}` : ""), t?.linked_from?.uri])
      .filter((uri) => typeof uri === "string" && /^spotify:track:[a-zA-Z0-9]+$/.test(uri)))];
  } catch { return []; }
}

function initHome() {
  initSelectionPresets();
  document.querySelectorAll('input[name="recordingVersion"]').forEach(input => {
    input.addEventListener("change", () => { recordingVersion = input.value; updateExclusionHint(); });
  });
  document.getElementById("homePlaylistRefresh")?.addEventListener("click", () => {
    if (spotifyPlaylistCache.length) renderHomePlaylists();
    else loadSpotifyPlaylists();
  });
  const moodButtons = document.querySelectorAll(".moods button");
  moodButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      moodButtons.forEach((b) => { b.classList.remove("selected"); b.setAttribute("aria-pressed", "false"); });
      btn.classList.add("selected");
      btn.setAttribute("aria-pressed", "true");
      selectedMood = btn.dataset.mood || btn.textContent.trim();
      const freeInput = document.getElementById("freeMoodInput");
      if (freeInput) freeInput.value = "";
      aiMoodText = "";
      resetMoodAnalysis();
    });
  });

  const genre = document.getElementById("genre");
  if (genre) {
    selectedGenre = genre.value || "all";
    genre.addEventListener("change", () => {
      setSelectedGenre(genre.value);
    });
  }

  const freeMoodInput = document.getElementById("freeMoodInput");
  const aiMoodButton = document.getElementById("aiMoodButton");
  const aiMoodResult = document.getElementById("aiMoodResult");

  if (freeMoodInput) {
    freeMoodInput.addEventListener("input", () => {
      aiMoodText = freeMoodInput.value.trim();
      resetMoodAnalysis();
      moodButtons.forEach((b) => { b.classList.remove("selected"); b.setAttribute("aria-pressed", "false"); });
      selectedMood = "";
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
      const analysisRequestId = ++moodAnalysisRequestId;
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
        if (analysisRequestId !== moodAnalysisRequestId) return;
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
        if (analysisRequestId !== moodAnalysisRequestId) return;
        if (aiMoodResult) aiMoodResult.innerHTML = `<div class="ai-result-error">${escapeHtml(e.message)}</div>`;
      } finally {
        if (analysisRequestId === moodAnalysisRequestId) {
          aiMoodButton.disabled = false;
          aiMoodButton.textContent = "気分を分析";
        }
      }
    });
  }

  document.getElementById("advancedToggle")?.addEventListener("click", () => {
    const toggle = document.getElementById("advancedToggle");
    const panel = document.getElementById("advancedSettings");
    const expanded = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.querySelector("span").textContent = expanded ? "−" : "＋";
    panel.hidden = !expanded;
  });
  document.querySelectorAll('input[name="detailedGenre"]').forEach((input) => {
    input.addEventListener("change", () => setSelectedGenre(input.value));
  });
  document.getElementById("resetGenre")?.addEventListener("click", () => setSelectedGenre("all"));

  initArtistSearch();

  const makeButton = document.getElementById("makePlaylist");
  if (makeButton) makeButton.addEventListener("click", makePlaylist);
}

function setSelectedGenre(value) {
  selectedGenre = value;
  const select = document.getElementById("genre");
  const basic = ["all", "j-pop", "pop", "k-pop", "rock", "hip-hop", "r-n-b"].includes(value);
  if (select) select.value = basic ? value : "advanced";
  const chosen = [...document.querySelectorAll('input[name="detailedGenre"]')].find(input => input.value === value);
  setText("selectedGenreHint", basic ? "その他のジャンルは詳細設定で選べます。" : `選択中：${chosen?.nextElementSibling?.textContent || value}（詳細設定で変更）`);
  document.querySelectorAll('input[name="detailedGenre"]').forEach((input) => {
    input.checked = input.value === value;
  });
}

function initArtistSearch() {
  const input = document.getElementById("artistSearch");
  const results = document.getElementById("artistResults");
  if (!input || !results) return;

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = results.querySelector(".artist-result");
      if (first) {
        e.preventDefault();
        first.click();
      }
    }
  });

  input.addEventListener("input", () => {
    clearTimeout(artistSearchTimer);
    const reqId = ++artistSearchRequestId;
    const keyword = input.value.trim();
    if (!keyword) {
      results.innerHTML = "";
      return;
    }
    artistSearchTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/artists?q=${encodeURIComponent(keyword)}`);
        const artists = await res.json();
        if (reqId !== artistSearchRequestId) return;
        results.innerHTML = "";
        if (!Array.isArray(artists) || !artists.length) {
          results.innerHTML = `<div class="artist-result empty">見つかりませんでした</div>`;
          return;
        }
        artists.forEach((a) => {
          const item = document.createElement("div");
          item.className = "artist-result";
          item.setAttribute("role", "button");
          item.setAttribute("tabindex", "0");
          item.setAttribute("aria-label", `${a.name}を選曲条件に追加`);
          item.innerHTML = `
            <div class="artist-result-identity">
              ${a.image ? `<img src="${escapeHtml(a.image)}" alt="" class="artist-result-avatar" onerror="this.style.display='none'">` : `<span class="artist-result-avatar-fallback">♫</span>`}
              <span class="artist-result-name">${escapeHtml(a.name)}</span>
            </div>
            <div class="artist-result-actions">
              <button type="button" class="artist-result-page-btn" title="${escapeHtml(a.name)}のアーティストページを開く" aria-label="${escapeHtml(a.name)}のアーティストページを開く">
                <span class="artist-page-btn-icon">👤</span>
                <span class="artist-page-btn-arrow">›</span>
              </button>
            </div>
          `;

          // 1. One-click selection: clicking row or icon directly adds artist to search conditions
          const addArtistToSelection = () => {
            if (selectedArtists.some((x) => x.id === a.id)) {
              showToast(`✓ ${a.name} は既に選択されています`);
              return;
            }
            if (selectedArtists.length >= 3) {
              showToast("アーティストは最大3組まで選択できます");
              return;
            }
            selectedArtists.push({ id: a.id, name: a.name, image: a.image || "" });
            selectedArtistId = selectedArtists[0].id;
            selectedArtistName = selectedArtists.map((x) => x.name).join(" × ");
            selectedArtistImage = selectedArtists[0].image || "";
            results.innerHTML = "";
            input.value = "";
            renderSelectedArtist();
            showToast(`✓ ${a.name} を選曲条件に追加しました`);
          };

          item.addEventListener("click", (e) => {
            if (e.target.closest(".artist-result-page-btn")) return;
            addArtistToSelection();
          });

          item.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              if (document.activeElement?.classList?.contains("artist-result-page-btn")) return;
              e.preventDefault();
              addArtistToSelection();
            }
          });

          // 2. Right-hand button with profile icon: navigates to dedicated artist page
          const pageBtn = item.querySelector(".artist-result-page-btn");
          if (pageBtn) {
            pageBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              results.innerHTML = "";
              input.value = "";
              if (typeof window.openArtistDetailPage === "function") {
                window.openArtistDetailPage(a);
              }
            });
          }

          results.appendChild(item);
        });
      } catch {}
    }, 250);
  });
}

function renderSelectedArtist() {
  const s = document.getElementById("selectedArtist");
  if (!s) return;
  if (!selectedArtists.length && selectedArtistId) {
    selectedArtists = [{ id: selectedArtistId, name: selectedArtistName || "Artist", image: selectedArtistImage || "" }];
  }
  if (!selectedArtists.length) {
    s.innerHTML = "";
    s.style.display = "none";
    return;
  }
  s.style.display = "flex";
  s.className = "selected-artists-container";
  s.setAttribute("aria-label", "選択中のアーティスト");

  const remaining = 3 - selectedArtists.length;
  const hintText = remaining > 0 ? `（あと${remaining}組追加可能）` : `（最大3組選択中）`;

  s.innerHTML = `
    <div class="selected-artists-list" role="list">
      ${selectedArtists
        .map(
          (a, idx) => `
        <span class="selected-artist-chip" role="button" tabindex="0"
              aria-label="${escapeHtml(a.name)}のアーティストページを表示"
              title="${escapeHtml(a.name)}をクリックしてアーティスト専用ページを表示"
              onclick="if(typeof openArtistDetailPage==='function'){openArtistDetailPage({id:'${escapeHtml(a.id)}',name:'${escapeHtml(a.name)}',image:'${escapeHtml(a.image||'')}'})}else{openArtistModal('${escapeHtml(a.id)}','${escapeHtml(a.name)}','${escapeHtml(a.image||'')}')}"
              onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();if(typeof openArtistDetailPage==='function'){openArtistDetailPage({id:'${escapeHtml(a.id)}',name:'${escapeHtml(a.name)}',image:'${escapeHtml(a.image||'')}'})}else{openArtistModal('${escapeHtml(a.id)}','${escapeHtml(a.name)}','${escapeHtml(a.image||'')}')}}">
          ${a.image ? `<img src="${escapeHtml(a.image)}" alt="" class="chip-avatar" onerror="this.style.display='none'">` : `<span class="chip-avatar-fallback">🎵</span>`}
          <span class="chip-name">${escapeHtml(a.name)}</span>
          <span class="chip-info-cue" title="専用ページを見る" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          </span>
          <button type="button" class="chip-remove-btn" aria-label="${escapeHtml(a.name)}を解除" title="${escapeHtml(a.name)}を解除" onclick="event.stopPropagation(); removeSelectedArtist(${idx});">×</button>
        </span>
      `
        )
        .join("")}
      <span class="artist-add-hint">${hintText}</span>
      <button type="button" class="selected-artist-clear-all" aria-label="すべてのアーティスト選択を解除" onclick="clearSelectedArtist()">すべて解除</button>
    </div>
  `;
}

window.removeSelectedArtist = function (index) {
  selectedArtists.splice(index, 1);
  selectedArtistId = selectedArtists[0]?.id || "";
  selectedArtistName = selectedArtists.map((x) => x.name).join(" × ");
  selectedArtistImage = selectedArtists[0]?.image || "";
  renderSelectedArtist();
};

window.clearSelectedArtist = function () {
  selectedArtists = [];
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
// Artist Biography & Top Tracks Modal Controller
// -------------------------------------------------------------
const clientArtistDetailsCache = new Map();
let modalAudioPreview = null;
let modalPlayingTrackId = null;

window.openArtistModal = async function (id, name, image) {
  if (typeof document === "undefined") return;
  const modal = document.getElementById("artistModal");
  const content = document.getElementById("artistModalContent");
  if (!modal || !content) return;

  stopModalPreview();

  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("active");
  if (document.body) {
    document.body.classList.add("modal-open");
  }

  // Initial skeleton with existing data
  content.innerHTML = `
    <div class="artist-modal-header-hero">
      <div class="artist-modal-avatar-frame">
        ${image ? `<img src="${escapeHtml(image)}" alt="" class="artist-modal-avatar" onerror="this.style.display='none'">` : `<div class="artist-modal-avatar-fallback">🎵</div>`}
      </div>
      <div class="artist-modal-hero-info">
        <div class="artist-modal-label">ARTIST PROFILE</div>
        <h2 id="artistModalName" class="artist-modal-title">${escapeHtml(name)}</h2>
        <div class="artist-modal-loading-badge">
          <span class="artist-modal-spinner"></span>
          <span>AIバイオグラフィー & 人気曲を読み込み中...</span>
        </div>
      </div>
    </div>
    <div class="artist-modal-loading-skeleton">
      <div class="skeleton-shimmer" style="height: 18px; width: 45%; margin-bottom: 12px; border-radius: 6px;"></div>
      <div class="skeleton-shimmer" style="height: 14px; width: 100%; margin-bottom: 8px; border-radius: 6px;"></div>
      <div class="skeleton-shimmer" style="height: 14px; width: 92%; margin-bottom: 8px; border-radius: 6px;"></div>
      <div class="skeleton-shimmer" style="height: 14px; width: 75%; margin-bottom: 24px; border-radius: 6px;"></div>
      <div class="skeleton-shimmer" style="height: 18px; width: 35%; margin-bottom: 14px; border-radius: 6px;"></div>
      <div class="skeleton-shimmer" style="height: 48px; width: 100%; margin-bottom: 8px; border-radius: 10px;"></div>
      <div class="skeleton-shimmer" style="height: 48px; width: 100%; margin-bottom: 8px; border-radius: 10px;"></div>
    </div>
  `;

  const cacheKey = `${id || "no-id"}:${(name || "").toLowerCase()}`;
  let data = clientArtistDetailsCache.get(cacheKey);

  if (!data) {
    try {
      const url = `/api/artist-details?id=${encodeURIComponent(id || "")}&name=${encodeURIComponent(name || "")}`;
      const res = await fetch(url);
      if (res.ok) {
        data = await res.json();
        clientArtistDetailsCache.set(cacheKey, data);
      }
    } catch (e) {
      console.warn("Failed to fetch artist details:", e);
    }
  }

  if (!data) {
    data = {
      id,
      name,
      image,
      genres: [],
      followers: 0,
      popularity: 0,
      spotifyUrl: id ? `https://open.spotify.com/artist/${id}` : "",
      bio: `${name}は、独自の音楽性でリスナーを魅了するアーティストです。SpotifyやGemini AIで厳選された楽曲をお楽しみいただけます。`,
      summary: `${name}のアーティスト情報`,
      highlights: ["アーティスト", "ミュージック"],
      topTracks: [],
    };
  }

  renderArtistModalContent(data);
};

window.closeArtistModal = function () {
  stopModalPreview();
  if (typeof document === "undefined") return;
  const modal = document.getElementById("artistModal");
  if (modal) {
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("active");
  }
  if (document.body) {
    document.body.classList.remove("modal-open");
  }
};

function stopModalPreview() {
  if (modalAudioPreview) {
    try {
      modalAudioPreview.pause();
      modalAudioPreview.currentTime = 0;
    } catch {}
    modalAudioPreview = null;
  }
  modalPlayingTrackId = null;
  if (typeof document !== "undefined") {
    document.querySelectorAll(".modal-track-play-btn").forEach((btn) => {
      btn.classList.remove("is-playing");
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
      btn.setAttribute("aria-label", "試聴を再生");
    });
  }
}

window.toggleModalTrackPreview = function (previewUrl, trackId, event) {
  if (event) event.stopPropagation();
  if (!previewUrl) {
    if (typeof showToast === "function") showToast("この曲には試聴プレビューが提供されていません");
    return;
  }

  const btn = document.getElementById(`modalPlayBtn-${trackId}`);

  if (modalAudioPreview && modalPlayingTrackId === trackId) {
    stopModalPreview();
    return;
  }

  stopModalPreview();

  try {
    if (typeof Audio === "undefined") return;
    modalAudioPreview = new Audio(previewUrl);
    modalPlayingTrackId = trackId;
    modalAudioPreview.volume = 0.7;

    if (btn) {
      btn.classList.add("is-playing");
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
      btn.setAttribute("aria-label", "試聴を一時停止");
    }

    modalAudioPreview.play().catch((err) => {
      console.warn("Audio preview playback blocked:", err);
      stopModalPreview();
      if (typeof showToast === "function") showToast("プレビュー再生を開始できませんでした");
    });

    modalAudioPreview.onended = () => {
      stopModalPreview();
    };
    modalAudioPreview.onerror = () => {
      stopModalPreview();
      if (typeof showToast === "function") showToast("プレビューの読み込みに失敗しました");
    };
  } catch (err) {
    console.error("Preview error:", err);
    stopModalPreview();
  }
};

window.playModalTrackInApp = function (trackJsonStr) {
  try {
    const track = JSON.parse(decodeURIComponent(trackJsonStr));
    if (typeof playTrack === "function") {
      playTrack(track, 0, false);
      if (typeof showToast === "function") showToast(`「${track.name}」を再生開始`);
      window.closeArtistModal();
    }
  } catch (err) {
    console.error("Failed to play track from modal:", err);
  }
};

function renderArtistModalContent(data) {
  const content = document.getElementById("artistModalContent");
  if (!content) return;

  const followersStr = data.followers > 0 ? `${Number(data.followers).toLocaleString()} 人のフォロワー` : "";
  const genresHtml = Array.isArray(data.genres) && data.genres.length > 0
    ? data.genres.slice(0, 4).map((g) => `<span class="artist-modal-genre-tag">${escapeHtml(g)}</span>`).join("")
    : "";

  const highlightsHtml = Array.isArray(data.highlights) && data.highlights.length > 0
    ? `<div class="artist-modal-highlights">
        ${data.highlights.map((h) => `<span class="artist-highlight-pill">✨ ${escapeHtml(h)}</span>`).join("")}
       </div>`
    : "";

  const topTracksList = Array.isArray(data.topTracks) ? data.topTracks : [];
  const topTracksHtml = topTracksList.length > 0
    ? `
      <div class="artist-modal-section">
        <div class="artist-modal-section-title">
          <span>🔥 人気曲・代表曲 TOP ${topTracksList.length}</span>
          <span class="artist-modal-section-subtitle">クリックで試聴・Spotify連携</span>
        </div>
        <div class="artist-modal-track-list">
          ${topTracksList
            .map((t) => {
              const safeTrackObj = encodeURIComponent(
                JSON.stringify({
                  id: t.id,
                  name: t.name,
                  artists: t.artists || data.name,
                  albumName: t.albumName,
                  image: t.image || data.image,
                  uri: t.uri,
                  preview_url: t.previewUrl,
                  spotifyUrl: t.spotifyUrl,
                })
              );
              return `
              <div class="modal-track-row" id="modalTrackRow-${escapeHtml(t.id)}">
                <span class="modal-track-rank">${t.rank}</span>
                <div class="modal-track-art-wrap">
                  ${t.image ? `<img src="${escapeHtml(t.image)}" alt="" class="modal-track-art" onerror="this.src='/icon.png'">` : `<div class="modal-track-art-fallback">🎵</div>`}
                  ${t.previewUrl ? `
                    <button type="button" class="modal-track-play-btn" id="modalPlayBtn-${escapeHtml(t.id)}" aria-label="試聴プレビューを再生" onclick="toggleModalTrackPreview('${escapeHtml(t.previewUrl)}', '${escapeHtml(t.id)}', event)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    </button>
                  ` : ""}
                </div>
                <div class="modal-track-info" onclick="playModalTrackInApp('${safeTrackObj}')" title="アプリで再生">
                  <div class="modal-track-title">${escapeHtml(t.name)}</div>
                  <div class="modal-track-meta">${escapeHtml(t.albumName || t.artists || data.name)}</div>
                </div>
                <div class="modal-track-actions">
                  ${t.previewUrl ? `
                    <button type="button" class="modal-action-preview-pill" onclick="toggleModalTrackPreview('${escapeHtml(t.previewUrl)}', '${escapeHtml(t.id)}', event)" title="30秒プレビュー試聴">
                      試聴
                    </button>
                  ` : ""}
                  ${t.spotifyUrl ? `
                    <a href="${escapeHtml(t.spotifyUrl)}" target="_blank" rel="noopener noreferrer" class="modal-track-spotify-btn" title="Spotifyで開く" aria-label="${escapeHtml(t.name)}をSpotifyで開く">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.347-1.434-5.303-1.758-8.784-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.807-.87 7.076-.505 9.713 1.113.294.18.386.563.207.857zm1.224-2.72c-.227.369-.712.484-1.08.257-2.686-1.65-6.782-2.128-9.96-1.163-.414.125-.853-.112-.979-.526-.125-.413.112-.852.526-.978 3.633-1.103 8.146-.57 11.236 1.33.369.227.484.712.257 1.08zm.106-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.018-.13-1.168-.624-.15-.494.13-1.018.624-1.168 3.532-1.072 9.404-.866 13.115 1.338.445.264.59.838.327 1.282-.264.444-.838.59-1.282.327z"/></svg>
                    </a>
                  ` : ""}
                </div>
              </div>
            `;
            })
            .join("")}
        </div>
      </div>
    `
    : `
      <div class="artist-modal-section">
        <div class="artist-modal-empty-tracks">代表曲の取得が完了していません</div>
      </div>
    `;

  content.innerHTML = `
    <div class="artist-modal-header-hero">
      <div class="artist-modal-avatar-frame">
        ${data.image ? `<img src="${escapeHtml(data.image)}" alt="${escapeHtml(data.name)}" class="artist-modal-avatar" onerror="this.src='/icon.png'">` : `<div class="artist-modal-avatar-fallback">🎵</div>`}
      </div>
      <div class="artist-modal-hero-info">
        <div class="artist-modal-hero-top-row">
          <span class="artist-modal-badge">ARTIST PROFILE</span>
          ${followersStr ? `<span class="artist-modal-followers">${followersStr}</span>` : ""}
        </div>
        <h2 id="artistModalName" class="artist-modal-title">${escapeHtml(data.name)}</h2>
        ${data.summary ? `<p class="artist-modal-summary">${escapeHtml(data.summary)}</p>` : ""}
        ${genresHtml ? `<div class="artist-modal-genres">${genresHtml}</div>` : ""}
      </div>
    </div>

    <!-- AI Biography Section -->
    <div class="artist-modal-section artist-modal-bio-card">
      <div class="artist-modal-bio-header">
        <span class="artist-modal-ai-tag">✨ AI バイオグラフィー & 魅力</span>
        ${data.spotifyUrl ? `<a href="${escapeHtml(data.spotifyUrl)}" target="_blank" rel="noopener noreferrer" class="artist-modal-spotify-link">Spotifyで開く ↗</a>` : ""}
      </div>
      <p class="artist-modal-bio-text">${escapeHtml(data.bio)}</p>
      ${highlightsHtml}
    </div>

    <!-- Top Tracks Section -->
    ${topTracksHtml}

    <!-- Modal Footer Actions -->
    <div class="artist-modal-footer">
      ${data.spotifyUrl ? `<a href="${escapeHtml(data.spotifyUrl)}" target="_blank" rel="noopener noreferrer" class="artist-modal-btn artist-modal-btn-spotify">Spotifyで全曲を聴く ↗</a>` : ""}
      <button type="button" class="artist-modal-btn artist-modal-btn-secondary" onclick="closeArtistModal()">閉じる</button>
    </div>
  `;
}

// Modal event listeners setup
if (typeof document !== "undefined") {
  const closeBtn = document.getElementById("artistModalClose");
  const backdrop = document.getElementById("artistModalBackdrop");
  const modal = document.getElementById("artistModal");
  if (closeBtn) closeBtn.addEventListener("click", () => window.closeArtistModal());
  if (backdrop) backdrop.addEventListener("click", () => window.closeArtistModal());
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) window.closeArtistModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const m = document.getElementById("artistModal");
      if (m && m.classList.contains("active")) {
        window.closeArtistModal();
      }
    }
  });
}

// -------------------------------------------------------------
// Artist Detail Page (Apple Music iOS Style) Controller
// -------------------------------------------------------------
let artistPageAudioPreview = null;
let artistPagePlayingTrackId = null;
let currentArtistPageData = null;

function stopArtistPagePreview() {
  if (artistPageAudioPreview) {
    try {
      artistPageAudioPreview.pause();
      artistPageAudioPreview.currentTime = 0;
    } catch {}
    artistPageAudioPreview = null;
  }
  artistPagePlayingTrackId = null;
  if (typeof document !== "undefined") {
    document.querySelectorAll(".artist-top-song-row").forEach((row) => {
      row.classList.remove("is-playing");
    });
    document.querySelectorAll(".song-preview-overlay-btn").forEach((btn) => {
      btn.innerHTML = `<span class="preview-play-icon">▶</span>`;
      btn.classList.remove("is-playing");
      btn.setAttribute("aria-label", "試聴を再生");
    });
    document.querySelectorAll(".song-action-pill-btn").forEach((pill) => {
      pill.textContent = "試聴";
      pill.classList.remove("is-playing");
    });
  }
}

window.stopArtistPagePreview = stopArtistPagePreview;

window.toggleArtistPageTrackPreview = function (previewUrl, trackId, event) {
  if (event) event.stopPropagation();
  if (!previewUrl) {
    if (typeof showToast === "function") showToast("この曲には試聴プレビューが提供されていません");
    return;
  }

  if (artistPageAudioPreview && artistPagePlayingTrackId === trackId) {
    stopArtistPagePreview();
    return;
  }

  stopArtistPagePreview();
  if (typeof stopModalPreview === "function") stopModalPreview();

  try {
    if (typeof Audio === "undefined") return;
    artistPageAudioPreview = new Audio(previewUrl);
    artistPagePlayingTrackId = trackId;
    artistPageAudioPreview.volume = 0.7;

    const row = document.querySelector(`.artist-top-song-row[data-track-id="${trackId}"]`);
    if (row) row.classList.add("is-playing");

    const btn = document.getElementById(`artistPagePlayBtn-${trackId}`);
    if (btn) {
      btn.innerHTML = `<span class="preview-play-icon">❚❚</span>`;
      btn.classList.add("is-playing");
      btn.setAttribute("aria-label", "試聴を一時停止");
    }
    const pill = document.getElementById(`artistPagePlayPill-${trackId}`);
    if (pill) {
      pill.textContent = "停止";
      pill.classList.add("is-playing");
    }

    artistPageAudioPreview.play().catch((err) => {
      console.warn("Artist page preview audio playback blocked:", err);
      stopArtistPagePreview();
      if (typeof showToast === "function") showToast("プレビュー再生を開始できませんでした");
    });

    artistPageAudioPreview.onended = () => {
      stopArtistPagePreview();
    };
    artistPageAudioPreview.onerror = () => {
      stopArtistPagePreview();
      if (typeof showToast === "function") showToast("プレビュー音源の読み込みに失敗しました");
    };
  } catch (err) {
    console.error("Artist page preview error:", err);
    stopArtistPagePreview();
  }
};

let artistTopSongsExpanded = false;

window.playArtistTopSong = function (idx, event) {
  if (event && (event.target.closest("a") || event.target.closest(".song-action-pill-btn"))) {
    return;
  }
  const tracks = currentArtistPageData?.topTracks || [];
  const track = tracks[idx];
  if (!track) return;

  const normalized = tracks.map((t) => normalizeTrack(t));
  stopArtistPagePreview();
  startTrackList(normalized, idx);
  if (typeof showToast === "function") {
    showToast(`「${track.title || track.name}」を再生開始`);
  }
};

window.openArtistDetailPage = async function (artist) {
  if (typeof document === "undefined" || !artist) return;
  const artistId = artist.id || "";
  const artistName = artist.name || "";
  const artistImage = artist.image || "";

  artistTopSongsExpanded = false;
  stopArtistPagePreview();
  if (typeof stopModalPreview === "function") stopModalPreview();

  // Switch to artistDetailPage view
  showPage("artistDetailPage");

  // DOM Elements
  const backdrop = document.getElementById("artistHeroBackdrop");
  const heroName = document.getElementById("artistHeroName");
  const navTitle = document.getElementById("artistNavTitle");
  const heroGenres = document.getElementById("artistHeroGenres");
  const spotifyLink = document.getElementById("artistSpotifyLink");
  const pickFiveBtn = document.getElementById("artistPickFiveBtn");
  const addToListBtn = document.getElementById("artistAddToListBtn");
  const releaseCard = document.getElementById("artistLatestReleaseCard");
  const topSongsContainer = document.getElementById("artistTopSongsContainer");
  const catchphrase = document.getElementById("artistCatchphrase");
  const bioBody = document.getElementById("artistBioBody");
  const highlightTags = document.getElementById("artistHighlightTags");

  // Set initial placeholders
  if (heroName) heroName.textContent = artistName || "アーティスト";
  if (navTitle) navTitle.textContent = artistName || "";
  if (heroGenres) heroGenres.textContent = "読み込み中...";
  if (catchphrase) catchphrase.textContent = "";
  if (bioBody) bioBody.textContent = "AIバイオグラフィー & 人気曲を取得しています...";
  if (highlightTags) highlightTags.innerHTML = "";
  if (releaseCard) releaseCard.style.display = "none";

  if (backdrop) {
    if (artistImage) {
      backdrop.src = artistImage;
      backdrop.style.opacity = "0.75";
    } else {
      backdrop.src = "";
      backdrop.style.opacity = "0";
    }
  }

  // Top Songs Skeleton
  if (topSongsContainer) {
    topSongsContainer.innerHTML = `
      <div class="artist-page-skeleton">
        <div class="skeleton-shimmer" style="height: 52px; width: 100%; margin-bottom: 10px; border-radius: 12px;"></div>
        <div class="skeleton-shimmer" style="height: 52px; width: 100%; margin-bottom: 10px; border-radius: 12px;"></div>
        <div class="skeleton-shimmer" style="height: 52px; width: 100%; margin-bottom: 10px; border-radius: 12px;"></div>
        <div class="skeleton-shimmer" style="height: 52px; width: 100%; margin-bottom: 10px; border-radius: 12px;"></div>
        <div class="skeleton-shimmer" style="height: 52px; width: 100%; margin-bottom: 10px; border-radius: 12px;"></div>
      </div>
    `;
  }

  // Update "Add to List" button initial state
  const isAlreadySelected = selectedArtists.some((x) => x.id === artistId);
  if (addToListBtn) {
    if (isAlreadySelected) {
      addToListBtn.innerHTML = `<span class="btn-icon">✓</span> 選択中 (${selectedArtists.length}/3)`;
    } else {
      addToListBtn.innerHTML = `<span class="btn-icon">+</span> 選曲リストに追加`;
    }
  }

  // Fetch full details
  const cacheKey = `${artistId || "no-id"}:${artistName.toLowerCase()}`;
  let data = clientArtistDetailsCache.get(cacheKey);

  if (!data) {
    try {
      const url = `/api/artist-details?id=${encodeURIComponent(artistId)}&name=${encodeURIComponent(artistName)}`;
      const res = await fetch(url);
      if (res.ok) {
        data = await res.json();
        clientArtistDetailsCache.set(cacheKey, data);
      }
    } catch (err) {
      console.warn("Failed to fetch artist details for page:", err);
    }
  }

  if (!data) {
    data = {
      id: artistId,
      name: artistName,
      image: artistImage,
      genres: [],
      followers: 0,
      popularity: 0,
      spotifyUrl: artistId ? `https://open.spotify.com/artist/${artistId}` : "",
      bio: `${artistName}は独自の音楽性で多くのリスナーから高い評価を得ているアーティストです。`,
      summary: `${artistName}のアーティストプロファイル`,
      highlights: ["メロディセンス", "独自の世界観"],
      topTracks: [],
      latestRelease: null,
    };
  }

  currentArtistPageData = data;
  renderArtistDetailPageContent(data);
};

function renderArtistDetailPageContent(data) {
  const backdrop = document.getElementById("artistHeroBackdrop");
  const heroName = document.getElementById("artistHeroName");
  const navTitle = document.getElementById("artistNavTitle");
  const heroGenres = document.getElementById("artistHeroGenres");
  const spotifyLink = document.getElementById("artistSpotifyLink");
  const pickFiveBtn = document.getElementById("artistPickFiveBtn");
  const addToListBtn = document.getElementById("artistAddToListBtn");
  const releaseCard = document.getElementById("artistLatestReleaseCard");
  const topSongsContainer = document.getElementById("artistTopSongsContainer");
  const catchphrase = document.getElementById("artistCatchphrase");
  const bioBody = document.getElementById("artistBioBody");
  const highlightTags = document.getElementById("artistHighlightTags");

  if (heroName) heroName.textContent = data.name || "アーティスト";
  if (navTitle) navTitle.textContent = data.name || "";

  // Backdrop image
  if (backdrop) {
    const bgUrl = data.image || "";
    if (bgUrl) {
      backdrop.src = bgUrl;
      backdrop.style.opacity = "0.85";
    } else {
      backdrop.style.opacity = "0";
    }
  }

  // Genres & Followers
  if (heroGenres) {
    const metaParts = [];
    if (data.followers > 0) metaParts.push(`${Number(data.followers).toLocaleString()} フォロワー`);
    if (Array.isArray(data.genres) && data.genres.length > 0) {
      metaParts.push(...data.genres.slice(0, 3));
    }
    heroGenres.textContent = metaParts.join(" · ") || "Music Artist";
  }

  // Spotify Link
  if (spotifyLink) {
    spotifyLink.href = data.spotifyUrl || (data.id ? `https://open.spotify.com/artist/${data.id}` : "https://open.spotify.com");
  }

  // Wire "Pick 5 Songs" CTA
  if (pickFiveBtn) {
    pickFiveBtn.onclick = () => {
      stopArtistPagePreview();
      selectedArtists = [{ id: data.id, name: data.name, image: data.image || "" }];
      selectedArtistId = data.id;
      selectedArtistName = data.name;
      selectedArtistImage = data.image || "";
      renderSelectedArtist();
      showPage("homePage");
      showToast(`✦ ${data.name} の気分に合わせた5曲を選曲中...`);
      const makeBtn = document.getElementById("makePlaylist");
      if (makeBtn) {
        makeBtn.click();
      }
    };
  }

  // Wire "Add to List" CTA
  if (addToListBtn) {
    const isAlreadySelected = selectedArtists.some((x) => x.id === data.id);
    if (isAlreadySelected) {
      addToListBtn.innerHTML = `<span class="btn-icon">✓</span> 選択中 (${selectedArtists.length}/3)`;
    } else {
      addToListBtn.innerHTML = `<span class="btn-icon">+</span> 選曲リストに追加`;
    }

    addToListBtn.onclick = () => {
      const idx = selectedArtists.findIndex((x) => x.id === data.id);
      if (idx >= 0) {
        selectedArtists.splice(idx, 1);
        selectedArtistId = selectedArtists[0]?.id || "";
        selectedArtistName = selectedArtists.map((x) => x.name).join(" × ");
        selectedArtistImage = selectedArtists[0]?.image || "";
        renderSelectedArtist();
        addToListBtn.innerHTML = `<span class="btn-icon">+</span> 選曲リストに追加`;
        showToast(`${data.name} を選曲リストから解除しました`);
        return;
      }
      if (selectedArtists.length >= 3) {
        showToast("アーティストは最大3組まで選択できます");
        return;
      }
      selectedArtists.push({ id: data.id, name: data.name, image: data.image || "" });
      selectedArtistId = selectedArtists[0].id;
      selectedArtistName = selectedArtists.map((x) => x.name).join(" × ");
      selectedArtistImage = selectedArtists[0].image || "";
      renderSelectedArtist();
      addToListBtn.innerHTML = `<span class="btn-icon">✓</span> 選択中 (${selectedArtists.length}/3)`;
      showToast(`✓ ${data.name} を選曲リストに追加しました (${selectedArtists.length}/3)`);
    };
  }

  // Latest Release Card (Apple Music iOS mockup style)
  if (releaseCard) {
    const rel = data.latestRelease;
    if (rel && (rel.name || rel.image)) {
      releaseCard.style.display = "flex";
      const relImg = document.getElementById("artistReleaseImage");
      const relFallback = releaseCard.querySelector(".release-art-fallback");
      if (relImg) {
        if (rel.image) {
          relImg.src = rel.image;
          relImg.style.display = "block";
          if (relFallback) relFallback.style.display = "none";
        } else {
          relImg.style.display = "none";
          if (relFallback) relFallback.style.display = "flex";
        }
      }
      const kicker = document.getElementById("artistReleaseKicker");
      if (kicker) kicker.textContent = rel.type ? `LATEST ${rel.type.toUpperCase()}` : "LATEST RELEASE";
      const title = document.getElementById("artistReleaseTitle");
      if (title) title.textContent = rel.name || "最新作";
      const meta = document.getElementById("artistReleaseMeta");
      if (meta) {
        const parts = [];
        if (rel.releaseDate) parts.push(rel.releaseDate.slice(0, 4));
        if (rel.totalTracks) parts.push(`${rel.totalTracks} 曲`);
        meta.textContent = parts.join(" · ") || "Single / Album";
      }
      const act = document.getElementById("artistReleaseAction");
      if (act) {
        act.href = rel.spotifyUrl || data.spotifyUrl || "https://open.spotify.com";
      }
    } else {
      releaseCard.style.display = "none";
    }
  }

  // Top Songs List (Top Songs >) - 5 tracks initially, expands to 20 tracks on toggle
  const topSongsToggleBtn = document.getElementById("artistTopSongsToggle");
  const topSongsTitle = document.getElementById("artistTopSongsTitle");
  const topSongsArrow = document.getElementById("artistTopSongsArrow");

  const updateTopSongsDisplay = () => {
    if (!topSongsContainer) return;
    const allTracks = Array.isArray(data.topTracks) ? data.topTracks : [];
    const limit = artistTopSongsExpanded ? 20 : 5;
    const tracks = allTracks.slice(0, limit);

    if (topSongsToggleBtn) {
      topSongsToggleBtn.setAttribute("aria-expanded", String(artistTopSongsExpanded));
      topSongsToggleBtn.title = artistTopSongsExpanded
        ? "5曲表示に戻す"
        : `人気曲をさらに表示 (全${Math.min(allTracks.length, 20)}曲)`;
    }
    if (topSongsTitle) {
      topSongsTitle.textContent = `Top Songs (${tracks.length} / ${Math.min(allTracks.length, 20)})`;
    }
    if (topSongsArrow) {
      topSongsArrow.textContent = artistTopSongsExpanded ? "‹" : "›";
      topSongsArrow.style.transform = artistTopSongsExpanded ? "rotate(-90deg)" : "none";
    }

    if (tracks.length === 0) {
      topSongsContainer.innerHTML = `<div class="artist-top-songs-empty">人気曲の情報を取得できませんでした</div>`;
      return;
    }

    topSongsContainer.innerHTML = tracks
      .map(
        (t, idx) => `
      <div class="artist-top-song-row" data-track-id="${escapeHtml(t.id)}" role="button" tabindex="0" aria-label="${escapeHtml(t.name)}を再生" onclick="window.playArtistTopSong(${idx}, event)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.playArtistTopSong(${idx}, event);}">
        <div class="song-rank">${idx + 1}</div>
        <div class="song-art-wrap">
          ${t.image ? `<img src="${escapeHtml(t.image)}" alt="" class="song-art" onerror="this.style.display='none'">` : `<span class="song-art-fallback">♫</span>`}
          <button type="button" class="song-preview-overlay-btn" id="artistPagePlayBtn-${escapeHtml(t.id)}" aria-label="${escapeHtml(t.name)}を再生">
            <span class="preview-play-icon">▶</span>
          </button>
        </div>
        <div class="song-info-col">
          <div class="song-title">${escapeHtml(t.name)}</div>
          <div class="song-sub">${escapeHtml(t.albumName || t.artists || data.name)}</div>
        </div>
        <div class="song-actions-col">
          ${t.previewUrl ? `
            <button type="button" class="song-action-pill-btn" id="artistPagePlayPill-${escapeHtml(t.id)}" onclick="window.toggleArtistPageTrackPreview('${escapeHtml(t.previewUrl)}', '${escapeHtml(t.id)}', event)">
              試聴
            </button>
          ` : ""}
          ${t.spotifyUrl ? `
            <a href="${escapeHtml(t.spotifyUrl)}" target="_blank" rel="noopener noreferrer" class="song-action-ext-btn" title="Spotifyで聴く" onclick="event.stopPropagation()">↗</a>
          ` : ""}
        </div>
      </div>
    `
      )
      .join("");
  };

  if (topSongsToggleBtn) {
    topSongsToggleBtn.onclick = () => {
      artistTopSongsExpanded = !artistTopSongsExpanded;
      updateTopSongsDisplay();
    };
  }

  updateTopSongsDisplay();

  // Artist Albums (Newest First)
  const albumsContainer = document.getElementById("artistAlbumsContainer");
  if (albumsContainer) {
    const albums = Array.isArray(data.albums) ? data.albums : [];
    if (albums.length === 0) {
      albumsContainer.innerHTML = `<div class="empty-message">アルバム情報はありません</div>`;
    } else {
      albumsContainer.innerHTML = albums
        .map(
          (alb) => `
        <a href="${escapeHtml(alb.spotifyUrl || data.spotifyUrl || "https://open.spotify.com")}" target="_blank" rel="noopener noreferrer" class="artist-album-card" title="${escapeHtml(alb.name)}をSpotifyで開く">
          <div class="artist-album-art-wrap">
            ${alb.image ? `<img src="${escapeHtml(alb.image)}" alt="" class="artist-album-art" onerror="this.style.display='none'">` : `<span class="artist-album-art-fallback">♫</span>`}
          </div>
          <div class="artist-album-info">
            <div class="artist-album-title">${escapeHtml(alb.name)}</div>
            <div class="artist-album-meta">${escapeHtml(alb.releaseDate ? alb.releaseDate.slice(0, 4) : "")}${alb.totalTracks ? ` · ${alb.totalTracks}曲` : ""}</div>
          </div>
        </a>
      `
        )
        .join("");
    }
  }

  // About Section (AI Curator Insight)
  if (catchphrase) catchphrase.textContent = data.summary || "";
  if (bioBody) bioBody.textContent = data.bio || `${data.name}のバイオグラフィー`;
  if (highlightTags) {
    const tags = Array.isArray(data.highlights) ? data.highlights : [];
    if (tags.length > 0) {
      highlightTags.innerHTML = tags.map((h) => `<span class="artist-highlight-tag">✦ ${escapeHtml(h)}</span>`).join("");
    } else {
      highlightTags.innerHTML = "";
    }
  }
}

// Navigation back button listener
if (typeof document !== "undefined") {
  const pageBackBtn = document.getElementById("artistPageBack");
  if (pageBackBtn) {
    pageBackBtn.addEventListener("click", () => {
      stopArtistPagePreview();
      showPage(lastPageBeforeArtistDetail || "homePage");
    });
  }
}

// -------------------------------------------------------------
// Make Playlist: AI Curator & Hybrid Logic
// -------------------------------------------------------------
async function makePlaylist(options = {}) {
  const text = aiMoodText || selectedMood;
  if (!text) {
    alert("気分を選択するか、自由に入力してください。");
    return;
  }

  const isReshuffle = options?.reshuffle === true;
  let excludedTrackUris = getRecentTrackUris();
  if (isReshuffle && Array.isArray(options?.currentTracks)) {
    const currentUris = options.currentTracks.map((t) => t.uri).filter(Boolean);
    excludedTrackUris = [...new Set([...excludedTrackUris, ...currentUris])];
  }

  const excluded = new Set(excludedTrackUris);
  const shouldExclude = excludeRecent;
  const version = recordingVersion;
  const btn = document.getElementById("makePlaylist");
  if (btn) {
    btn.disabled = true;
    btn.textContent = isReshuffle ? "🎲 AIが再選曲中..." : "🤖 AIが選曲中...";
  }

  try {
    let tracks = [];
    aiCuratorNote = "";

    const artistsToUse = selectedArtists.length > 0
      ? selectedArtists
      : (selectedArtistId ? [{ id: selectedArtistId, name: selectedArtistName || "Artist", image: selectedArtistImage || "" }] : []);

    // 1. If multi-artist, free text mood, no artist, or specific genre: use Hybrid Gemini Recommendation
    if (artistsToUse.length > 1 || aiMoodText || artistsToUse.length === 0 || selectedGenre !== "all") {
      const res = await fetch("/api/gemini/recommend-from-mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          analysis: aiMoodAnalysis,
          artistId: artistsToUse[0]?.id || "",
          artistName: artistsToUse.map((a) => a.name).join(" × "),
          artists: artistsToUse,
          genre: selectedGenre !== "all" ? selectedGenre : "",
          excludedTrackUris,
          recordingVersion: version,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "選曲に失敗しました。");
      tracks = data.tracks || [];
      aiCuratorNote = data.curatorNote || "";
    } else if (artistsToUse.length === 1) {
      // 2. Direct artist catalogue query with AI mood ranking
      const excParam = excludedTrackUris.length ? `&excluded=${encodeURIComponent(excludedTrackUris.join(','))}` : '';
      const res = await fetch(`/api/artist-tracks?id=${encodeURIComponent(artistsToUse[0].id)}&mood=${encodeURIComponent(text)}&recordingVersion=${encodeURIComponent(version)}${excParam}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "選曲に失敗しました。");
      tracks = Array.isArray(data) ? data : (data.tracks || []);
      if (data.curatorNote) {
        aiCuratorNote = data.curatorNote;
      } else if (tracks[0]?.reason) {
        aiCuratorNote = `${artistsToUse[0].name}の楽曲の中から、「${text}」の気分にぴったりな5曲をAIが厳選しました。`;
      }
    }

    tracks = normalizeTracks(tracks).filter((t) => !excluded.has(t.uri) && !excluded.has(t.linked_from?.uri));
    tracks = [...new Map(tracks.map((t) => [t.uri, t])).values()].slice(0, 5);
    if (version !== "all" && tracks.length < 5) {
      throw new Error("指定したバージョンで5曲そろいませんでした。アーティスト・ジャンルを変えるか、曲のバージョンを「指定なし」にしてください。");
    }
    if (shouldExclude && tracks.length < 5) {
      throw new Error("最近聴いた曲を除くと5曲そろいませんでした。アーティスト・ジャンルを変えるか、「最近聴いた曲を除外」をオフにしてください。");
    }

    if (tracks.length === 0) {
      throw new Error("条件に合う曲が見つかりませんでした。別の気分やアーティストをお試しください。");
    }

    displayPlaylist(tracks);
    showToast(isReshuffle ? "🎲 別の5曲を引き直しました！" : "🎵 新しいおすすめ5曲を作りました！");
  } catch (err) {
    alert(err.message || "プレイリスト作成に失敗しました。");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "5曲を選ぶ";
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
      <div class="ai-curator-note-header">
        <span class="ai-curator-badge">✨ Gemini AI キュレーター</span>
        <span class="ai-curator-mood-tag">${escapeHtml(selectedMood || "AIおすすめ")}</span>
      </div>
      <div class="ai-curator-message">${escapeHtml(aiCuratorNote)}</div>
    `;
    container.appendChild(note);
  }

  const header = document.createElement("div");
  header.className = "playlist-header";
  header.innerHTML = `
    <h2 class="playlist-title" style="font-size:17px;margin:0;">🎵 ${escapeHtml(selectedMood || "AIおすすめ")} プレイリスト</h2>
  `;

  const headerActions = document.createElement("div");
  headerActions.className = "playlist-header-actions";

  const playAll = document.createElement("button");
  playAll.textContent = "▶ まとめて再生";
  playAll.className = "play-all-button playlist-play-all";
  playAll.addEventListener("click", () => {
    startTrackList(playlist);
  });
  headerActions.appendChild(playAll);

  const reshuffleBtn = document.createElement("button");
  reshuffleBtn.type = "button";
  reshuffleBtn.className = "reshuffle-button";
  reshuffleBtn.innerHTML = "🔄 別の5曲を引き直す";
  reshuffleBtn.title = "同じ条件でAIに別の5曲を選び直してもらいます";
  reshuffleBtn.addEventListener("click", () => {
    reshuffleBtn.disabled = true;
    reshuffleBtn.textContent = "🎲 再選曲中...";
    makePlaylist({ reshuffle: true, currentTracks: playlist }).finally(() => {
      reshuffleBtn.disabled = false;
      reshuffleBtn.textContent = "🔄 別の5曲を引き直す";
    });
  });
  headerActions.appendChild(reshuffleBtn);

  header.appendChild(headerActions);
  container.appendChild(header);

  // Spotify 一括保存ボタン
  const saveBtn = document.createElement("button");
  saveBtn.className = "spotify-save-button";
  saveBtn.textContent = "🎵 Spotifyのプレイリストに一括保存";
  saveBtn.addEventListener("click", () => openSpotifySaveModal(playlist));
  container.appendChild(saveBtn);

  // 曲カード
  if (playlist.length) {
    const tableHeader = document.createElement("div");
    tableHeader.className = "apple-track-table-header";
    tableHeader.innerHTML = `
      <span class="th-col-title">曲</span>
      <span class="th-col-artist">アーティスト</span>
      <span class="th-col-album">アルバム</span>
      <span class="th-col-duration">時間</span>
      <span class="th-col-actions"></span>
    `;
    container.appendChild(tableHeader);
  }

  playlist.forEach((track, index) => {
    container.appendChild(createTrackCard(track, index, playlist));
  });
}

function createTrackCard(track, index, queue = null, onPlay = null) {
  track = normalizeTrack(track);
  const card = document.createElement("div");
  card.className = "track-card apple-track-card";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("data-uri", track.uri || "");

  // 一覧の中の曲を押したら、その一覧を再生リストにして次/前の曲に進めるようにする
  const playFromCard = () => {
    if (onPlay) return onPlay();
    startTrackList(queue?.length ? queue : [track], queue?.length ? index : 0);
  };

  const img = document.createElement("img");
  img.className = "track-image";
  img.src = track.image || "";
  img.alt = "";
  img.onerror = () => {
    img.style.display = "none";
    if (fallback) fallback.style.display = "flex";
  };
  if (!track.image) img.style.display = "none";

  const fallback = document.createElement("span");
  fallback.className = "track-art-fallback";
  fallback.textContent = "♫";
  if (track.image) fallback.style.display = "none";

  const playHover = document.createElement("span");
  playHover.className = "track-hover-play";
  playHover.textContent = "▶";

  const imgWrapper = document.createElement("div");
  imgWrapper.className = "track-image-wrapper";
  imgWrapper.appendChild(img);
  imgWrapper.appendChild(fallback);
  imgWrapper.appendChild(playHover);

  const artistText = getArtistText(track);
  const albumText = track.albumName || "";
  const durationText = track.durationMs > 0 ? formatTime(track.durationMs) : "";

  const info = document.createElement("div");
  info.className = "track-info";
  info.innerHTML = `
    <div class="track-col-title-group">
      <span class="track-title">${escapeHtml(track.title)}</span>
      <span class="track-artist-mobile">${escapeHtml(artistText)}</span>
      ${track.reason ? `<div class="track-reason"><strong class="track-reason-label">💡 なぜこの曲？</strong> <span class="track-reason-body">${escapeHtml(track.reason)}</span></div>` : ""}
      ${
        track.vibeKeywords && track.vibeKeywords.length
          ? `<div class="track-tags">${track.vibeKeywords
              .map((k) => `<span class="track-tag">#${escapeHtml(k)}</span>`)
              .join("")}</div>`
          : ""
      }
    </div>
    <div class="track-col-artist">${escapeHtml(artistText) || "—"}</div>
    <div class="track-col-album">${escapeHtml(albumText) || "—"}</div>
    <div class="track-col-duration">${durationText}</div>
  `;
  info.title = [track.title, artistText, albumText, track.reason].filter(Boolean).join(" · ");

  const main = document.createElement("button");
  main.className = "track-main";
  main.type = "button";
  main.setAttribute("aria-label", `${track.title} — ${artistText}を再生`);
  main.appendChild(imgWrapper);
  main.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "track-actions";

  const favBtn = document.createElement("button");
  favBtn.className = "favorite-button";
  favBtn.type = "button";
  favBtn.dataset.uri = track.uri || "";
  favBtn.dataset.compact = "true";
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

  setPlayerIcon(spotLink, "spotify", "Spotifyで開く");
  actions.appendChild(favBtn);
  actions.appendChild(spotLink);

  card.appendChild(main);
  card.appendChild(actions);

  card.addEventListener("click", () => {
    playFromCard();
  });

  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      playFromCard();
    }
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

// Older saved favorites may predate album/duration fields needed by lyrics.
function fillPlaybackMetadata(saved, track, duration) {
  const patch = {};
  if (!saved.album?.name && track.album?.name) patch.album = { ...saved.album, ...track.album };
  if ((!Number.isFinite(saved.duration_ms) || saved.duration_ms <= 0) && Number.isFinite(duration) && duration > 0) patch.duration_ms = duration;
  if (!saved.artists?.length && track.artists?.length) patch.artists = track.artists;
  return Object.keys(patch).length ? { ...saved, ...patch } : saved;
}
function restorePlayingMetadata(track, duration) {
  const restored = fillPlaybackMetadata(currentTrackData, track, duration);
  if (restored === currentTrackData) return;
  currentTrackData = restored;
  updatePlayerInfo(restored); // Restarts lyrics when the required metadata arrives.
  try {
    const favorites = getFavorites();
    if (!Array.isArray(favorites)) return;
    let changed = false;
    const updated = favorites.map(saved => {
      if (saved.uri !== restored.uri) return saved;
      const filled = fillPlaybackMetadata(saved, track, duration);
      if (filled !== saved) changed = true;
      return filled;
    });
    if (changed) localStorage.setItem("music_picker_favorites", JSON.stringify(updated));
  } catch { /* Storage failure must not interrupt playback or lyrics. */ }
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
    restorePlayingMetadata(track, state.duration);
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
  ["playPauseButton", "menuPlayPauseButton", "fpPlay"].forEach(id => setPlayerIcon(document.getElementById(id), paused ? "play" : "pause", paused ? "再生" : "一時停止"));
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
    ...(usesSystemVolume() ? {} : { volume: appSettings.volume / 100 }),
  });

  spotifyPlayer.addListener("ready", ({ device_id }) => {
    spotifyDeviceId = device_id;
    setVolume(appSettings.volume);
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
  ["playerImage", "menuPlayerImage", "fpImage", "fpBackdrop", "fpThumb"].forEach((id) => {
    const img = document.getElementById(id);
    if (img) img.src = image || "";
  });
}

function updatePlayerInfo(track) {
  track = normalizeTrack(track);
  if (!track) return;
  setNowPlaying(track.title || "曲名なし", getArtistText(track), track.image);
  const artistElement = document.getElementById("fpArtist");
  if (artistElement) {
    artistElement.dataset.artist = getArtistText(track);
    artistElement.dataset.album = track.album?.name || "";
  }
  renderFullPlayerArtist();
  const spotifyLink = document.getElementById("fpSpotifyLink");
  if (spotifyLink) spotifyLink.href = /^[a-zA-Z0-9]+$/.test(track.id || "") ? `https://open.spotify.com/track/${track.id}` : "https://open.spotify.com/";

  refreshLyricsForTrack(track);

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
  if (isSeeking && seekPreview !== null) pos = seekPreview;
  const dur = playerClock.duration || 0;
  ["progressBar", "menuProgressBar", "fpProgress"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.max = dur;
    el.value = pos;
  });
  const cur = formatTime(pos);
  const total = formatTime(dur);
  setText("currentTime", cur);
  setText("menuCurrentTime", cur);
  setText("duration", total);
  setText("menuDuration", total);
  setText("fpCurrent", cur);
  setText("fpDuration", `−${formatTime(Math.max(0, dur - pos))}`);
  document.getElementById("fpProgress")?.style.setProperty?.("--range-progress", `${dur ? Math.min(100, pos / dur * 100) : 0}%`);
  syncLyrics(pos);
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
      const revision = seekRevision;
      const target = seekTarget();
      spotifyPlayer
        .getCurrentState()
        .then((st) => {
          if (st && !isSeeking && revision === seekRevision && target === seekTarget()) onSpotifyPlayerState(st);
        })
        .catch(() => {});
    }
  }, 250);
}

// Own pointer dragging so touch works across the entire track, including
// outside its bounds after capture. Native input/change still handle keyboards.
function bindRangeDrag(el) {
  let pointerId = null;
  const update = event => {
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const min = Number(el.min) || 0, max = Number(el.max) || 0;
    const step = Number(el.step) || 1;
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    el.value = Math.min(max, Math.max(min, min + Math.round(fraction * (max - min) / step) * step));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const finish = event => {
    if (event.pointerId !== pointerId) return;
    const captured = pointerId;
    pointerId = null;
    if (el.hasPointerCapture?.(captured)) el.releasePointerCapture(captured);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  el.addEventListener("pointerdown", event => {
    if (el.disabled || event.isPrimary === false || event.button !== 0 || pointerId !== null) return;
    event.preventDefault();
    pointerId = event.pointerId;
    el.focus({ preventScroll: true });
    el.setPointerCapture(event.pointerId);
    update(event);
  });
  el.addEventListener("pointermove", event => {
    if (event.pointerId === pointerId) { event.preventDefault(); update(event); }
  });
  el.addEventListener("pointerup", event => {
    if (event.pointerId === pointerId) update(event);
    finish(event);
  });
  el.addEventListener("pointercancel", finish);
  el.addEventListener("lostpointercapture", finish);
}

function seekTarget() {
  return `${playbackGeneration}:${currentTrackData?.uri || playerClock.trackId || ""}`;
}

function seekTo(pos) {
  const ms = Math.max(0, Math.round(Number(pos) || 0));
  const target = seekTarget();
  isSeeking = true;
  seekPreview = ms;
  seekRevision++;
  clearTimeout(trackEndTimer);
  renderProgress(ms);
  playerClock = { ...playerClock, position: ms, ts: Date.now() };
  queuedSeek = { pos: ms, target, revision: seekRevision };
  return flushSeek();
}
function bindSeekBar(id) {
  const el = document.getElementById(id);
  if (!el) return;
  let target = null;
  bindRangeDrag(el);
  el.addEventListener("input", () => {
    if (target === null) target = seekTarget();
    isSeeking = true;
    seekPreview = Number(el.value);
    seekRevision++;
    clearTimeout(trackEndTimer);
    renderProgress(seekPreview);
  });
  el.addEventListener("change", () => {
    const request = { pos: Number(el.value), target: target ?? seekTarget(), revision: seekRevision };
    target = null;
    queuedSeek = request;
    return flushSeek();
  });
}

async function flushSeek() {
  if (seekApplying) return seekApplying;
  seekApplying = (async () => {
    while (queuedSeek) {
      const request = queuedSeek;
      queuedSeek = null;
      try {
        if (request.target !== seekTarget()) continue;
        if (!spotifyPlayer) throw new Error("Player unavailable");
        await spotifyPlayer.seek(request.pos);
        if (request.target === seekTarget() && request.revision === seekRevision) {
          playerClock = { ...playerClock, position: request.pos, ts: Date.now() };
        }
      } catch {
        if (request.target === seekTarget() && request.revision === seekRevision) showToast("再生位置を変更できませんでした。もう一度お試しください。");
      } finally {
        if (!queuedSeek && request.revision === seekRevision) {
          isSeeking = false;
          seekPreview = null;
          renderProgress(clockPosition());
          scheduleTrackEnd();
        }
      }
    }
  })();
  try { await seekApplying; }
  finally {
    seekApplying = null;
    if (queuedSeek) return flushSeek();
  }
}

function usesSystemVolume() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent || "") ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function renderVolume(value) {
  const system = usesSystemVolume();
  ["volumeBar", "menuVolumeBar", "fpVolume"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = system;
    el.hidden = system;
    el.value = value;
    if (id === "fpVolume") el.style.setProperty?.("--range-progress", `${value}%`);
  });
  setText("volumeValue", system ? "本体で調整" : `${value}%`);
  setText("menuVolumeValue", system ? "本体の音量ボタンで調整" : `${value}%`);
  const hint = document.getElementById("fpVolumeHint");
  if (hint) hint.hidden = !system;
}
function setVolume(value) {
  if (usesSystemVolume()) { renderVolume(appSettings.volume); return Promise.resolve(); }
  const v = Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
  renderVolume(v);
  if (!spotifyPlayer) {
    confirmedVolume = v;
    saveAppSetting("volume", v);
    return Promise.resolve();
  }
  queuedVolume = v;
  return flushVolume();
}
async function flushVolume() {
  if (volumeApplying) return volumeApplying;
  volumeApplying = (async () => {
    while (queuedVolume !== null) {
      const v = queuedVolume;
      queuedVolume = null;
      try {
        await spotifyPlayer.setVolume(v / 100);
        confirmedVolume = v;
        saveAppSetting("volume", v);
      } catch {
        if (queuedVolume === null) {
          renderVolume(confirmedVolume);
          showToast("音量を変更できませんでした。再接続してお試しください。");
        }
      }
    }
  })();
  try { await volumeApplying; }
  finally {
    volumeApplying = null;
    if (queuedVolume !== null) return flushVolume();
  }
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
  const albumName =
    track.albumName ||
    (typeof track.album === "string" ? track.album : track.album?.name) ||
    "";
  const durationMs =
    track.durationMs || track.duration_ms || track.duration || 0;

  return {
    ...track,
    id,
    uri,
    title,
    artist: artistName,
    artists,
    image,
    albumName,
    durationMs,
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
  if (btn.id === "fpFav") {
    setPlayerIcon(btn, "favorite", exists ? "お気に入りから削除" : "お気に入りに追加");
    btn.setAttribute("aria-pressed", String(exists));
  } else if (btn.dataset.compact === "true") {
    setPlayerIcon(btn, "heart", exists ? "お気に入りから削除" : "お気に入りに追加");
    btn.setAttribute("aria-pressed", String(exists));
  } else btn.textContent = exists ? "❤️" : "♡";
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

function samplePlaylists(list, limit = 4) {
  const unique = [...new Map(list.filter((p) => p?.id).map((p) => [p.id, p])).values()];
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  return unique.slice(0, limit);
}

function setPlaylistListStatus(message, retry = false) {
  for (const id of ["playlistList", "homePlaylists"]) {
    const box = document.getElementById(id);
    if (box) box.innerHTML = `<div class="empty-message" role="status">${escapeHtml(message)}</div>`;
  }
  const refresh = document.getElementById("homePlaylistRefresh");
  if (refresh) {
    refresh.disabled = !retry;
    refresh.textContent = retry ? "再読み込み" : "別のプレイリスト";
  }
}

async function loadSpotifyPlaylists() {
  const reqId = ++playlistLoadId;
  spotifyPlaylistCache = [];
  setPlaylistListStatus("プレイリストを読み込んでいます…");
  try {
    const token = await getFreshSpotifyToken(false);
    if (reqId !== playlistLoadId) return;
    if (!token) {
      spotifyPlaylistCache = [];
      setPlaylistListStatus("Spotifyにログインすると、保存したプレイリストが表示されます。", true);
      return;
    }
    const all = await fetchSpotifyPages("https://api.spotify.com/v1/me/playlists?limit=50", () => reqId !== playlistLoadId);
    if (reqId !== playlistLoadId) return;
    spotifyPlaylistCache = [...new Map(all.filter((p) => p?.id).map((p) => [p.id, p])).values()];
    renderSpotifyPlaylists(spotifyPlaylistCache);
    renderHomePlaylists();
  } catch (e) {
    if (reqId !== playlistLoadId) return;
    spotifyPlaylistCache = [];
    const msg = e.status === 401 || e.status === 403
      ? "プレイリストを取得できませんでした。Spotifyにログインし直してください。"
      : "プレイリストの取得に失敗しました。再読み込みしてください。";
    setPlaylistListStatus(msg, true);
  }
}

function createSpotifyPlaylistCard(p, sourcePage = "favoritesPage") {
  const count = p.tracks?.total ?? p.items?.total;
  const img = p.images?.[1]?.url || p.images?.[0]?.url || "";
  const card = document.createElement("button");
  card.type = "button";
  card.className = "spotify-playlist-card";
  card.innerHTML = `
    <span class="spotify-playlist-image"><span aria-hidden="true">♫</span>${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy">` : ""}</span>
    <span class="spotify-playlist-info">
      <span class="spotify-playlist-name">${escapeHtml(p.name || "プレイリスト")}</span>
      <span class="spotify-playlist-count">${count != null ? `${count}曲` : "Spotifyプレイリスト"}</span>
    </span>
  `;
  const image = card.querySelector?.("img");
  if (image) image.addEventListener("error", () => { image.hidden = true; });
  card.addEventListener("click", () => openSpotifyPlaylist(p, sourcePage));
  return card;
}

function renderSpotifyPlaylists(list) {
  const box = document.getElementById("playlistList");
  if (!box) return;
  box.innerHTML = "";
  if (!list.length) {
    box.innerHTML = `<div class="empty-message">保存したプレイリストはまだありません。</div>`;
    return;
  }
  list.forEach((p) => box.appendChild(createSpotifyPlaylistCard(p)));
}

function renderHomePlaylists() {
  const box = document.getElementById("homePlaylists");
  if (!box) return;
  box.innerHTML = "";
  const chosen = samplePlaylists(spotifyPlaylistCache);
  chosen.forEach((p) => box.appendChild(createSpotifyPlaylistCard(p, "homePage")));
  if (!chosen.length) box.innerHTML = `<div class="empty-message">保存したプレイリストはまだありません。Spotifyでプレイリストを保存すると、ここに表示されます。</div>`;
  const refresh = document.getElementById("homePlaylistRefresh");
  if (refresh) {
    refresh.disabled = chosen.length < 2;
    refresh.textContent = "別のプレイリスト";
  }
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
  const status = error?.status;
  if (status === 401) return "Spotifyにログインし直してください。";
  if (status === 403) return "この内容へのアクセスが許可されていません。Spotifyの権限やプレイリストの共有設定を確認してください。";
  if (status === 404) return "プレイリストが見つからないか、曲の取得に対応していません。Spotifyで開いて確認してください。";
  if (status === 429) return "Spotifyへのアクセスが集中しています。時間をおいて再度お試しください。";
  if (status >= 500) return "Spotify側で一時的な問題が起きています。しばらくしてからお試しください。";
  if (error?.name === "TypeError") return "インターネットに接続できません。通信状況を確認してください。";
  return "取得に失敗しました。通信状況を確認して再度お試しください。";
}

async function openSpotifyPlaylist(playlist, sourcePage = "favoritesPage") {
  playlistSourcePage = sourcePage;
  setText("playlistBack", sourcePage === "homePage" ? "← ホームに戻る" : "← ライブラリに戻る");
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
  const initialHeader = document.getElementById("playlistTracksHeader");
  if (initialHeader) initialHeader.style.display = "none";
  box.innerHTML = '<div class="empty-message" role="status">曲を読み込み中...</div>';
  try {
    const items = await fetchSpotifyPages(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlist.id)}/items?limit=50`, () => requestId !== playlistDetailLoadId);
    if (requestId !== playlistDetailLoadId) return;
    const tracks = items.map((entry, position) => ({ track: entry.item || entry.track, position }))
      .filter(({ track }) => track?.type === "track" && !track.is_local && track.is_playable !== false && track.uri?.startsWith("spotify:track:"));
    setText("playlistMeta", `${items.length}曲・再生可能な曲 ${tracks.length}曲${playlist.owner?.display_name ? ` · ${playlist.owner.display_name}` : ""}`);
    box.innerHTML = "";
    const tracksHeader = document.getElementById("playlistTracksHeader");
    if (!tracks.length) {
      if (tracksHeader) tracksHeader.style.display = "none";
      box.innerHTML = '<div class="empty-message">再生できる曲がありません。Spotifyで開いて確認できます。</div>';
    } else {
      if (tracksHeader) tracksHeader.style.display = "grid";
      tracks.forEach(({ track, position }, index) => box.appendChild(createTrackCard(track, index, null, () => playSpotifyPlaylist(playlist, position, tracks))));
    }
    play.disabled = !tracks.length;
    play.onclick = () => playSpotifyPlaylist(playlist, tracks[0].position, tracks);
  } catch (error) {
    const tracksHeader = document.getElementById("playlistTracksHeader");
    if (tracksHeader) tracksHeader.style.display = "none";
    if (requestId !== playlistDetailLoadId) return;
    box.innerHTML = `<div class="empty-message" role="alert">${escapeHtml(spotifyReadError(error))}</div>`;
    retry.hidden = false;
    retry.onclick = () => openSpotifyPlaylist(playlist, sourcePage);
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
    if (!input || !box) return;
    let timer = null;
    const run = () => {
      clearTimeout(timer);
      runSongSearch(input.value.trim(), box);
    };
    // 入力するたびに自動検索（変換中も含む）。連打を避けるため少しだけ待つ
    input.addEventListener("input", () => {
      clearTimeout(timer);
      if (!input.value.trim()) {
        searchRequestId++; // 進行中の検索を無効化
        box.innerHTML = `<div class="empty-message">曲名やアーティスト名を入力してください</div>`;
        return;
      }
      timer = setTimeout(run, 250);
    });
    // 検索ボタンがあるページ用（なくても動く）
    if (btn) btn.addEventListener("click", run);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        run();
      }
    });
  });
}

// Spotifyの検索は1回10件までなので、offsetをずらして取得する。
// 最初に20曲を表示し、下までスクロールしたら続きを自動で読み込む（無限スクロール）。
const SEARCH_PAGE_SIZE = 10;
const SEARCH_INITIAL_PAGES = 2; // 10 x 2 = まず20曲
const SEARCH_MAX_TRACKS = 200; // 読み込みすぎ防止の上限
const SEARCH_CACHE_MAX = 30;
const searchCache = new Map(); // 同じ検索語は再取得しない
let searchAbort = null;
let searchMoreObserver = null;

function searchCacheSet(key, value) {
  if (searchCache.has(key)) searchCache.delete(key);
  searchCache.set(key, value);
  while (searchCache.size > SEARCH_CACHE_MAX) searchCache.delete(searchCache.keys().next().value);
}

// 429(混雑)のときは Retry-After を見て短く待ち、1回だけ再試行する
async function fetchWithRetry(url, options = {}, retries = 1) {
  const response = await fetch(url, options);
  if (response.status === 429 && retries > 0 && !options.signal?.aborted) {
    const wait = Math.min(Number(response.headers?.get?.("Retry-After")) || 1, 3);
    await new Promise((resolve) => setTimeout(resolve, wait * 1000));
    return fetchWithRetry(url, options, retries - 1);
  }
  return response;
}

// 1ページ分を取得する。ログイン中はSpotifyへ直接、未ログインやトークン失効時はサーバーの /api/search を使う
async function fetchSearchPage(query, offset, token, signal) {
  const viaServer = async () => {
    const res = await fetchWithRetry(`/api/search?q=${encodeURIComponent(query)}&offset=${offset}&limit=${SEARCH_PAGE_SIZE}`, { signal });
    if (!res.ok) throw Object.assign(new Error(`Search ${res.status}`), { status: res.status });
    const data = await res.json();
    return { tracks: data.tracks || [], artist: data.artists?.[0] || null, albums: data.albums || [], next: Boolean(data.next) };
  };
  if (!token) return viaServer();

  const type = offset === 0 ? "track,artist,album" : "track";
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${SEARCH_PAGE_SIZE}&offset=${offset}&market=JP`;
  const res = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` }, signal });
  if (res.status === 401) return viaServer(); // トークン切れでも検索自体は続ける
  if (!res.ok) throw Object.assign(new Error(`Spotify ${res.status}`), { status: res.status });
  const data = await res.json();
  const albums = (data.albums?.items || []).map((alb) => ({
    id: alb.id,
    name: alb.name,
    releaseDate: alb.release_date || "",
    totalTracks: alb.total_tracks || 1,
    type: alb.album_type === "single" ? "Single" : "Album",
    artistName: (alb.artists || []).map(a => a.name).join(", "),
    image: alb.images?.[0]?.url || alb.images?.[1]?.url || "",
    spotifyUrl: alb.external_urls?.spotify || `https://open.spotify.com/album/${alb.id}`,
  }));
  return { tracks: data.tracks?.items || [], artist: data.artists?.items?.[0] || null, albums, next: Boolean(data.tracks?.next) };
}

function dedupeNormalizedTracks(rawTracks, seen = new Set()) {
  return normalizeTracks(rawTracks).filter((t) => {
    const key = t.id || t.uri;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderSearchArtistCard(matchedArtist, box) {
  const artImg = matchedArtist.images?.[0]?.url || matchedArtist.image || "";
  const artCard = document.createElement("div");
  artCard.className = "search-artist-card";
  artCard.setAttribute("role", "button");
  artCard.setAttribute("tabindex", "0");
  artCard.setAttribute("aria-label", `${matchedArtist.name}のアーティストページを開く`);
  artCard.innerHTML = `
    <div class="search-artist-left">
      ${artImg ? `<img src="${escapeHtml(artImg)}" alt="" class="search-artist-avatar">` : `<span class="search-artist-avatar-fallback">♫</span>`}
      <div class="search-artist-text">
        <span class="search-artist-kicker">アーティスト</span>
        <span class="search-artist-name">${escapeHtml(matchedArtist.name)}</span>
        <span class="search-artist-meta">${matchedArtist.followers?.total ? `${Number(matchedArtist.followers.total).toLocaleString()} 人のフォロワー` : "アーティスト専用ページを表示"}</span>
      </div>
    </div>
    <div class="search-artist-arrow-btn">
      <span>詳細</span>
      <span class="arrow-glyph">›</span>
    </div>
  `;
  artCard.addEventListener("click", () => {
    if (typeof window.openArtistDetailPage === "function") {
      window.openArtistDetailPage({ id: matchedArtist.id, name: matchedArtist.name, image: artImg });
    }
  });
  artCard.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      artCard.click();
    }
  });
  box.appendChild(artCard);
}

// 検索結果（アーティストカード + アルバムセクション + 曲の表 + 続きを読み込むセンサー）を描画する
function renderSearchResults(query, state, box) {
  if (searchMoreObserver) {
    searchMoreObserver.disconnect();
    searchMoreObserver = null;
  }
  box.innerHTML = "";
  if (!state.artist && !state.tracks.length && (!state.albums || state.albums.length === 0)) {
    box.innerHTML = `<div class="empty-message">「${escapeHtml(query)}」に一致する曲、アーティスト、アルバムが見つかりませんでした</div>`;
    return;
  }
  if (state.artist) renderSearchArtistCard(state.artist, box);

  if (Array.isArray(state.albums) && state.albums.length > 0) {
    const albumSection = document.createElement("div");
    albumSection.className = "search-albums-section";
    albumSection.innerHTML = `
      <div class="search-section-title" style="font-size:14px;font-weight:700;margin:12px 0 8px;color:var(--text);">アルバム</div>
      <div class="artist-albums-grid">
        ${state.albums.map(alb => `
          <a href="${escapeHtml(alb.spotifyUrl)}" target="_blank" rel="noopener noreferrer" class="artist-album-card" title="${escapeHtml(alb.name)}をSpotifyで開く">
            <div class="artist-album-art-wrap">
              ${alb.image ? `<img src="${escapeHtml(alb.image)}" alt="" class="artist-album-art" onerror="this.style.display='none'">` : `<span class="artist-album-art-fallback">♫</span>`}
            </div>
            <div class="artist-album-info">
              <div class="artist-album-title">${escapeHtml(alb.name)}</div>
              <div class="artist-album-meta">${escapeHtml(alb.artistName || "")} · ${escapeHtml(alb.releaseDate ? alb.releaseDate.slice(0, 4) : "")}</div>
            </div>
          </a>
        `).join("")}
      </div>
    `;
    box.appendChild(albumSection);
  }

  if (state.tracks.length) {
    const trackSection = document.createElement("div");
    trackSection.className = "search-tracks-section";
    const tableHeader = document.createElement("div");
    tableHeader.className = "apple-track-table-header";
    tableHeader.innerHTML = `
      <span class="th-col-title">曲</span>
      <span class="th-col-artist">アーティスト</span>
      <span class="th-col-album">アルバム</span>
      <span class="th-col-duration">時間</span>
      <span class="th-col-actions"></span>
    `;
    trackSection.appendChild(tableHeader);
    // state.tracks を再生キューとして共有するので、後から追加した曲も続けて再生できる
    state.tracks.forEach((t, i) => trackSection.appendChild(createTrackCard(t, i, state.tracks)));
    box.appendChild(trackSection);

    const more = document.createElement("div");
    more.className = "search-more";
    more.style.cssText = "text-align:center;padding:16px 0;color:var(--muted);font-size:12px;";
    box.appendChild(more);
    state.trackSection = trackSection;
    state.moreEl = more;
    updateSearchMore(query, state, box);
  }
}

function updateSearchMore(query, state, box) {
  const more = state.moreEl;
  if (!more) return;
  if (!state.next || state.tracks.length >= SEARCH_MAX_TRACKS) {
    more.textContent = state.tracks.length ? `${state.tracks.length}曲` : "";
    return;
  }
  more.innerHTML = "";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "search-more-button";
  btn.textContent = state.loadingMore ? "読み込み中..." : "もっと見る";
  btn.style.cssText = "padding:10px 22px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--text);cursor:pointer;font-size:13px;";
  btn.addEventListener("click", () => loadMoreSearch(query, state, box));
  more.appendChild(btn);
  // 画面の下に来たら自動で続きを読み込む
  if (typeof IntersectionObserver === "function") {
    searchMoreObserver = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMoreSearch(query, state, box);
    }, { rootMargin: "300px" });
    searchMoreObserver.observe(more);
  }
}

async function loadMoreSearch(query, state, box) {
  if (state.loadingMore || !state.next) return;
  if (searchCache.get(query) !== state) return; // 別の検索に切り替わった
  state.loadingMore = true;
  if (searchMoreObserver) searchMoreObserver.disconnect();
  updateSearchMore(query, state, box);
  const signal = searchAbort?.signal;
  try {
    const token = await getFreshSpotifyToken(false);
    const page = await fetchSearchPage(query, state.offset, token, signal);
    if (signal?.aborted || searchCache.get(query) !== state) return;
    state.offset += SEARCH_PAGE_SIZE;
    state.next = page.next;
    const fresh = dedupeNormalizedTracks(page.tracks, state.seen);
    const startIndex = state.tracks.length;
    state.tracks.push(...fresh);
    fresh.forEach((t, i) => state.trackSection.appendChild(createTrackCard(t, startIndex + i, state.tracks)));
  } catch (e) {
    if (e?.name === "AbortError") return;
    state.moreEl.textContent = spotifyReadError(e);
    state.loadingMore = false;
    return;
  }
  state.loadingMore = false;
  updateSearchMore(query, state, box);
}

async function runSongSearch(query, box) {
  if (!query) {
    searchAbort?.abort();
    box.innerHTML = `<div class="empty-message">曲名やアーティスト名を入力してください</div>`;
    return;
  }
  const reqId = ++searchRequestId;
  // 入力のたびに前の通信を中断する（古い結果が後から表示されるのも防ぐ）
  searchAbort?.abort();
  searchAbort = typeof AbortController === "function" ? new AbortController() : null;
  const signal = searchAbort?.signal;

  const cached = searchCache.get(query);
  if (cached) {
    renderSearchResults(query, cached, box);
    return;
  }
  // 前の結果が出ている間は表示を消さない（入力中のちらつき防止）
  if (!box.querySelector(".search-tracks-section, .search-artist-card")) {
    box.innerHTML = `<div class="empty-message">🔄 検索中...</div>`;
  }

  try {
    const token = await getFreshSpotifyToken(false); // 未ログイン(null)でも /api/search で検索できる
    if (reqId !== searchRequestId) return;

    const pages = [];
    let next = true;
    for (let i = 0; i < SEARCH_INITIAL_PAGES && next; i++) {
      const page = await fetchSearchPage(query, i * SEARCH_PAGE_SIZE, token, signal);
      if (reqId !== searchRequestId) return;
      pages.push(page);
      next = page.next;
    }

    let artist = pages[0]?.artist || null;
    if (!artist) {
      try {
        const res = await fetch(`/api/artists?q=${encodeURIComponent(query)}`, { signal });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length) artist = list[0];
        }
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
      if (reqId !== searchRequestId) return;
    }

    const seen = new Set();
    const tracks = dedupeNormalizedTracks(pages.flatMap((p) => p.tracks), seen);
    const albums = pages[0]?.albums || [];
    const state = { tracks, seen, artist, albums, next, offset: pages.length * SEARCH_PAGE_SIZE, loadingMore: false };
    searchCacheSet(query, state);
    renderSearchResults(query, state, box);
  } catch (e) {
    if (e?.name === "AbortError" || reqId !== searchRequestId) return;
    box.innerHTML = `<div class="empty-message">${escapeHtml(spotifyReadError(e))}</div>`;
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
  ["volumeBar", "menuVolumeBar", "fpVolume"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    bindRangeDrag(el);
    el.addEventListener("input", event => setVolume(event.target.value));
  });
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
  initLyrics();
  initMobileFullPlayer();
  document.getElementById("fpClose")?.addEventListener("click", closeFullPlayer);
  document.getElementById("fpQueueButton")?.addEventListener("click", () => setPlayerQueueOpen(!fp.classList.contains("queue-open")));
  document.getElementById("fpQueueBack")?.addEventListener("click", () => setPlayerQueueOpen(false));
  document.getElementById("fpMoreButton")?.addEventListener("click", () => togglePlayerPopover("fpOptions", "fpMoreButton"));
  document.getElementById("fpVolumeButton")?.addEventListener("click", () => togglePlayerPopover("fpVolumePanel", "fpVolumeButton"));
  document.getElementById("playerLyrics")?.addEventListener("click", () => { openFullPlayer(); setLyricsOpen(true); });
  document.getElementById("playerQueue")?.addEventListener("click", () => { openFullPlayer(); setPlayerQueueOpen(true); });
  fp.addEventListener("click", event => {
    if (!event.target.closest(".fp-control-area, .fp-mobile-actions, .fp-mobile-options, .fp-mobile-volume")) closePlayerPopovers();
  });

  document.getElementById("fpFav")?.addEventListener("click", () => {
    if (currentTrackData) toggleFavorite(currentTrackData);
  });
  ["fpShuffle", "playerShuffle"].forEach(id => document.getElementById(id)?.addEventListener("click", () => setShuffle(!appSettings.shuffle)));
  ["fpInfinite", "menuInfinite"].forEach(id => {
    document.getElementById(id)?.addEventListener("click", () => setInfiniteMode(!infiniteMode));
  });
  ["fpRepeat", "playerRepeat"].forEach(id => document.getElementById(id)?.addEventListener("click", () => {
    const order = ["off", "all", "one"];
    setRepeat(order[(order.indexOf(appSettings.repeat) + 1) % order.length]);
  }));

  setInterval(() => {
    if (!document.hidden && fp.classList.contains("open") && fp.classList.contains("queue-open")) refreshSpotifyQueue();
  }, 10000);
  document.addEventListener("keydown", (e) => {
    if (!fp.classList.contains("open")) return;
    if (e.key === "Escape") {
      if (closePlayerPopovers()) document.getElementById("fpMoreButton")?.focus();
      else closeFullPlayer();
    }
    if (e.key === "Tab") {
      const controls = [...fp.querySelectorAll("button, input, a[href], [tabindex='0']")].filter(el => !el.disabled && el.getClientRects().length);
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
  closePlayerPopovers();
  document.getElementById("fpQueueButton")?.setAttribute("aria-expanded", "false");
  document.getElementById("fpQueueButton")?.classList.remove("active");
  setLyricsOpen(false);
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
    setPlayerIcon(button, "infinite", `無限再生：${infiniteMode ? "オン" : "オフ"}`);
    button.classList.toggle("active", infiniteMode);
    button.setAttribute("aria-pressed", String(infiniteMode));
  });
  ["fpShuffle", "playerShuffle"].forEach(id => {
    const button = document.getElementById(id);
    if (!button) return;
    setPlayerIcon(button, "shuffle", `シャッフル：${appSettings.shuffle ? "オン" : "オフ"}`);
    button.classList.toggle("active", !!appSettings.shuffle);
    button.setAttribute("aria-pressed", String(!!appSettings.shuffle));
  });
  ["fpRepeat", "playerRepeat"].forEach(id => {
    const button = document.getElementById(id);
    if (!button) return;
    const label = { off: "オフ", all: "全曲", one: "1曲" }[appSettings.repeat] || "オフ";
    setPlayerIcon(button, appSettings.repeat === "one" ? "repeatOne" : "repeat", `リピート：${label}`);
    button.classList.toggle("active", appSettings.repeat !== "off");
    button.setAttribute("aria-pressed", String(appSettings.repeat !== "off"));
  });
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

// Lyrics use the same clock as the seek bar; no separate timer can drift.
let lyricsOpen = false;
let lyricsTrack = null;
let lyricsKey = "";
let lyricsRequestId = 0;
let lyricsController = null;
let lyricsLines = [];
let lyricsActiveIndex = -1;
let lyricsFollowing = true;

function parseSyncedLyrics(lrc) {
  const offset = Number(String(lrc).match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0);
  const lines = [];
  for (const line of String(lrc || "").split(/\r?\n/)) {
    const stamps = [...line.matchAll(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
    const text = line.replace(/\[[^\]]*\]/g, "").trim();
    for (const stamp of stamps) {
      const time = Number(stamp[1]) * 60000 + Number(stamp[2]) * 1000 + Number((stamp[3] || "").padEnd(3, "0")) - offset;
      lines.push({ time: Math.max(0, time), text });
    }
  }
  return lines.sort((a, b) => a.time - b.time).slice(0, 2000);
}

function refreshLyricsForTrack(track) {
  lyricsTrack = track;
  const key = JSON.stringify([track?.uri, track?.title || track?.name, track?.artists?.[0]?.name || track?.artist, track?.album?.name, track?.duration_ms]);
  if (key === lyricsKey) return;
  lyricsKey = key;
  lyricsRequestId++;
  lyricsController?.abort();
  lyricsLines = [];
  lyricsActiveIndex = -1;
  if (lyricsOpen) loadLyrics();
}

function setLyricsOpen(open) {
  if (open && mobilePlayerLayout && document.getElementById("fullPlayer")?.classList.contains("queue-open")) setPlayerQueueOpen(false);
  lyricsOpen = open;
  const main = document.querySelector(".fp-main");
  if (main) main.scrollTop = 0;
  document.getElementById("fullPlayer")?.classList.toggle("lyrics-open", open);
  const panel = document.getElementById("fpLyrics");
  if (panel) panel.hidden = !open;
  const button = document.getElementById("fpLyricsButton");
  button?.setAttribute("aria-pressed", String(open));
  button?.classList.toggle("active", open);
  if (open) {
    closePlayerPopovers();
    refreshLyricsForTrack(currentTrackData);
    // refresh may have already started this request for a new track.
    if (!lyricsController) loadLyrics();
  } else {
    lyricsRequestId++;
    lyricsController?.abort();
    lyricsController = null;
  }
}

async function loadLyrics() {
  lyricsController?.abort();
  const requestId = ++lyricsRequestId;
  const controller = new AbortController();
  lyricsController = controller;
  const track = lyricsTrack;
  const container = document.getElementById("fpLyricsLines");
  container.replaceChildren();
  container.scrollTop = 0;
  lyricsLines = [];
  lyricsActiveIndex = -1;
  lyricsFollowing = true;
  document.getElementById("fpLyricsFollow").hidden = true;
  document.getElementById("fpLyricsRetry").hidden = true;
  if (!track?.album?.name || !track?.duration_ms) {
    setText("fpLyricsStatus", track ? "この曲の情報では歌詞を取得できません。" : "曲を再生すると歌詞を表示できます。");
    lyricsController = null;
    return;
  }
  setText("fpLyricsStatus", "歌詞を読み込み中…");
  try {
    const params = new URLSearchParams({ title: track.title || track.name || "", artist: track.artists?.[0]?.name || getArtistText(track), album: track.album.name, duration: String(track.duration_ms / 1000) });
    const res = await fetch(`/api/lyrics?${params}`, { signal: controller.signal });
    const data = await res.json();
    if (requestId !== lyricsRequestId || !lyricsOpen) return;
    if (!res.ok) throw new Error(data.error || "歌詞を取得できませんでした。");
    if (data.status !== "found") {
      setText("fpLyricsStatus", data.status === "instrumental" ? "インストゥルメンタルのため歌詞はありません。" : "この曲の歌詞はまだ見つかりません。別の曲でもお試しください。");
      return;
    }
    lyricsLines = parseSyncedLyrics(data.syncedLyrics);
    const synced = lyricsLines.some(line => line.text);
    if (!synced) lyricsLines = [];
    container.classList.toggle("plain-lyrics", !synced);
    setText("fpLyricsStatus", synced ? "" : "この曲は歌詞の時間情報がないため、全文を表示します。");
    const display = synced ? lyricsLines : String(data.plainLyrics || "").split(/\r?\n/).map(text => ({ text }));
    display.forEach(line => {
      const element = document.createElement("p");
      element.className = "fp-lyric-line";
      element.textContent = line.text || "♪";
      if (synced && Number.isFinite(line.time)) {
        element.setAttribute("role", "button");
        element.setAttribute("tabindex", "0");
        element.setAttribute("aria-label", `${line.text || "歌詞"} (${formatTime(line.time)}へ移動)`);
        element.title = `${formatTime(line.time)} へ移動`;

        const jumpToLine = (e) => {
          e?.stopPropagation?.();
          seekTo(line.time);
          lyricsFollowing = true;
          const followBtn = document.getElementById("fpLyricsFollow");
          if (followBtn) followBtn.hidden = true;
          syncLyrics(line.time, true);
        };

        element.addEventListener("click", jumpToLine);
        element.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            jumpToLine(e);
          }
        });
      }
      container.appendChild(element);
    });
    syncLyrics(clockPosition());
  } catch (error) {
    if (requestId !== lyricsRequestId || error.name === "AbortError") return;
    setText("fpLyricsStatus", error.message || "歌詞を取得できませんでした。");
    document.getElementById("fpLyricsRetry").hidden = false;
  } finally {
    if (requestId === lyricsRequestId) lyricsController = null;
  }
}

function syncLyrics(position, force = false) {
  if (!lyricsOpen || !lyricsLines.length) return;
  let index = -1;
  for (let i = 0; i < lyricsLines.length && lyricsLines[i].time <= position; i++) index = i;
  if (index === lyricsActiveIndex && !force) return;
  lyricsActiveIndex = index;
  const container = document.getElementById("fpLyricsLines");
  [...container.children].forEach((el, i) => {
    el.classList.toggle("current", i === index);
    el.classList.toggle("past", i < index);
    if (i === index) el.setAttribute("aria-current", "true");
    else el.removeAttribute("aria-current");
  });
  const line = container.children[index];
  if (line && lyricsFollowing) container.scrollTo({ top: Math.max(0, line.offsetTop - 12), behavior: "auto" });
}

function initLyrics() {
  window.addEventListener?.("resize", () => syncLyrics(clockPosition(), true));
  document.getElementById("fpLyricsButton")?.addEventListener("click", () => setLyricsOpen(!lyricsOpen));
  document.getElementById("fpLyricsRetry")?.addEventListener("click", loadLyrics);
  document.getElementById("fpLyricsFollow")?.addEventListener("click", () => {
    lyricsFollowing = true;
    document.getElementById("fpLyricsFollow").hidden = true;
    syncLyrics(clockPosition(), true);
    document.getElementById("fpLyricsLines").focus();
  });
  const manual = () => {
    if (!lyricsLines.length) return;
    lyricsFollowing = false;
    document.getElementById("fpLyricsFollow").hidden = false;
  };
  const lines = document.getElementById("fpLyricsLines");
  ["wheel", "touchstart", "pointerdown"].forEach(event => lines?.addEventListener(event, manual, { passive: true }));
  lines?.addEventListener("keydown", event => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) manual();
  });
}

// Shared SVG controls keep transport symbols identical across all players.
const PLAYER_ICONS = {
  play: '<path d="M7 4.5v15L20 12z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" stroke="none"/>',
  previous: '<path d="M12 5v14L1 12zm11 0v14L12 12z" fill="currentColor" stroke="none"/>',
  next: '<path d="M1 5v14l11-7zm11 0v14l11-7z" fill="currentColor" stroke="none"/>',
  shuffle: '<path d="M3 6h2c5 0 9 12 14 12h2m-4-4 4 4-4 4M3 18h2c2 0 4-2 6-5m2-3c2-3 4-4 6-4h2m-4-4 4 4-4 4"/>',
  repeat: '<path d="m16 2 4 4-4 4M4 11V9a3 3 0 0 1 3-3h13M8 22l-4-4 4-4m12-1v2a3 3 0 0 1-3 3H4"/>',
  repeatOne: '<path d="m16 2 4 4-4 4M4 11V9a3 3 0 0 1 3-3h13M8 22l-4-4 4-4m12-1v2a3 3 0 0 1-3 3H4m7-7 2-1v5"/>',
  infinite: '<path d="M12 12c-3-5-4-5-6-5a5 5 0 0 0 0 10c2 0 3-1 6-5s4-5 6-5a5 5 0 0 1 0 10c-2 0-3-1-6-5Z"/>',
  lyrics: '<path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-7l-6 4v-4H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M8 8v3h2c0 2-1 3-2 3m6-6v3h2c0 2-1 3-2 3"/>',
  queue: '<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
  volumeLow: '<path d="M3 9h4l5-4v14l-5-4H3Z" fill="currentColor" stroke="none"/>',
  spotify: '<circle cx="12" cy="12" r="9"/><path d="M6 9c4-1 8-1 12 1M7 12c3-1 7-1 10 1m-9 2c3-.6 5-.5 8 1"/>',
  volume: '<path d="M3 9h4l5-4v14l-5-4H3Zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  more: '<circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="20" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
  back: '<path d="m14 5-7 7 7 7"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  favorite: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
  follow: '<path d="M12 3v4m0 10v4M3 12h4m10 0h4"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1"/>',
  refresh: '<path d="M20 5v6h-6m6 0a8 8 0 1 0-2 7"/>',
};
function playerIcon(name) {
  return `<svg class="player-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PLAYER_ICONS[name] || PLAYER_ICONS.play}</svg>`;
}
function setPlayerIcon(button, name, label) {
  if (!button) return;
  button.innerHTML = playerIcon(name);
  if (label) {
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  }
}
function initPlaybackIcons() {
  document.querySelectorAll("[data-player-icon]").forEach(button => setPlayerIcon(button, button.dataset.playerIcon, button.getAttribute("aria-label")));
}
function closePlayerPopovers() {
  let closed = false;
  for (const [panelId, buttonId] of [["fpOptions", "fpMoreButton"], ["fpVolumePanel", "fpVolumeButton"]]) {
    const panel = document.getElementById(panelId);
    if (mobilePlayerLayout && (panelId === "fpVolumePanel" || (panelId === "fpOptions" && document.getElementById("fullPlayer")?.classList.contains("queue-open")))) continue;
    if (panel && !panel.hidden) {
      panel.hidden = true;
      const button = document.getElementById(buttonId);
      button?.setAttribute("aria-expanded", "false");
      button?.classList.remove("active");
      closed = true;
    }
  }
  return closed;
}
function togglePlayerPopover(panelId, buttonId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const open = panel.hidden;
  closePlayerPopovers();
  panel.hidden = !open;
  const button = document.getElementById(buttonId);
  button?.setAttribute("aria-expanded", String(open));
  button?.classList.toggle("active", open);
}
function setPlayerQueueOpen(open) {
  if (open && mobilePlayerLayout && lyricsOpen) setLyricsOpen(false);
  document.getElementById("fullPlayer")?.classList.toggle("queue-open", open);
  document.getElementById("fpQueueButton")?.setAttribute("aria-expanded", String(open));
  document.getElementById("fpQueueButton")?.classList.toggle("active", open);
  closePlayerPopovers();
  if (mobilePlayerLayout) {
    const panel = document.getElementById("fpOptions");
    if (panel) panel.hidden = !open;
    document.getElementById("fpMoreButton")?.setAttribute("aria-expanded", String(open));
    document.getElementById("fpMoreButton")?.classList.toggle("active", open);
  }
  renderQueue();
  if (open) {
    document.getElementById(mobilePlayerLayout ? "fpQueueButton" : "fpQueueBack")?.focus();
    refreshSpotifyQueue();
  } else {
    document.getElementById("fpMoreButton")?.focus();
    syncLyrics(clockPosition(), true);
  }
}

// Reuse the same controls and listeners in the phone layout, including queue
// mode, so playback, seek and volume remain available in all three views.
let mobilePlayerLayout = false;
function renderFullPlayerArtist() {
  const element = document.getElementById("fpArtist");
  if (!element) return;
  element.textContent = mobilePlayerLayout ? element.dataset.artist || "" : [element.dataset.artist, element.dataset.album].filter(Boolean).join(" — ");
}
function initMobileFullPlayer() {
  const query = window.matchMedia("(max-width: 600px)");
  const moves = [
    ["#fpImage", "fpMobileArt"], [".fp-meta", "fpMobileMetadata"],
    ["#fpFav", "fpMobileActions"], ["#fpMoreButton", "fpMobileActions"],
    [".fp-progress", "fpMobileProgress"], ["#fpPrev", "fpMobileTransport"],
    ["#fpPlay", "fpMobileTransport"], ["#fpNext", "fpMobileTransport"],
    ["#fpVolumePanel", "fpMobileVolume"], ["#fpLyricsButton", "fpMobileLyricsTab"],
    ["#fpQueueButton", "fpMobileQueueTab"], ["#fpOptions", "fpMobileOptions"],
    ["#fpLyrics", "fpMobileContent"], ["#fpQueue", "fpMobileContent"],
  ].map(([selector, targetId]) => {
    const node = document.querySelector(selector);
    const anchor = document.createComment(`desktop ${selector}`);
    node.before(anchor);
    return { node, anchor, target: document.getElementById(targetId) };
  });
  const update = () => {
    if (mobilePlayerLayout === query.matches) return;
    closePlayerPopovers();
    mobilePlayerLayout = query.matches;
    document.getElementById("fpMobile").hidden = !mobilePlayerLayout;
    for (const { node, anchor, target } of moves) {
      if (mobilePlayerLayout) target.appendChild(node);
      else anchor.after(node);
    }
    document.getElementById("fpVolumePanel").hidden = !mobilePlayerLayout;
    const queueOpen = document.getElementById("fullPlayer").classList.contains("queue-open");
    if (mobilePlayerLayout && queueOpen) {
      setLyricsOpen(false);
      document.getElementById("fpOptions").hidden = false;
      document.getElementById("fpMoreButton").setAttribute("aria-expanded", "true");
    }
    renderFullPlayerArtist();
    requestAnimationFrame(() => syncLyrics(clockPosition(), true));
  };
  query.addEventListener("change", update);
  update();
}


// PWA: ホーム画面に追加でき、画面の枠だけオフラインでも開けるようにする
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("Service worker registration failed:", e));
  });
}
