// ============================================================
// Music Picker
// ============================================================

let selectedMood = "";
let selectedGenre = "all";

let selectedArtistId = "";
let selectedArtistName = "";
let selectedArtistImage = "";

let previousSongs = [];

let currentPlaylist = [];
let currentTrackIndex = 0;

let isPlaylistMode = false;

let spotifyPlayer = null;
let spotifyDeviceId = "";
let spotifyToken = "";

let searchRequestId = 0;
let playbackRequestId = 0;

// ========================================
// 気分ごとに違う順番を作る
// ========================================

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

// ========================================
// 気分に応じて曲を並べ替える
// ========================================

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

document.addEventListener("DOMContentLoaded", () => {

    console.log("Music Picker 起動");

    // 前回の曲
    try {
        previousSongs = JSON.parse(
            localStorage.getItem("previousSongs") || "[]"
        );

        if (!Array.isArray(previousSongs)) {
            previousSongs = [];
        }

    } catch (_) {
        previousSongs = [];
    }

    initMenu();
    initBottomNav();
    initHome();
    initSearch();
    initSettings();
    initTheme();
    initSpotify();

    updateFavoritesPage();
    updateHistoryPage();

});


// ============================================================
// 下部ナビゲーション
// ============================================================

function initBottomNav() {

    const links =
        document.querySelectorAll(".bottom-nav-link");

    links.forEach(link => {

        link.addEventListener("click", () => {

            const pageId = link.dataset.page;

            showPage(pageId);

        });

    });

}


// ============================================================
// ハンバーガーメニュー
// ============================================================

function initMenu() {

    const menuButton =
        document.getElementById("menuButton");

    const sideMenu =
        document.getElementById("sideMenu");

    const overlay =
        document.getElementById("menuOverlay");

    const menuLinks =
        document.querySelectorAll(".menu-link");

    if (!menuButton || !sideMenu) {
        return;
    }

    menuButton.addEventListener("click", () => {

        sideMenu.classList.toggle("open");

        if (overlay) {
            overlay.classList.toggle("open");
        }

    });

    if (overlay) {
        overlay.addEventListener("click", closeMenu);
    }

    menuLinks.forEach(link => {

        link.addEventListener("click", () => {

            showPage(link.dataset.page);
            closeMenu();

        });

    });

}


function closeMenu() {

    const sideMenu =
        document.getElementById("sideMenu");

    const overlay =
        document.getElementById("menuOverlay");

    if (sideMenu) {
        sideMenu.classList.remove("open");
    }

    if (overlay) {
        overlay.classList.remove("open");
    }

}


// ============================================================
// ページ切り替え
// ============================================================

function showPage(pageId) {

    document.querySelectorAll(".page").forEach(page => {

        page.classList.remove("active-page");

    });

    const page =
        document.getElementById(pageId);

    if (page) {
        page.classList.add("active-page");
    }


    // サイドメニュー
    document.querySelectorAll(".menu-link").forEach(link => {

        link.classList.toggle(
            "active",
            link.dataset.page === pageId
        );

    });


    // 下部ナビ
    document.querySelectorAll(".bottom-nav-link").forEach(link => {

        link.classList.toggle(
            "active",
            link.dataset.page === pageId
        );

    });


    if (pageId === "favoritesPage") {
        updateFavoritesPage();
    }

    if (pageId === "historyPage") {
        updateHistoryPage();
    }

}


// ============================================================
// ホーム
// ============================================================

function initHome() {

    const moodButtons =
        document.querySelectorAll(".moods button");


    moodButtons.forEach(button => {

        button.addEventListener("click", () => {

            moodButtons.forEach(btn => {
                btn.classList.remove("selected");
            });

            button.classList.add("selected");


            selectedMood =
                button.dataset.mood ||
                button.textContent.trim();


            console.log(
                "選択した気分:",
                selectedMood
            );

        });

    });


    const genre =
        document.getElementById("genre");


    if (genre) {

        selectedGenre =
            genre.value || "all";


        genre.addEventListener("change", () => {

            selectedGenre =
                genre.value;


            console.log(
                "選択したジャンル:",
                selectedGenre
            );

        });

    }


    initArtistSearch();


    const makeButton =
        document.getElementById("makePlaylist");


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
        document.getElementById("artistSearch");

    const results =
        document.getElementById("artistResults");

    const selected =
        document.getElementById("selectedArtist");


    if (!input || !results) {
        return;
    }


    input.addEventListener("input", async () => {

        const keyword =
            input.value.trim();

        const requestId =
            ++searchRequestId;


        // 新しい検索を始めたら
        // 現在のアーティスト選択を解除
        if (keyword) {

            selectedArtistId = "";
            selectedArtistName = "";
            selectedArtistImage = "";

            if (selected) {

                selected.innerHTML = "";
                selected.style.display = "none";

            }

        }


        if (!keyword) {

            results.innerHTML = "";
            return;

        }


        results.innerHTML =
            `<div class="loading">
                🔎 検索中...
            </div>`;


        try {

            const response =
                await fetch(
                    `/api/artists?q=${encodeURIComponent(keyword)}`
                );


            if (!response.ok) {

                if (response.status === 429) {
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
                requestId !== searchRequestId
            ) {
                return;
            }


            results.innerHTML = "";


            if (
                !Array.isArray(artists) ||
                artists.length === 0
            ) {

                results.innerHTML =
                    `<div class="no-results">
                        アーティストが見つかりません
                    </div>`;

                return;

            }


            artists.forEach(artist => {

                const item =
                    document.createElement("div");

                item.className =
                    "artist-result";


                const image =
                    document.createElement("img");

                image.src =
                    artist.image ||
                    artist.images?.[0]?.url ||
                    "";

                image.alt =
                    artist.name || "";


                image.onerror = () => {
                    image.style.display = "none";
                };


                const name =
                    document.createElement("span");

                name.textContent =
                    artist.name || "名前なし";


                item.appendChild(image);
                item.appendChild(name);


                item.addEventListener("click", () => {

                    selectArtist(artist);

                    results.innerHTML = "";

                    input.value = "";

                });


                results.appendChild(item);

            });


        } catch (error) {

            console.error(
                "アーティスト検索エラー:",
                error
            );


            results.innerHTML =
                `<div class="error-message">
                    ${escapeHtml(error.message)}
                </div>`;

        }

    });

}


// ============================================================
// アーティスト選択
// ============================================================

function selectArtist(artist) {

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


    selected.innerHTML = `

        <div class="selected-artist-card">

            <img
                class="selected-artist-image"
                src="${escapeHtml(selectedArtistImage)}"
                alt="${escapeHtml(selectedArtistName)}"
            >

            <div class="selected-artist-info">

                <strong>
                    ${escapeHtml(selectedArtistName)}
                </strong>

                <span class="selected-check">
                    ✓ 選択中
                </span>

            </div>

        </div>

    `;


    selected.style.display = "block";


    const image =
        selected.querySelector(
            ".selected-artist-image"
        );


    if (image) {

        image.onerror = () => {
            image.style.display = "none";
        };

    }

}


async function makePlaylist() {

    if (!selectedMood) {

        alert("気分を選択してください。");

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
        button.disabled = true;
        button.textContent =
            "🎵 80曲から選んでいます...";
    }

    try {

        let tracks = [];

        // ========================================
        // アーティスト
        // ========================================

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
                        .catch(() => ({}));

                throw new Error(
                    error.error ||
                    "アーティストの曲取得に失敗しました。"
                );
            }

            tracks =
                await response.json();

        }

        // ========================================
        // ジャンル
        // ========================================

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
                        .catch(() => ({}));

                throw new Error(
                    error.error ||
                    "ジャンルの曲取得に失敗しました。"
                );
            }

            tracks =
                await response.json();
        }


        // ========================================
        // ① 不正データ除外
        // ========================================

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


        // ========================================
        // ② 重複削除
        // ========================================

        const uniqueMap =
            new Map();

        tracks.forEach(track => {

            if (
                !uniqueMap.has(track.uri)
            ) {

                uniqueMap.set(
                    track.uri,
                    track
                );

            }

        });


        tracks =
            Array.from(
                uniqueMap.values()
            );


        console.log(
            "重複削除後:",
            tracks.length,
            "曲"
        );


        // ========================================
        // ③ 気分ごとに並べ替え
        // ========================================

        tracks =
            sortTracksByMood(
                tracks,
                selectedMood
            );


        console.log(
            "気分:",
            selectedMood
        );


        // ========================================
        // ④ 前回使った曲を除外
        // ========================================

        const previousSet =
            new Set(previousSongs);


        const newTracks =
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


        // ========================================
        // ⑤ 5曲決定
        // ========================================

        const playlist =
            newTracks.slice(0, 5);


        // ========================================
        // 5曲未満だった場合
        // ========================================

        if (playlist.length < 5) {

            alert(
                "新しい曲が5曲見つかりませんでした。\n" +
                "もう一度試すか、別の条件を選択してください。"
            );

            return;
        }


        // ========================================
        // プレイリスト保存
        // ========================================

        currentPlaylist =
            playlist;

        currentTrackIndex = 0;


        // ========================================
        // 前回曲として保存
        // ========================================

        previousSongs.push(
            ...playlist.map(
                track =>
                    track.uri
            )
        );


        // 最大20曲まで
        if (
            previousSongs.length > 20
        ) {

            previousSongs =
                previousSongs.slice(-20);

        }


        localStorage.setItem(
            "previousSongs",
            JSON.stringify(
                previousSongs
            )
        );


        // ========================================
        // 履歴
        // ========================================

        if (
            typeof saveToHistory ===
            "function"
        ) {

            saveToHistory(
                playlist
            );

        }


        // ========================================
        // 表示
        // ========================================

        displayPlaylist(
            playlist
        );


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

            button.disabled = false;

            button.textContent =
                "🎵 おすすめ5曲を作る";

        }

    }

}

// ============================================================
// ★ 気分別シャッフル
// ============================================================
//
// 同じSpotify検索結果でも
// 「楽しい」と「しんみり」で
// 選ばれる順番を変える。
//
// Spotify APIには曲ごとの「気分」という
// 完全な分類値がないため、ここでは
// 気分ごとの固定シードを使って選曲順を変える。
// ============================================================

function moodShuffle(tracks, mood) {

    const moodSeeds = {

        "楽しい": 137,

        "テンション高い": 421,

        "落ち着きたい": 763,

        "しんみり": 982

    };


    const seed =
        moodSeeds[mood] || 555;


    const result =
        [...tracks];


    // Fisher-Yates + 気分シード
    let currentSeed =
        seed;


    function random() {

        currentSeed =
            (
                currentSeed * 9301 +
                49297
            ) % 233280;


        return (
            currentSeed /
            233280
        );

    }


    for (
        let i = result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                random() * (i + 1)
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

function displayPlaylist(playlist) {

    const container =
        document.getElementById(
            "playlist"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    // ========================================================
    // ヘッダー
    // ========================================================

    const header =
        document.createElement("div");

    header.className =
        "playlist-header";


    const title =
        document.createElement("h2");

    title.textContent =
        `🎵 ${selectedMood}のおすすめ5曲`;


    const playAll =
        document.createElement("button");

    playAll.className =
        "play-all-button";

    playAll.textContent =
        "▶ まとめて再生";


    playAll.addEventListener(
        "click",
        async () => {

            currentPlaylist =
                normalizeTracks(
                    playlist
                );

            currentTrackIndex = 0;

            isPlaylistMode = true;


            await playTrack(
                currentPlaylist[0],
                0,
                true
            );

        }
    );


    header.appendChild(title);
    header.appendChild(playAll);

    container.appendChild(header);


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
        normalizeTrack(track);


    const card =
        document.createElement("div");

    card.className =
        "track-card";


    // --------------------------------------------------------
    // ジャケット
    // --------------------------------------------------------

    const image =
        document.createElement("img");

    image.className =
        "track-image";

    image.src =
        track.image || "";

    image.alt =
        track.title || "";


    image.onerror = () => {

        image.style.display =
            "none";

    };


    // --------------------------------------------------------
    // 曲情報
    // --------------------------------------------------------

    const info =
        document.createElement("div");

    info.className =
        "track-info";


    const title =
        document.createElement("div");

    title.className =
        "track-title";

    title.textContent =
        track.title;


    const artist =
        document.createElement("div");

    artist.className =
        "track-artist";

    artist.textContent =
        getArtistText(track);


    info.appendChild(title);
    info.appendChild(artist);


    // --------------------------------------------------------
    // ボタン
    // --------------------------------------------------------

    const actions =
        document.createElement("div");

    actions.className =
        "track-actions";


    // --------------------------------------------------------
    // 再生
    // --------------------------------------------------------

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

            currentTrackIndex = 0;

            isPlaylistMode = false;


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
        document.createElement("a");

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
        event =>
            event.stopPropagation()
    );


    actions.appendChild(play);
    actions.appendChild(favorite);
    actions.appendChild(spotify);


    card.appendChild(image);
    card.appendChild(info);
    card.appendChild(actions);


    // カードクリックでも再生
    card.addEventListener(
        "click",
        async () => {

            currentPlaylist =
                [track];

            currentTrackIndex = 0;

            isPlaylistMode = false;


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


    track =
        normalizeTrack(track);


    if (!track || !track.uri) {

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

        // ====================================================
        // 再生する曲
        // ====================================================

        let uris =
            [track.uri];


        if (
            playlistMode &&
            currentPlaylist.length > 0
        ) {

            const playlistTracks =
                normalizeTracks(
                    currentPlaylist
                );


            uris =
                playlistTracks.map(
                    item =>
                        item.uri
                );

        }


        if (!uris.length) {

            uris =
                [track.uri];

        }


        console.log(
            "Spotify再生:",
            uris
        );


        // ====================================================
        // ブラウザ再生許可
        // ====================================================

        if (
            spotifyPlayer.activateElement
        ) {

            try {

                await spotifyPlayer.activateElement();

            } catch (_) {}

        }


        // ====================================================
        // Web Playerへ移動
        // ====================================================

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

                        device_ids: [
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


        // ====================================================
        // Spotify再生
        // ====================================================

        const body = {

            uris: uris,

            position_ms: 0

        };


        // ★重要
        //
        // プレイリスト中に「次へ」を押した場合、
        // offset.position で指定した曲から開始する。
        //

        if (
            playlistMode &&
            uris.length > 1
        ) {

            body.offset = {
                position: index
            };

        }


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
                        JSON.stringify(body)

                }
            );


        if (!response.ok) {

            const error =
                await readSpotifyError(
                    response
                );


            if (
                response.status === 401
            ) {

                localStorage.removeItem(
                    "spotify_access_token"
                );

                spotifyToken = "";

                throw new Error(
                    "Spotifyのログイン期限が切れています。\nもう一度ログインしてください。"
                );

            }


            if (
                response.status === 403
            ) {

                throw new Error(
                    "Spotifyの再生権限がありません。\nPremiumアカウントと権限を確認してください。"
                );

            }


            throw new Error(
                `Spotify再生エラー: ${error}`
            );

        }


        // ====================================================
        // プレイヤー情報
        // ====================================================

        currentPlaylist =
            normalizeTracks(
                currentPlaylist
            );


        if (playlistMode) {

            currentTrackIndex =
                index;

        } else {

            currentPlaylist =
                [track];

            currentTrackIndex = 0;

        }


        isPlaylistMode =
            playlistMode;


        showPlayerPanel();

        updatePlayerInfo(
            track
        );


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

    // 二重作成防止
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


    spotifyPlayer =
        new Spotify.Player({

            name:
                "Music Picker",

            volume:
                getSavedVolume(),


            getOAuthToken:
                callback => {

                    const token =
                        localStorage.getItem(
                            "spotify_access_token"
                        ) || "";


                    spotifyToken =
                        token;


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

                spotifyDeviceId = "";

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

            if (!state) {
                return;
            }


            updatePlayerState(
                state
            );


            const current =
                state.track_window
                    ?.current_track;


            if (!current) {
                return;
            }


            const currentTrack =
                normalizeTrack(
                    current
                );


            const uri =
                currentTrack.uri;


            const index =
                currentPlaylist.findIndex(
                    track =>
                        track.uri ===
                        uri
                );


            if (index >= 0) {

                currentTrackIndex =
                    index;

            }


            updatePlayerInfo(
                currentTrack
            );

        }
    );


    // ========================================================
    // Autoplay
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
    // 初期化エラー
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
    // 認証エラー
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
    // アカウントエラー
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
    // 再生エラー
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
    // 接続
    // ========================================================

    spotifyPlayer
        .connect()
        .then(success => {

            console.log(
                "Spotify接続:",
                success
            );

        })
        .catch(error => {

            console.error(
                "Spotify接続エラー:",
                error
            );

        });

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
        Date.now() - start < timeout
    ) {

        await sleep(250);

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


    if (panel) {

        panel.style.display =
            "block";

    }


    setupVolume();

}


// ============================================================
// プレイヤー情報
// ============================================================

function updatePlayerInfo(
    track
) {

    track =
        normalizeTrack(track);


    if (!track) {
        return;
    }


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
            getArtistText(track);

    }


    if (image) {

        image.src =
            track.image || "";

    }

}


// ============================================================
// プレイヤー状態
// ============================================================

function updatePlayerState(
    state
) {

    const button =
        document.getElementById(
            "playPauseButton"
        );


    if (button) {

        button.textContent =
            state.paused
                ? "▶"
                : "⏸";

    }


    const progress =
        document.getElementById(
            "progressBar"
        );


    if (progress) {

        progress.max =
            state.duration || 0;

        progress.value =
            state.position || 0;

    }


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

    if (!currentPlaylist.length) {
        return;
    }


    let index =
        currentTrackIndex + 1;


    if (
        index >=
        currentPlaylist.length
    ) {

        index = 0;

    }


    currentTrackIndex =
        index;


    await playTrack(
        currentPlaylist[index],
        index,
        true
    );

}


// ============================================================
// 前の曲
// ============================================================

async function playPrevious() {

    if (!currentPlaylist.length) {
        return;
    }


    let index =
        currentTrackIndex - 1;


    if (index < 0) {

        index =
            currentPlaylist.length - 1;

    }


    currentTrackIndex =
        index;


    await playTrack(
        currentPlaylist[index],
        index,
        true
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


    if (!bar) {
        return;
    }


    const saved =
        getSavedVolume();


    bar.value =
        Math.round(
            saved * 100
        );


    if (value) {

        value.textContent =
            `${bar.value}%`;

    }


    bar.oninput =
        async () => {

            const volume =
                Number(bar.value) / 100;


            localStorage.setItem(
                "spotify_volume",
                String(volume)
            );


            if (value) {

                value.textContent =
                    `${bar.value}%`;

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

        };

}


function getSavedVolume() {

    const volume =
        Number(
            localStorage.getItem(
                "spotify_volume"
            )
        );


    if (
        !Number.isFinite(volume) ||
        volume < 0 ||
        volume > 1
    ) {

        return 0.5;

    }


    return volume;

}


async function applySavedVolume() {

    if (!spotifyPlayer) {
        return;
    }


    try {

        await spotifyPlayer.setVolume(
            getSavedVolume()
        );

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


    if (!input || !button) {
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
                event.key === "Enter"
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
            `<div class="no-results">
                曲名やアーティスト名を入力してください
            </div>`;

        return;

    }


    results.innerHTML =
        `<div class="loading">
            🔎 曲を検索中...
        </div>`;


    try {

        const response =
            await fetch(
                `/api/search?q=${encodeURIComponent(query)}`
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


        // /api/search は
        // { tracks, artists }

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


        results.innerHTML = "";


        if (!tracks.length) {

            results.innerHTML =
                `<div class="no-results">
                    曲が見つかりませんでした
                </div>`;

            return;

        }


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

        console.error(
            "曲検索エラー:",
            error
        );


        results.innerHTML =
            `<div class="error-message">
                ${escapeHtml(error.message)}
            </div>`;

    }

}


// ============================================================
// お気に入り
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


function toggleFavorite(
    track
) {

    const favorites =
        getFavorites();


    const normalized =
        normalizeTrack(track);


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

    } else {

        favorites.unshift(
            normalized
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


    container.innerHTML = "";


    if (!favorites.length) {

        container.innerHTML =
            `<div class="no-results">
                ❤️ お気に入りはまだありません
            </div>`;

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


function saveToHistory(
    tracks
) {

    let history =
        getHistory();


    tracks.forEach(track => {

        const normalized =
            normalizeTrack(track);


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

    });


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


    container.innerHTML = "";


    if (!history.length) {

        container.innerHTML =
            `<div class="no-results">
                📜 履歴はまだありません
            </div>`;

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
// 設定
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

                }

            }
        );

    }

}


// ============================================================
// テーマ
// ============================================================

function initTheme() {

    const theme =
        localStorage.getItem(
            "music_picker_theme"
        );


    if (theme) {

        document.body.dataset.theme =
            theme;

    }

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
        track.images?.[0]?.url ||
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

        name: title,

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

    if (track.artist) {
        return track.artist;
    }


    if (track.artistName) {
        return track.artistName;
    }


    if (
        Array.isArray(
            track.artists
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
        Array.isArray(tracks)
            ? tracks
            : []
    )
        .map(normalizeTrack)
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

function formatTime(
    milliseconds
) {

    if (
        !Number.isFinite(
            milliseconds
        )
    ) {

        return "0:00";

    }


    const seconds =
        Math.floor(
            milliseconds / 1000
        );


    const minutes =
        Math.floor(
            seconds / 60
        );


    const remaining =
        seconds % 60;


    return (
        `${minutes}:` +
        String(
            remaining
        ).padStart(
            2,
            "0"
        )
    );

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
            JSON.stringify(data)
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
// プレイヤー操作
// ============================================================

document.addEventListener(
    "click",
    event => {

        if (
            event.target.closest(
                "#playPauseButton"
            )
        ) {

            togglePlayback();

        }


        if (
            event.target.closest(
                "#nextButton"
            )
        ) {

            playNext();

        }


        if (
            event.target.closest(
                "#previousButton"
            )
        ) {

            playPrevious();

        }

    }
);


// ============================================================
// プログレスバー
// ============================================================

document.addEventListener(
    "change",
    event => {

        if (
            event.target.id ===
            "progressBar"
        ) {

            seekPlayback(
                event.target.value
            );

        }

    }
);