// ==========================================
// Music Picker - script.js
// ==========================================


// ==========================================
// グローバル変数
// ==========================================

let spotifyPlayer = null;
let spotifyDeviceId = null;

let currentPlaylist = [];
let currentTrackIndex = 0;

let isPlaylistMode = false;
let isChangingTrack = false;
let lastPlaybackPosition = 0;


// ==========================================
// DOM読み込み
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    initMenu();

    initHomePage();
    initSearchPage();
    initFavoritesPage();
    initTopTracksPage();
    initHistoryPage();
    initSettingsPage();
    initAccountPage();

});


// ==========================================
// ハンバーガーメニュー
// ==========================================

function initMenu() {

    const menuButton =
        document.getElementById("menuButton");

    const closeMenu =
        document.getElementById("closeMenu");

    const sideMenu =
        document.getElementById("sideMenu");

    const menuOverlay =
        document.getElementById("menuOverlay");


    if (menuButton && sideMenu) {

        menuButton.addEventListener(
            "click",
            () => {

                sideMenu.classList.add("active");

                if (menuOverlay) {
                    menuOverlay.classList.add("active");
                }

            }
        );

    }


    if (closeMenu && sideMenu) {

        closeMenu.addEventListener(
            "click",
            closeMenuFunction
        );

    }


    if (menuOverlay && sideMenu) {

        menuOverlay.addEventListener(
            "click",
            closeMenuFunction
        );

    }


    function closeMenuFunction() {

        sideMenu.classList.remove("active");

        if (menuOverlay) {
            menuOverlay.classList.remove("active");
        }

    }

}


// ==========================================
// Spotifyアクセストークン
// ==========================================

function getSpotifyAccessToken() {

    return localStorage.getItem(
        "spotify_access_token"
    );

}


// ==========================================
// Spotifyデータを統一
// ==========================================

function normalizeTrack(track) {

    if (!track) {
        return null;
    }


    // ==========================================
    // server.jsから返ってくる形式
    // ==========================================

    if (
        track.title ||
        track.artist ||
        track.image ||
        track.spotifyUrl
    ) {

        return {

            id:
                track.id ||
                track.uri ||
                `${track.title}_${track.artist}`,

            uri:
                track.uri || "",

            name:
                track.title ||
                track.name ||
                "Unknown",

            artists:
                track.artist
                    ? track.artist
                        .split(",")
                        .map(name => ({
                            name: name.trim(),
                            id: ""
                        }))
                    : (
                        track.artists || []
                    ),

            // ★ アーティストIDを保持
            artistId:
                track.artistId || "",

            album: {

                images:
                    track.image
                        ? [
                            {
                                url: track.image
                            }
                        ]
                        : []

            },

            external_urls: {

                spotify:
                    track.spotifyUrl ||
                    ""

            }

        };

    }


    // ==========================================
    // Spotify APIそのものの形式
    // ==========================================

    return {

        ...track,

        id:
            track.id ||
            track.uri,

        name:
            track.name ||
            "Unknown",

        artists:
            track.artists || [],

        album:
            track.album || {
                images: []
            },

        external_urls:
            track.external_urls || {}

    };

}


// ==========================================
// アーティスト検索・ホーム
// ==========================================

function initHomePage() {

    const artistSearch =
        document.getElementById(
            "artistSearch"
        );


    if (!artistSearch) {
        return;
    }


    const artistResults =
        document.getElementById(
            "artistResults"
        );

    const selectedArtist =
        document.getElementById(
            "selectedArtist"
        );

    const genre =
        document.getElementById(
            "genre"
        );

    const makePlaylist =
        document.getElementById(
            "makePlaylist"
        );

    const playlist =
        document.getElementById(
            "playlist"
        );


    let selectedMood = "";
    let selectedGenre = "all";
    let selectedArtistId = "";
    let selectedArtistName = "";

    let searchTimer;


    // ==========================================
    // アーティスト入力
    // ==========================================

    artistSearch.addEventListener(
        "input",
        () => {

            clearTimeout(searchTimer);


            const keyword =
                artistSearch.value.trim();


            // 入力を消した
            if (!keyword) {

                if (artistResults) {
                    artistResults.innerHTML = "";
                }

                selectedArtistId = "";
                selectedArtistName = "";

                if (selectedArtist) {

                    selectedArtist.innerHTML = "";

                    selectedArtist.style.display =
                        "none";

                }

                return;

            }


            // アーティストを変更した
            selectedArtistId = "";
            selectedArtistName = "";


            if (selectedArtist) {

                selectedArtist.innerHTML = "";

                selectedArtist.style.display =
                    "none";

            }


            searchTimer =
                setTimeout(
                    () => {
                        searchArtists(keyword);
                    },
                    300
                );

        }
    );


    // ==========================================
    // アーティスト検索
    // ==========================================

    async function searchArtists(keyword) {

        if (!artistResults) {
            return;
        }


        artistResults.innerHTML = `
            <div class="search-loading">
                🔍 アーティストを検索中...
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

                const errorText =
                    await response.text();

                console.error(
                    "Artist Search HTTP Error:",
                    response.status,
                    errorText
                );

                throw new Error(
                    `HTTP ${response.status}`
                );

            }


            const data =
                await response.json();


            // ======================================
            // server.jsは配列を返す
            // ======================================

            const artists =
                Array.isArray(data)
                    ? data
                    : (
                        Array.isArray(data.artists)
                            ? data.artists
                            : []
                    );


            artistResults.innerHTML = "";


            if (artists.length === 0) {

                artistResults.innerHTML = `
                    <div class="no-results">
                        アーティストが見つかりませんでした。
                    </div>
                `;

                return;

            }


            // ======================================
            // アーティスト表示
            // ======================================

            artists.forEach(
                artist => {

                    const item =
                        document.createElement(
                            "div"
                        );


                    item.className =
                        "artist-result";


                    const image =
                        artist.image ||
                        artist.images?.[0]?.url ||
                        "";


                    item.innerHTML = `

                        ${
                            image
                            ? `
                                <img
                                    src="${escapeHTML(image)}"
                                    alt=""
                                >
                              `
                            : `
                                <div class="artist-no-image">
                                    🎵
                                </div>
                              `
                        }

                        <div class="artist-result-info">

                            <div class="artist-result-name">
                                ${escapeHTML(
                                    artist.name
                                )}
                            </div>

                            <div class="artist-followers">
                                アーティスト
                            </div>

                        </div>

                    `;


                    // ==================================
                    // アーティスト選択
                    // ==================================

                    item.addEventListener(
                        "click",
                        () => {

                            selectedArtistId =
                                artist.id;

                            selectedArtistName =
                                artist.name;


                            if (selectedArtist) {

                                selectedArtist.innerHTML = `

                                    ${
                                        image
                                        ? `
                                            <img
                                                src="${escapeHTML(image)}"
                                                alt=""
                                            >
                                          `
                                        : `
                                            <div class="artist-no-image">
                                                🎵
                                            </div>
                                          `
                                    }

                                    <div>

                                        <strong>
                                            ${escapeHTML(
                                                artist.name
                                            )}
                                        </strong>

                                        <span>
                                            選択中のアーティスト
                                        </span>

                                    </div>

                                `;

                                selectedArtist.style.display =
                                    "flex";

                            }


                            artistSearch.value =
                                artist.name;


                            artistResults.innerHTML =
                                "";

                        }
                    );


                    artistResults.appendChild(
                        item
                    );

                }
            );


        } catch (error) {

            console.error(
                "Artist Search Error:",
                error
            );


            artistResults.innerHTML = `
                <div class="no-results">
                    アーティスト検索に失敗しました。
                </div>
            `;

        }

    }


    // ==========================================
    // ジャンル
    // ==========================================

    if (genre) {

        genre.addEventListener(
            "change",
            () => {

                selectedGenre =
                    genre.value;

            }
        );

    }


    // ==========================================
    // 気分
    // ==========================================

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

                }
            );

        }
    );


    // ==========================================
    // プレイリスト作成
    // ==========================================

    if (makePlaylist) {

        makePlaylist.addEventListener(
            "click",
            async () => {

                // 気分チェック
                if (!selectedMood) {

                    alert(
                        "気分を選択してください。"
                    );

                    return;

                }


                // アーティスト・ジャンルチェック
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


                makePlaylist.disabled =
                    true;

                makePlaylist.textContent =
                    "曲を探しています...";


                try {

                    let tracks = [];


                    // ==================================
                    // アーティスト
                    // ==================================

                    if (selectedArtistId) {

                        console.log(
                            "選択アーティスト:",
                            selectedArtistName,
                            selectedArtistId
                        );


                        const response =
                            await fetch(
                                `/api/artist-tracks?id=${encodeURIComponent(
                                    selectedArtistId
                                )}`
                            );


                        if (!response.ok) {

                            throw new Error(
                                `HTTP ${response.status}`
                            );

                        }


                        const data =
                            await response.json();


                        tracks =
                            Array.isArray(data)
                                ? data
                                : (
                                    Array.isArray(data.tracks)
                                        ? data.tracks
                                        : []
                                );

                    }


                    // ==================================
                    // ジャンル
                    // ==================================

                    else {

                        const response =
                            await fetch(
                                `/api/genre-tracks?genre=${encodeURIComponent(
                                    selectedGenre
                                )}`
                            );


                        if (!response.ok) {

                            throw new Error(
                                `HTTP ${response.status}`
                            );

                        }


                        const data =
                            await response.json();


                        tracks =
                            Array.isArray(data)
                                ? data
                                : (
                                    Array.isArray(data.tracks)
                                        ? data.tracks
                                        : []
                                );

                    }


                    console.log(
                        "取得した曲:",
                        tracks
                    );


                    // ==================================
                    // Spotify形式に統一
                    // ==================================

                    tracks =
                        tracks
                            .map(
                                normalizeTrack
                            )
                            .filter(Boolean);


                    // ==================================
                    // アーティストの場合
                    // ==================================

                    if (selectedArtistId) {

                        tracks =
                            tracks.filter(
                                track => {

                                    // server.jsからartistIdが来る場合
                                    if (
                                        track.artistId ===
                                        selectedArtistId
                                    ) {

                                        return true;

                                    }


                                    // Spotify形式の場合
                                    if (
                                        track.artists?.some(
                                            artist =>
                                                artist.id ===
                                                selectedArtistId
                                        )
                                    ) {

                                        return true;

                                    }


                                    return false;

                                }
                            );

                    }


                    // ==================================
                    // 重複削除
                    // ==================================

                    const unique =
                        [];

                    const used =
                        new Set();


                    tracks.forEach(
                        track => {

                            const key =
                                getTrackId(
                                    track
                                );


                            if (
                                key &&
                                !used.has(key)
                            ) {

                                used.add(key);

                                unique.push(
                                    track
                                );

                            }

                        }
                    );


                    // ==================================
                    // シャッフル
                    // ==================================

                    tracks =
                        shuffleArray(
                            unique
                        );


                    // ==================================
                    // 曲数
                    // ==================================

                    const savedCount =
                        parseInt(
                            localStorage.getItem(
                                "musicPickerSongCount"
                            ),
                            10
                        );


                    const songCount =
                        Number.isFinite(savedCount) &&
                        savedCount > 0
                            ? savedCount
                            : 5;


                    const selectedTracks =
                        tracks.slice(
                            0,
                            songCount
                        );


                    // ==================================
                    // 曲がない
                    // ==================================

                    if (
                        selectedTracks.length === 0
                    ) {

                        alert(
                            "曲が見つかりませんでした。"
                        );

                        return;

                    }


                    // ==================================
                    // 履歴保存
                    // ==================================

                    saveToHistory(
                        selectedTracks
                    );


                    // ==================================
                    // プレイリスト表示
                    // ==================================

                    displayPlaylist(
                        selectedTracks,
                        playlist,
                        selectedMood
                    );


                } catch (error) {

                    console.error(
                        "Playlist Error:",
                        error
                    );


                    alert(
                        "プレイリストの作成に失敗しました。"
                    );

                } finally {

                    makePlaylist.disabled =
                        false;

                    makePlaylist.textContent =
                        "🎵 5曲選ぶ";

                }

            }
        );

    }


    // ==========================================
    // Spotify Player
    // ==========================================

    setupSpotifyPlayer();

}


// ==========================================
// プレイリスト表示
// ==========================================

function displayPlaylist(
    tracks,
    container,
    mood = ""
) {

    if (!container) {
        return;
    }


    const normalizedTracks =
        tracks
            .map(normalizeTrack)
            .filter(Boolean);


    container.innerHTML = `

        <div class="playlist-title">

            <h2>
                🎵 あなたのプレイリスト
            </h2>

            <p>
                ${
                    mood
                    ? `${escapeHTML(mood)}におすすめ・`
                    : ""
                }

                ${normalizedTracks.length}曲
            </p>

            <button
                id="playAllButton"
                class="play-all-button"
                type="button">

                ▶ まとめて再生

            </button>

            <a
                id="playSpotifyButton"
                class="play-all-button"
                href="https://open.spotify.com/"
                target="_blank"
                rel="noopener noreferrer">

                🎵 Spotifyで開く

            </a>

        </div>


        <div class="song-list">

            ${
                normalizedTracks
                    .map(
                        (track, index) => {

                            const image =
                                track.album
                                    ?.images?.[0]?.url ||
                                "";


                            const artists =
                                track.artists
                                    ?.map(
                                        artist =>
                                            artist.name
                                    )
                                    .join(", ") ||
                                "Unknown";


                            return `

                                <div
                                    class="song-card"
                                    data-index="${index}"
                                >

                                    <div class="song-number">
                                        ${index + 1}
                                    </div>


                                    ${
                                        image
                                        ? `
                                            <img
                                                class="song-cover"
                                                src="${escapeHTML(image)}"
                                                alt=""
                                            >
                                          `
                                        : `
                                            <div class="song-cover song-no-image">
                                                🎵
                                            </div>
                                          `
                                    }


                                    <div class="song-info">

                                        <div class="song-name">
                                            ${escapeHTML(
                                                track.name
                                            )}
                                        </div>

                                        <div class="artist-name">
                                            ${escapeHTML(
                                                artists
                                            )}
                                        </div>

                                    </div>


                                    <div class="song-actions">

                                        <button
                                            class="favorite-button"
                                            title="お気に入りに追加"
                                            type="button">

                                            ♡ お気に入り

                                        </button>


                                        ${
                                            track.external_urls
                                                ?.spotify
                                            ? `
                                                <a
                                                    class="spotify-button"
                                                    href="${escapeHTML(
                                                        track
                                                            .external_urls
                                                            .spotify
                                                    )}"
                                                    target="_blank"
                                                    rel="noopener noreferrer">

                                                    Spotify

                                                </a>
                                              `
                                            : ""
                                        }

                                    </div>

                                </div>

                            `;

                        }
                    )
                    .join("")
            }

        </div>

    `;


    // ==========================================
    // 曲カード
    // ==========================================

    const cards =
        container.querySelectorAll(
            ".song-card"
        );


    cards.forEach(
        (card, index) => {

            const track =
                normalizedTracks[index];


            // ======================================
            // お気に入り
            // ======================================

            const favoriteButton =
                card.querySelector(
                    ".favorite-button"
                );


            if (favoriteButton) {

                updateFavoriteButton(
                    favoriteButton,
                    track
                );


                favoriteButton.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();


                        toggleFavorite(
                            track,
                            favoriteButton
                        );

                    }
                );

            }


            // ======================================
            // 曲クリック
            // ======================================

            card.addEventListener(
                "click",
                event => {

                    if (
                        event.target.closest(
                            "a, button"
                        )
                    ) {
                        return;
                    }


                    playTrack(
                        normalizedTracks,
                        index,
                        false
                    );

                }
            );

        }
    );


    // ==========================================
    // まとめて再生
    // ==========================================

    const playAllButton =
        document.getElementById(
            "playAllButton"
        );


    if (playAllButton) {

        playAllButton.addEventListener(
            "click",
            async () => {

                if (
                    normalizedTracks.length === 0
                ) {
                    return;
                }


                currentPlaylist =
                    normalizedTracks;


                currentTrackIndex =
                    0;


                isPlaylistMode =
                    true;


                isChangingTrack =
                    false;


                await playTrack(
                    currentPlaylist,
                    0,
                    true
                );

            }
        );

    }

}


// ==========================================
// お気に入りボタン
// ==========================================

function updateFavoriteButton(
    button,
    track
) {

    const favorites =
        getStoredTracks(
            "favorites"
        );


    const id =
        getTrackId(
            track
        );


    const isFavorite =
        favorites.some(
            saved =>
                getTrackId(
                    normalizeTrack(saved)
                ) === id
        );


    if (isFavorite) {

        button.classList.add(
            "active"
        );

        button.textContent =
            "♥ お気に入り済み";

        button.title =
            "お気に入りから削除";

    } else {

        button.classList.remove(
            "active"
        );

        button.textContent =
            "♡ お気に入り";

        button.title =
            "お気に入りに追加";

    }

}


// ==========================================
// 曲ID
// ==========================================

function getTrackId(
    track
) {

    if (!track) {
        return "";
    }


    return (
        track.id ||
        track.uri ||
        `${track.name || track.title}_${getArtistText(track)}`
    );

}


// ==========================================
// アーティスト名取得
// ==========================================

function getArtistText(
    track
) {

    if (!track) {
        return "";
    }


    if (track.artist) {
        return track.artist;
    }


    if (
        Array.isArray(
            track.artists
        )
    ) {

        return track.artists
            .map(
                artist =>
                    artist.name
            )
            .join(",");

    }


    return "";

}


// ==========================================
// 検索ページ
// ==========================================

function initSearchPage() {

    const input =
        document.getElementById(
            "musicSearchInput"
        );

    const button =
        document.getElementById(
            "musicSearchButton"
        );

    const results =
        document.getElementById(
            "searchResults"
        );


    if (
        !input ||
        !button ||
        !results
    ) {
        return;
    }


    async function searchMusic() {

        const keyword =
            input.value.trim();


        if (!keyword) {

            results.innerHTML = `
                <div class="empty-message">
                    曲名やアーティスト名を入力してください。
                </div>
            `;

            return;

        }


        results.innerHTML = `
            <div class="search-loading">
                🔍 検索中...
            </div>
        `;


        try {

            const response =
                await fetch(
                    `/api/search?q=${encodeURIComponent(
                        keyword
                    )}`
                );


            if (!response.ok) {

                throw new Error(
                    `HTTP ${response.status}`
                );

            }


            const data =
                await response.json();


            const tracks =
                Array.isArray(data)
                    ? data
                    : (
                        Array.isArray(data.tracks)
                            ? data.tracks
                            : []
                    );


            if (tracks.length === 0) {

                results.innerHTML = `
                    <div class="empty-message">
                        曲が見つかりませんでした。
                    </div>
                `;

                return;

            }


            results.innerHTML = "";


            tracks.forEach(
                track => {

                    const normalized =
                        normalizeTrack(
                            track
                        );


                    if (normalized) {

                        results.appendChild(
                            createTrackElement(
                                normalized,
                                true
                            )
                        );

                    }

                }
            );


        } catch (error) {

            console.error(
                "Search Error:",
                error
            );


            results.innerHTML = `
                <div class="empty-message">
                    検索に失敗しました。
                </div>
            `;

        }

    }


    button.addEventListener(
        "click",
        searchMusic
    );


    input.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                searchMusic();

            }

        }
    );

}


// ==========================================
// お気に入りページ
// ==========================================

function initFavoritesPage() {

    const container =
        document.getElementById(
            "favoritesList"
        );


    if (!container) {
        return;
    }


    const favorites =
        getStoredTracks(
            "favorites"
        );


    if (favorites.length === 0) {

        container.innerHTML = `

            <div class="empty-message">

                <div>❤️</div>

                <p>
                    お気に入りの曲はまだありません。
                </p>

                <button
                    onclick="location.href='search.html'">

                    🔍 曲を探す

                </button>

            </div>

        `;

        return;

    }


    container.innerHTML = "";


    favorites.forEach(
        track => {

            const normalized =
                normalizeTrack(
                    track
                );


            if (normalized) {

                container.appendChild(
                    createTrackElement(
                        normalized,
                        true
                    )
                );

            }

        }
    );

}


// ==========================================
// TOP TRACKS
// ==========================================

async function initTopTracksPage() {

    const container =
        document.getElementById(
            "topTracksList"
        );


    if (!container) {
        return;
    }


    const token =
        getSpotifyAccessToken();


    if (!token) {

        container.innerHTML = `

            <div class="empty-message">

                <div>🎵</div>

                <p>
                    Spotifyにログインすると<br>
                    あなたのTOP曲を表示できます。
                </p>

                <button
                    onclick="location.href='/auth/login'">

                    🎵 Spotifyにログイン

                </button>

            </div>

        `;

        return;

    }


    container.innerHTML = `
        <div class="search-loading">
            🔥 TOP曲を読み込んでいます...
        </div>
    `;


    try {

        const response =
            await fetch(
                "/api/top-tracks",
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        const tracks =
            Array.isArray(data)
                ? data
                : (
                    Array.isArray(data.tracks)
                        ? data.tracks
                        : []
                );


        if (tracks.length === 0) {

            container.innerHTML = `
                <div class="empty-message">
                    TOP曲が見つかりませんでした。
                </div>
            `;

            return;

        }


        container.innerHTML = "";


        tracks.forEach(
            track => {

                const normalized =
                    normalizeTrack(
                        track
                    );


                if (normalized) {

                    container.appendChild(
                        createTrackElement(
                            normalized,
                            true
                        )
                    );

                }

            }
        );


    } catch (error) {

        console.error(
            "TOP Tracks Error:",
            error
        );


        container.innerHTML = `

            <div class="empty-message">

                <p>
                    TOP曲を取得できませんでした。
                </p>

                <button
                    onclick="location.href='/auth/login'">

                    Spotifyに再ログイン

                </button>

            </div>

        `;

    }

}


// ==========================================
// 履歴
// ==========================================

function initHistoryPage() {

    const container =
        document.getElementById(
            "historyList"
        );


    if (!container) {
        return;
    }


    const history =
        getStoredTracks(
            "playHistory"
        );


    if (history.length === 0) {

        container.innerHTML = `

            <div class="empty-message">

                <div>🕘</div>

                <p>
                    まだ再生履歴がありません。
                </p>

            </div>

        `;

        return;

    }


    container.innerHTML = "";


    history.forEach(
        track => {

            const normalized =
                normalizeTrack(
                    track
                );


            if (normalized) {

                container.appendChild(
                    createTrackElement(
                        normalized,
                        true
                    )
                );

            }

        }
    );

}


// ==========================================
// アカウント
// ==========================================

function initAccountPage() {

    const status =
        document.getElementById(
            "spotifyStatus"
        );

    const statusText =
        document.getElementById(
            "spotifyStatusText"
        );


    if (
        !status &&
        !statusText
    ) {
        return;
    }


    const token =
        getSpotifyAccessToken();


    if (token) {

        if (status) {

            status.textContent =
                "Spotify接続済み 🎵";

        }


        if (statusText) {

            statusText.textContent =
                "Spotifyアカウントが接続されています。";

        }

    } else {

        if (status) {

            status.textContent =
                "Spotify未接続";

        }


        if (statusText) {

            statusText.textContent =
                "Spotifyにログインすると、TOP曲などの機能が使えます。";

        }

    }

}


// ==========================================
// 設定
// ==========================================

function initSettingsPage() {

    const themeButtons =
        document.querySelectorAll(
            ".theme-option"
        );

    const songCount =
        document.getElementById(
            "songCount"
        );

    const clearHistoryButton =
        document.getElementById(
            "clearHistoryButton"
        );

    const message =
        document.getElementById(
            "settingsMessage"
        );


    const savedTheme =
        localStorage.getItem(
            "musicPickerTheme"
        ) ||
        "light";


    applyTheme(
        savedTheme
    );


    themeButtons.forEach(
        button => {

            const theme =
                button.dataset.theme;


            if (theme === savedTheme) {

                button.classList.add(
                    "active"
                );

            }


            button.addEventListener(
                "click",
                () => {

                    const selectedTheme =
                        button.dataset.theme;


                    localStorage.setItem(
                        "musicPickerTheme",
                        selectedTheme
                    );


                    applyTheme(
                        selectedTheme
                    );


                    themeButtons.forEach(
                        btn => {

                            btn.classList.remove(
                                "active"
                            );

                        }
                    );


                    button.classList.add(
                        "active"
                    );


                    if (message) {

                        message.textContent =
                            "テーマを変更しました。";

                    }

                }
            );

        }
    );


    // ==========================================
    // 曲数
    // ==========================================

    if (songCount) {

        const savedCount =
            localStorage.getItem(
                "musicPickerSongCount"
            );


        if (savedCount) {

            songCount.value =
                savedCount;

        }


        songCount.addEventListener(
            "change",
            () => {

                localStorage.setItem(
                    "musicPickerSongCount",
                    songCount.value
                );


                if (message) {

                    message.textContent =
                        "曲数を保存しました。";

                }

            }
        );

    }


    // ==========================================
    // 履歴削除
    // ==========================================

    if (clearHistoryButton) {

        clearHistoryButton.addEventListener(
            "click",
            () => {

                localStorage.removeItem(
                    "playHistory"
                );


                if (message) {

                    message.textContent =
                        "履歴を削除しました。";

                }

            }
        );

    }

}


// ==========================================
// テーマ
// ==========================================

function applyTheme(
    theme
) {

    document.body.classList.remove(
        "theme-dark",
        "theme-pink",
        "theme-blue"
    );


    if (theme === "dark") {

        document.body.classList.add(
            "theme-dark"
        );

    }


    if (theme === "pink") {

        document.body.classList.add(
            "theme-pink"
        );

    }


    if (theme === "blue") {

        document.body.classList.add(
            "theme-blue"
        );

    }

}


// ==========================================
// 曲カード
// ==========================================

function createTrackElement(
    track,
    showFavoriteButton = true
) {

    track =
        normalizeTrack(
            track
        );


    if (!track) {
        return document.createElement("div");
    }


    const item =
        document.createElement(
            "div"
        );


    item.className =
        "song-card";


    const image =
        track.album
            ?.images?.[0]?.url ||
        "";


    const artists =
        track.artists
            ?.map(
                artist =>
                    artist.name
            )
            .join(", ") ||
        "Unknown";


    item.innerHTML = `

        ${
            image
            ? `
                <img
                    class="song-cover"
                    src="${escapeHTML(image)}"
                    alt=""
                >
              `
            : `
                <div class="song-cover song-no-image">
                    🎵
                </div>
              `
        }


        <div class="song-info">

            <div class="song-name">
                ${escapeHTML(
                    track.name
                )}
            </div>

            <div class="artist-name">
                ${escapeHTML(
                    artists
                )}
            </div>

        </div>


        <div class="song-actions">

            ${
                showFavoriteButton
                ? `
                    <button
                        class="favorite-button"
                        title="お気に入りに追加"
                        type="button">

                        ♡ お気に入り

                    </button>
                  `
                : ""
            }


            ${
                track.external_urls
                    ?.spotify
                ? `
                    <a
                        class="spotify-button"
                        href="${escapeHTML(
                            track.external_urls.spotify
                        )}"
                        target="_blank"
                        rel="noopener noreferrer">

                        Spotify

                    </a>
                  `
                : ""
            }

        </div>

    `;


    // ==========================================
    // お気に入り
    // ==========================================

    const favoriteButton =
        item.querySelector(
            ".favorite-button"
        );


    if (favoriteButton) {

        updateFavoriteButton(
            favoriteButton,
            track
        );


        favoriteButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                toggleFavorite(
                    track,
                    favoriteButton
                );

            }
        );

    }


    // ==========================================
    // 曲クリック
    // ==========================================

    item.addEventListener(
        "click",
        event => {

            if (
                event.target.closest(
                    "a, button"
                )
            ) {
                return;
            }


            playTrack(
                [track],
                0,
                false
            );

        }
    );


    return item;

}


// ==========================================
// お気に入り切り替え
// ==========================================

function toggleFavorite(
    track,
    button
) {

    track =
        normalizeTrack(
            track
        );


    if (!track) {
        return;
    }


    let favorites =
        getStoredTracks(
            "favorites"
        );


    const id =
        getTrackId(
            track
        );


    const index =
        favorites.findIndex(
            item =>
                getTrackId(
                    normalizeTrack(item)
                ) === id
        );


    if (index >= 0) {

        favorites.splice(
            index,
            1
        );

    } else {

        favorites.unshift(
            track
        );

    }


    localStorage.setItem(
        "favorites",
        JSON.stringify(
            favorites
        )
    );


    updateFavoriteButton(
        button,
        track
    );

}


// ==========================================
// 履歴保存
// ==========================================

function saveToHistory(
    tracks
) {

    let history =
        getStoredTracks(
            "playHistory"
        );


    tracks.forEach(
        track => {

            track =
                normalizeTrack(
                    track
                );


            if (!track) {
                return;
            }


            const id =
                getTrackId(
                    track
                );


            history =
                history.filter(
                    item =>
                        getTrackId(
                            normalizeTrack(item)
                        ) !== id
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
        "playHistory",
        JSON.stringify(
            history
        )
    );

}


// ==========================================
// LocalStorage
// ==========================================

function getStoredTracks(
    key
) {

    try {

        const data =
            localStorage.getItem(
                key
            );


        if (!data) {
            return [];
        }


        const parsed =
            JSON.parse(
                data
            );


        return Array.isArray(parsed)
            ? parsed
            : [];


    } catch (error) {

        console.error(
            "LocalStorage Error:",
            error
        );


        return [];

    }

}


// ==========================================
// シャッフル
// ==========================================

function shuffleArray(
    array
) {

    const result =
        [...array];


    for (
        let i = result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );


        [
            result[i],
            result[j]
        ] = [
            result[j],
            result[i]
        ];

    }


    return result;

}


// ==========================================
// HTMLエスケープ
// ==========================================

function escapeHTML(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        value ?? "";


    return div.innerHTML;

}


// ==========================================
// Spotify Web Playback SDK
// ==========================================

function setupSpotifyPlayer() {

    const token =
        getSpotifyAccessToken();


    if (!token) {

        updateSpotifyStatus(
            "Spotify未接続"
        );

        return;

    }


    if (!window.Spotify) {

        console.log(
            "Spotify SDKを待機中..."
        );

        return;

    }


    if (spotifyPlayer) {
        return;
    }


    createSpotifyPlayer(
        token
    );

}


// ==========================================
// 以前の名前にも対応
// ==========================================

function initSpotifyPlayer() {

    setupSpotifyPlayer();

}


// ==========================================
// Spotify Player作成
// ==========================================

function createSpotifyPlayer(
    token
) {

    spotifyPlayer =
        new Spotify.Player({

            name:
                "Music Picker",

            getOAuthToken:
                callback => {

                    callback(
                        getSpotifyAccessToken()
                    );

                },

            volume:
                getSavedVolume(),

            enableMediaSession:
                true

        });


    // ==========================================
    // Ready
    // ==========================================

    spotifyPlayer.addListener(
        "ready",
        ({ device_id }) => {

            console.log(
                "Spotify Player Ready:",
                device_id
            );


            spotifyDeviceId =
                device_id;


            localStorage.setItem(
                "spotify_device_id",
                device_id
            );


            updateSpotifyStatus(
                "Spotify接続済み 🎵"
            );


            setupVolumeControl();

        }
    );


    // ==========================================
    // Not Ready
    // ==========================================

    spotifyPlayer.addListener(
        "not_ready",
        ({ device_id }) => {

            console.log(
                "Spotify Player Not Ready:",
                device_id
            );

        }
    );


    // ==========================================
    // 再生状態
    // ==========================================

    spotifyPlayer.addListener(
        "player_state_changed",
        state => {

            if (!state) {
                return;
            }


            updatePlayerUI(
                state
            );


            // ======================================
            // まとめて再生
            // ======================================

            if (
                isPlaylistMode &&
                state.paused &&
                state.duration > 0 &&
                state.position >=
                    state.duration - 1000 &&
                !isChangingTrack
            ) {

                isChangingTrack =
                    true;


                setTimeout(
                    async () => {

                        try {

                            if (
                                currentTrackIndex <
                                currentPlaylist.length - 1
                            ) {

                                currentTrackIndex++;


                                await playTrack(
                                    currentPlaylist,
                                    currentTrackIndex,
                                    true
                                );

                            } else {

                                // 最後の曲
                                isPlaylistMode =
                                    false;

                            }

                        } catch (error) {

                            console.error(
                                "Auto Next Error:",
                                error
                            );

                        } finally {

                            isChangingTrack =
                                false;

                        }

                    },
                    500
                );

            }


            lastPlaybackPosition =
                state.position || 0;

        }
    );


    // ==========================================
    // Autoplay
    // ==========================================

    spotifyPlayer.addListener(
        "autoplay_failed",
        () => {

            console.warn(
                "ブラウザの自動再生がブロックされました"
            );

        }
    );


    // ==========================================
    // エラー
    // ==========================================

    spotifyPlayer.addListener(
        "initialization_error",
        ({ message }) => {

            console.error(
                "Spotify initialization error:",
                message
            );

        }
    );


    spotifyPlayer.addListener(
        "authentication_error",
        ({ message }) => {

            console.error(
                "Spotify authentication error:",
                message
            );

            updateSpotifyStatus(
                "Spotify認証エラー"
            );

        }
    );


    spotifyPlayer.addListener(
        "account_error",
        ({ message }) => {

            console.error(
                "Spotify account error:",
                message
            );

            updateSpotifyStatus(
                "Spotify Premiumが必要です"
            );

        }
    );


    spotifyPlayer.addListener(
        "playback_error",
        ({ message }) => {

            console.error(
                "Spotify playback error:",
                message
            );

        }
    );


    // ==========================================
    // 接続
    // ==========================================

    spotifyPlayer
        .connect()
        .then(
            success => {

                console.log(
                    "Spotify Player connect:",
                    success
                );

            }
        );

}


// ==========================================
// Spotify状態表示
// ==========================================

function updateSpotifyStatus(
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


// ==========================================
// 曲を再生
// ==========================================

async function playTrack(
    tracks,
    index,
    playlistMode = false
) {

    if (
        !tracks ||
        tracks.length === 0
    ) {
        return;
    }


    tracks =
        tracks
            .map(normalizeTrack)
            .filter(Boolean);


    const track =
        tracks[index];


    if (!track) {
        return;
    }


    if (!track.uri) {

        alert(
            "この曲はSpotifyで再生できません。"
        );

        return;

    }


    currentPlaylist =
        tracks;

    currentTrackIndex =
        index;

    isPlaylistMode =
        playlistMode;


    // ==========================================
    // Playerチェック
    // ==========================================

    if (!spotifyPlayer) {

        alert(
            "Spotifyにログインしてください。"
        );

        return;

    }


    if (!spotifyDeviceId) {

        alert(
            "Spotify Playerを接続しています。\n少し待ってからもう一度押してください。"
        );

        return;

    }


    const token =
        getSpotifyAccessToken();


    if (!token) {

        alert(
            "Spotifyにログインしてください。"
        );

        return;

    }


    try {

        // ======================================
        // ブラウザ自動再生対策
        // ======================================

        if (
            spotifyPlayer.activateElement
        ) {

            await spotifyPlayer
                .activateElement();

        }


        // ======================================
        // Web Playerへ再生先を移動
        // ======================================

        const transferResponse =
            await fetch(
                "https://api.spotify.com/v1/me/player",
                {

                    method: "PUT",

                    headers: {

                        Authorization:
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        device_ids:
                            [spotifyDeviceId],

                        play:
                            false

                    })

                }
            );


        if (
            !transferResponse.ok &&
            transferResponse.status !== 204
        ) {

            console.warn(
                "Playback transfer warning:",
                await transferResponse.text()
            );

        }


        // ======================================
        // 再生
        // ======================================

        const response =
            await fetch(
                `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(
                    spotifyDeviceId
                )}`,
                {

                    method: "PUT",

                    headers: {

                        Authorization:
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        uris:
                            [track.uri]

                    })

                }
            );


        if (!response.ok) {

            const errorText =
                await response.text();

            console.error(
                "Spotify Playback Error:",
                response.status,
                errorText
            );


            throw new Error(
                `HTTP ${response.status}`
            );

        }


        // ======================================
        // プレイヤー表示
        // ======================================

        showPlayerPanel(
            track
        );


    } catch (error) {

        console.error(
            "Playback Error:",
            error
        );


        alert(
            "Spotifyで再生できませんでした。\nSpotifyにログインしているか確認してください。"
        );

    }

}


// ==========================================
// Player UI
// ==========================================

function updatePlayerUI(
    state
) {

    const currentTrack =
        state.track_window
            ?.current_track;


    if (!currentTrack) {
        return;
    }


    const panel =
        document.getElementById(
            "playerPanel"
        );


    if (!panel) {
        return;
    }


    // ==========================================
    // タイトル
    // ==========================================

    const title =
        document.getElementById(
            "playerSongTitle"
        ) ||
        document.getElementById(
            "playerTitle"
        );


    // ==========================================
    // アーティスト
    // ==========================================

    const artist =
        document.getElementById(
            "playerArtist"
        );


    // ==========================================
    // 画像
    // ==========================================

    const image =
        document.getElementById(
            "playerImage"
        );


    // ==========================================
    // プログレス
    // ==========================================

    const progress =
        document.getElementById(
            "progressBar"
        ) ||
        document.getElementById(
            "playerProgress"
        );


    const currentTime =
        document.getElementById(
            "currentTime"
        );


    const duration =
        document.getElementById(
            "duration"
        );


    // ==========================================
    // タイトル表示
    // ==========================================

    if (title) {

        title.textContent =
            currentTrack.name;

    }


    // ==========================================
    // アーティスト表示
    // ==========================================

    if (artist) {

        artist.textContent =
            currentTrack.artists
                ?.map(
                    a => a.name
                )
                .join(", ") ||
            "";

    }


    // ==========================================
    // 画像表示
    // ==========================================

    if (
        image &&
        currentTrack.album
            ?.images?.length
    ) {

        image.src =
            currentTrack
                .album
                .images[0]
                .url;

    }


    // ==========================================
    // プログレス
    // ==========================================

    if (progress) {

        progress.max =
            state.duration || 1;

        progress.value =
            state.position || 0;

    }


    // ==========================================
    // 時間
    // ==========================================

    if (currentTime) {

        currentTime.textContent =
            formatTime(
                state.position || 0
            );

    }


    if (duration) {

        duration.textContent =
            formatTime(
                state.duration || 0
            );

    }


    // ==========================================
    // パネル表示
    // ==========================================

    panel.classList.add(
        "show"
    );


    // ==========================================
    // 再生ボタン
    // ==========================================

    const playButton =
        document.getElementById(
            "playPauseButton"
        ) ||
        document.getElementById(
            "playerPlay"
        );


    if (playButton) {

        playButton.textContent =
            state.paused
                ? "▶"
                : "⏸";

    }

}


// ==========================================
// Player表示
// ==========================================

function showPlayerPanel(
    track
) {

    const panel =
        document.getElementById(
            "playerPanel"
        );


    if (!panel) {
        return;
    }


    const title =
        document.getElementById(
            "playerSongTitle"
        ) ||
        document.getElementById(
            "playerTitle"
        );


    const artist =
        document.getElementById(
            "playerArtist"
        );


    if (title) {

        title.textContent =
            track.name;

    }


    if (artist) {

        artist.textContent =
            track.artists
                ?.map(
                    a => a.name
                )
                .join(", ") ||
            "";

    }


    panel.classList.add(
        "show"
    );

}


// ==========================================
// 前の曲
// ==========================================

async function playPrevious() {

    if (
        currentPlaylist.length === 0
    ) {
        return;
    }


    currentTrackIndex--;


    if (
        currentTrackIndex < 0
    ) {

        currentTrackIndex =
            currentPlaylist.length - 1;

    }


    await playTrack(
        currentPlaylist,
        currentTrackIndex,
        isPlaylistMode
    );

}


// ==========================================
// 次の曲
// ==========================================

async function playNext() {

    if (
        currentPlaylist.length === 0
    ) {
        return;
    }


    currentTrackIndex++;


    if (
        currentTrackIndex >=
        currentPlaylist.length
    ) {

        currentTrackIndex =
            0;

    }


    await playTrack(
        currentPlaylist,
        currentTrackIndex,
        isPlaylistMode
    );

}


// ==========================================
// 再生 / 一時停止
// ==========================================

async function togglePlayback() {

    if (!spotifyPlayer) {
        return;
    }


    try {

        await spotifyPlayer.togglePlay();

    } catch (error) {

        console.error(
            "Toggle Play Error:",
            error
        );

    }

}


// ==========================================
// シーク
// ==========================================

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
            "Seek Error:",
            error
        );

    }

}


// ==========================================
// 音量保存値
// ==========================================

function getSavedVolume() {

    const saved =
        parseFloat(
            localStorage.getItem(
                "musicPickerVolume"
            )
        );


    if (
        Number.isFinite(saved) &&
        saved >= 0 &&
        saved <= 1
    ) {

        return saved;

    }


    return 0.5;

}


// ==========================================
// 音量UI
// ==========================================

function setupVolumeControl() {

    const volumeBar =
        document.getElementById(
            "volumeBar"
        );


    const volumeValue =
        document.getElementById(
            "volumeValue"
        );


    if (!volumeBar) {
        return;
    }


    const saved =
        getSavedVolume();


    volumeBar.value =
        Math.round(
            saved * 100
        );


    if (volumeValue) {

        volumeValue.textContent =
            `${Math.round(saved * 100)}%`;

    }


    // 既存イベントを上書き
    volumeBar.oninput =
        async () => {

            const value =
                Number(
                    volumeBar.value
                );


            const volume =
                value / 100;


            // 保存
            localStorage.setItem(
                "musicPickerVolume",
                String(volume)
            );


            // 表示
            if (volumeValue) {

                volumeValue.textContent =
                    `${value}%`;

            }


            // Spotify Player
            if (spotifyPlayer) {

                try {

                    await spotifyPlayer
                        .setVolume(
                            volume
                        );

                } catch (error) {

                    console.error(
                        "Volume Error:",
                        error
                    );

                }

            }

        };

}


// ==========================================
// プレイヤーボタン
// ==========================================

document.addEventListener(
    "click",
    event => {

        // 前の曲
        if (
            event.target.closest(
                "#previousButton, #playerPrevious"
            )
        ) {

            playPrevious();

            return;

        }


        // 次の曲
        if (
            event.target.closest(
                "#nextButton, #playerNext"
            )
        ) {

            playNext();

            return;

        }


        // 再生・一時停止
        if (
            event.target.closest(
                "#playPauseButton, #playerPlay"
            )
        ) {

            togglePlayback();

            return;

        }

    }
);


// ==========================================
// プログレスバー
// ==========================================

document.addEventListener(
    "change",
    event => {

        if (
            event.target.matches(
                "#progressBar, #playerProgress"
            )
        ) {

            seekPlayback(
                event.target.value
            );

        }

    }
);


// ==========================================
// 時間
// ==========================================

function formatTime(
    milliseconds
) {

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


    return `${minutes}:${String(
        remaining
    ).padStart(
        2,
        "0"
    )}`;

}


// ==========================================
// Spotify SDK読み込み後
// ==========================================

window.onSpotifyWebPlaybackSDKReady =
    function () {

        console.log(
            "Spotify Web Playback SDK 読み込み完了"
        );


        setupSpotifyPlayer();

    };