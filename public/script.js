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


// ============================================================
// 初期化
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("Music Picker 起動");

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
        document.querySelectorAll(
            ".bottom-nav-link"
        );


    links.forEach(link => {

        link.addEventListener(
            "click",
            () => {

                const pageId =
                    link.dataset.page;


                showPage(pageId);


                links.forEach(
                    item =>
                        item.classList.remove(
                            "active"
                        )
                );


                link.classList.add(
                    "active"
                );

            }
        );

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

            const pageId =
                link.dataset.page;

            showPage(pageId);

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


function showPage(pageId) {

    document.querySelectorAll(".page")
        .forEach(page => {

            page.classList.remove(
                "active-page"
            );

        });


    const page =
        document.getElementById(pageId);


    if (page) {

        page.classList.add(
            "active-page"
        );
    }


    document.querySelectorAll(".menu-link")
        .forEach(link => {

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
        document.querySelectorAll(
            ".moods button"
        );


    moodButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                moodButtons.forEach(
                    btn =>
                        btn.classList.remove(
                            "selected"
                        )
                );


                button.classList.add(
                    "selected"
                );


                selectedMood =
                    button.dataset.mood ||
                    button.textContent.trim();


                console.log(
                    "気分:",
                    selectedMood
                );

            }
        );

    });


    const genre =
        document.getElementById("genre");


    if (genre) {

        genre.addEventListener(
            "change",
            () => {

                selectedGenre =
                    genre.value;

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


    if (!input || !results) {
        return;
    }


    input.addEventListener(
        "input",
        async () => {

            const keyword =
                input.value.trim();


            const requestId =
                ++searchRequestId;


            // 新しいアーティストを検索したら
            // 前の選択を解除
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
                `<div class="loading">
                    🔎 検索中...
                 </div>`;


            try {

                const response =
                    await fetch(
                        `/api/artists?q=${encodeURIComponent(keyword)}`
                    );


                if (!response.ok) {

                    throw new Error(
                        `HTTP ${response.status}`
                    );
                }


                const artists =
                    await response.json();


                // 古い検索結果なら無視
                if (
                    requestId !==
                    searchRequestId
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
                            artist.name || "";


                        const name =
                            document.createElement(
                                "span"
                            );


                        name.textContent =
                            artist.name ||
                            "名前なし";


                        item.appendChild(image);

                        item.appendChild(name);


                        item.addEventListener(
                            "click",
                            () => {

                                selectArtist(
                                    artist
                                );


                                results.innerHTML =
                                    "";


                                // inputイベントは発生しない
                                input.value = "";

                            }
                        );


                        results.appendChild(item);

                    }
                );


            } catch (error) {

                console.error(
                    "アーティスト検索エラー:",
                    error
                );


                results.innerHTML =
                    `<div class="error-message">
                        検索に失敗しました
                     </div>`;

            }

        }
    );

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


    selected.style.display =
        "block";


    const image =
        selected.querySelector(
            ".selected-artist-image"
        );


    if (image) {

        image.onerror = () => {

            image.style.display =
                "none";

        };

    }

}


// ============================================================
// プレイリスト作成
// ============================================================

async function makePlaylist() {

    const button =
        document.getElementById(
            "makePlaylist"
        );


    if (!selectedMood) {

        alert(
            "まず気分を選んでください！"
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
            "アーティストかジャンルを選んでください！"
        );

        return;
    }


    if (button) {

        button.disabled = true;

        button.textContent =
            "🎵 曲を探しています...";
    }


    try {

        let tracks = [];


        // ----------------------------------------------------
        // アーティスト
        // ----------------------------------------------------

        if (selectedArtistId) {

            console.log(
                "アーティスト曲取得:",
                selectedArtistName
            );


            const response =
                await fetch(
                    `/api/artist-tracks?id=${encodeURIComponent(selectedArtistId)}`
                );


            if (!response.ok) {

                throw new Error(
                    `HTTP ${response.status}`
                );
            }


            tracks =
                await response.json();


            // 選択したアーティストだけ
            tracks =
                tracks.filter(
                    track => {

                        if (
                            track.artistId
                        ) {

                            return (
                                track.artistId ===
                                selectedArtistId
                            );
                        }


                        if (
                            Array.isArray(
                                track.artists
                            )
                        ) {

                            return track.artists.some(
                                artist =>
                                    artist.id ===
                                    selectedArtistId
                            );

                        }


                        return false;

                    }
                );

        }


        // ----------------------------------------------------
        // ジャンル
        // ----------------------------------------------------

        else {

            const response =
                await fetch(
                    `/api/genre-tracks?genre=${encodeURIComponent(selectedGenre)}`
                );


            if (!response.ok) {

                throw new Error(
                    `HTTP ${response.status}`
                );
            }


            tracks =
                await response.json();

        }


        tracks =
            tracks
                .map(normalizeTrack)
                .filter(
                    track =>
                        track &&
                        track.uri
                );


        // 重複削除

        const seen =
            new Set();


        tracks =
            tracks.filter(track => {

                if (
                    seen.has(track.uri)
                ) {

                    return false;
                }


                seen.add(
                    track.uri
                );


                return true;

            });


        if (tracks.length === 0) {

            alert(
                "曲が見つかりませんでした。"
            );

            return;
        }


        shuffleArray(tracks);


        // 前回と違う曲を優先

        let newTracks =
            tracks.filter(
                track =>
                    !previousSongs.includes(
                        track.uri
                    )
            );


        if (
            newTracks.length < 5
        ) {

            newTracks.push(
                ...tracks.filter(
                    track =>
                        !newTracks.includes(
                            track
                        )
                )
            );

        }


        const playlist =
            newTracks.slice(0, 5);


        currentPlaylist =
            playlist;


        currentTrackIndex = 0;

        isPlaylistMode = false;


        previousSongs =
            playlist.map(
                track => track.uri
            );


        localStorage.setItem(
            "previousSongs",
            JSON.stringify(
                previousSongs
            )
        );


        saveToHistory(
            playlist
        );


        displayPlaylist(
            playlist
        );


    } catch (error) {

        console.error(
            "プレイリスト作成エラー:",
            error
        );


        if (
            error.message.includes(
                "429"
            )
        ) {

            alert(
                "Spotify APIの利用上限に達しています。\n少し時間を置いてください。"
            );

        } else {

            alert(
                "曲を取得できませんでした。\n" +
                error.message
            );

        }

    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                "🎵 5曲選ぶ";
        }

    }

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


    container.innerHTML = "";


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
        "🎵 おすすめ5曲";


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
        document.createElement(
            "div"
        );


    card.className =
        "track-card";


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
        getArtistText(track);


    info.appendChild(title);

    info.appendChild(artist);


    const actions =
        document.createElement(
            "div"
        );


    actions.className =
        "track-actions";


    // 再生
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


    // お気に入り
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


    // Spotify
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
        `https://open.spotify.com/track/${track.id}`;


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


    track =
        normalizeTrack(track);


    if (!track || !track.uri) {

        alert(
            "この曲は再生できません。"
        );

        return;
    }


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
            "Spotifyプレイヤーが準備できませんでした。\nSpotifyにログインしてから再生してください。"
        );

        return;
    }


    try {

        // ----------------------------------------------------
        // 再生する曲
        // ----------------------------------------------------

let uris = [track.uri];

if (playlistMode && currentPlaylist.length > 0) {

    const playlistTracks =
        currentPlaylist
            .map(normalizeTrack)
            .filter(track => track && track.uri);

    uris = playlistTracks.map(
        track => track.uri
    );
}

// 曲が1曲も取れなかった場合
if (!uris.length && track.uri) {
    uris = [track.uri];
}

console.log(
    "再生:",
    uris
);
        // ブラウザ再生許可
        if (
            spotifyPlayer.activateElement
        ) {

            try {

                await spotifyPlayer
                    .activateElement();

            } catch (_) {}

        }


        // ----------------------------------------------------
        // 再生先をWeb Playerへ移動
        // ----------------------------------------------------

 const response =
    await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(spotifyDeviceId)}`,
        {
            method: "PUT",

            headers: {
                Authorization:
                    `Bearer ${spotifyToken}`,

                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({
                uris: uris,
                position_ms: 0
            })
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

        throw new Error(
            "Spotifyのログイン期限が切れています。もう一度ログインしてください。"
        );
    }


    if (
        response.status === 403
    ) {

        throw new Error(
            "Spotifyの再生権限がありません。Premiumアカウントと権限を確認してください。"
        );
    }


    throw new Error(
        `Spotify再生エラー: ${error}`
    );
}


// ----------------------------------------------------
// 現在のプレイリストを保存
// ----------------------------------------------------

if (playlistMode) {

    currentPlaylist =
        normalizeTracks(
            currentPlaylist
        );

    currentTrackIndex =
        index;

} else {

    currentPlaylist =
        [track];

    currentTrackIndex =
        0;
}


isPlaylistMode =
    playlistMode;


// ----------------------------------------------------
// プレイヤー画面を表示
// ----------------------------------------------------

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

    return;

}

}


// ============================================================
// Spotify初期化
// ============================================================

function initSpotify() {

    if (
        window.Spotify
    ) {

        setupSpotifyPlayer();

    }

}


// SDKが後から読み込まれた場合
window.onSpotifyWebPlaybackSDKReady =
    function () {

        console.log(
            "Spotify SDK Ready"
        );


        setupSpotifyPlayer();

    };


// ============================================================
// Player作成
// ============================================================


// SDKが後から読み込まれた場合
window.onSpotifyWebPlaybackSDKReady =
    function () {

        console.log(
            "Spotify SDK Ready"
        );


        setupSpotifyPlayer();

    };


// ============================================================
// Player作成
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


            const uri =
                current.uri;


            const index =
                currentPlaylist.findIndex(
                    track =>
                        track.uri === uri
                );


            if (index >= 0) {

                currentTrackIndex =
                    index;
            }


            updatePlayerInfo(
                normalizeTrack(
                    current
                )
            );

        }
    );


    spotifyPlayer.addListener(
        "autoplay_failed",
        () => {

            console.log(
                "Autoplay failed"
            );

        }
    );


    spotifyPlayer.addListener(
        "initialization_error",
        ({ message }) => {

            console.error(
                "Initialization error:",
                message
            );

        }
    );


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


    spotifyPlayer.addListener(
        "playback_error",
        ({ message }) => {

            console.error(
                "Playback error:",
                message
            );

        }
    );


    spotifyPlayer.connect()
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
// デバイス待機
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
        Date.now() - start <
            timeout
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
// 再生/停止
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


    if (
        index >=
        currentPlaylist.length
    ) {

        index = 0;
    }


    currentTrackIndex =
        index;


    isPlaylistMode =
        true;


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

    if (
        !currentPlaylist.length
    ) {

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


    isPlaylistMode =
        true;


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
                Number(
                    bar.value
                ) / 100;


            localStorage.setItem(
                "spotify_volume",
                String(volume)
            );


            if (value) {

                value.textContent =
                    `${bar.value}%`;

            }


            if (spotifyPlayer) {

                await spotifyPlayer
                    .setVolume(
                        volume
                    );

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

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        let tracks =
            await response.json();


        tracks =
            tracks
                .map(normalizeTrack)
                .filter(
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
            track => {

                results.appendChild(
                    createTrackCard(
                        track,
                        0
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
                検索できませんでした。
             </div>`;

    }

}


// ============================================================
// お気に入り
// ============================================================

function getFavorites() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "music_picker_favorites"
            ) || "[]"
        );

    } catch (_) {

        return [];

    }

}


function toggleFavorite(
    track
) {

    const favorites =
        getFavorites();


    const index =
        favorites.findIndex(
            item =>
                item.uri ===
                track.uri
        );


    if (index >= 0) {

        favorites.splice(
            index,
            1
        );

    } else {

        favorites.unshift(
            normalizeTrack(
                track
            )
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

        return JSON.parse(
            localStorage.getItem(
                "music_picker_history"
            ) || "[]"
        );

    } catch (_) {

        return [];

    }

}


function saveToHistory(
    tracks
) {

    let history =
        getHistory();


    tracks.forEach(
        track => {

            track =
                normalizeTrack(
                    track
                );


            history =
                history.filter(
                    item =>
                        item.uri !==
                        track.uri
                );


            history.unshift(
                track
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

    if (
        track.artist
    ) {

        return track.artist;
    }


    if (
        track.artistName
    ) {

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
// シャッフル
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
// エスケープ
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

        return (
            `HTTP ${response.status}`
        );

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