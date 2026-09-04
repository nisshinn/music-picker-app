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

            sideMenu.classList.add("active");

            if (menuOverlay) {
                menuOverlay.classList.add("active");
            }

        });

    }

    if (closeMenu && sideMenu) {

        closeMenu.addEventListener("click", () => {

            sideMenu.classList.remove("active");

            if (menuOverlay) {
                menuOverlay.classList.remove("active");
            }

        });

    }

    if (menuOverlay && sideMenu) {

        menuOverlay.addEventListener("click", () => {

            sideMenu.classList.remove("active");
            menuOverlay.classList.remove("active");

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
// Spotifyアクセストークン
// ==========================================

function getSpotifyAccessToken() {

    return localStorage.getItem(
        "spotify_access_token"
    );

}


// ==========================================
// HOME
// ==========================================

function initHomePage() {

    const artistSearch =
        document.getElementById("artistSearch");

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


        // 入力が空なら消す
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


                if (!response.ok) {
                    throw new Error(
                        `HTTP ${response.status}`
                    );
                }


                const data =
                    await response.json();


                if (!artistResults) {
                    return;
                }


                artistResults.innerHTML = "";


                if (
                    !data.artists ||
                    data.artists.length === 0
                ) {

                    artistResults.innerHTML =
                        `<div class="no-results">
                            アーティストが見つかりませんでした。
                        </div>`;

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
                            ? `
                                <img
                                    src="${image}"
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
                                ${escapeHTML(artist.name)}
                            </div>

                            <div class="artist-followers">
                                アーティスト
                            </div>

                        </div>

                    `;


                    item.addEventListener(
                        "click",
                        () => {

                            selectedArtistId =
                                artist.id;

                            selectedArtistName =
                                artist.name;


                            if (selectedArtist) {

                                selectedArtist.style.display =
                                    "flex";


                                selectedArtist.innerHTML = `

                                    ${
                                        image
                                        ? `
                                            <img
                                                src="${image}"
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

                            }


                            artistSearch.value =
                                artist.name;


                            artistResults.innerHTML = "";

                        }
                    );


                    artistResults.appendChild(item);

                });


            } catch (error) {

                console.error(
                    "Artist Search Error:",
                    error
                );


                if (artistResults) {

                    artistResults.innerHTML =
                        `<div class="no-results">
                            アーティスト検索に失敗しました。
                        </div>`;

                }

            }

        }, 300);

    });


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


    moodButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                moodButtons.forEach(btn => {

                    btn.classList.remove(
                        "selected"
                    );

                });


                button.classList.add(
                    "selected"
                );


                selectedMood =
                    button.dataset.mood ||
                    button.textContent.trim();

            }
        );

    });


    // ==========================================
    // プレイリスト作成
    // ==========================================

    if (makePlaylist) {

        makePlaylist.addEventListener(
            "click",
            async () => {

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


                makePlaylist.disabled =
                    true;

                makePlaylist.textContent =
                    "曲を探しています...";


                try {

                    let tracks = [];


                    // ==================================
                    // アーティストから探す
                    // ==================================

                    if (selectedArtistId) {

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
                            data.tracks || [];

                    }


                    // ==================================
                    // ジャンルから探す
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
                            data.tracks || [];

                    }


                    // ==================================
                    // シャッフル
                    // ==================================

                    tracks =
                        shuffleArray(tracks);


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
                    // 表示
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


    container.innerHTML = `

        <div class="playlist-title">

            <h2>
                🎵 あなたのプレイリスト
            </h2>

            <p>
                ${
                    mood
                    ? `${escapeHTML(mood)}におすすめ`
                    : ""
                }
                ${tracks.length}曲
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

            ${tracks.map(
                (track, index) => {

                    const image =
                        track.album &&
                        track.album.images &&
                        track.album.images.length > 0
                            ? track.album.images[0].url
                            : "";


                    const artists =
                        track.artists
                            ?.map(
                                artist =>
                                    artist.name
                            )
                            .join(", ") || "";


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
                                        src="${image}"
                                        alt=""
                                    >
                                  `
                                : `
                                    <div class="
                                        song-cover
                                        song-no-image
                                    ">
                                        🎵
                                    </div>
                                  `
                            }


                            <div class="song-info">

                                <div class="song-name">
                                    ${escapeHTML(
                                        track.name ||
                                        "Unknown"
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
                                    title="お気に入り"
                                    type="button">

                                    ❤️

                                </button>


                                ${
                                    track.external_urls?.spotify
                                    ? `
                                        <a
                                            class="spotify-button"
                                            href="${track.external_urls.spotify}"
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
            ).join("")}

        </div>

    `;


    // ==========================================
    // お気に入りボタン
    // ==========================================

    const cards =
        container.querySelectorAll(
            ".song-card"
        );


    cards.forEach((card, index) => {

        const favoriteButton =
            card.querySelector(
                ".favorite-button"
            );


        if (!favoriteButton) {
            return;
        }


        const track =
            tracks[index];


        const favorites =
            getStoredTracks(
                "favorites"
            );


        if (
            favorites.some(
                saved =>
                    saved.id === track.id
            )
        ) {

            favoriteButton.classList.add(
                "active"
            );

        }


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

    });


    // ==========================================
    // 曲クリック
    // ==========================================

    cards.forEach((card, index) => {

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
                    tracks,
                    index
                );

            }
        );

    });


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
            () => {

                playTrack(
                    tracks,
                    0
                );

            }
        );

    }

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


            if (
                !data.tracks ||
                data.tracks.length === 0
            ) {

                results.innerHTML = `
                    <div class="empty-message">
                        曲が見つかりませんでした。
                    </div>
                `;

                return;

            }


            results.innerHTML = "";


            data.tracks.forEach(
                track => {

                    results.appendChild(
                        createTrackElement(
                            track,
                            true
                        )
                    );

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
// お気に入り
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


        if (
            !data.tracks ||
            data.tracks.length === 0
        ) {

            container.innerHTML = `
                <div class="empty-message">
                    TOP曲が見つかりませんでした。
                </div>
            `;

            return;

        }


        container.innerHTML = "";


        data.tracks.forEach(track => {

            container.appendChild(
                createTrackElement(
                    track,
                    true
                )
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


    history.forEach(track => {

        container.appendChild(
            createTrackElement(
                track,
                true
            )
        );

    });

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
        !status ||
        !statusText
    ) {
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
        document.querySelectorAll(".theme-option");

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


    applyTheme(savedTheme);


    themeButtons.forEach(button => {

        const theme =
            button.dataset.theme;


        // 現在のテーマを選択状態にする

        if (theme === savedTheme) {

            button.classList.add("active");

        }


        button.addEventListener("click", () => {

            const selectedTheme =
                button.dataset.theme;


            localStorage.setItem(
                "musicPickerTheme",
                selectedTheme
            );


            applyTheme(selectedTheme);


            themeButtons.forEach(btn => {

                btn.classList.remove("active");

            });


            button.classList.add("active");


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
// テーマ適用
// ==========================================

function applyTheme(theme) {

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
// 曲カード作成
// ==========================================

function createTrackElement(
    track,
    showFavoriteButton = true
) {

    const item =
        document.createElement(
            "div"
        );


    item.className =
        "song-card";


    const image =
        track.album &&
        track.album.images &&
        track.album.images.length > 0
            ? track.album.images[0].url
            : "";


    const artists =
        track.artists
            ?.map(
                artist =>
                    artist.name
            )
            .join(", ") || "";


    item.innerHTML = `

        ${
            image
            ? `
                <img
                    class="song-cover"
                    src="${image}"
                    alt=""
                >
              `
            : `
                <div class="
                    song-cover
                    song-no-image
                ">
                    🎵
                </div>
              `
        }


        <div class="song-info">

            <div class="song-name">
                ${escapeHTML(
                    track.name ||
                    "Unknown"
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
                        title="お気に入り"
                        type="button">

                        ❤️

                    </button>
                  `
                : ""
            }


            ${
                track.external_urls?.spotify
                ? `
                    <a
                        class="spotify-button"
                        href="${track.external_urls.spotify}"
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

        const favorites =
            getStoredTracks(
                "favorites"
            );


        const alreadyFavorite =
            favorites.some(
                saved =>
                    saved.id ===
                    track.id
            );


        if (alreadyFavorite) {

            favoriteButton.classList.add(
                "active"
            );

        }


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
                0
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

    let favorites =
        getStoredTracks(
            "favorites"
        );


    const index =
        favorites.findIndex(
            item =>
                item.id ===
                track.id
        );


    if (index >= 0) {

        favorites.splice(
            index,
            1
        );


        button.classList.remove(
            "active"
        );

    } else {

        favorites.unshift(
            track
        );


        button.classList.add(
            "active"
        );

    }


    localStorage.setItem(
        "favorites",
        JSON.stringify(
            favorites
        )
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


    tracks.forEach(track => {

        history =
            history.filter(
                item =>
                    item.id !==
                    track.id
            );


        history.unshift(
            track
        );

    });


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

let spotifyPlayer = null;
let spotifyDeviceId = null;

let currentPlaylist = [];
let currentTrackIndex = 0;


// ==========================================
// SDKセットアップ
// ==========================================

function setupSpotifyPlayer() {

    const token =
        getSpotifyAccessToken();


    if (!token) {
        return;
    }


    if (!window.Spotify) {

        console.log(
            "Spotify SDKを待機中..."
        );

        return;

    }


    createSpotifyPlayer(
        token
    );

}


// 以前の名前にも対応
function initSpotifyPlayer() {

    setupSpotifyPlayer();

}


// ==========================================
// Player作成
// ==========================================

function createSpotifyPlayer(
    token
) {

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
// 曲を再生
// ==========================================

async function playTrack(
    tracks,
    index
) {

    if (!tracks || tracks.length === 0) {
        return;
    }


    currentPlaylist =
        tracks;

    currentTrackIndex =
        index;


    const track =
        tracks[index];


    if (!track) {
        return;
    }


    // Playerがない場合
    if (!spotifyPlayer) {

        alert(
            "Spotifyにログインしてください。"
        );

        return;

    }


    // device IDがまだない場合
    if (!spotifyDeviceId) {

        alert(
            "Spotify Playerを接続しています。少し待ってからもう一度押してください。"
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

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        showPlayerPanel(
            track
        );


    } catch (error) {

        console.error(
            "Playback Error:",
            error
        );


        alert(
            "Spotifyで再生できませんでした。"
        );

    }

}


// ==========================================
// Player UI更新
// ==========================================

function updatePlayerUI(
    state
) {

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


    const progress =
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


    if (title) {

        title.textContent =
            currentTrack.name;

    }


    if (artist) {

        artist.textContent =
            currentTrack.artists
                .map(
                    a => a.name
                )
                .join(", ");

    }


    if (
        image &&
        currentTrack.album?.images?.length
    ) {

        image.src =
            currentTrack.album.images[0].url;

    }


    if (progress) {

        progress.max =
            state.duration || 1;

        progress.value =
            state.position || 0;

    }


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


    playerPanel.classList.add(
        "show"
    );


    const playButton =
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
// プレイヤー表示
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
            track.name;

    }


    if (artist) {

        artist.textContent =
            track.artists
                ?.map(
                    a => a.name
                )
                .join(", ") || "";

    }


    if (
        image &&
        track.album?.images?.length
    ) {

        image.src =
            track.album.images[0].url;

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
        currentTrackIndex
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

        currentTrackIndex = 0;

    }


    await playTrack(
        currentPlaylist,
        currentTrackIndex
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
// プレイヤーボタン
// ==========================================

document.addEventListener(
    "click",
    event => {

        if (
            event.target.closest(
                "#playerPrevious"
            )
        ) {

            playPrevious();

        }


        if (
            event.target.closest(
                "#playerNext"
            )
        ) {

            playNext();

        }


        if (
            event.target.closest(
                "#playerPlay"
            )
        ) {

            togglePlayback();

        }

    }
);


// ==========================================
// 時間表示
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
    ).padStart(2, "0")}`;

}