// ============================================================
// Music Picker
// ============================================================
// ============================================================
// 📚 ライブラリ用プレイリスト
// ============================================================

const LIBRARY_PLAYLISTS_KEY =
    "music_picker_playlists";

// ============================================================
// 基本変数
// ============================================================
let trackEndTimer = null;
let trackChangeLock = false;
let playbackGeneration = 0;
let lastEndedTrackUri = "";
let isChangingTrack = false;
let selectedMood = "";
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

let lastHandledEndedUri = "";
let lastHandledEndedTime = 0;

let volumeInitialized = false;


// ============================================================
// 設定
// ============================================================

const APP_SETTINGS_DEFAULTS = {

    theme: "ocean",

    background: "gradient",

    animation: true,

    autoplay: true,

    shuffle: false,

    repeat: "off",

    alwaysShowPlayer: false,

    preferredGenre: "",

    preferredArtist: "",

    dislikedGenre: "",

    notifications: true

};


let appSettings = {
    ...APP_SETTINGS_DEFAULTS
};


// ============================================================
// localStorageキー
// ============================================================

const STORAGE_KEYS = {

    theme:
        "music_picker_theme",

    background:
        "music_picker_background",

    animation:
        "music_picker_animation",

    autoplay:
        "music_picker_autoplay",

    shuffle:
        "music_picker_shuffle",

    repeat:
        "music_picker_repeat",

    alwaysShowPlayer:
        "music_picker_player_always_visible",

    preferredGenre:
        "music_picker_preferred_genre",

    preferredArtist:
        "music_picker_preferred_artist",

    dislikedGenre:
        "music_picker_disliked_genre",

    notifications:
        "music_picker_notifications"

};


// ============================================================
// 気分ごとに違う順番を作る
// ============================================================

function hashString(text) {

    let hash = 2166136261;

    for (let i = 0; i < text.length; i++) {

        hash ^= text.charCodeAt(i);

        hash =
            Math.imul(
                hash,
                16777619
            );

    }

    return hash >>> 0;

}


// ============================================================
// 気分に応じて曲を並べ替える
// ============================================================

function sortTracksByMood(
    tracks,
    mood
) {

    const seed =
        String(mood || "default");

    return [...tracks].sort(
        (a, b) => {

            const aHash =
                hashString(
                    `${seed}:${a.uri || a.id}`
                );

            const bHash =
                hashString(
                    `${seed}:${b.uri || b.id}`
                );

            return aHash - bHash;

        }
    );

}


// ============================================================
// 初期化
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "Music Picker 起動"
        );

        initLogout();

        // ここから下は今までの処理

        // ----------------------------------------------------
        // 前回の曲
        // ----------------------------------------------------

        try {

            previousSongs =
                JSON.parse(
                    localStorage.getItem(
                        "previousSongs"
                    ) || "[]"
                );


            if (
                !Array.isArray(
                    previousSongs
                )
            ) {

                previousSongs = [];

            }

        } catch (_) {

            previousSongs = [];

        }


        // ----------------------------------------------------
        // 設定
        // ----------------------------------------------------

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

        updateLibraryPage();

        initLibraryAccordion();

updateHistoryPage();

updateMenuPlayerEmptyState();
    }
);


// ============================================================
// アプリ設定読み込み
// ============================================================

function loadAppSettings() {

    appSettings.theme =
        getStorageValue(
            STORAGE_KEYS.theme,
            APP_SETTINGS_DEFAULTS.theme
        );


    appSettings.background =
        getStorageValue(
            STORAGE_KEYS.background,
            APP_SETTINGS_DEFAULTS.background
        );


    appSettings.animation =
        getBooleanStorageValue(
            STORAGE_KEYS.animation,
            APP_SETTINGS_DEFAULTS.animation
        );


    appSettings.autoplay =
        getBooleanStorageValue(
            STORAGE_KEYS.autoplay,
            APP_SETTINGS_DEFAULTS.autoplay
        );


    appSettings.shuffle =
        getBooleanStorageValue(
            STORAGE_KEYS.shuffle,
            APP_SETTINGS_DEFAULTS.shuffle
        );


    appSettings.repeat =
        getStorageValue(
            STORAGE_KEYS.repeat,
            APP_SETTINGS_DEFAULTS.repeat
        );


    appSettings.alwaysShowPlayer =
        getBooleanStorageValue(
            STORAGE_KEYS.alwaysShowPlayer,
            APP_SETTINGS_DEFAULTS.alwaysShowPlayer
        );


    appSettings.preferredGenre =
        getStorageValue(
            STORAGE_KEYS.preferredGenre,
            APP_SETTINGS_DEFAULTS.preferredGenre
        );


    appSettings.preferredArtist =
        getStorageValue(
            STORAGE_KEYS.preferredArtist,
            APP_SETTINGS_DEFAULTS.preferredArtist
        );


    appSettings.dislikedGenre =
        getStorageValue(
            STORAGE_KEYS.dislikedGenre,
            APP_SETTINGS_DEFAULTS.dislikedGenre
        );


    appSettings.notifications =
        getBooleanStorageValue(
            STORAGE_KEYS.notifications,
            APP_SETTINGS_DEFAULTS.notifications
        );

}


// ============================================================
// 設定保存
// ============================================================

function saveAppSetting(
    key,
    value
) {

    appSettings[key] = value;


    const storageKey =
        STORAGE_KEYS[key];


    if (!storageKey) {
        return;
    }


    localStorage.setItem(
        storageKey,
        String(value)
    );

}


// ============================================================
// localStorage取得
// ============================================================

function getStorageValue(
    key,
    fallback
) {

    const value =
        localStorage.getItem(key);


    return value === null
        ? fallback
        : value;

}


// ============================================================
// Boolean localStorage
// ============================================================

function getBooleanStorageValue(
    key,
    fallback
) {

    const value =
        localStorage.getItem(key);


    if (value === null) {
        return fallback;
    }


    return value === "true";

}


// ============================================================
// 設定を画面へ適用
// ============================================================

function applyAppSettings() {

    document.body.dataset.theme =
        appSettings.theme;


    document.body.dataset.background =
        appSettings.background;


    document.body.dataset.animation =
        appSettings.animation
            ? "on"
            : "off";

}


// ============================================================
// 下部ナビゲーション
// ============================================================

function initBottomNav() {

    const links =
        document.querySelectorAll(
            ".bottom-nav-link"
        );


    links.forEach(
        link => {

            link.addEventListener(
                "click",
                () => {

                    const pageId =
                        link.dataset.page;


                    showPage(
                        pageId
                    );

                }
            );

        }
    );

}


// ============================================================
// ハンバーガーメニュー
// ============================================================

function initMenu() {

    const menuButton =
        document.getElementById(
            "menuButton"
        );


    const closeButton =
        document.getElementById(
            "menuCloseButton"
        );


    const sideMenu =
        document.getElementById(
            "sideMenu"
        );


    const overlay =
        document.getElementById(
            "menuOverlay"
        );


    const menuLinks =
        document.querySelectorAll(
            ".menu-link"
        );


    if (
        !menuButton ||
        !sideMenu
    ) {

        return;

    }


    menuButton.addEventListener(
        "click",
        () => {

            if (
                sideMenu.classList.contains(
                    "open"
                )
            ) {

                closeMenu();

            } else {

                openMenu();

            }

        }
    );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeMenu
        );

    }


    if (overlay) {

        overlay.addEventListener(
            "click",
            closeMenu
        );

    }


    menuLinks.forEach(
        link => {

            link.addEventListener(
                "click",
                () => {

                    showPage(
                        link.dataset.page
                    );

                    closeMenu();

                }
            );

        }
    );


    // --------------------------------------------------------
    // Escキー
    // --------------------------------------------------------

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeMenu();

            }

        }
    );

}


// ============================================================
// メニューを開く
// ============================================================

function openMenu() {

    const sideMenu =
        document.getElementById(
            "sideMenu"
        );


    const overlay =
        document.getElementById(
            "menuOverlay"
        );


    if (sideMenu) {

        sideMenu.classList.add(
            "open"
        );

    }


    if (overlay) {

        overlay.classList.add(
            "open"
        );

    }


    syncMenuSettingsUI();

}


// ============================================================
// メニューを閉じる
// ============================================================

function closeMenu() {

    const sideMenu =
        document.getElementById(
            "sideMenu"
        );


    const overlay =
        document.getElementById(
            "menuOverlay"
        );


    if (sideMenu) {

        sideMenu.classList.remove(
            "open"
        );

    }


    if (overlay) {

        overlay.classList.remove(
            "open"
        );

    }

}


// ============================================================
// ページ切り替え
// ============================================================

function showPage(
    pageId
) {

    document.querySelectorAll(
        ".page"
    ).forEach(
        page => {

            page.classList.remove(
                "active-page"
            );

        }
    );


    const page =
        document.getElementById(
            pageId
        );


    if (page) {

        page.classList.add(
            "active-page"
        );

    }


    // --------------------------------------------------------
    // サイドメニュー
    // --------------------------------------------------------

    document.querySelectorAll(
        ".menu-link"
    ).forEach(
        link => {

            link.classList.toggle(
                "active",
                link.dataset.page ===
                pageId
            );

        }
    );


    // --------------------------------------------------------
    // 下部ナビ
    // --------------------------------------------------------

    document.querySelectorAll(
        ".bottom-nav-link"
    ).forEach(
        link => {

            link.classList.toggle(
                "active",
                link.dataset.page ===
                pageId
            );

        }
    );


    if (
    pageId ===
    "favoritesPage"
) {

    updateLibraryPage();

}


    if (
        pageId ===
        "historyPage"
    ) {

        updateHistoryPage();

    }

}


// ============================================================
// ホーム
// ============================================================

function initHome() {

    const moodButtons =
        document.querySelectorAll(
            ".moods button"
        );


    moodButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    moodButtons.forEach(
                        btn => {

                            btn.classList.remove(
                                "selected"
                            );

                        }
                    );


                    button.classList.add(
                        "selected"
                    );


                    selectedMood =
                        button.dataset.mood ||
                        button.textContent.trim();


                    console.log(
                        "選択した気分:",
                        selectedMood
                    );

                }
            );

        }
    );


    const genre =
        document.getElementById(
            "genre"
        );


    if (genre) {

        selectedGenre =
            genre.value || "all";


        genre.addEventListener(
            "change",
            () => {

                selectedGenre =
                    genre.value;


                console.log(
                    "選択したジャンル:",
                    selectedGenre
                );

            }
        );

    }


    initArtistSearch();


    const makeButton =
        document.getElementById(
            "makePlaylist"
        );


    if (makeButton) {

        makeButton.addEventListener(
            "click",
            makePlaylist
        );

    }

}


// ============================================================
// アーティスト検索
// ============================================================

function initArtistSearch() {

    const input =
        document.getElementById(
            "artistSearch"
        );


    const results =
        document.getElementById(
            "artistResults"
        );


    const selected =
        document.getElementById(
            "selectedArtist"
        );


    if (
        !input ||
        !results
    ) {

        return;

    }


    input.addEventListener(
        "input",
        async () => {

            const keyword =
                input.value.trim();


            const requestId =
                ++searchRequestId;


            // ------------------------------------------------
            // 新しい検索なら
            // アーティスト選択解除
            // ------------------------------------------------

            if (keyword) {

                selectedArtistId = "";

                selectedArtistName = "";

                selectedArtistImage = "";


                if (selected) {

                    selected.innerHTML = "";

                    selected.style.display =
                        "none";

                }

            }


            if (!keyword) {

                results.innerHTML = "";

                return;

            }


            results.innerHTML =
                `
                <div class="loading">
                    🔎 検索中...
                </div>
                `;


            try {

                const response =
                    await fetch(
                        `/api/artists?q=${encodeURIComponent(
                            keyword
                        )}`
                    );


                if (!response.ok) {

                    if (
                        response.status ===
                        429
                    ) {

                        throw new Error(
                            "Spotify APIの利用上限に達しています。"
                        );

                    }


                    throw new Error(
                        `HTTP ${response.status}`
                    );

                }


                const artists =
                    await response.json();


                // 古い検索結果は無視

                if (
                    requestId !==
                    searchRequestId
                ) {

                    return;

                }


                results.innerHTML = "";


                if (
                    !Array.isArray(
                        artists
                    ) ||
                    artists.length === 0
                ) {

                    results.innerHTML =
                        `
                        <div class="no-results">
                            アーティストが見つかりません
                        </div>
                        `;

                    return;

                }


                artists.forEach(
                    artist => {

                        const item =
                            document.createElement(
                                "div"
                            );


                        item.className =
                            "artist-result";


                        const image =
                            document.createElement(
                                "img"
                            );


                        image.src =
                            artist.image ||
                            artist.images?.[0]?.url ||
                            "";


                        image.alt =
                            artist.name ||
                            "";


                        image.onerror = () => {
    console.warn(
        "ジャケット画像の読み込み失敗:",
        image.src
    );

    image.removeAttribute("src");
};


                        const name =
                            document.createElement(
                                "span"
                            );


                        name.textContent =
                            artist.name ||
                            "名前なし";


                        item.appendChild(
                            image
                        );


                        item.appendChild(
                            name
                        );


                        item.addEventListener(
                            "click",
                            () => {

                                selectArtist(
                                    artist
                                );


                                results.innerHTML =
                                    "";


                                input.value =
                                    "";

                            }
                        );


                        results.appendChild(
                            item
                        );

                    }
                );


            } catch (error) {

                console.error(
                    "アーティスト検索エラー:",
                    error
                );


                results.innerHTML =
                    `
                    <div class="error-message">
                        ${escapeHtml(
                            error.message
                        )}
                    </div>
                    `;

            }

        }
    );

}


// ============================================================
// アーティスト選択
// ============================================================

function selectArtist(
    artist
) {

    selectedArtistId =
        artist.id || "";


    selectedArtistName =
        artist.name || "";


    selectedArtistImage =
        artist.image ||
        artist.images?.[0]?.url ||
        "";


    console.log(
        "選択アーティスト:",
        selectedArtistName,
        selectedArtistId
    );


    const selected =
        document.getElementById(
            "selectedArtist"
        );


    if (!selected) {
        return;
    }


    selected.innerHTML = "";


    const card =
        document.createElement(
            "div"
        );


    card.className =
        "selected-artist-card";


    const image =
        document.createElement(
            "img"
        );


    image.className =
        "selected-artist-image";


    image.src =
        selectedArtistImage;


    image.alt =
        selectedArtistName;


    image.onerror =
        () => {

            image.style.display =
                "none";

        };


    const info =
        document.createElement(
            "div"
        );


    info.className =
        "selected-artist-info";


    const name =
        document.createElement(
            "strong"
        );


    name.textContent =
        selectedArtistName;


    const check =
        document.createElement(
            "span"
        );


    check.className =
        "selected-check";


    check.textContent =
        "✓ 選択中";


    info.appendChild(
        name
    );


    info.appendChild(
        check
    );


    card.appendChild(
        image
    );


    card.appendChild(
        info
    );


    selected.appendChild(
        card
    );


    selected.style.display =
        "block";

}


// ============================================================
// プレイリスト作成
// ============================================================

async function makePlaylist() {

    if (!selectedMood) {

        alert(
            "気分を選択してください。"
        );

        return;

    }


    if (
        !selectedArtistId &&
        (
            !selectedGenre ||
            selectedGenre === "all"
        )
    ) {

        alert(
            "アーティストまたはジャンルを選択してください。"
        );

        return;

    }


    const button =
        document.getElementById(
            "makePlaylist"
        );


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "🎵 曲を探しています...";

    }


    try {

        let tracks = [];


        // ====================================================
        // アーティスト
        // ====================================================

        if (selectedArtistId) {

            const url =
                `/api/artist-tracks?id=${encodeURIComponent(
                    selectedArtistId
                )}&mood=${encodeURIComponent(
                    selectedMood
                )}`;


            const response =
                await fetch(url);


            if (!response.ok) {

                const error =
                    await response.json()
                        .catch(
                            () => ({})
                        );


                throw new Error(
                    error.error ||
                    "アーティストの曲取得に失敗しました。"
                );

            }


            tracks =
                await response.json();

        }


        // ====================================================
        // ジャンル
        // ====================================================

        else {

            const url =
                `/api/genre-tracks?genre=${encodeURIComponent(
                    selectedGenre
                )}&mood=${encodeURIComponent(
                    selectedMood
                )}`;


            const response =
                await fetch(url);


            if (!response.ok) {

                const error =
                    await response.json()
                        .catch(
                            () => ({})
                        );


                throw new Error(
                    error.error ||
                    "ジャンルの曲取得に失敗しました。"
                );

            }


            tracks =
                await response.json();

        }


        // ====================================================
        // 不正データ除外
        // ====================================================

        tracks =
            Array.isArray(tracks)
                ? tracks.filter(
                    track =>
                        track &&
                        track.uri
                )
                : [];


        console.log(
            "Spotifyから取得:",
            tracks.length,
            "曲"
        );


        // ====================================================
        // Normalize
        // ====================================================

        tracks =
            normalizeTracks(
                tracks
            );


        // ====================================================
        // 重複削除
        // ====================================================

        const uniqueMap =
            new Map();


        tracks.forEach(
            track => {

                if (
                    !uniqueMap.has(
                        track.uri
                    )
                ) {

                    uniqueMap.set(
                        track.uri,
                        track
                    );

                }

            }
        );


        tracks =
            Array.from(
                uniqueMap.values()
            );


        console.log(
            "重複削除後:",
            tracks.length,
            "曲"
        );


        // ====================================================
        // 気分で並べ替え
        // ====================================================

        tracks =
            sortTracksByMood(
                tracks,
                selectedMood
            );


        // ====================================================
        // 前回曲を除外
        // ====================================================

        const previousSet =
            new Set(
                previousSongs
            );


        let newTracks =
            tracks.filter(
                track =>
                    !previousSet.has(
                        track.uri
                    )
            );


        console.log(
            "前回曲を除外後:",
            newTracks.length,
            "曲"
        );


        // ====================================================
        // 前回曲を除外しすぎて5曲未満の場合
        // ====================================================

        if (
            newTracks.length < 5
        ) {

            console.log(
                "新曲が5曲未満なので、取得曲から補充します。"
            );


            const alreadySelected =
                new Set(
                    newTracks.map(
                        track =>
                            track.uri
                    )
                );


            for (
                const track of tracks
            ) {

                if (
                    newTracks.length >= 5
                ) {

                    break;

                }


                if (
                    alreadySelected.has(
                        track.uri
                    )
                ) {

                    continue;

                }


                newTracks.push(
                    track
                );


                alreadySelected.add(
                    track.uri
                );

            }

        }


        // ====================================================
        // 5曲決定
        // ====================================================

        let playlist =
            newTracks.slice(
                0,
                5
            );


        if (
            playlist.length < 5
        ) {

            alert(
                "5曲見つかりませんでした。\n" +
                "別のアーティスト・ジャンル・気分で試してください。"
            );

            return;

        }


        // ====================================================
        // 現在のプレイリスト
        // ====================================================

        currentPlaylist =
            normalizeTracks(
                playlist
            );


        currentTrackIndex =
            0;


        isPlaylistMode =
            true;


        // ====================================================
        // 前回曲として保存
        // ====================================================

        previousSongs.push(
            ...playlist.map(
                track =>
                    track.uri
            )
        );


        if (
            previousSongs.length > 20
        ) {

            previousSongs =
                previousSongs.slice(
                    -20
                );

        }


        localStorage.setItem(
            "previousSongs",
            JSON.stringify(
                previousSongs
            )
        );


        // ====================================================
        // 履歴
        // ====================================================

        saveToHistory(
            playlist
        );


        // ====================================================
        // 表示
        // ====================================================

       displayPlaylist(playlist);




        if (
            appSettings.notifications
        ) {

            showToast(
                "🎵 新しいおすすめ5曲を作りました！"
            );

        }


        console.log(
            "🎵 決定した5曲:",
            playlist
        );


    } catch (error) {

        console.error(
            "Playlist Error:",
            error
        );


        alert(
            error.message ||
            "プレイリスト作成に失敗しました。"
        );


    } finally {

        if (button) {

            button.disabled =
                false;

            button.textContent =
                "🎵 おすすめ5曲を作る";

        }

    }

}


// ============================================================
// 気分別シャッフル
// ============================================================

function moodShuffle(
    tracks,
    mood
) {

    const moodSeeds = {

        "楽しい": 137,

        "テンション高い": 421,

        "落ち着きたい": 763,

        "しんみり": 982

    };


    const seed =
        moodSeeds[mood] ||
        555;


    const result =
        [...tracks];


    let currentSeed =
        seed;


    function random() {

        currentSeed =
            (
                currentSeed *
                9301 +
                49297
            ) %
            233280;


        return (
            currentSeed /
            233280
        );

    }


    for (
        let i =
            result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                random() *
                (i + 1)
            );


        [
            result[i],
            result[j]
        ] =
        [
            result[j],
            result[i]
        ];

    }


    return result;

}


// ============================================================
// プレイリスト表示
// ============================================================

function displayPlaylist(
    playlist
) {

    const container =
        document.getElementById(
            "playlist"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        "";


    // ========================================================
    // ヘッダー
    // ========================================================

    const header =
        document.createElement(
            "div"
        );


    header.className =
        "playlist-header";


    const title =
        document.createElement(
            "h2"
        );


    title.textContent =
        `🎵 ${selectedMood}のおすすめ5曲`;


    const playAll =
        document.createElement(
            "button"
        );


    playAll.className =
        "play-all-button";


    playAll.textContent =
        "▶ まとめて再生";


    playAll.addEventListener(
        "click",
        async () => {

            let playbackPlaylist =
                normalizeTracks(
                    playlist
                );


            // ------------------------------------------------
            // シャッフルONなら
            // 再生順だけシャッフル
            // ------------------------------------------------

            if (
                appSettings.shuffle
            ) {

                playbackPlaylist =
                    shuffleArray(
                        [...playbackPlaylist]
                    );

            }


            currentPlaylist =
                playbackPlaylist;


            currentTrackIndex =
                0;


            isPlaylistMode =
                true;


            await playTrack(
                currentPlaylist[0],
                0,
                true
            );

        }
    );


    header.appendChild(
        title
    );


    header.appendChild(
        playAll
    );


    container.appendChild(
        header
    );

// ====================================================
// Spotifyに保存ボタン
// ====================================================

const saveSpotifyButton =
    document.createElement("button");

saveSpotifyButton.className =
    "spotify-save-button";

saveSpotifyButton.textContent =
    "🎵 Spotifyに保存";

saveSpotifyButton.addEventListener(
    "click",
    () => {

        openSpotifySaveModal(
            playlist
        );

    }
);

container.appendChild(
    saveSpotifyButton
);
    // ========================================================
    // 曲カード
    // ========================================================

    playlist.forEach(
        (track, index) => {

            container.appendChild(
                createTrackCard(
                    track,
                    index
                )
            );

        }
    );

}


// ============================================================
// 曲カード
// ============================================================

function createTrackCard(
    track,
    index
) {

    track =
        normalizeTrack(
            track
        );


    const card =
        document.createElement(
            "div"
        );


    card.className =
        "track-card";


    // --------------------------------------------------------
    // ジャケット
    // --------------------------------------------------------

    const image =
        document.createElement(
            "img"
        );


    image.className =
        "track-image";


    image.src =
        track.image || "";


    image.alt =
        track.title || "";


    image.onerror =
        () => {

            image.style.display =
                "none";

        };


    // --------------------------------------------------------
    // 曲情報
    // --------------------------------------------------------

    const info =
        document.createElement(
            "div"
        );


    info.className =
        "track-info";


    const title =
        document.createElement(
            "div"
        );


    title.className =
        "track-title";


    title.textContent =
        track.title;


    const artist =
        document.createElement(
            "div"
        );


    artist.className =
        "track-artist";


    artist.textContent =
        getArtistText(
            track
        );


    info.appendChild(
        title
    );


    info.appendChild(
        artist
    );


    // --------------------------------------------------------
    // ボタン
    // --------------------------------------------------------

    const actions =
        document.createElement(
            "div"
        );


    actions.className =
        "track-actions";


    // --------------------------------------------------------
    // 再生
    // --------------------------------------------------------

    const play =
        document.createElement(
            "button"
        );


    play.className =
        "track-play-button";


    play.textContent =
        "▶";


    play.addEventListener(
        "click",
        async event => {

            event.stopPropagation();


            currentPlaylist =
                [track];


            currentTrackIndex =
                0;


            isPlaylistMode =
                false;


            await playTrack(
                track,
                0,
                false
            );

        }
    );


    // --------------------------------------------------------
    // お気に入り
    // --------------------------------------------------------

    const favorite =
        document.createElement(
            "button"
        );


    favorite.className =
        "favorite-button";


    updateFavoriteButton(
        favorite,
        track
    );


    favorite.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            toggleFavorite(
                track
            );


            updateFavoriteButton(
                favorite,
                track
            );

        }
    );


    // --------------------------------------------------------
    // Spotify
    // --------------------------------------------------------

    const spotify =
        document.createElement(
            "a"
        );


    spotify.className =
        "spotify-button";


    spotify.textContent =
        "Spotify";


    spotify.target =
        "_blank";


    spotify.rel =
        "noopener noreferrer";


    spotify.href =
        track.spotifyUrl ||
        (
            track.id
                ? `https://open.spotify.com/track/${track.id}`
                : "#"
        );


    spotify.addEventListener(
        "click",
        event => {

            event.stopPropagation();

        }
    );


    actions.appendChild(
        play
    );


    actions.appendChild(
        favorite
    );


    actions.appendChild(
        spotify
    );


    card.appendChild(
        image
    );


    card.appendChild(
        info
    );


    card.appendChild(
        actions
    );


    // --------------------------------------------------------
    // カードクリック
    // --------------------------------------------------------

    card.addEventListener(
        "click",
        async () => {

            currentPlaylist =
                [track];


            currentTrackIndex =
                0;


            isPlaylistMode =
                false;


            await playTrack(
                track,
                0,
                false
            );

        }
    );


    return card;

}


// ============================================================
// Spotify再生
// ============================================================

async function playTrack(
    track,
    index = 0,
    playlistMode = false
) {

    const requestId =
        ++playbackRequestId;

        playbackGeneration++;
      
        clearTrackEndTimer();


    track =
        normalizeTrack(
            track
        );


    if (
        !track ||
        !track.uri
    ) {

        alert(
            "この曲は再生できません。"
        );

        return;

    }


    // --------------------------------------------------------
    // Token
    // --------------------------------------------------------

    spotifyToken =
        localStorage.getItem(
            "spotify_access_token"
        ) || "";


    if (!spotifyToken) {

        alert(
            "Spotifyにログインしてください。"
        );

        return;

    }


    // --------------------------------------------------------
    // Player
    // --------------------------------------------------------

    if (!spotifyPlayer) {

        setupSpotifyPlayer();

    }


    const ready =
        await waitForSpotifyDevice(
            10000
        );


    if (
        requestId !==
        playbackRequestId
    ) {

        return;

    }


    if (
        !ready ||
        !spotifyDeviceId
    ) {

        alert(
            "Spotifyプレイヤーが準備できませんでした。\n" +
            "Spotifyにログインしてから再生してください。"
        );

        return;

    }


    try {

        // ----------------------------------------------------
        // 現在の曲情報
        // ----------------------------------------------------

        if (playlistMode) {

            currentPlaylist =
                normalizeTracks(
                    currentPlaylist
                );


            currentTrackIndex =
                Math.max(
                    0,
                    Math.min(
                        index,
                        currentPlaylist.length - 1
                    )
                );

        } else {

            currentPlaylist =
                [track];

            currentTrackIndex =
                0;

        }


        isPlaylistMode =
            playlistMode;


        // ----------------------------------------------------
        // ブラウザ再生許可
        // ----------------------------------------------------

        if (
            spotifyPlayer.activateElement
        ) {

            try {

                await spotifyPlayer.activateElement();

            } catch (_) {}

        }


        // ----------------------------------------------------
        // Spotify Playerへ移動
        // ----------------------------------------------------

        const transferResponse =
            await fetch(
                "https://api.spotify.com/v1/me/player",
                {

                    method: "PUT",

                    headers: {

                        Authorization:
                            `Bearer ${spotifyToken}`,

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        device_ids:
                            [
                                spotifyDeviceId
                            ],

                        play: false

                    })

                }
            );


        if (
            !transferResponse.ok &&
            transferResponse.status !== 204
        ) {

            console.warn(
                "再生先移動に失敗:",
                await readSpotifyError(
                    transferResponse
                )
            );

        }


        // ----------------------------------------------------
        // 重要
        //
        // 1曲ずつSpotifyへ渡す
        //
        // これによって
        // 自動再生・リピートを
        // Music Picker側で管理できる
        // ----------------------------------------------------

        const body = {

            uris:
                [
                    track.uri
                ],

            position_ms:
                0

        };


        const response =
            await fetch(
                `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(
                    spotifyDeviceId
                )}`,

                {

                    method: "PUT",

                    headers: {

                        Authorization:
                            `Bearer ${spotifyToken}`,

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify(
                            body
                        )

                }
            );


        if (!response.ok) {

            const error =
                await readSpotifyError(
                    response
                );


            if (
                response.status ===
                401
            ) {

                localStorage.removeItem(
                    "spotify_access_token"
                );


                spotifyToken =
                    "";


                throw new Error(
                    "Spotifyのログイン期限が切れています。\nもう一度ログインしてください。"
                );

            }


            if (
                response.status ===
                403
            ) {

                throw new Error(
                    "Spotifyの再生権限がありません。\nSpotify Premiumと権限を確認してください。"
                );

            }


            throw new Error(
                `Spotify再生エラー: ${error}`
            );

        }

// ----------------------------------------------------
// 再生成功
// ----------------------------------------------------

lastEndedTrackUri = "";

currentTrackData = track;

// プレイヤー表示
showPlayerPanel();

// 曲情報表示
updatePlayerInfo(track);

// ロック画面・ジャケット表示
try {
    updateMediaSession(track);
} catch (error) {
    console.warn(
        "MediaSession更新失敗:",
        error
    );
}

// ★重要
// MediaSessionとは完全に独立して
// 曲終了タイマーを開始する

    } catch (error) {

        console.error(
            "再生エラー:",
            error
        );


        alert(
            "音楽を再生できませんでした。\n\n" +
            error.message
        );

    }

}


// ============================================================
// Spotify初期化
// ============================================================

function initSpotify() {

    if (window.Spotify) {

        setupSpotifyPlayer();

    }

}


// ============================================================
// Spotify SDK Ready
// ============================================================

window.onSpotifyWebPlaybackSDKReady =
    function () {

        console.log(
            "Spotify SDK Ready"
        );


        setupSpotifyPlayer();

    };


// ============================================================
// Spotify Player作成
// ============================================================

function setupSpotifyPlayer() {

    if (spotifyPlayer) {
        return;
    }

    if (!window.Spotify) {

        console.log(
            "Spotify SDK待機中"
        );

        return;

    }

    spotifyToken =
        localStorage.getItem(
            "spotify_access_token"
        ) || "";

    if (!spotifyToken) {

        console.log(
            "Spotify tokenなし"
        );

        showSpotifyStatus(
            "Spotify未接続"
        );

        return;

    }
console.log(
    "mediaSession:",
    "mediaSession" in navigator
);

console.log(
    "metadata:",
    navigator.mediaSession?.metadata
);

    spotifyPlayer = new Spotify.Player({

    name: "Music Picker",

    enableMediaSession: false,
    volume: getSavedVolume(),

    getOAuthToken: callback => {

        const token =
            localStorage.getItem("spotify_access_token") || "";

        spotifyToken = token;

        callback(token);
    }

});


    


    // ========================================================
    // Ready
    // ========================================================

    spotifyPlayer.addListener(
        "ready",
        ({ device_id }) => {

            console.log(
                "Spotify Player Ready:",
                device_id
            );


            spotifyDeviceId =
                device_id;


            showSpotifyStatus(
                "Spotify接続済み"
            );


            applySavedVolume();

        }
    );


    // ========================================================
    // Not Ready
    // ========================================================

    spotifyPlayer.addListener(
        "not_ready",
        ({ device_id }) => {

            if (
                spotifyDeviceId ===
                device_id
            ) {

                spotifyDeviceId =
                    "";

            }


            showSpotifyStatus(
                "Spotify未接続"
            );

        }
    );


    // ========================================================
    // 再生状態
    // ========================================================

    spotifyPlayer.addListener(
    "player_state_changed",
    state => {
        if (!state) return;

        updatePlayerState(state);

        if (state.paused) {
            stopProgressTimer();
        } else {
            startProgressTimer();
        }

        const current =
            state.track_window?.current_track;

        if (!current) return;

        const currentTrack =
            normalizeTrack(current);

        currentTrackData =
            currentTrack;

        // 📱 ロック画面のジャケット・曲名
        updateMediaSession(currentTrack);

        updatePlayerInfo(currentTrack);

        if (state.duration > 0 && !state.paused) {
            scheduleTrackEnded(
                currentTrack,
                state
            );
        } else {
            clearTrackEndTimer();
        }
    }
);
    // ========================================================
    // Autoplay failed
    // ========================================================

    spotifyPlayer.addListener(
        "autoplay_failed",
        () => {

            console.log(
                "Autoplay failed"
            );

        }
    );


    // ========================================================
    // Initialization error
    // ========================================================

    spotifyPlayer.addListener(
        "initialization_error",
        ({ message }) => {

            console.error(
                "Initialization error:",
                message
            );


            showSpotifyStatus(
                "Spotify初期化エラー"
            );

        }
    );


    // ========================================================
    // Authentication error
    // ========================================================

    spotifyPlayer.addListener(
        "authentication_error",
        ({ message }) => {

            console.error(
                "Authentication error:",
                message
            );


            showSpotifyStatus(
                "Spotify認証エラー"
            );

        }
    );


    // ========================================================
    // Account error
    // ========================================================

    spotifyPlayer.addListener(
        "account_error",
        ({ message }) => {

            console.error(
                "Account error:",
                message
            );


            showSpotifyStatus(
                "Spotify Premiumが必要です"
            );

        }
    );


    // ========================================================
    // Playback error
    // ========================================================

    spotifyPlayer.addListener(
        "playback_error",
        ({ message }) => {

            console.error(
                "Playback error:",
                message
            );

        }
    );


    // ========================================================
    // Connect
    // ========================================================

    spotifyPlayer
        .connect()
        .then(
            success => {

                console.log(
                    "Spotify接続:",
                    success
                );

            }
        )
        .catch(
            error => {

                console.error(
                    "Spotify接続エラー:",
                    error
                );

            }
        );

}
let progressTimer = null;

function startProgressTimer() {
    if (progressTimer) return;

    progressTimer = setInterval(async () => {
        if (!spotifyPlayer) return;

        try {
            const state = await spotifyPlayer.getCurrentState();

            if (!state) return;

            const progress = document.getElementById("progressBar");

            if (progress && state.duration > 0) {
                progress.max = state.duration;
                progress.value = Math.min(
                    state.position,
                    state.duration
                );
            }

            // 時間表示
            const currentTime = document.getElementById("currentTime");

            if (currentTime) {
                currentTime.textContent =
                    formatTime(state.position);
            }

        } catch (error) {
            console.warn("再生位置更新:", error);
        }

    }, 500);
}

function stopProgressTimer() {
    if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
    }
}

function scheduleTrackEnded(track, state) {

    clearTrackEndTimer();

    const uri = track?.uri || "";

    if (!uri) return;

    const duration =
        Number(state?.duration || 0);

    const position =
        Number(state?.position || 0);

    if (duration <= 0) return;

    const generation =
        playbackGeneration;

    const remaining =
        Math.max(
            500,
            duration - position
        );

    trackEndTimer = setTimeout(
        async () => {

            // 古い曲のタイマーなら完全無視
            if (
                generation !==
                playbackGeneration
            ) {
                return;
            }

            if (trackChangeLock) {
                return;
            }

            try {

                const currentState =
                    await spotifyPlayer?.getCurrentState();

                if (!currentState) return;

                const current =
                    currentState
                        .track_window
                        ?.current_track;

                if (!current) return;

                // 別の曲なら終了処理しない
                if (
                    current.uri !== uri
                ) {
                    return;
                }

                if (
                    currentState.paused
                ) {
                    return;
                }

                const currentDuration =
                    Number(
                        currentState.duration || 0
                    );

                const currentPosition =
                    Number(
                        currentState.position || 0
                    );

                // まだ終わっていない
                if (
                    currentPosition <
                    currentDuration - 1000
                ) {

                    scheduleTrackEnded(
                        current,
                        currentState
                    );

                    return;
                }

                console.log(
                    "🎵 曲終了:",
                    current.name
                );

                await handleTrackEnded();

            } catch (error) {

                console.warn(
                    "曲終了処理:",
                    error
                );

            }

        },

        Math.max(
            500,
            remaining - 300
        )
    );
}

function clearTrackEndTimer() {

    if (trackEndTimer) {

        clearTimeout(
            trackEndTimer
        );

        trackEndTimer =
            null;

    }

}



// ============================================================
// 曲終了後の動作
// ============================================================

async function handleTrackEnded() {

    // 二重実行を完全に防ぐ
    if (trackChangeLock) {
        console.log("🔒 曲変更処理中");
        return;
    }

    if (!currentPlaylist.length) {
        console.log("プレイリストなし");
        return;
    }

    if (!appSettings.autoplay) {
        console.log("自動再生OFF");
        return;
    }

    trackChangeLock = true;

    // 現在の曲を確定
    const oldIndex = currentTrackIndex;

    try {

        // ============================================
        // 1曲リピート
        // ============================================

        if (appSettings.repeat === "one") {

            console.log("🔁 1曲リピート");

            currentTrackIndex = oldIndex;

            await playTrack(
                currentPlaylist[oldIndex],
                oldIndex,
                true
            );

            return;
        }

        // ============================================
        // 次の曲
        // ============================================

        let nextIndex;

        if (appSettings.shuffle) {

            if (currentPlaylist.length <= 1) {

                nextIndex = oldIndex;

            } else {

                do {

                    nextIndex =
                        Math.floor(
                            Math.random() *
                            currentPlaylist.length
                        );

                } while (
                    nextIndex === oldIndex
                );

            }

        } else {

            nextIndex = oldIndex + 1;

        }

        // ============================================
        // 次の曲が存在
        // ============================================

        if (
            nextIndex >= 0 &&
            nextIndex < currentPlaylist.length
        ) {

            console.log(
                "➡️ 次の曲:",
                nextIndex + 1,
                "/",
                currentPlaylist.length
            );

            // ★先にインデックスを確定
            currentTrackIndex = nextIndex;

            await playTrack(
                currentPlaylist[nextIndex],
                nextIndex,
                true
            );

            return;
        }

        // ============================================
        // 全曲リピート
        // ============================================

        if (appSettings.repeat === "all") {

            console.log(
                "🔁 最初の曲へ"
            );

            currentTrackIndex = 0;

            await playTrack(
                currentPlaylist[0],
                0,
                true
            );

            return;
        }

        console.log(
            "⏹ プレイリスト終了"
        );

    } finally {

        // 少し長めにロック
        setTimeout(() => {

            trackChangeLock = false;

        }, 2000);

    }
}
// ============================================================
// Spotifyデバイス待機
// ============================================================

async function waitForSpotifyDevice(
    timeout
) {

    if (spotifyDeviceId) {

        return true;

    }


    const start =
        Date.now();


    while (
        !spotifyDeviceId &&
        Date.now() -
            start <
            timeout
    ) {

        await sleep(
            250
        );

    }


    return !!spotifyDeviceId;

}


// ============================================================
// プレイヤー表示
// ============================================================

function showPlayerPanel() {

    const panel =
        document.getElementById(
            "playerPanel"
        );


    if (!panel) {
        return;
    }


    if (
        appSettings.alwaysShowPlayer ||
        currentTrackData
    ) {

        panel.style.display =
            "block";

    }


    setupVolume();

}


// ============================================================
// プレイヤー表示/非表示
// ============================================================

function applyPlayerVisibility() {

    const panel =
        document.getElementById(
            "playerPanel"
        );


    if (!panel) {
        return;
    }


    if (
        !currentTrackData
    ) {

        panel.style.display =
            "none";

        return;

    }


    if (
        appSettings.alwaysShowPlayer
    ) {

        panel.style.display =
            "block";

    } else {

        panel.style.display =
            "block";

    }

}


// ============================================================
// プレイヤー情報
// ============================================================

function updatePlayerInfo(
    track
) {

    track =
        normalizeTrack(
            track
        );


    if (!track) {
        return;
    }


    currentTrackData =
        track;


    // --------------------------------------------------------
    // 下プレイヤー
    // --------------------------------------------------------

    const title =
        document.getElementById(
            "playerTitle"
        );


    const artist =
        document.getElementById(
            "playerArtist"
        );


    const image =
        document.getElementById(
            "playerImage"
        );


    if (title) {

        title.textContent =
            track.title ||
            "曲名なし";

    }


    if (artist) {

        artist.textContent =
            getArtistText(
                track
            );

    }


    if (image) {

        image.src =
            track.image || "";

    }


    // --------------------------------------------------------
    // メニュー NOW PLAYING
    // --------------------------------------------------------

    const menuTitle =
        document.getElementById(
            "menuPlayerTitle"
        );


    const menuArtist =
        document.getElementById(
            "menuPlayerArtist"
        );


    const menuImage =
        document.getElementById(
            "menuPlayerImage"
        );


    if (menuTitle) {

        menuTitle.textContent =
            track.title ||
            "曲名なし";

    }


    if (menuArtist) {

        menuArtist.textContent =
            getArtistText(
                track
            );

    }


    if (menuImage) {

        menuImage.src =
            track.image || "";

    }

}


// ============================================================
// プレイヤー状態
// ============================================================

function updatePlayerState(
    state
) {

    // --------------------------------------------------------
    // 下プレイヤー
    // --------------------------------------------------------

    const button =
        document.getElementById(
            "playPauseButton"
        );


    // --------------------------------------------------------
    // メニュー
    // --------------------------------------------------------

    const menuButton =
        document.getElementById(
            "menuPlayPauseButton"
        );


    const playIcon =
        state.paused
            ? "▶"
            : "⏸";


    if (button) {

        button.textContent =
            playIcon;

    }


    if (menuButton) {

        menuButton.textContent =
            playIcon;

    }


 // --------------------------------------------------------
// 下プログレス
// --------------------------------------------------------

const progress = document.getElementById("progressBar");

if (progress) {
    const duration = Number(state.duration || 0);
    const position = Number(state.position || 0);

    if (duration > 0) {
        progress.max = duration;
        progress.value = Math.min(position, duration);
    }
}


    // --------------------------------------------------------
    // メニュープログレス
    // --------------------------------------------------------

    const menuProgress =
        document.getElementById(
            "menuProgressBar"
        );


    if (menuProgress) {

        menuProgress.max =
            state.duration || 0;


        menuProgress.value =
            state.position || 0;

    }


    // --------------------------------------------------------
    // 時間
    // --------------------------------------------------------

    const current =
        document.getElementById(
            "currentTime"
        );


    const duration =
        document.getElementById(
            "duration"
        );


    if (current) {

        current.textContent =
            formatTime(
                state.position
            );

    }


    if (duration) {

        duration.textContent =
            formatTime(
                state.duration
            );

    }


    // --------------------------------------------------------
    // メニュー時間
    // --------------------------------------------------------

    const menuCurrent =
        document.getElementById(
            "menuCurrentTime"
        );


    const menuDuration =
        document.getElementById(
            "menuDuration"
        );


    if (menuCurrent) {

        menuCurrent.textContent =
            formatTime(
                state.position
            );

    }


    if (menuDuration) {

        menuDuration.textContent =
            formatTime(
                state.duration
            );

    }

}


// ============================================================
// 再生 / 一時停止
// ============================================================

async function togglePlayback() {

    if (!spotifyPlayer) {

        setupSpotifyPlayer();

        return;

    }


    try {

        await spotifyPlayer.togglePlay();

    } catch (error) {

        console.error(
            "再生切り替えエラー:",
            error
        );

    }

}


// ============================================================
// 次の曲
// ============================================================

async function playNext() {

    if (
        !currentPlaylist.length
    ) {

        return;

    }


    let index =
        currentTrackIndex + 1;


    // --------------------------------------------------------
    // 次の曲がある
    // --------------------------------------------------------

    if (
        index <
        currentPlaylist.length
    ) {

        currentTrackIndex =
            index;


        await playTrack(
            currentPlaylist[index],
            index,
            isPlaylistMode
        );


        return;

    }


    // --------------------------------------------------------
    // 最後の曲
    // --------------------------------------------------------

    if (
        appSettings.repeat ===
        "all"
    ) {

        index = 0;


        currentTrackIndex =
            0;


        await playTrack(
            currentPlaylist[0],
            0,
            isPlaylistMode
        );

    }

}


// ============================================================
// 前の曲
// ============================================================

async function playPrevious() {

    if (
        !currentPlaylist.length
    ) {

        return;

    }


    let index =
        currentTrackIndex - 1;


    if (
        index < 0
    ) {

        index =
            currentPlaylist.length - 1;

    }


    currentTrackIndex =
        index;


    await playTrack(
        currentPlaylist[index],
        index,
        isPlaylistMode
    );

}


// ============================================================
// シーク
// ============================================================

async function seekPlayback(
    value
) {

    if (!spotifyPlayer) {
        return;
    }


    try {

        await spotifyPlayer.seek(
            Number(value)
        );

    } catch (error) {

        console.error(
            "シークエラー:",
            error
        );

    }

}


// ============================================================
// プレイヤー操作イベント
// ============================================================

function initPlayerControls() {

    // --------------------------------------------------------
    // 下プレイヤー
    // --------------------------------------------------------

    const playButton =
        document.getElementById(
            "playPauseButton"
        );


    const nextButton =
        document.getElementById(
            "nextButton"
        );


    const previousButton =
        document.getElementById(
            "previousButton"
        );


    if (playButton) {

        playButton.addEventListener(
            "click",
            togglePlayback
        );

    }


    if (nextButton) {

        nextButton.addEventListener(
            "click",
            playNext
        );

    }


    if (previousButton) {

        previousButton.addEventListener(
            "click",
            playPrevious
        );

    }


    // --------------------------------------------------------
    // メニュー NOW PLAYING
    // --------------------------------------------------------

    const menuPlayButton =
        document.getElementById(
            "menuPlayPauseButton"
        );


    const menuNextButton =
        document.getElementById(
            "menuNextButton"
        );


    const menuPreviousButton =
        document.getElementById(
            "menuPreviousButton"
        );


    if (menuPlayButton) {

        menuPlayButton.addEventListener(
            "click",
            togglePlayback
        );

    }


    if (menuNextButton) {

        menuNextButton.addEventListener(
            "click",
            playNext
        );

    }


    if (menuPreviousButton) {

        menuPreviousButton.addEventListener(
            "click",
            playPrevious
        );

    }


    // --------------------------------------------------------
    // 下プログレス
    // --------------------------------------------------------

    const progress =
        document.getElementById(
            "progressBar"
        );


    if (progress) {

        progress.addEventListener(
            "change",
            () => {

                seekPlayback(
                    progress.value
                );

            }
        );

    }


    // --------------------------------------------------------
    // メニュープログレス
    // --------------------------------------------------------

    const menuProgress =
        document.getElementById(
            "menuProgressBar"
        );


    if (menuProgress) {

        menuProgress.addEventListener(
            "change",
            () => {

                seekPlayback(
                    menuProgress.value
                );

            }
        );

    }

}


// ============================================================
// 音量
// ============================================================

function setupVolume() {

    const bar =
        document.getElementById(
            "volumeBar"
        );


    const value =
        document.getElementById(
            "volumeValue"
        );


    const menuBar =
        document.getElementById(
            "menuVolumeBar"
        );


    const menuValue =
        document.getElementById(
            "menuVolumeValue"
        );


    const saved =
        Math.round(
            getSavedVolume() *
            100
        );


    if (bar) {

        bar.value =
            saved;

        if (!volumeInitialized) {

            bar.oninput =
                () => {

                    changeVolume(
                        bar.value
                    );

                };

        }

    }


    if (value) {

        value.textContent =
            `${saved}%`;

    }


    if (menuBar) {

        menuBar.value =
            saved;


        if (!volumeInitialized) {

            menuBar.oninput =
                () => {

                    changeVolume(
                        menuBar.value
                    );

                };

        }

    }


    if (menuValue) {

        menuValue.textContent =
            `${saved}%`;

    }


    volumeInitialized =
        true;

}


// ============================================================
// 音量変更
// ============================================================

async function changeVolume(
    rawValue
) {

    let value =
        Number(rawValue);


    if (
        !Number.isFinite(
            value
        )
    ) {

        value = 50;

    }


    value =
        Math.max(
            0,
            Math.min(
                100,
                value
            )
        );


    const volume =
        value / 100;


    localStorage.setItem(
        "spotify_volume",
        String(volume)
    );


    const bottomValue =
        document.getElementById(
            "volumeValue"
        );


    const menuValue =
        document.getElementById(
            "menuVolumeValue"
        );


    const bottomBar =
        document.getElementById(
            "volumeBar"
        );


    const menuBar =
        document.getElementById(
            "menuVolumeBar"
        );


    if (bottomBar) {

        bottomBar.value =
            value;

    }


    if (menuBar) {

        menuBar.value =
            value;

    }


    if (bottomValue) {

        bottomValue.textContent =
            `${Math.round(value)}%`;

    }


    if (menuValue) {

        menuValue.textContent =
            `${Math.round(value)}%`;

    }


    if (spotifyPlayer) {

        try {

            await spotifyPlayer.setVolume(
                volume
            );

        } catch (error) {

            console.error(
                "音量変更エラー:",
                error
            );

        }

    }

}


// ============================================================
// 保存された音量
// ============================================================

function getSavedVolume() {

    const volume =
        Number(
            localStorage.getItem(
                "spotify_volume"
            )
        );


    if (
        !Number.isFinite(
            volume
        ) ||
        volume < 0 ||
        volume > 1
    ) {

        return 0.5;

    }


    return volume;

}


// ============================================================
// 保存音量を適用
// ============================================================

async function applySavedVolume() {

    if (!spotifyPlayer) {
        return;
    }


    try {

        await spotifyPlayer.setVolume(
            getSavedVolume()
        );


        setupVolume();

    } catch (_) {}

}


// ============================================================
// Spotify状態
// ============================================================

function showSpotifyStatus(
    text
) {

    const status =
        document.getElementById(
            "spotifyStatus"
        );


    if (status) {

        status.textContent =
            text;

    }

}


// ============================================================
// 検索ページ
// ============================================================

function initSearch() {

    const input =
        document.getElementById(
            "songSearchInput"
        );


    const button =
        document.getElementById(
            "songSearchButton"
        );


    if (
        !input ||
        !button
    ) {

        return;

    }


    button.addEventListener(
        "click",
        () => {

            searchSongs(
                input.value.trim()
            );

        }
    );


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                searchSongs(
                    input.value.trim()
                );

            }

        }
    );

}


// ============================================================
// 曲検索
// ============================================================

async function searchSongs(
    query
) {

    const results =
        document.getElementById(
            "searchResults"
        );


    if (!results) {
        return;
    }


    if (!query) {

        results.innerHTML =
            `
            <div class="no-results">
                曲名やアーティスト名を入力してください
            </div>
            `;

        return;

    }


    results.innerHTML =
        `
        <div class="loading">
            🔎 曲を検索中...
        </div>
        `;


    try {

        const response =
            await fetch(
                `/api/search?q=${encodeURIComponent(
                    query
                )}`
            );


        if (!response.ok) {

            const message =
                await readResponseError(
                    response
                );


            throw new Error(
                message
            );

        }


        const data =
            await response.json();


        let tracks =
            Array.isArray(data)
                ? data
                : data.tracks || [];


        tracks =
            normalizeTracks(
                tracks
            ).filter(
                track =>
                    track &&
                    track.uri
            );


        results.innerHTML =
            "";


        if (!tracks.length) {

            results.innerHTML =
                `
                <div class="no-results">
                    曲が見つかりませんでした
                </div>
                `;

            return;

        }


        tracks.forEach(
    (track, index) => {

        results.appendChild(
            createSearchTrackCard(
                track,
                index
            )
        );

    }
);

    } catch (error) {

        console.error(
            "曲検索エラー:",
            error
        );


        results.innerHTML =
            `
            <div class="error-message">
                ${escapeHtml(
                    error.message
                )}
            </div>
            `;

    }

}


// ============================================================
// お気に入り取得
// ============================================================

function getFavorites() {

    try {

        const data =
            JSON.parse(
                localStorage.getItem(
                    "music_picker_favorites"
                ) || "[]"
            );


        return Array.isArray(data)
            ? data
            : [];


    } catch (_) {

        return [];

    }

}


// ============================================================
// お気に入り切り替え
// ============================================================

function toggleFavorite(
    track
) {

    const favorites =
        getFavorites();


    const normalized =
        normalizeTrack(
            track
        );


    if (!normalized) {
        return;
    }


    const index =
        favorites.findIndex(
            item =>
                item.uri ===
                normalized.uri
        );


    if (index >= 0) {

        favorites.splice(
            index,
            1
        );


        showToast(
            "お気に入りから削除しました"
        );

    } else {

        favorites.unshift(
            normalized
        );


        showToast(
            "❤️ お気に入りに追加しました"
        );

    }


    localStorage.setItem(
        "music_picker_favorites",
        JSON.stringify(
            favorites
        )
    );


    updateFavoritesPage();

}


// ============================================================
// お気に入りボタン
// ============================================================

function updateFavoriteButton(
    button,
    track
) {

    const favorites =
        getFavorites();


    const exists =
        favorites.some(
            item =>
                item.uri ===
                track.uri
        );


    if (exists) {

        button.textContent =
            "❤️";


        button.classList.add(
            "favorite-active"
        );

    } else {

        button.textContent =
            "♡";


        button.classList.remove(
            "favorite-active"
        );

    }

}


// ============================================================
// お気に入りページ
// ============================================================

function updateFavoritesPage() {

    const container =
        document.getElementById(
            "favoritesList"
        );


    if (!container) {
        return;
    }


    const favorites =
        getFavorites();


    container.innerHTML =
        "";


    if (!favorites.length) {

        container.innerHTML =
            `
            <div class="no-results">
                ❤️ お気に入りはまだありません
            </div>
            `;

        return;

    }


    favorites.forEach(
        (track, index) => {

            container.appendChild(
                createTrackCard(
                    track,
                    index
                )
            );

        }
    );

}
// ============================================================
// 📚 ライブラリ：プレイリスト取得
// ============================================================

function getSavedPlaylists() {

    try {

        const data =
            JSON.parse(
                localStorage.getItem(
                    LIBRARY_PLAYLISTS_KEY
                ) || "[]"
            );

        return Array.isArray(data)
            ? data
            : [];

    } catch (error) {

        console.warn(
            "プレイリスト読み込みエラー:",
            error
        );

        return [];

    }

}


// ============================================================
// 📚 ライブラリ：プレイリスト保存
// ============================================================

function saveSavedPlaylists(playlists) {

    try {

        localStorage.setItem(
            LIBRARY_PLAYLISTS_KEY,
            JSON.stringify(
                playlists
            )
        );

    } catch (error) {

        console.error(
            "プレイリスト保存エラー:",
            error
        );

    }

}


// ============================================================
// 📚 おすすめプレイリストをライブラリへ保存
// ============================================================

function saveGeneratedPlaylistToLibrary(
    playlist
) {

    const tracks =
        normalizeTracks(
            playlist
        )
        .filter(
            track =>
                track &&
                track.uri
        )
        .slice(
            0,
            100
        );

    if (!tracks.length) {
        return;
    }


    const playlists =
        getSavedPlaylists();


    const item = {

        id:
            `local-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        name:
            selectedMood
                ? `${selectedMood}のおすすめ`
                : "おすすめプレイリスト",

        mood:
            selectedMood || "",

        artistName:
            selectedArtistName || "",

        genre:
            selectedGenre !== "all"
                ? selectedGenre
                : "",

        createdAt:
            new Date().toISOString(),

        tracks:
            tracks

    };


    playlists.unshift(
        item
    );


    // 最大50プレイリスト
    saveSavedPlaylists(
        playlists.slice(
            0,
            50
        )
    );


    updateLibraryPage();


    showToast(
        "📚 プレイリストをライブラリに保存しました"
    );

}


// ============================================================
// 📚 プレイリスト削除
// ============================================================

function deleteSavedPlaylist(
    playlistId
) {

    const playlists =
        getSavedPlaylists();


    const target =
        playlists.find(
            playlist =>
                playlist.id ===
                playlistId
        );


    if (!target) {
        return;
    }


    if (
        !confirm(
            `「${target.name}」を削除しますか？`
        )
    ) {

        return;

    }


    const newPlaylists =
        playlists.filter(
            playlist =>
                playlist.id !==
                playlistId
        );


    saveSavedPlaylists(
        newPlaylists
    );


    updateLibraryPage();


    showToast(
        "🗑️ プレイリストを削除しました"
    );

}


// ============================================================
// 📚 プレイリスト再生
// ============================================================

async function playSavedPlaylist(
    playlist
) {

    if (
        !playlist ||
        !Array.isArray(
            playlist.tracks
        ) ||
        !playlist.tracks.length
    ) {

        alert(
            "このプレイリストには曲がありません。"
        );

        return;

    }


    let tracks =
        normalizeTracks(
            playlist.tracks
        )
        .filter(
            track =>
                track &&
                track.uri
        );


    if (!tracks.length) {

        alert(
            "再生できる曲がありません。"
        );

        return;

    }


    // シャッフルON
    if (
        appSettings.shuffle
    ) {

        tracks =
            shuffleArray(
                [...tracks]
            );

    }


    currentPlaylist =
        tracks;


    currentTrackIndex =
        0;


    isPlaylistMode =
        true;


    await playTrack(
        currentPlaylist[0],
        0,
        true
    );

}


// ============================================================
// 📚 プレイリストのSpotify保存情報を更新
// ============================================================

function attachSpotifyPlaylistToLibrary(
    tracks,
    spotifyData,
    playlistName
) {

    if (
        !spotifyData ||
        !spotifyData.playlistId
    ) {

        return;

    }


    const saved =
        getSavedPlaylists();


    const normalized =
        normalizeTracks(
            tracks
        );


    const target =
        saved.find(
            playlist => {

                const a =
                    playlist.tracks
                        ?.map(
                            track =>
                                track.uri
                        )
                        .filter(Boolean)
                        .join("|");

                const b =
                    normalized
                        .map(
                            track =>
                                track.uri
                        )
                        .filter(Boolean)
                        .join("|");

                return (
                    a === b
                );

            }
        );


    if (!target) {
        return;
    }


    target.spotifyPlaylistId =
        spotifyData.playlistId;


    target.spotifyUrl =
        spotifyData.spotifyUrl || "";


    if (
        playlistName
    ) {

        target.spotifyName =
            playlistName;

    }


    saveSavedPlaylists(
        saved
    );


    updateLibraryPage();

}


// ============================================================
// 📚 ライブラリ画面
// ============================================================

function updateLibraryPage() {

    // --------------------------------------------
    // お気に入り
    // --------------------------------------------

    updateFavoritesPage();


    // --------------------------------------------
    // プレイリスト
    // --------------------------------------------

    const container =
        document.getElementById(
            "playlistList"
        );


    if (!container) {
        return;
    }


    const playlists =
        getSavedPlaylists();


    container.innerHTML =
        "";


    if (!playlists.length) {

        container.innerHTML =
            `
            <div class="library-empty">
                🎵<br>
                プレイリストはまだありません。<br>
                ホームでおすすめ5曲を作ると<br>
                ここに自動保存されます。
            </div>
            `;

        return;

    }


    playlists.forEach(
        playlist => {

            container.appendChild(
                createLibraryPlaylistCard(
                    playlist
                )
            );

        }
    );

}


// ============================================================
// 📚 プレイリストカード
// ============================================================

function createLibraryPlaylistCard(
    playlist
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "library-playlist-card";


    const header =
        document.createElement(
            "div"
        );


    header.className =
        "library-playlist-header";


    const info =
        document.createElement(
            "div"
        );


    info.className =
        "library-playlist-info";


    const name =
        document.createElement(
            "div"
        );


    name.className =
        "library-playlist-name";


    name.textContent =
        playlist.name ||
        "プレイリスト";


    const meta =
        document.createElement(
            "div"
        );


    meta.className =
        "library-playlist-meta";


    const metaParts = [];


    if (
        playlist.mood
    ) {

        metaParts.push(
            `気分: ${playlist.mood}`
        );

    }


    if (
        playlist.artistName
    ) {

        metaParts.push(
            `🎤 ${playlist.artistName}`
        );

    }


    if (
        playlist.genre
    ) {

        metaParts.push(
            `🎼 ${playlist.genre}`
        );

    }


    metaParts.push(
        `${playlist.tracks?.length || 0}曲`
    );


    meta.textContent =
        metaParts.join(
            " ・ "
        );


    info.appendChild(
        name
    );

    info.appendChild(
        meta
    );


    // --------------------------------------------
    // ボタン
    // --------------------------------------------

    const actions =
        document.createElement(
            "div"
        );


    actions.className =
        "library-playlist-actions";


    const playButton =
        document.createElement(
            "button"
        );


    playButton.className =
        "library-play-button";


    playButton.type =
        "button";


    playButton.textContent =
        "▶ 再生";


    playButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            playSavedPlaylist(
                playlist
            );

        }
    );


    const deleteButton =
        document.createElement(
            "button"
        );


    deleteButton.className =
        "library-delete-button";


    deleteButton.type =
        "button";


    deleteButton.textContent =
        "🗑️";


    deleteButton.title =
        "削除";


    deleteButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            deleteSavedPlaylist(
                playlist.id
            );

        }
    );


    actions.appendChild(
        playButton
    );


    actions.appendChild(
        deleteButton
    );


    header.appendChild(
        info
    );


    header.appendChild(
        actions
    );


    card.appendChild(
        header
    );


    // --------------------------------------------
    // 曲一覧
    // --------------------------------------------

    const trackList =
        document.createElement(
            "div"
        );


    trackList.className =
        "library-track-list";


    const tracks =
        normalizeTracks(
            playlist.tracks || []
        );


    tracks.forEach(
        (track, index) => {

            const item =
    createLibraryTrackItem(
        track,
        index,
        playlist
    );


            trackList.appendChild(
                item
            );

        }
    );


    card.appendChild(
        trackList
    );


    // --------------------------------------------
    // Spotify保存済み表示
    // --------------------------------------------

    if (
        playlist.spotifyUrl
    ) {

        const spotifyLink =
            document.createElement(
                "a"
            );


        spotifyLink.href =
            playlist.spotifyUrl;


        spotifyLink.target =
            "_blank";


        spotifyLink.rel =
            "noopener noreferrer";


        spotifyLink.textContent =
            "🎵 Spotifyで開く";


        spotifyLink.style.display =
            "inline-block";


        spotifyLink.style.marginTop =
            "10px";


        spotifyLink.style.fontSize =
            "12px";


        card.appendChild(
            spotifyLink
        );

    }


    return card;

}

// ============================================================
// 📚 ライブラリ内の曲
// ============================================================

function createLibraryTrackItem(
    track,
    index,
    playlist
) {

    const item =
        document.createElement("div");

    item.className =
        "library-track-item";


    // 曲画像
    const image =
        document.createElement("img");

    image.src =
        track.image || "";

    image.alt =
        track.title || "";


    // 曲情報
    const info =
        document.createElement("div");

    info.className =
        "library-track-info";


    const title =
        document.createElement("div");

    title.className =
        "library-track-title";

    title.textContent =
        track.title || "曲名なし";


    const artist =
        document.createElement("div");

    artist.className =
        "library-track-artist";

    artist.textContent =
        getArtistText(track);


    info.appendChild(title);
    info.appendChild(artist);


    // 再生ボタン
    const play =
        document.createElement("button");

    play.type =
        "button";

    play.textContent =
        "▶";

    play.style.border =
        "none";

    play.style.background =
        "transparent";

    play.style.cursor =
        "pointer";


    play.addEventListener(
        "click",
        async (event) => {

            event.stopPropagation();


            // このプレイリストの曲を再生対象にする
            currentPlaylist =
                normalizeTracks(
                    playlist.tracks
                );


            // 押した曲の位置を探す
            currentTrackIndex =
                currentPlaylist.findIndex(
                    savedTrack =>
                        savedTrack.uri ===
                        track.uri
                );


            // 見つからなかった場合
            if (
                currentTrackIndex < 0
            ) {

                currentTrackIndex =
                    index;

            }


            // プレイリスト再生モード
            isPlaylistMode =
                true;


            // 押した曲から再生
            await playTrack(
                track,
                currentTrackIndex,
                true
            );

        }
    );


    item.appendChild(
        image
    );

    item.appendChild(
        info
    );

    item.appendChild(
        play
    );


    return item;

}

// ============================================================
// 履歴
// ============================================================

function getHistory() {

    try {

        const data =
            JSON.parse(
                localStorage.getItem(
                    "music_picker_history"
                ) || "[]"
            );


        return Array.isArray(data)
            ? data
            : [];


    } catch (_) {

        return [];

    }

}


// ============================================================
// 履歴保存
// ============================================================

function saveToHistory(
    tracks
) {

    let history =
        getHistory();


    tracks.forEach(
        track => {

            const normalized =
                normalizeTrack(
                    track
                );


            if (!normalized) {
                return;
            }


            history =
                history.filter(
                    item =>
                        item.uri !==
                        normalized.uri
                );


            history.unshift(
                normalized
            );

        }
    );


    history =
        history.slice(
            0,
            50
        );


    localStorage.setItem(
        "music_picker_history",
        JSON.stringify(
            history
        )
    );


    updateHistoryPage();

}


// ============================================================
// 履歴ページ
// ============================================================

function updateHistoryPage() {

    const container =
        document.getElementById(
            "historyList"
        );


    if (!container) {
        return;
    }


    const history =
        getHistory();


    container.innerHTML =
        "";


    if (!history.length) {

        container.innerHTML =
            `
            <div class="no-results">
                📜 履歴はまだありません
            </div>
            `;

        return;

    }


    history.forEach(
        (track, index) => {

            container.appendChild(
                createTrackCard(
                    track,
                    index
                )
            );

        }
    );

}

// ============================================================
// 曲検索
// ============================================================

// ============================================================
// 🔎 検索初期化
// ============================================================

function initSearch() {

    const input =
        document.getElementById(
            "songSearchInput"
        );

    const button =
        document.getElementById(
            "songSearchButton"
        );

    if (!input || !button) {
        return;
    }


    // --------------------------------------------------------
    // 検索ボタン
    // --------------------------------------------------------

    button.addEventListener(
        "click",
        () => {

            const query =
                input.value.trim();

            searchSongs(query);

        }
    );


    // --------------------------------------------------------
    // Enterキー
    // --------------------------------------------------------

    input.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                event.preventDefault();

                const query =
                    input.value.trim();

                searchSongs(query);

            }

        }
    );

}


// ============================================================
// 🔎 曲検索
// ============================================================

async function searchSongs(query) {

    const results =
        document.getElementById(
            "searchResults"
        );

    if (!results) {
        return;
    }


    // --------------------------------------------------------
    // 検索ID
    //
    // 古い検索結果が後から表示されるのを防ぐ
    // --------------------------------------------------------

    const requestId =
        ++searchRequestId;


    // --------------------------------------------------------
    // 空検索
    // --------------------------------------------------------

    if (!query) {

        results.innerHTML = `
            <div class="no-results">
                曲名やアーティスト名を入力してください
            </div>
        `;

        return;
    }


    // --------------------------------------------------------
    // ローディング
    // --------------------------------------------------------

    results.innerHTML = `
        <div class="loading">
            🔎 「${escapeHtml(query)}」を検索中...
        </div>
    `;


    try {

        const response =
            await fetch(
                `/api/search?q=${encodeURIComponent(query)}`
            );


        // ----------------------------------------------------
        // 古い検索なら無視
        // ----------------------------------------------------

        if (
            requestId !==
            searchRequestId
        ) {
            return;
        }


        if (!response.ok) {

            const message =
                await readResponseError(
                    response
                );

            throw new Error(
                message
            );

        }


        const data =
            await response.json();


        // ----------------------------------------------------
        // Spotifyレスポンス
        // ----------------------------------------------------

        let tracks =
            Array.isArray(data)
                ? data
                : data.tracks || [];


        // ----------------------------------------------------
        // 正規化
        // ----------------------------------------------------

        tracks =
            normalizeTracks(
                tracks
            )
            .filter(
                track =>
                    track &&
                    track.uri
            );


        // ----------------------------------------------------
        // 重複削除
        // ----------------------------------------------------

        const seen =
            new Set();

        tracks =
            tracks.filter(
                track => {

                    if (
                        seen.has(
                            track.uri
                        )
                    ) {
                        return false;
                    }

                    seen.add(
                        track.uri
                    );

                    return true;

                }
            );


        // ----------------------------------------------------
        // もう古い検索なら表示しない
        // ----------------------------------------------------

        if (
            requestId !==
            searchRequestId
        ) {
            return;
        }


        // ----------------------------------------------------
        // 表示をクリア
        // ----------------------------------------------------

        results.innerHTML =
            "";


        // ----------------------------------------------------
        // 結果なし
        // ----------------------------------------------------

        if (!tracks.length) {

            results.innerHTML = `
                <div class="no-results">
                    「${escapeHtml(query)}」の曲が見つかりませんでした
                </div>
            `;

            return;
        }


        // ----------------------------------------------------
        // 検索結果表示
        // ----------------------------------------------------

        tracks.forEach(
            (track, index) => {

                results.appendChild(
                    createTrackCard(
                        track,
                        index
                    )
                );

            }
        );


    } catch (error) {

        // ----------------------------------------------------
        // 古い検索なら無視
        // ----------------------------------------------------

        if (
            requestId !==
            searchRequestId
        ) {
            return;
        }


        console.error(
            "曲検索エラー:",
            error
        );


        results.innerHTML = `
            <div class="error-message">
                ${escapeHtml(
                    error.message ||
                    "検索中にエラーが発生しました"
                )}
            </div>
        `;

    }

}

// ============================================================
// 検索結果カード
// ============================================================

function createSearchTrackCard(
    track,
    index
) {

    track =
        normalizeTrack(track);


    const card =
        document.createElement("div");


    card.className =
        "track-card";


    const image =
        document.createElement("img");


    image.className =
        "track-image";


    image.src =
        track.image || "";


    image.alt =
        track.title || "";


    image.onerror =
        () => {

            image.style.display =
                "none";

        };


    const info =
        document.createElement("div");


    info.className =
        "track-info";


    const title =
        document.createElement("div");


    title.className =
        "track-title";


    title.textContent =
        track.title || "曲名なし";


    const artist =
        document.createElement("div");


    artist.className =
        "track-artist";


    artist.textContent =
        getArtistText(track);


    info.appendChild(title);
    info.appendChild(artist);


    const actions =
        document.createElement("div");


    actions.className =
        "track-actions";


    const play =
        document.createElement("button");


    play.className =
        "track-play-button";


    play.textContent =
        "▶";


    play.addEventListener(
        "click",
        async event => {

            event.stopPropagation();


            currentPlaylist =
                [track];

            currentTrackIndex =
                0;

            isPlaylistMode =
                false;


            await playTrack(
                track,
                0,
                false
            );

        }
    );


    const favorite =
        document.createElement("button");


    favorite.className =
        "favorite-button";


    updateFavoriteButton(
        favorite,
        track
    );


    favorite.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            toggleFavorite(track);


            updateFavoriteButton(
                favorite,
                track
            );

        }
    );


    actions.appendChild(play);
    actions.appendChild(favorite);


    card.appendChild(image);
    card.appendChild(info);
    card.appendChild(actions);


    card.addEventListener(
        "click",
        async () => {

            currentPlaylist =
                [track];

            currentTrackIndex =
                0;

            isPlaylistMode =
                false;


            await playTrack(
                track,
                0,
                false
            );

        }
    );


    return card;

}
// ============================================================
// 設定ページ
// ============================================================

function initSettings() {

    const clearFavorites =
        document.getElementById(
            "clearFavorites"
        );


    if (clearFavorites) {

        clearFavorites.addEventListener(
            "click",
            () => {

                if (
                    confirm(
                        "お気に入りを全部削除しますか？"
                    )
                ) {

                    localStorage.removeItem(
                        "music_picker_favorites"
                    );


                    updateFavoritesPage();


                    showToast(
                        "お気に入りを削除しました"
                    );

                }

            }
        );

    }


    const clearHistory =
        document.getElementById(
            "clearHistory"
        );


    if (clearHistory) {

        clearHistory.addEventListener(
            "click",
            () => {

                if (
                    confirm(
                        "履歴を全部削除しますか？"
                    )
                ) {

                    localStorage.removeItem(
                        "music_picker_history"
                    );


                    updateHistoryPage();


                    showToast(
                        "履歴を削除しました"
                    );

                }

            }
        );

    }

}


// ============================================================
// テーマ初期化
// ============================================================

function initTheme() {

    applyAppSettings();

}


// ============================================================
// メニュー設定
// ============================================================

function initMenuSettings() {

    // ========================================================
    // テーマ
    // ========================================================

    document.querySelectorAll(
        ".theme-button"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const theme =
                        button.dataset.theme;


                    if (!theme) {
                        return;
                    }


                    saveAppSetting(
                        "theme",
                        theme
                    );


                    document.body.dataset.theme =
                        theme;


                    syncMenuSettingsUI();


                    showToast(
                        `🎨 ${getThemeName(theme)} に変更しました`
                    );

                }
            );

        }
    );


    // ========================================================
    // 背景
    // ========================================================

    document.querySelectorAll(
        ".background-button"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const background =
                        button.dataset.background;


                    if (!background) {
                        return;
                    }


                    saveAppSetting(
                        "background",
                        background
                    );


                    document.body.dataset.background =
                        background;


                    syncMenuSettingsUI();

                }
            );

        }
    );


    // ========================================================
    // アニメーション
    // ========================================================

    const animationToggle =
        document.getElementById(
            "animationToggle"
        );


    if (animationToggle) {

        animationToggle.addEventListener(
            "change",
            () => {

                saveAppSetting(
                    "animation",
                    animationToggle.checked
                );


                document.body.dataset.animation =
                    animationToggle.checked
                        ? "on"
                        : "off";

            }
        );

    }


    // ========================================================
    // 自動再生
    // ========================================================

    const autoplayToggle =
        document.getElementById(
            "autoplayToggle"
        );


    if (autoplayToggle) {

        autoplayToggle.addEventListener(
            "change",
            () => {

                saveAppSetting(
                    "autoplay",
                    autoplayToggle.checked
                );


                showToast(
                    autoplayToggle.checked
                        ? "▶️ 自動再生 ON"
                        : "⏹️ 自動再生 OFF"
                );

            }
        );

    }


    // ========================================================
    // シャッフル
    // ========================================================

    const shuffleToggle =
        document.getElementById(
            "shuffleToggle"
        );


    if (shuffleToggle) {

        shuffleToggle.addEventListener(
            "change",
            () => {

                saveAppSetting(
                    "shuffle",
                    shuffleToggle.checked
                );


                showToast(
                    shuffleToggle.checked
                        ? "🔀 シャッフル ON"
                        : "🔀 シャッフル OFF"
                );

            }
        );

    }


    // ========================================================
    // リピート
    // ========================================================

    const repeatMode =
        document.getElementById(
            "repeatMode"
        );


    if (repeatMode) {

        repeatMode.addEventListener(
            "change",
            () => {

                saveAppSetting(
                    "repeat",
                    repeatMode.value
                );


                const names = {

                    off:
                        "OFF",

                    one:
                        "1曲",

                    all:
                        "全曲"

                };


                showToast(
                    `🔁 リピート: ${names[
                        repeatMode.value
                    ] || "OFF"}`
                );

            }
        );

    }


    // ========================================================
    // プレイヤー常時表示
    // ========================================================

    const alwaysShow =
        document.getElementById(
            "alwaysShowPlayerToggle"
        );


    if (alwaysShow) {

        alwaysShow.addEventListener(
            "change",
            () => {

                saveAppSetting(
                    "alwaysShowPlayer",
                    alwaysShow.checked
                );


                if (
                    alwaysShow.checked &&
                    currentTrackData
                ) {

                    showPlayerPanel();

                }


                syncMenuSettingsUI();

            }
        );

    }


    // ========================================================
    // 音量
    // ========================================================

    setupVolume();


    // ========================================================
    // 音楽の好み
    // ========================================================

    const favoriteGenre =
        document.getElementById(
            "favoriteGenreSetting"
        );


    if (favoriteGenre) {

        favoriteGenre.addEventListener(
            "click",
            () => {

                const current =
                    appSettings.preferredGenre ||
                    "なし";


                const value =
                    prompt(
                        "よく聴くジャンルを入力してください。\n例：J-Pop",
                        current === "なし"
                            ? ""
                            : current
                    );


                if (
                    value === null
                ) {

                    return;

                }


                saveAppSetting(
                    "preferredGenre",
                    value.trim()
                );


                showToast(
                    "🎼 よく聴くジャンルを保存しました"
                );

            }
        );

    }


    const favoriteArtist =
        document.getElementById(
            "favoriteArtistSetting"
        );


    if (favoriteArtist) {

        favoriteArtist.addEventListener(
            "click",
            () => {

                const value =
                    prompt(
                        "好きなアーティストを入力してください。\n例：RADWIMPS",
                        appSettings.preferredArtist
                    );


                if (
                    value === null
                ) {

                    return;

                }


                saveAppSetting(
                    "preferredArtist",
                    value.trim()
                );


                showToast(
                    "🎤 好きなアーティストを保存しました"
                );

            }
        );

    }


    const avoidGenre =
        document.getElementById(
            "avoidGenreSetting"
        );


    if (avoidGenre) {

        avoidGenre.addEventListener(
            "click",
            () => {

                const current =
                    appSettings.dislikedGenre ||
                    "なし";


                const value =
                    prompt(
                        "苦手なジャンルを入力してください。\n例：Hip-Hop",
                        current === "なし"
                            ? ""
                            : current
                    );


                if (
                    value === null
                ) {

                    return;

                }


                saveAppSetting(
                    "dislikedGenre",
                    value.trim()
                );


                showToast(
                    "🚫 苦手なジャンルを保存しました"
                );

            }
        );

    }


    // ========================================================
    // 通知
    // ========================================================

    const notificationToggle =
        document.getElementById(
            "notificationToggle"
        );


    if (notificationToggle) {

        notificationToggle.addEventListener(
            "change",
            () => {

                saveAppSetting(
                    "notifications",
                    notificationToggle.checked
                );


                showToast(
                    notificationToggle.checked
                        ? "🔔 おすすめ通知 ON"
                        : "🔕 おすすめ通知 OFF"
                );

            }
        );

    }


    syncMenuSettingsUI();

}


// ============================================================
// メニュー設定UI同期
// ============================================================

function syncMenuSettingsUI() {

    // --------------------------------------------------------
    // テーマ
    // --------------------------------------------------------

    document.querySelectorAll(
        ".theme-button"
    ).forEach(
        button => {

            button.classList.toggle(
                "active",
                button.dataset.theme ===
                appSettings.theme
            );

        }
    );


    // --------------------------------------------------------
    // 背景
    // --------------------------------------------------------

    document.querySelectorAll(
        ".background-button"
    ).forEach(
        button => {

            button.classList.toggle(
                "active",
                button.dataset.background ===
                appSettings.background
            );

        }
    );


    // --------------------------------------------------------
    // アニメーション
    // --------------------------------------------------------

    const animationToggle =
        document.getElementById(
            "animationToggle"
        );


    if (animationToggle) {

        animationToggle.checked =
            appSettings.animation;

    }


    // --------------------------------------------------------
    // 自動再生
    // --------------------------------------------------------

    const autoplayToggle =
        document.getElementById(
            "autoplayToggle"
        );


    if (autoplayToggle) {

        autoplayToggle.checked =
            appSettings.autoplay;

    }


    // --------------------------------------------------------
    // シャッフル
    // --------------------------------------------------------

    const shuffleToggle =
        document.getElementById(
            "shuffleToggle"
        );


    if (shuffleToggle) {

        shuffleToggle.checked =
            appSettings.shuffle;

    }


    // --------------------------------------------------------
    // リピート
    // --------------------------------------------------------

    const repeatMode =
        document.getElementById(
            "repeatMode"
        );


    if (repeatMode) {

        repeatMode.value =
            appSettings.repeat;

    }


    // --------------------------------------------------------
    // 常時表示
    // --------------------------------------------------------

    const alwaysShow =
        document.getElementById(
            "alwaysShowPlayerToggle"
        );


    if (alwaysShow) {

        alwaysShow.checked =
            appSettings.alwaysShowPlayer;

    }


    // --------------------------------------------------------
    // 通知
    // --------------------------------------------------------

    const notificationToggle =
        document.getElementById(
            "notificationToggle"
        );


    if (notificationToggle) {

        notificationToggle.checked =
            appSettings.notifications;

    }


    // --------------------------------------------------------
    // 音量
    // --------------------------------------------------------

    setupVolume();

}


// ============================================================
// テーマ名
// ============================================================

function getThemeName(
    theme
) {

    const names = {

        ocean:
            "Ocean",

        night:
            "Night",

        sunset:
            "Sunset",

        sakura:
            "Sakura",

        classic:
            "Classic"

    };


    return names[theme] ||
        "Ocean";

}


// ============================================================
// 曲データ統一
// ============================================================

function normalizeTrack(
    track
) {

    if (!track) {
        return null;
    }


    const artists =
        Array.isArray(
            track.artists
        )
            ? track.artists
            : [];


    const artistName =
        track.artist ||
        track.artistName ||
        artists
            .map(
                artist =>
                    artist?.name
            )
            .filter(Boolean)
            .join(", ");


    const artistId =
        track.artistId ||
        artists[0]?.id ||
        "";


    const image =
    track.image ||
    track.album?.images?.[0]?.url ||
    track.album?.images?.[1]?.url ||
    track.album?.images?.[2]?.url ||
    track.images?.[0]?.url ||
    track.images?.[1]?.url ||
    track.images?.[2]?.url ||
    "";


    const title =
        track.title ||
        track.name ||
        "曲名なし";


    const uri =
        track.uri ||
        (
            track.id
                ? `spotify:track:${track.id}`
                : ""
        );


    const id =
        track.id ||
        (
            uri.startsWith(
                "spotify:track:"
            )
                ? uri.replace(
                    "spotify:track:",
                    ""
                )
                : ""
        );


    const spotifyUrl =
        track.spotifyUrl ||
        track.external_urls?.spotify ||
        (
            id
                ? `https://open.spotify.com/track/${id}`
                : ""
        );


    return {

        ...track,

        id,

        uri,

        title,

        name:
            title,

        artist:
            artistName,

        artistId,

        artists:
            artists.length
                ? artists
                : artistName
                    ? [
                        {
                            id:
                                artistId,

                            name:
                                artistName
                        }
                    ]
                    : [],

        image,

        spotifyUrl

    };

}


// ============================================================
// アーティスト名
// ============================================================

function getArtistText(
    track
) {

    if (
        track?.artist
    ) {

        return track.artist;

    }


    if (
        track?.artistName
    ) {

        return track.artistName;

    }


    if (
        Array.isArray(
            track?.artists
        )
    ) {

        return track.artists
            .map(
                artist =>
                    artist?.name
            )
            .filter(Boolean)
            .join(", ");

    }


    return "";

}


// ============================================================
// 複数曲Normalize
// ============================================================

function normalizeTracks(
    tracks
) {

    return (
        Array.isArray(
            tracks
        )
            ? tracks
            : []
    )
        .map(
            normalizeTrack
        )
        .filter(Boolean);

}


// ============================================================
// 普通のシャッフル
// ============================================================

function shuffleArray(
    array
) {

    for (
        let i =
            array.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );


        [
            array[i],
            array[j]
        ] =
        [
            array[j],
            array[i]
        ];

    }


    return array;

}


// ============================================================
// 時間
// ============================================================

function formatTime(ms) {

    const totalSeconds =
        Math.floor(ms / 1000);

    const minutes =
        Math.floor(totalSeconds / 60);

    const seconds =
        totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ============================================================
// 待機
// ============================================================

function sleep(
    ms
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}


// ============================================================
// HTMLエスケープ
// ============================================================

function escapeHtml(
    text
) {

    return String(
        text ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// ============================================================
// Spotifyエラー
// ============================================================

async function readSpotifyError(
    response
) {

    try {

        const data =
            await response.json();


        return (
            data?.error?.message ||
            data?.message ||
            JSON.stringify(
                data
            )
        );


    } catch (_) {

        return `HTTP ${response.status}`;

    }

}


// ============================================================
// APIレスポンスエラー
// ============================================================

async function readResponseError(
    response
) {

    try {

        const data =
            await response.json();


        return (
            data?.error ||
            data?.message ||
            `HTTP ${response.status}`
        );


    } catch (_) {

        return `HTTP ${response.status}`;

    }

}


// ============================================================
// NOW PLAYING 初期状態
// ============================================================

function updateMenuPlayerEmptyState() {

    const title =
        document.getElementById(
            "menuPlayerTitle"
        );


    const artist =
        document.getElementById(
            "menuPlayerArtist"
        );


    const image =
        document.getElementById(
            "menuPlayerImage"
        );


    if (title) {

        title.textContent =
            "まだ再生していません";

    }


    if (artist) {

        artist.textContent =
            "曲を選んで再生してください";

    }


    if (image) {

        image.removeAttribute(
            "src"
        );

    }

}


// ============================================================
// Toast
// ============================================================

function showToast(
    message
) {

    let toast =
        document.getElementById(
            "musicPickerToast"
        );


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );


        toast.id =
            "musicPickerToast";


        toast.style.position =
            "fixed";


        toast.style.left =
            "50%";


        toast.style.bottom =
            "105px";


        toast.style.transform =
            "translateX(-50%)";


        toast.style.zIndex =
            "10000";


        toast.style.padding =
            "11px 18px";


        toast.style.borderRadius =
            "999px";


        toast.style.background =
            "rgba(20,20,20,0.92)";


        toast.style.color =
            "white";


        toast.style.fontSize =
            "13px";


        toast.style.fontWeight =
            "bold";


        toast.style.boxShadow =
            "0 8px 25px rgba(0,0,0,0.2)";


        toast.style.pointerEvents =
            "none";


        toast.style.transition =
            "opacity 0.2s ease";


        document.body.appendChild(
            toast
        );

    }


    toast.textContent =
        message;


    toast.style.opacity =
        "1";


    clearTimeout(
        toast._timer
    );


    toast._timer =
        setTimeout(
            () => {

                toast.style.opacity =
                    "0";

            },
            1800
        );

}


// ============================================================
// 完了
// ============================================================

console.log(
    "Music Picker script loaded"
);
function initLogout() {
    const logoutButton =
        document.getElementById("logoutButton");

    if (!logoutButton) return;

    logoutButton.addEventListener("click", () => {

        if (!confirm("Spotifyアカウントを切り替えますか？")) {
            return;
        }

        // ========================================
        // Music Picker側のログイン情報を削除
        // ========================================

        localStorage.removeItem(
            "spotify_access_token"
        );

        // Spotifyの状態をリセット
        spotifyToken = "";
        spotifyDeviceId = "";

        // ========================================
        // Spotify Playerを切断
        // ========================================

        if (spotifyPlayer) {
            spotifyPlayer.disconnect();
            spotifyPlayer = null;
        }

        // ========================================
        // Spotifyのログイン・認証画面へ
        // ========================================

       // アカウント変更ページへ
window.location.href =
    "/account/change";
    });
}
function updateMediaSession(track) {
    console.log("🔵 updateMediaSession 実行");

    if (!track) return;

    const title =
        track.title ||
        track.name ||
        "Music Picker";

    const artist =
        track.artist ||
        getArtistText(track) ||
        "";

    const album =
        track.album?.name ||
        "Music Picker";



    // ジャケット画像を取得
    const image =
        track.image ||
        track.album?.images?.[0]?.url ||
        track.images?.[0]?.url ||
        "";

    try {
        navigator.mediaSession.metadata =
            new MediaMetadata({
                title: title,
                artist: artist,
                album: album,
                artwork: image
                    ? [
                        {
                            src: image,
                            sizes: "96x96",
                            type: "image/jpeg"
                        },
                        {
                            src: image,
                            sizes: "128x128",
                            type: "image/jpeg"
                        },
                        {
                            src: image,
                            sizes: "192x192",
                            type: "image/jpeg"
                        },
                        {
                            src: image,
                            sizes: "256x256",
                            type: "image/jpeg"
                        },
                        {
                            src: image,
                            sizes: "512x512",
                            type: "image/jpeg"
                        }
                    ]
                    : []
            });

        console.log(
            "📱 Media Session設定:",
            title,
            artist,
            album
        );

    } catch (error) {
        console.error(
            "Media Session設定エラー:",
            error
        );
    }


    // ==========================================
    // ▶ 再生
    // ==========================================
    try {
        navigator.mediaSession.setActionHandler(
            "play",
            () => {
                togglePlayback();
            }
        );
    } catch (error) {
        console.warn("play設定:", error);
    }


    // ==========================================
    // ⏸ 一時停止
    // ==========================================
    try {
        navigator.mediaSession.setActionHandler(
            "pause",
            () => {
                togglePlayback();
            }
        );
    } catch (error) {
        console.warn("pause設定:", error);
    }


    // ==========================================
    // ⏭ 次の曲
    // ==========================================
    try {
        navigator.mediaSession.setActionHandler(
            "nexttrack",
            () => {
                playNext();
            }
        );
    } catch (error) {
        console.warn("nexttrack設定:", error);
    }


    // ==========================================
    // ⏮ 前の曲
    // ==========================================
    try {
        navigator.mediaSession.setActionHandler(
            "previoustrack",
            () => {
                playPrevious();
            }
        );
    } catch (error) {
        console.warn("previoustrack設定:", error);
    }
}
function updateMediaSessionPosition(state) {
    if (!state) return;
    if (!("mediaSession" in navigator)) return;
    if (!("setPositionState" in navigator.mediaSession)) return;

    const duration = Number(state.duration || 0);
    const position = Number(state.position || 0);
    const playbackRate = Number(state.playbackSpeed || 1);

    if (duration <= 0) return;

    try {
        navigator.mediaSession.setPositionState({
            duration: duration / 1000,
            playbackRate: playbackRate,
            position: Math.min(
                position / 1000,
                duration / 1000
            )
        });
    } catch (error) {
        console.warn("Media Session position:", error);
    }
}


// ============================================================
// Spotifyプレイリスト保存
// ============================================================

function openSpotifySaveModal(playlist) {

    if (!playlist || !playlist.length) {

        alert(
            "保存する曲がありません。"
        );

        return;

    }

    // すでに開いていたら削除
    const oldModal =
        document.getElementById(
            "spotifySaveModal"
        );

    if (oldModal) {
        oldModal.remove();
    }

    const modal =
        document.createElement("div");

    modal.id =
        "spotifySaveModal";

    modal.className =
        "spotify-save-modal";

    modal.innerHTML = `
        <div class="spotify-save-box">

            <button
                class="spotify-save-close"
                id="spotifySaveClose"
                type="button"
            >
                ×
            </button>

            <h2>
                🎵 Spotifyに保存
            </h2>

            <p>
                今のおすすめ曲を
                Spotifyのプレイリストに保存します。
            </p>

            <label>
                プレイリスト名
            </label>

            <input
                id="spotifyPlaylistName"
                type="text"
                maxlength="100"
                value="${escapeHtml(
                    selectedMood
                        ? `${selectedMood}のおすすめ5曲`
                        : "Music Picker"
                )}"
            >

            <label>
                公開設定
            </label>

            <div class="spotify-public-options">

                <label>
                    <input
                        type="radio"
                        name="spotifyPlaylistPublic"
                        value="false"
                        checked
                    >
                    🔒 非公開
                </label>

                <label>
                    <input
                        type="radio"
                        name="spotifyPlaylistPublic"
                        value="true"
                    >
                    🌎 公開
                </label>

            </div>

            <div class="spotify-save-actions">

                <button
                    id="spotifySaveCancel"
                    type="button"
                    class="spotify-cancel-button"
                >
                    キャンセル
                </button>

                <button
                    id="spotifySaveConfirm"
                    type="button"
                    class="spotify-confirm-button"
                >
                    🎵 Spotifyに保存
                </button>

            </div>

            <div
                id="spotifySaveStatus"
                class="spotify-save-status"
            ></div>

        </div>
    `;

    document.body.appendChild(
        modal
    );

    const closeButton =
        document.getElementById(
            "spotifySaveClose"
        );

    const cancelButton =
        document.getElementById(
            "spotifySaveCancel"
        );

    const confirmButton =
        document.getElementById(
            "spotifySaveConfirm"
        );

    if (closeButton) {

        closeButton.addEventListener(
            "click",
            () => modal.remove()
        );

    }

    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            () => modal.remove()
        );

    }

    if (confirmButton) {

        confirmButton.addEventListener(
            "click",
            () => savePlaylistToSpotify(
                playlist
            )
        );

    }

    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal
            ) {

                modal.remove();

            }

        }
    );

}


// ============================================================
// Spotifyへプレイリストを保存
// ============================================================

async function savePlaylistToSpotify(
    playlist
) {

    const token =
        localStorage.getItem(
            "spotify_access_token"
        ) || "";

    if (!token) {

        alert(
            "Spotifyにログインしてください。"
        );

        location.href =
            "/auth/login";

        return;

    }

    const nameInput =
        document.getElementById(
            "spotifyPlaylistName"
        );

    const confirmButton =
        document.getElementById(
            "spotifySaveConfirm"
        );

    const status =
        document.getElementById(
            "spotifySaveStatus"
        );

    const name =
        nameInput?.value.trim() ||
        "Music Picker";
        // アプリ内ライブラリにも保存
saveGeneratedPlaylistToLibrary({
    name: name,
    tracks: tracks
});

    const publicRadio =
        document.querySelector(
            'input[name="spotifyPlaylistPublic"]:checked'
        );

    const isPublic =
        publicRadio?.value === "true";

    if (!playlist || !playlist.length) {

        return;

    }

    const tracks =
        playlist
            .map(
                track =>
                    normalizeTrack(track)
            )
            .filter(
                track =>
                    track &&
                    track.uri &&
                    track.uri.startsWith(
                        "spotify:track:"
                    )
            );

    if (!tracks.length) {

        alert(
            "Spotifyに保存できる曲がありません。"
        );

        return;

    }

    if (confirmButton) {

        confirmButton.disabled =
            true;

        confirmButton.textContent =
            "⏳ 保存しています...";

    }

    if (status) {

        status.textContent =
            "Spotifyにプレイリストを作成しています...";

    }

    try {

        const response =
            await fetch(
                "/api/create-playlist",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            name:
                                name,

                            public:
                                isPublic,

                            tracks:
                                tracks.map(
                                    track =>
                                        track.uri
                                )

                        })
                }
            );

        const data =
            await response.json()
                .catch(
                    () => ({})
                );

        if (!response.ok) {

            if (
                response.status === 401
            ) {

                localStorage.removeItem(
                    "spotify_access_token"
                );

                alert(
                    "Spotifyのログイン期限が切れています。再ログインしてください。"
                );

                location.href =
                    "/auth/login";

                return;

            }

            throw new Error(
                data.error ||
                "Spotifyへの保存に失敗しました。"
            );

        }

        attachSpotifyPlaylistToLibrary(
    playlist,
    data,
    name
);

        const modal =
            document.getElementById(
                "spotifySaveModal"
            );

        if (!modal) {
            return;
        }

        modal.innerHTML = `
            <div class="spotify-save-box spotify-save-success">

                <div class="spotify-success-icon">
                    ✅
                </div>

                <h2>
                    Spotifyに保存しました！
                </h2>

                <p>
                    「${escapeHtml(
                        data.playlistName ||
                        name
                    )}」
                </p>

                <p>
                    ${Number(
                        data.addedTracks ||
                        tracks.length
                    )}曲を追加しました。
                </p>

                <div class="spotify-save-actions">

                    ${
                        data.spotifyUrl
                            ? `
                                <button
                                    type="button"
                                    class="spotify-confirm-button"
                                    id="openSpotifyPlaylist"
                                >
                                    🎵 Spotifyで開く
                                </button>
                            `
                            : ""
                    }

                    <button
                        type="button"
                        class="spotify-cancel-button"
                        id="closeSpotifySuccess"
                    >
                        閉じる
                    </button>

                </div>

            </div>
        `;

        const openButton =
            document.getElementById(
                "openSpotifyPlaylist"
            );

        if (openButton) {

            openButton.addEventListener(
                "click",
                () => {

                    if (
                        data.spotifyUrl
                    ) {

                        window.open(
                            data.spotifyUrl,
                            "_blank"
                        );

                    }

                }
            );

        }

        const closeButton =
            document.getElementById(
                "closeSpotifySuccess"
            );

        if (closeButton) {

            closeButton.addEventListener(
                "click",
                () => modal.remove()
            );

        }

        showToast(
            "🎵 Spotifyにプレイリストを保存しました！"
        );

    } catch (error) {

        console.error(
            "Spotifyプレイリスト保存エラー:",
            error
        );

        if (status) {

            status.textContent =
                error.message ||
                "保存に失敗しました。";

        }

        if (confirmButton) {

            confirmButton.disabled =
                false;

            confirmButton.textContent =
                "🎵 Spotifyに保存";

        }

    }

}
function initLibraryAccordion() {
    const headers = document.querySelectorAll(".library-section-header");

    headers.forEach(header => {
        header.addEventListener("click", () => {
            const targetId = header.dataset.target;
            const content = document.getElementById(targetId);

            if (!content) return;

            content.classList.toggle("closed");
            header.classList.toggle("closed");
        });
    });
}
// ============================================================
// 🎵 フルスクリーン NOW PLAYING
// ============================================================

let fullPlayerOverlay = null;
let fullPlayerTimer = null;


// ============================================================
// フルプレイヤーを作る
// ============================================================

function createFullPlayer() {

    if (document.getElementById("fullPlayerOverlay")) {
        return;
    }

    const overlay = document.createElement("div");

    overlay.id = "fullPlayerOverlay";
    overlay.className = "full-player-overlay";

    overlay.innerHTML = `

        <div
            id="fullPlayerMain"
            class="full-player-main"
        >

            <div class="full-player-top">

                <button
                    class="full-player-close"
                    id="fullPlayerClose"
                    type="button"
                    aria-label="閉じる"
                >
                    ×
                </button>

                <div class="full-player-top-title">
                    NOW PLAYING
                </div>

                <button
                    class="full-player-queue-button"
                    id="fullPlayerQueueButton"
                    type="button"
                    aria-label="再生リスト"
                >
                    📋
                </button>

            </div>


            <div class="full-player-art-wrap">

                <img
                    id="fullPlayerArt"
                    class="full-player-art"
                    alt=""
                >

            </div>


            <div class="full-player-info">

                <div class="full-player-text">

                    <div
                        id="fullPlayerTitle"
                        class="full-player-title"
                    >
                        曲名なし
                    </div>

                    <div
                        id="fullPlayerArtist"
                        class="full-player-artist"
                    >
                        アーティスト
                    </div>

                </div>


                <button
                    id="fullPlayerFavorite"
                    class="full-player-favorite"
                    type="button"
                >
                    ♡
                </button>

            </div>


            <div class="full-player-progress-area">

                <input
                    id="fullPlayerProgress"
                    class="full-player-progress"
                    type="range"
                    min="0"
                    max="100"
                    value="0"
                >

                <div class="full-player-times">

                    <span id="fullPlayerCurrentTime">
                        0:00
                    </span>

                    <span id="fullPlayerDuration">
                        0:00
                    </span>

                </div>

            </div>


            <div class="full-player-controls">

                <button
                    id="fullPlayerPrevious"
                    class="full-player-control"
                    type="button"
                    aria-label="前の曲"
                >
                    ⏮
                </button>


                <button
                    id="fullPlayerPlay"
                    class="full-player-control full-player-play"
                    type="button"
                    aria-label="再生"
                >
                    ▶
                </button>


                <button
                    id="fullPlayerNext"
                    class="full-player-control"
                    type="button"
                    aria-label="次の曲"
                >
                    ⏭
                </button>

            </div>


            <div class="full-player-volume">

                <span>🔈</span>

                <input
                    id="fullPlayerVolume"
                    type="range"
                    min="0"
                    max="100"
                    value="50"
                >

                <span>🔊</span>

            </div>


            <div class="full-player-extra">

                <button
                    id="fullPlayerShuffle"
                    type="button"
                >
                    🔀 シャッフル
                </button>

                <button
                    id="fullPlayerRepeat"
                    type="button"
                >
                    🔁 OFF
                </button>

            </div>

        </div>


        <!-- =========================================
             📋 再生リスト
             ========================================= -->

        <div
            id="fullPlayerQueueScreen"
            class="full-player-queue-screen"
            style="display:none;"
        >

            <div class="queue-screen-header">

                <button
                    id="fullPlayerQueueBack"
                    class="queue-screen-back"
                    type="button"
                    aria-label="戻る"
                >
                    ←
                </button>

                <div class="queue-screen-title">
                    再生リスト
                </div>

            </div>


            <div
                id="fullPlayerQueue"
                class="full-player-queue-list"
            ></div>

        </div>

    `;

    document.body.appendChild(overlay);

    fullPlayerOverlay = overlay;


    // ============================================================
    // 閉じる
    // ============================================================

    document
        .getElementById("fullPlayerClose")
        .addEventListener(
            "click",
            closeFullPlayer
        );


    // ============================================================
    // 再生リスト
    // ============================================================

    document
        .getElementById("fullPlayerQueueButton")
        .addEventListener(
            "click",
            showFullPlayerQueue
        );


    // ============================================================
    // NOW PLAYINGへ戻る
    // ============================================================

    document
        .getElementById("fullPlayerQueueBack")
        .addEventListener(
            "click",
            showFullPlayerMain
        );


    // ============================================================
    // 再生 / 一時停止
    // ============================================================

    document
        .getElementById("fullPlayerPlay")
        .addEventListener(
            "click",
            togglePlayback
        );


    // ============================================================
    // 前の曲
    // ============================================================

    document
        .getElementById("fullPlayerPrevious")
        .addEventListener(
            "click",
            playPrevious
        );


    // ============================================================
    // 次の曲
    // ============================================================

    document
        .getElementById("fullPlayerNext")
        .addEventListener(
            "click",
            playNext
        );


    // ============================================================
    // シーク
    // ============================================================

    const progress =
        document.getElementById(
            "fullPlayerProgress"
        );

    if (progress) {

        progress.addEventListener(
            "input",
            () => {

                seekPlayback(
                    Number(progress.value)
                );

            }
        );

    }


    // ============================================================
    // 音量
    // ============================================================

    const volume =
        document.getElementById(
            "fullPlayerVolume"
        );

    if (volume) {

        volume.addEventListener(
            "input",
            () => {

                changeVolume(
                    Number(volume.value)
                );

            }
        );

    }


    // ============================================================
    // シャッフル
    // ============================================================

    document
        .getElementById("fullPlayerShuffle")
        .addEventListener(
            "click",
            () => {

                appSettings.shuffle =
                    !appSettings.shuffle;

                saveAppSetting(
                    "shuffle",
                    appSettings.shuffle
                );

                updateFullPlayer();

                showToast(
                    appSettings.shuffle
                        ? "🔀 シャッフル ON"
                        : "🔀 シャッフル OFF"
                );

            }
        );


    // ============================================================
    // リピート
    // ============================================================

    document
        .getElementById("fullPlayerRepeat")
        .addEventListener(
            "click",
            cycleFullPlayerRepeat
        );


    // ============================================================
    // お気に入り
    // ============================================================

    document
        .getElementById("fullPlayerFavorite")
        .addEventListener(
            "click",
            () => {

                if (!currentTrackData) {
                    return;
                }

                toggleFavorite(
                    currentTrackData
                );

                updateFullPlayer();

            }
        );


    // ============================================================
    // 背景クリック
    // ============================================================

    overlay.addEventListener(
        "click",
        event => {

            if (event.target === overlay) {
                closeFullPlayer();
            }

        }
    );

}


// ============================================================
// 📋 再生リストを表示
// ============================================================

function showFullPlayerQueue() {

    const main =
        document.getElementById(
            "fullPlayerMain"
        );

    const queue =
        document.getElementById(
            "fullPlayerQueueScreen"
        );

    if (!main || !queue) {
        return;
    }

    main.style.display = "none";
    queue.style.display = "block";

    updateFullPlayerQueue();

}


// ============================================================
// ← NOW PLAYINGに戻る
// ============================================================

function showFullPlayerMain() {

    const main =
        document.getElementById(
            "fullPlayerMain"
        );

    const queue =
        document.getElementById(
            "fullPlayerQueueScreen"
        );

    if (!main || !queue) {
        return;
    }

    queue.style.display = "none";
    main.style.display = "block";

}


// ============================================================
// フルプレイヤーを開く
// ============================================================

function openFullPlayer() {

    if (!currentTrackData) {
        return;
    }

    createFullPlayer();

    showFullPlayerMain();

    updateFullPlayer();

    fullPlayerOverlay.classList.add(
        "is-open"
    );

    document.body.style.overflow = "hidden";

    startFullPlayerUpdater();

}


// ============================================================
// フルプレイヤーを閉じる
// ============================================================

function closeFullPlayer() {

    if (!fullPlayerOverlay) {
        return;
    }

    fullPlayerOverlay.classList.remove(
        "is-open"
    );

    document.body.style.overflow = "";

    stopFullPlayerUpdater();

}


// ============================================================
// 曲情報を更新
// ============================================================

function updateFullPlayer() {

    if (!fullPlayerOverlay) {
        return;
    }

    if (!currentTrackData) {
        return;
    }

    const track =
        normalizeTrack(
            currentTrackData
        );


    const title =
        document.getElementById(
            "fullPlayerTitle"
        );

    const artist =
        document.getElementById(
            "fullPlayerArtist"
        );

    const image =
        document.getElementById(
            "fullPlayerArt"
        );


    if (title) {

        title.textContent =
            track.title ||
            "曲名なし";

    }


    if (artist) {

        artist.textContent =
            getArtistText(track);

    }


    if (image) {

        image.src =
            track.image ||
            track.album?.images?.[0]?.url ||
            "";

    }


    updateFullPlayerPlayButton();


    // ========================================================
    // 音量
    // ========================================================

    const volume =
        document.getElementById(
            "fullPlayerVolume"
        );

    if (volume) {

        volume.value =
            Math.round(
                getSavedVolume() * 100
            );

    }


    // ========================================================
    // シャッフル
    // ========================================================

    const shuffle =
        document.getElementById(
            "fullPlayerShuffle"
        );

    if (shuffle) {

        shuffle.classList.toggle(
            "active",
            !!appSettings.shuffle
        );

    }


    // ========================================================
    // リピート
    // ========================================================

    const repeat =
        document.getElementById(
            "fullPlayerRepeat"
        );

    if (repeat) {

        const labels = {

            off: "🔁 OFF",
            one: "🔂 1曲",
            all: "🔁 全曲"

        };

        repeat.textContent =
            labels[
                appSettings.repeat
            ] || "🔁 OFF";

        repeat.classList.toggle(
            "active",
            appSettings.repeat !== "off"
        );

    }


    // ========================================================
    // お気に入り
    // ========================================================

    const favorite =
        document.getElementById(
            "fullPlayerFavorite"
        );

    if (favorite) {

        const favorites =
            getFavorites();

        const exists =
            favorites.some(
                saved =>
                    saved.uri === track.uri
            );

        favorite.textContent =
            exists
                ? "♥"
                : "♡";

    }


    updateFullPlayerQueue();

}


// ============================================================
// 再生ボタン表示
// ============================================================

async function updateFullPlayerPlayButton() {

    if (!spotifyPlayer) {
        return;
    }

    try {

        const state =
            await spotifyPlayer.getCurrentState();

        const button =
            document.getElementById(
                "fullPlayerPlay"
            );

        if (!button) {
            return;
        }

        button.textContent =
            state && !state.paused
                ? "Ⅱ"
                : "▶";

    } catch (_) {}

}


// ============================================================
// リピート切り替え
// ============================================================

function cycleFullPlayerRepeat() {

    const modes = [
        "off",
        "one",
        "all"
    ];

    const current =
        modes.indexOf(
            appSettings.repeat
        );

    const next =
        modes[
            (current + 1) %
            modes.length
        ];

    saveAppSetting(
        "repeat",
        next
    );

    updateFullPlayer();

    showToast(
        next === "off"
            ? "🔁 リピート OFF"
            : next === "one"
                ? "🔂 1曲リピート"
                : "🔁 全曲リピート"
    );

}


// ============================================================
// 📋 再生リスト
// ============================================================

function updateFullPlayerQueue() {

    const container =
        document.getElementById(
            "fullPlayerQueue"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";


    // ========================================================
    // プレイリストがない場合
    // ========================================================

    if (
        !currentPlaylist ||
        !currentPlaylist.length
    ) {

        if (currentTrackData) {

            currentPlaylist = [
                normalizeTrack(
                    currentTrackData
                )
            ];

            currentTrackIndex = 0;

        } else {

            container.innerHTML = `
                <div class="queue-empty">
                    再生リストはありません
                </div>
            `;

            return;

        }

    }


    const tracks =
        normalizeTracks(
            currentPlaylist
        );


    tracks.forEach(
        (track, index) => {

            if (!track) {
                return;
            }


            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "full-player-queue-item";


            // ==================================================
            // 現在再生中
            // ==================================================

            if (
                index === currentTrackIndex &&
                currentTrackData?.uri === track.uri
            ) {

                item.classList.add(
                    "is-current"
                );

            }


            // ==================================================
            // ジャケット
            // ==================================================

            const image =
                document.createElement(
                    "img"
                );

            image.src =
                track.image ||
                track.album?.images?.[0]?.url ||
                "";

            image.alt =
                track.title ||
                "";


            // ==================================================
            // 曲情報
            // ==================================================

            const info =
                document.createElement(
                    "div"
                );

            info.className =
                "full-player-queue-info";


            const name =
                document.createElement(
                    "div"
                );

            name.className =
                "full-player-queue-name";

            name.textContent =
                track.title ||
                "曲名なし";


            const artist =
                document.createElement(
                    "div"
                );

            artist.className =
                "full-player-queue-artist";

            artist.textContent =
                getArtistText(track);


            info.appendChild(name);
            info.appendChild(artist);


            // ==================================================
            // 再生アイコン
            // ==================================================

            const play =
                document.createElement(
                    "div"
                );

            play.className =
                "full-player-queue-play";

            play.textContent =
                index === currentTrackIndex
                    ? "▶"
                    : "▷";


            item.appendChild(image);
            item.appendChild(info);
            item.appendChild(play);


            // ==================================================
            // 曲を選択
            // ==================================================

            item.addEventListener(
                "click",
                async () => {

                    currentPlaylist =
                        tracks;

                    currentTrackIndex =
                        index;

                    isPlaylistMode =
                        true;

                    await playTrack(
                        track,
                        index,
                        true
                    );

                    showFullPlayerMain();

                    updateFullPlayer();

                    updateFullPlayerQueue();

                }
            );


            container.appendChild(item);

        }
    );

}


// ============================================================
// 再生位置を更新
// ============================================================

async function updateFullPlayerProgress() {

    if (
        !fullPlayerOverlay ||
        !fullPlayerOverlay.classList.contains(
            "is-open"
        )
    ) {
        return;
    }

    if (!spotifyPlayer) {
        return;
    }


    try {

        const state =
            await spotifyPlayer.getCurrentState();

        if (!state) {
            return;
        }


        const progress =
            document.getElementById(
                "fullPlayerProgress"
            );

        const currentTime =
            document.getElementById(
                "fullPlayerCurrentTime"
            );

        const duration =
            document.getElementById(
                "fullPlayerDuration"
            );


        // ========================================================
        // プログレスバー
        // ========================================================

        if (progress) {

            progress.max =
                state.duration || 0;

            progress.value =
                Math.min(
                    state.position || 0,
                    state.duration || 0
                );

        }


        // ========================================================
        // 現在時間
        // ========================================================

        if (currentTime) {

            currentTime.textContent =
                formatTime(
                    state.position || 0
                );

        }


        // ========================================================
        // 曲の長さ
        // ========================================================

        if (duration) {

            duration.textContent =
                formatTime(
                    state.duration || 0
                );

        }


        // ========================================================
        // 再生ボタン
        // ========================================================

        const play =
            document.getElementById(
                "fullPlayerPlay"
            );

        if (play) {

            play.textContent =
                state.paused
                    ? "▶"
                    : "Ⅱ";

        }

    } catch (_) {}

}


// ============================================================
// 定期更新
// ============================================================

function startFullPlayerUpdater() {

    stopFullPlayerUpdater();

    fullPlayerTimer =
        setInterval(
            () => {

                updateFullPlayerProgress();

                // 曲情報などの更新
                if (
                    fullPlayerOverlay &&
                    fullPlayerOverlay.classList.contains(
                        "is-open"
                    )
                ) {
                    updateFullPlayer();
                }

            },
            1000
        );

}


function stopFullPlayerUpdater() {

    if (fullPlayerTimer) {

        clearInterval(
            fullPlayerTimer
        );

        fullPlayerTimer = null;

    }

}


// ============================================================
// 下の再生バーをタップしたら開く
// ============================================================

function initFullPlayer() {

    createFullPlayer();

    const panel =
        document.getElementById(
            "playerPanel"
        );

    if (!panel) {
        return;
    }


    panel.style.cursor = "pointer";


    panel.addEventListener(
        "click",
        event => {

            // ボタン・スライダー・リンクは除外
            if (
                event.target.closest(
                    "button, input, a"
                )
            ) {
                return;
            }

            openFullPlayer();

        }
    );

}


// ============================================================
// 初期化
// ============================================================

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initFullPlayer
    );

} else {

    initFullPlayer();

}


