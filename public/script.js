// ==========================================
// Music Picker - script.js
// ==========================================


// ==========================================
// ハンバーガーメニュー
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    const menuButton = document.getElementById("menuButton");
    const closeMenu = document.getElementById("closeMenu");
    const sideMenu = document.getElementById("sideMenu");
    const menuOverlay = document.getElementById("menuOverlay");

    if (menuButton && sideMenu) {
        menuButton.addEventListener("click", () => {
            sideMenu.classList.add("open");

            if (menuOverlay) {
                menuOverlay.classList.add("show");
            }
        });
    }

    if (closeMenu && sideMenu) {
        closeMenu.addEventListener("click", () => {
            sideMenu.classList.remove("open");

            if (menuOverlay) {
                menuOverlay.classList.remove("show");
            }
        });
    }

    if (menuOverlay && sideMenu) {
        menuOverlay.addEventListener("click", () => {
            sideMenu.classList.remove("open");
            menuOverlay.classList.remove("show");
        });
    }


    // ==========================================
    // ページごとの初期化
    // ==========================================

    initHomePage();
    initSearchPage();
    initFavoritesPage();
    initTopTracksPage();
    initHistoryPage();
    initSettingsPage();
    initAccountPage();

});


// ==========================================
// 共通：Spotifyアクセストークン
// ==========================================

function getSpotifyAccessToken() {

    return localStorage.getItem("spotify_access_token");

}


// ==========================================
// HOME
// ==========================================

function initHomePage() {

    const artistSearch = document.getElementById("artistSearch");

    // ホームページではない
    if (!artistSearch) {
        return;
    }

    let selectedMood = "";
    let selectedGenre = "all";
    let selectedArtistId = "";
    let selectedArtistName = "";

    const artistResults =
        document.getElementById("artistResults");

    const selectedArtist =
        document.getElementById("selectedArtist");

    const genre =
        document.getElementById("genre");

    const makePlaylist =
        document.getElementById("makePlaylist");

    const playlist =
        document.getElementById("playlist");


    // ==========================================
    // アーティスト検索
    // ==========================================

    let searchTimer;

    artistSearch.addEventListener("input", () => {

        clearTimeout(searchTimer);

        const keyword =
            artistSearch.value.trim();

        if (!keyword) {

            if (artistResults) {
                artistResults.innerHTML = "";
            }

            return;
        }

        searchTimer = setTimeout(async () => {

            try {

                const response =
                    await fetch(
                        `/api/artists?q=${encodeURIComponent(keyword)}`
                    );

                const data =
                    await response.json();

                if (!artistResults) {
                    return;
                }

                artistResults.innerHTML = "";

                if (!data.artists ||
                    data.artists.length === 0) {

                    artistResults.innerHTML =
                        "<p>アーティストが見つかりませんでした。</p>";

                    return;
                }


                data.artists.forEach(artist => {

                    const item =
                        document.createElement("div");

                    item.className =
                        "artist-result";


                    const image =
                        artist.images &&
                        artist.images.length > 0
                            ? artist.images[0].url
                            : "";


                    item.innerHTML = `

                        ${
                            image
                            ? `<img src="${image}" alt="">`
                            : `<div class="artist-no-image">🎵</div>`
                        }

                        <span>${escapeHTML(artist.name)}</span>

                    `;


                    item.addEventListener("click", () => {

                        selectedArtistId =
                            artist.id;

                        selectedArtistName =
                            artist.name;


                        if (selectedArtist) {

                            selectedArtist.innerHTML = `

                                <div class="selected-artist-card">

                                    ${
                                        image
                                        ? `<img src="${image}" alt="">`
                                        : ""
                                    }

                                    <span>
                                        ${escapeHTML(artist.name)}
                                    </span>

                                </div>

                            `;

                        }


                        artistSearch.value =
                            artist.name;


                        artistResults.innerHTML = "";

                    });


                    artistResults.appendChild(item);

                });

            } catch (error) {

                console.error(
                    "Artist Search Error:",
                    error
                );

            }

        }, 300);

    });


    // ==========================================
    // ジャンル
    // ==========================================

    if (genre) {

        genre.addEventListener("change", () => {

            selectedGenre =
                genre.value;

        });

    }


    // ==========================================
    // 気分
    // ==========================================

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

        });

    });


    // ==========================================
    // プレイリスト作成
    // ==========================================

    if (makePlaylist) {

        makePlaylist.addEventListener("click", async () => {

            if (!selectedMood) {

                alert("気分を選択してください。");
                return;

            }


            if (
                !selectedArtistId &&
                (!selectedGenre || selectedGenre === "all")
            ) {

                alert(
                    "アーティストまたはジャンルを選択してください。"
                );

                return;

            }


            makePlaylist.disabled = true;

            makePlaylist.textContent =
                "曲を探しています...";


            try {

                let tracks = [];


                // アーティスト指定
                if (selectedArtistId) {

                    const response =
                        await fetch(
                            `/api/artist-tracks?id=${encodeURIComponent(selectedArtistId)}`
                        );

                    const data =
                        await response.json();

                    tracks =
                        data.tracks || [];

                }

                // ジャンル指定
                else {

                    const response =
                        await fetch(
                            `/api/genre-tracks?genre=${encodeURIComponent(selectedGenre)}`
                        );

                    const data =
                        await response.json();

                    tracks =
                        data.tracks || [];

                }


                // ======================================
                // シャッフル
                // ======================================

                tracks =
                    shuffleArray(tracks);


                // 5曲
                const selectedTracks =
                    tracks.slice(0, 5);


                if (selectedTracks.length === 0) {

                    alert(
                        "曲が見つかりませんでした。"
                    );

                    return;

                }


                // 履歴に保存
                saveToHistory(selectedTracks);


                // 表示
                displayPlaylist(
                    selectedTracks,
                    playlist
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

                makePlaylist.disabled = false;

                makePlaylist.textContent =
                    "🎵 プレイリストを作る";

            }

        });

    }


    // ==========================================
    // Spotify SDK
    // ==========================================

    initSpotifyPlayer();

}


// ==========================================
// プレイリスト表示
// ==========================================

function displayPlaylist(tracks, container) {

    if (!container) {
        return;
    }


    container.innerHTML = `

        <div class="playlist-header">

            <h2>🎵 あなたのプレイリスト</h2>

            <p>
                ${tracks.length}曲
            </p>

        </div>

        <div class="playlist-songs">

            ${tracks.map((track, index) => {

                const image =
                    track.album &&
                    track.album.images &&
                    track.album.images.length > 0
                        ? track.album.images[0].url
                        : "";


                return `

                    <div
                        class="playlist-song"
                        data-index="${index}"
                    >

                        <span class="song-number">
                            ${index + 1}
                        </span>


                        ${
                            image
                            ? `<img
                                class="song-image"
                                src="${image}"
                                alt=""
                              >`
                            : `<div class="song-image no-image">
                                🎵
                              </div>`
                        }


                        <div class="song-info">

                            <strong>
                                ${escapeHTML(track.name || "Unknown")}
                            </strong>

                            <span>
                                ${escapeHTML(
                                    track.artists
                                    ?.map(a => a.name)
                                    .join(", ") || ""
                                )}
                            </span>

                        </div>


                        ${
                            track.external_urls?.spotify
                            ? `
                                <a
                                    class="spotify-button"
                                    href="${track.external_urls.spotify}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Spotify
                                </a>
                              `
                            : ""
                        }

                    </div>

                `;

            }).join("")}

        </div>

    `;

}


// ==========================================
// 検索ページ
// ==========================================

function initSearchPage() {

    const input =
        document.getElementById("musicSearchInput");

    const button =
        document.getElementById("musicSearchButton");

    const results =
        document.getElementById("searchResults");


    if (!input || !button || !results) {
        return;
    }


    async function searchMusic() {

        const keyword =
            input.value.trim();


        if (!keyword) {

            results.innerHTML =
                "<p>曲名やアーティスト名を入力してください。</p>";

            return;

        }


        results.innerHTML =
            "<p>検索中...</p>";


        try {

            const response =
                await fetch(
                    `/api/search?q=${encodeURIComponent(keyword)}`
                );


            const data =
                await response.json();


            if (!data.tracks ||
                data.tracks.length === 0) {

                results.innerHTML =
                    "<p>曲が見つかりませんでした。</p>";

                return;

            }


            results.innerHTML = "";


            data.tracks.forEach(track => {

                results.appendChild(
                    createTrackElement(track)
                );

            });


        } catch (error) {

            console.error(
                "Search Error:",
                error
            );

            results.innerHTML =
                "<p>検索に失敗しました。</p>";

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
// お気に入り
// ==========================================

function initFavoritesPage() {

    const container =
        document.getElementById("favoritesList");


    if (!container) {
        return;
    }


    const favorites =
        getStoredTracks("favorites");


    if (favorites.length === 0) {

        container.innerHTML = `

            <div class="empty-message">

                <div>❤️</div>

                <p>
                    お気に入りの曲はまだありません。
                </p>

                <button
                    onclick="location.href='search.html'"
                >
                    🔍 曲を探す
                </button>

            </div>

        `;

        return;

    }


    container.innerHTML = "";


    favorites.forEach(track => {

        container.appendChild(
            createTrackElement(
                track,
                true
            )
        );

    });

}


// ==========================================
// TOP TRACKS
// ==========================================

async function initTopTracksPage() {

    const container =
        document.getElementById("topTracksList");


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
                    onclick="location.href='/auth/login'"
                >
                    🎵 Spotifyにログイン
                </button>

            </div>

        `;

        return;

    }


    container.innerHTML =
        "<p>TOP曲を読み込んでいます...</p>";


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


        if (!data.tracks ||
            data.tracks.length === 0) {

            container.innerHTML =
                "<p>TOP曲が見つかりませんでした。</p>";

            return;

        }


        container.innerHTML = "";


        data.tracks.forEach(track => {

            container.appendChild(
                createTrackElement(track)
            );

        });


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
                    onclick="location.href='/auth/login'"
                >
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
        document.getElementById("historyList");


    if (!container) {
        return;
    }


    const history =
        getStoredTracks("playHistory");


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


    history.forEach(track => {

        container.appendChild(
            createTrackElement(track)
        );

    });

}


// ==========================================
// アカウント
// ==========================================

function initAccountPage() {

    const status =
        document.getElementById("spotifyStatus");

    const statusText =
        document.getElementById("spotifyStatusText");


    if (!status || !statusText) {
        return;
    }


    const token =
        getSpotifyAccessToken();


    if (token) {

        status.textContent =
            "Spotify接続済み 🎵";

        statusText.textContent =
            "Spotifyアカウントが接続されています。";

    } else {

        status.textContent =
            "Spotify未接続";

        statusText.textContent =
            "Spotifyにログインすると、TOP曲などの機能が使えます。";

    }

}


// ==========================================
// 設定
// ==========================================

function initSettingsPage() {

    const themeButtons =
        document.querySelectorAll(".theme-button");

    const songCount =
        document.getElementById("songCount");

    const clearHistoryButton =
        document.getElementById("clearHistoryButton");

    const message =
        document.getElementById("settingsMessage");


    // ==========================================
    // 保存されているテーマ
    // ==========================================

    const savedTheme =
        localStorage.getItem("musicPickerTheme") ||
        "light";


    document.body.dataset.theme =
        savedTheme;


    themeButtons.forEach(button => {

        if (
            button.dataset.theme ===
            savedTheme
        ) {

            button.classList.add("selected");

        }


        button.addEventListener("click", () => {

            const theme =
                button.dataset.theme;


            localStorage.setItem(
                "musicPickerTheme",
                theme
            );


            document.body.dataset.theme =
                theme;


            themeButtons.forEach(btn => {
                btn.classList.remove("selected");
            });


            button.classList.add("selected");


            if (message) {

                message.textContent =
                    "テーマを変更しました。";

            }

        });

    });


    // ==========================================
    // 曲数
    // ==========================================

    if (songCount) {

        const savedCount =
            localStorage.getItem(
                "musicPickerSongCount"
            );


        if (savedCount) {
            songCount.value = savedCount;
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
// 曲カード作成
// ==========================================

function createTrackElement(
    track,
    showFavoriteButton = false
) {

    const item =
        document.createElement("div");


    item.className =
        "track-item";


    const image =
        track.album &&
        track.album.images &&
        track.album.images.length > 0
            ? track.album.images[0].url
            : "";


    item.innerHTML = `

        ${
            image
            ? `<img
                class="track-image"
                src="${image}"
                alt=""
              >`
            : `<div class="track-image no-image">
                🎵
              </div>`
        }


        <div class="track-info">

            <strong>
                ${escapeHTML(track.name || "Unknown")}
            </strong>

            <span>
                ${escapeHTML(
                    track.artists
                    ?.map(a => a.name)
                    .join(", ") || ""
                )}
            </span>

        </div>


        <div class="track-actions">

            ${
                track.external_urls?.spotify
                ? `
                    <a
                        class="spotify-button"
                        href="${track.external_urls.spotify}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Spotify
                    </a>
                  `
                : ""
            }


            <button
                class="favorite-button"
                title="お気に入り"
            >
                ❤️
            </button>

        </div>

    `;


    const favoriteButton =
        item.querySelector(
            ".favorite-button"
        );


    if (favoriteButton) {

        const favorites =
            getStoredTracks("favorites");


        const alreadyFavorite =
            favorites.some(
                saved =>
                    saved.id === track.id
            );


        if (alreadyFavorite) {

            favoriteButton.classList.add(
                "active"
            );

        }


        favoriteButton.addEventListener(
            "click",
            () => {

                toggleFavorite(
                    track,
                    favoriteButton
                );

            }
        );

    }


    return item;

}


// ==========================================
// お気に入り切り替え
// ==========================================

function toggleFavorite(
    track,
    button
) {

    let favorites =
        getStoredTracks("favorites");


    const index =
        favorites.findIndex(
            item =>
                item.id === track.id
        );


    if (index >= 0) {

        favorites.splice(index, 1);

        button.classList.remove(
            "active"
        );

    } else {

        favorites.unshift(track);

        button.classList.add(
            "active"
        );

    }


    localStorage.setItem(
        "favorites",
        JSON.stringify(favorites)
    );

}


// ==========================================
// 履歴保存
// ==========================================

function saveToHistory(tracks) {

    let history =
        getStoredTracks("playHistory");


    tracks.forEach(track => {

        history =
            history.filter(
                item =>
                    item.id !== track.id
            );


        history.unshift(track);

    });


    // 最大50曲
    history =
        history.slice(0, 50);


    localStorage.setItem(
        "playHistory",
        JSON.stringify(history)
    );

}


// ==========================================
// LocalStorageから曲を取得
// ==========================================

function getStoredTracks(key) {

    try {

        const data =
            localStorage.getItem(key);


        if (!data) {
            return [];
        }


        const parsed =
            JSON.parse(data);


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

function shuffleArray(array) {

    const result =
        [...array];


    for (
        let i = result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
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

function escapeHTML(value) {

    const div =
        document.createElement("div");


    div.textContent =
        value ?? "";


    return div.innerHTML;

}


// ==========================================
// Spotify Web Playback SDK
// ==========================================

let spotifyPlayer = null;
let spotifyDeviceId = null;


function initSpotifyPlayer() {

    const token =
        getSpotifyAccessToken();


    if (!token) {
        return;
    }


    // SDKがまだ読み込まれていない場合
    if (!window.Spotify) {

        window.onSpotifyWebPlaybackSDKReady =
            () => {

                createSpotifyPlayer(token);

            };

        return;

    }


    createSpotifyPlayer(token);

}


// ==========================================
// Spotify Player作成
// ==========================================

function createSpotifyPlayer(token) {

    if (spotifyPlayer) {
        return;
    }


    spotifyPlayer =
        new Spotify.Player({

            name: "Music Picker",

            getOAuthToken: callback => {

                callback(
                    getSpotifyAccessToken()
                );

            },

            volume: 0.5

        });


    // ==========================================
    // 接続完了
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

        }
    );


    // ==========================================
    // 切断
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


            console.log(
                "Spotify Player State:",
                state
            );


            updatePlayerUI(state);

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

        }
    );


    spotifyPlayer.addListener(
        "account_error",
        ({ message }) => {

            console.error(
                "Spotify account error:",
                message
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


    spotifyPlayer.connect();

}


// ==========================================
// Player UI
// ==========================================

function updatePlayerUI(state) {

    const currentTrack =
        state.track_window?.current_track;


    if (!currentTrack) {
        return;
    }


    const playerPanel =
        document.getElementById(
            "playerPanel"
        );


    if (!playerPanel) {
        return;
    }


    const title =
        playerPanel.querySelector(
            ".player-title"
        );


    const artist =
        playerPanel.querySelector(
            ".player-artist"
        );


    const progress =
        playerPanel.querySelector(
            ".player-progress"
        );


    if (title) {

        title.textContent =
            currentTrack.name;

    }


    if (artist) {

        artist.textContent =
            currentTrack.artists
                .map(a => a.name)
                .join(", ");

    }


    if (progress) {

        progress.max =
            state.duration;


        progress.value =
            state.position;

    }

}