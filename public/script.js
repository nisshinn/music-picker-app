// ==========================================
// 🎵 Music Picker
// ==========================================


// ==========================================
// 基本設定
// ==========================================

let selectedMood = "";
let selectedGenre = "all";

let selectedArtistId = "";
let selectedArtistName = "";

let previousSongs = [];

let playlistSongs = [];

let searchSongs = [];


// ==========================================
// 🕘 再生履歴
// ==========================================

let playHistory =
    JSON.parse(
        localStorage.getItem("play_history") || "[]"
    );


function addToHistory(song) {

    if (!song || !song.uri) {
        return;
    }


    playHistory =
        playHistory.filter(
            item => item.uri !== song.uri
        );


    playHistory.unshift({

        uri: song.uri,

        title: song.title,

        artist: song.artist,

        image: song.image || ""

    });


    playHistory =
        playHistory.slice(0, 30);


    localStorage.setItem(
        "play_history",
        JSON.stringify(playHistory)
    );

}


// ==========================================
// ❤️ お気に入り
// ==========================================

let favoriteSongs =
    JSON.parse(
        localStorage.getItem("favorite_songs") || "[]"
    );


function isFavorite(uri) {

    return favoriteSongs.some(
        song => song.uri === uri
    );

}


function toggleFavorite(song) {

    if (!song || !song.uri) {
        return;
    }


    const index =
        favoriteSongs.findIndex(
            item => item.uri === song.uri
        );


    if (index !== -1) {

        favoriteSongs.splice(index, 1);

    } else {

        favoriteSongs.push(song);

    }


    localStorage.setItem(
        "favorite_songs",
        JSON.stringify(favoriteSongs)
    );


    showFavorites();

}


// ==========================================
// HTMLエスケープ
// ==========================================

function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text ?? "";

    return div.innerHTML;

}


// ==========================================
// 🎤 アーティスト検索
// ==========================================

const artistSearch =
    document.getElementById("artistSearch");


const artistResults =
    document.getElementById("artistResults");


const selectedArtist =
    document.getElementById("selectedArtist");


let searchTimer;


artistSearch?.addEventListener(
    "input",
    () => {

        clearTimeout(searchTimer);


        const keyword =
            artistSearch.value.trim();


        if (!keyword) {

            artistResults.innerHTML = "";

            return;

        }


        searchTimer =
            setTimeout(
                () => {
                    searchArtists(keyword);
                },
                400
            );

    }
);


// ==========================================
// Spotify アーティスト検索
// ==========================================

async function searchArtists(keyword) {

    artistResults.innerHTML = `

        <div class="search-loading">
            🔎 Spotifyで検索中...
        </div>

    `;


    try {

        const response =
            await fetch(
                "/api/artists?q=" +
                encodeURIComponent(keyword)
            );


        if (!response.ok) {

            throw new Error(
                "Artist search error"
            );

        }


        const artists =
            await response.json();


        artistResults.innerHTML = "";


        if (
            !artists ||
            artists.length === 0
        ) {

            artistResults.innerHTML = `

                <div class="no-results">
                    アーティストが見つかりませんでした
                </div>

            `;

            return;

        }


        artists.forEach(
            artist => {

                const div =
                    document.createElement("div");


                div.className =
                    "artist-result";


                div.innerHTML = `

                    ${
                        artist.image
                            ? `
                                <img
                                    src="${artist.image}"
                                    alt=""
                                >
                              `
                            : `
                                <div class="artist-no-image">
                                    🎤
                                </div>
                              `
                    }


                    <div class="artist-result-info">

                        <div class="artist-result-name">
                            ${escapeHtml(artist.name)}
                        </div>

                        <div class="artist-followers">
                            Spotifyアーティスト
                        </div>

                    </div>

                `;


                div.addEventListener(
                    "click",
                    () => {

                        selectArtist(artist);

                    }
                );


                artistResults.appendChild(div);

            }
        );


    } catch (error) {

        console.error(
            "アーティスト検索エラー:",
            error
        );


        artistResults.innerHTML = `

            <div class="no-results">
                Spotifyとの通信に失敗しました
            </div>

        `;

    }

}


// ==========================================
// アーティスト選択
// ==========================================

function selectArtist(artist) {

    selectedArtistId =
        artist.id;


    selectedArtistName =
        artist.name;


    artistSearch.value =
        artist.name;


    selectedArtist.innerHTML = `

        ${
            artist.image
                ? `
                    <img
                        src="${artist.image}"
                        alt=""
                    >
                  `
                : ""
        }


        <div>

            <strong>
                ${escapeHtml(artist.name)}
            </strong>

            <span>
                ✓ 選択中
            </span>

        </div>

    `;


    artistResults.innerHTML = "";

}


// ==========================================
// 😊 気分選択
// ==========================================

document
    .querySelectorAll(".moods button")
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(".moods button")
                        .forEach(
                            b => {

                                b.classList.remove(
                                    "selected"
                                );

                            }
                        );


                    button.classList.add(
                        "selected"
                    );


                    selectedMood =
                        button.dataset.mood;

                }
            );

        }
    );


// ==========================================
// 🎸 ジャンル
// ==========================================

const genreSelect =
    document.getElementById("genre");


genreSelect?.addEventListener(
    "change",
    () => {

        selectedGenre =
            genreSelect.value;

    }
);


// ==========================================
// 🎵 プレイリスト作成
// ==========================================

document
    .getElementById("makePlaylist")
    ?.addEventListener(
        "click",
        async () => {

            if (!selectedMood) {

                alert(
                    "気分を選んでください！"
                );

                return;

            }


            const button =
                document.getElementById(
                    "makePlaylist"
                );


            button.disabled = true;


            button.textContent =
                "🎵 Spotifyから曲を取得中...";


            try {

                let songs = [];


                // アーティスト指定
                if (selectedArtistId) {

                    const response =
                        await fetch(
                            "/api/artist-tracks?id=" +
                            encodeURIComponent(
                                selectedArtistId
                            )
                        );


                    if (!response.ok) {

                        throw new Error(
                            "Artist Track API error"
                        );

                    }


                    songs =
                        await response.json();

                }


                // ジャンル指定
                else {

                    const response =
                        await fetch(
                            "/api/genre-tracks?genre=" +
                            encodeURIComponent(
                                selectedGenre
                            )
                        );


                    if (!response.ok) {

                        throw new Error(
                            "Genre Track API error"
                        );

                    }


                    songs =
                        await response.json();

                }


                if (
                    !songs ||
                    songs.length === 0
                ) {

                    alert(
                        "曲が見つかりませんでした。"
                    );

                    return;

                }


                const newSongs =
                    songs.filter(
                        song =>
                            !previousSongs.includes(
                                song.title
                            )
                    );


                const candidates =
                    newSongs.length >= 5
                        ? newSongs
                        : songs;


                const shuffled =
                    [...candidates].sort(
                        () =>
                            Math.random() - 0.5
                    );


                const playlist =
                    shuffled.slice(0, 5);


                previousSongs =
                    playlist.map(
                        song =>
                            song.title
                    );


                showPlaylist(
                    playlist
                );


                // ホームのままプレイリスト表示
                showPage("homePage");


            } catch (error) {

                console.error(
                    "プレイリスト取得エラー:",
                    error
                );


                alert(
                    "Spotify APIから曲を取得できませんでした。"
                );

            } finally {

                button.disabled = false;


                button.textContent =
                    "🎵 プレイリストを作る";

            }

        }
    );


// ==========================================
// 🎧 プレイリスト表示
// ==========================================

function showPlaylist(playlist) {

    const area =
        document.getElementById("playlist");


    if (!area) {
        return;
    }


    playlistSongs =
        playlist;


    area.innerHTML = `

        <div class="playlist-title">

            <h2>
                🎧 Spotifyおすすめ
            </h2>

            <p>
                ${
                    escapeHtml(
                        selectedArtistName ||
                        "おすすめ"
                    )
                }

                ×

                ${
                    escapeHtml(
                        selectedMood ||
                        "おすすめ"
                    )
                }

                のおすすめ5曲
            </p>


            <button
                id="playAllButton"
                class="play-all-button"
            >
                ▶️ 5曲まとめて再生
            </button>


            <button
                id="playSpotifyButton"
                class="play-all-button"
            >
                🎵 Spotifyで5曲再生
            </button>

        </div>


        <div class="song-list"></div>

    `;


    const songList =
        area.querySelector(
            ".song-list"
        );


    playlist.forEach(
        (song, index) => {

            const div =
                document.createElement("div");


            div.className =
                "song-card";


            div.innerHTML = `

                <div class="song-number">
                    ${index + 1}
                </div>


                ${
                    song.image
                        ? `
                            <img
                                class="song-cover"
                                src="${song.image}"
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
                        ${escapeHtml(song.title)}
                    </div>


                    <div class="artist-name">
                        ${escapeHtml(song.artist)}
                    </div>

                </div>


                <div class="song-actions">

                    <button
                        class="favorite-button"
                        onclick="toggleFavoriteFromPlaylist(${index})"
                    >
                        ${
                            isFavorite(song.uri)
                                ? "❤️"
                                : "♡"
                        }
                    </button>


                    <button
                        class="spotify-button"
                        onclick="playSingleSong(${index})"
                    >
                        ▶ 再生
                    </button>

                </div>

            `;


            songList.appendChild(div);

        }
    );


    document
        .getElementById("playAllButton")
        ?.addEventListener(
            "click",
            () => {

                playPlaylist(
                    playlist
                );

            }
        );


    document
        .getElementById("playSpotifyButton")
        ?.addEventListener(
            "click",
            () => {

                playPlaylistOnSpotify(
                    playlist
                );

            }
        );

}


// ==========================================
// ❤️ プレイリストからお気に入り
// ==========================================

function toggleFavoriteFromPlaylist(index) {

    const song =
        playlistSongs[index];


    if (!song) {
        return;
    }


    toggleFavorite(song);


    showPlaylist(
        playlistSongs
    );

}


// ==========================================
// ▶ 1曲再生
// ==========================================

async function playSingleSong(index) {

    const song =
        playlistSongs[index];


    if (!song) {
        return;
    }


    addToHistory(song);


    await playSingleSongFromList(
        song,
        false
    );

}


// ==========================================
// 🎵 共通1曲再生
// ==========================================

async function playSingleSongFromList(
    song,
    alreadyAddedHistory = false
) {

    if (!song) {
        return;
    }


    if (!alreadyAddedHistory) {
        addToHistory(song);
    }


    if (
        !spotifyPlayer ||
        !spotifyDeviceId
    ) {

        alert(
            "先にSpotifyに接続してください"
        );

        return;

    }


    const token =
        localStorage.getItem(
            "spotify_access_token"
        );


    if (!token) {

        alert(
            "Spotifyにログインしてください"
        );

        return;

    }


    if (!song.uri) {

        alert(
            "この曲は再生できません"
        );

        return;

    }


    try {

        const response =
            await fetch(
                "https://api.spotify.com/v1/me/player/play?device_id=" +
                encodeURIComponent(
                    spotifyDeviceId
                ),
                {

                    method: "PUT",

                    headers: {

                        "Authorization":
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({
                            uris: [
                                song.uri
                            ]
                        })

                }
            );


        if (!response.ok) {

            console.error(
                await response.text()
            );


            alert(
                "再生できませんでした"
            );

            return;

        }


    } catch (error) {

        console.error(
            "再生エラー:",
            error
        );


        alert(
            "再生中にエラーが発生しました"
        );

    }

}


// ==========================================
// 🎵 Spotify Web Playback SDK
// ==========================================

let spotifyPlayer = null;

let spotifyDeviceId = null;


window.onSpotifyWebPlaybackSDKReady =
    function () {

        console.log(
            "Spotify SDK 起動"
        );


        const token =
            localStorage.getItem(
                "spotify_access_token"
            );


        const status =
            document.getElementById(
                "spotifyStatus"
            );


        if (!token) {

            if (status) {

                status.textContent =
                    "🔴 Spotify未接続";

            }

            return;

        }


        spotifyPlayer =
            new Spotify.Player({

                name: "Music Picker",

                volume: 0.5,

                getOAuthToken:
                    callback => {

                        const currentToken =
                            localStorage.getItem(
                                "spotify_access_token"
                            );

                        callback(
                            currentToken
                        );

                    }

            });


        spotifyPlayer.addListener(
            "ready",
            ({ device_id }) => {

                spotifyDeviceId =
                    device_id;


                if (status) {

                    status.textContent =
                        "🟢 Spotify接続中";

                }


                console.log(
                    "Spotify接続成功:",
                    device_id
                );

            }
        );


        spotifyPlayer.addListener(
            "not_ready",
            ({ device_id }) => {

                console.log(
                    "Spotify接続解除:",
                    device_id
                );


                if (status) {

                    status.textContent =
                        "🔴 Spotify未接続";

                }

            }
        );


        spotifyPlayer.addListener(
            "authentication_error",
            ({ message }) => {

                console.error(
                    "Spotify認証エラー:",
                    message
                );

            }
        );


        spotifyPlayer.addListener(
            "account_error",
            ({ message }) => {

                console.error(
                    "Spotifyアカウントエラー:",
                    message
                );

            }
        );


        spotifyPlayer.addListener(
            "initialization_error",
            ({ message }) => {

                console.error(
                    "Spotify初期化エラー:",
                    message
                );

            }
        );


        spotifyPlayer.addListener(
            "playback_error",
            ({ message }) => {

                console.error(
                    "Spotify再生エラー:",
                    message
                );

            }
        );


        spotifyPlayer.addListener(
            "player_state_changed",
            state => {

                if (!state) {
                    return;
                }


                const panel =
                    document.getElementById(
                        "playerPanel"
                    );


                const track =
                    state.track_window
                        ?.current_track;


                if (!track) {
                    return;
                }


                panel?.classList.add(
                    "show"
                );


                const title =
                    document.getElementById(
                        "playerTitle"
                    );


                if (title) {

                    title.textContent =
                        track.name;

                }


                const artist =
                    document.getElementById(
                        "playerArtist"
                    );


                if (artist) {

                    artist.textContent =
                        track.artists
                            .map(
                                a => a.name
                            )
                            .join(", ");

                }


                const image =
                    document.getElementById(
                        "playerImage"
                    );


                if (image) {

                    image.src =
                        track.album.images?.[0]?.url ||
                        "";

                }


                const playButton =
                    document.getElementById(
                        "playerPlay"
                    );


                if (playButton) {

                    playButton.textContent =
                        state.paused
                            ? "▶"
                            : "Ⅱ";

                }


                const playerStatus =
                    document.getElementById(
                        "playerStatus"
                    );


                if (playerStatus) {

                    playerStatus.textContent =
                        state.paused
                            ? "一時停止中"
                            : "▶ 再生中";

                }


                updatePlayerProgress(
                    state
                );


                updatePlaylistPosition(
                    track
                );

            }
        );


        setInterval(
            async () => {

                if (!spotifyPlayer) {
                    return;
                }


                try {

                    const state =
                        await spotifyPlayer
                            .getCurrentState();


                    if (!state) {
                        return;
                    }


                    updatePlayerProgress(
                        state
                    );

                } catch (error) {

                    console.error(
                        "プレイヤー状態取得エラー:",
                        error
                    );

                }

            },
            500
        );


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

    };


// ==========================================
// 🎵 5曲まとめて再生
// ==========================================

async function playPlaylist(songs) {

    if (
        !songs ||
        songs.length === 0
    ) {

        return;

    }


    playlistSongs =
        songs;


    const token =
        localStorage.getItem(
            "spotify_access_token"
        );


    if (!token) {

        alert(
            "Spotifyにログインしてください！"
        );

        return;

    }


    if (
        !spotifyPlayer ||
        !spotifyDeviceId
    ) {

        alert(
            "Spotifyが接続されていません！"
        );

        return;

    }


    const uris =
        songs
            .map(
                song => song.uri
            )
            .filter(
                uri => uri
            );


    if (uris.length === 0) {

        alert(
            "再生できる曲がありません！"
        );

        return;

    }


    try {

        const response =
            await fetch(
                "https://api.spotify.com/v1/me/player/play?device_id=" +
                encodeURIComponent(
                    spotifyDeviceId
                ),
                {

                    method: "PUT",

                    headers: {

                        "Authorization":
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({
                            uris
                        })

                }
            );


        if (!response.ok) {

            console.error(
                await response.text()
            );


            alert(
                "Spotifyで再生できませんでした！"
            );

            return;

        }


        songs.forEach(
            song => addToHistory(song)
        );


    } catch (error) {

        console.error(
            "5曲再生エラー:",
            error
        );


        alert(
            "再生中にエラーが発生しました！"
        );

    }

}


// ==========================================
// 🎵 Spotifyアプリで5曲再生
// ==========================================

async function playPlaylistOnSpotify(songs) {

    if (
        !songs ||
        songs.length === 0
    ) {

        return;

    }


    const token =
        localStorage.getItem(
            "spotify_access_token"
        );


    if (!token) {

        alert(
            "先にSpotifyにログインしてください！"
        );

        return;

    }


    const uris =
        songs
            .map(
                song => song.uri
            )
            .filter(
                uri => uri
            );


    if (uris.length === 0) {

        alert(
            "Spotifyで再生できる曲がありません！"
        );

        return;

    }


    try {

        const devicesResponse =
            await fetch(
                "https://api.spotify.com/v1/me/player/devices",
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );


        if (!devicesResponse.ok) {

            console.error(
                await devicesResponse.text()
            );


            alert(
                "Spotifyの再生デバイスを取得できませんでした。"
            );

            return;

        }


        const devicesData =
            await devicesResponse.json();


        const devices =
            devicesData.devices || [];


        if (devices.length === 0) {

            alert(
                "Spotifyの再生デバイスが見つかりません。"
            );

            return;

        }


        let device =
            devices.find(
                d => d.is_active
            );


        if (!device) {

            device =
                devices[0];

        }


        const playResponse =
            await fetch(
                "https://api.spotify.com/v1/me/player/play?device_id=" +
                encodeURIComponent(
                    device.id
                ),
                {

                    method: "PUT",

                    headers: {

                        Authorization:
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({
                            uris
                        })

                }
            );


        if (!playResponse.ok) {

            console.error(
                await playResponse.text()
            );


            alert(
                "Spotifyで再生できませんでした。"
            );

            return;

        }


        songs.forEach(
            song => addToHistory(song)
        );


    } catch (error) {

        console.error(
            "Spotify再生エラー:",
            error
        );


        alert(
            "Spotifyとの通信でエラーが発生しました。"
        );

    }

}


// ==========================================
// 🎵 プレイヤー進行状況
// ==========================================

function updatePlayerProgress(state) {

    const progress =
        document.getElementById(
            "playerProgress"
        );


    const currentTime =
        document.getElementById(
            "playerCurrentTime"
        );


    const duration =
        document.getElementById(
            "playerDuration"
        );


    if (
        !progress ||
        !currentTime ||
        !duration ||
        !state
    ) {

        return;

    }


    if (!state.duration) {
        return;
    }


    progress.max =
        state.duration;


    progress.value =
        state.position;


    currentTime.textContent =
        formatTime(
            state.position
        );


    duration.textContent =
        formatTime(
            state.duration
        );

}


// ==========================================
// ⏱ 時間表示
// ==========================================

function formatTime(ms) {

    const totalSeconds =
        Math.floor(
            ms / 1000
        );


    const minutes =
        Math.floor(
            totalSeconds / 60
        );


    const seconds =
        totalSeconds % 60;


    return (
        minutes +
        ":" +
        String(seconds).padStart(
            2,
            "0"
        )
    );

}


// ==========================================
// 🎵 何曲目か
// ==========================================

function updatePlaylistPosition(track) {

    const status =
        document.getElementById(
            "playerStatus"
        );


    if (
        !status ||
        playlistSongs.length === 0
    ) {

        return;

    }


    const index =
        playlistSongs.findIndex(
            song =>
                song.uri === track.uri
        );


    if (index !== -1) {

        status.textContent =
            `▶ 再生中　${index + 1} / ${playlistSongs.length}曲`;

    }

}


// ==========================================
// ▶ / ⏸
// ==========================================

document
    .getElementById("playerPlay")
    ?.addEventListener(
        "click",
        () => {

            spotifyPlayer?.togglePlay();

        }
    );


// ==========================================
// ⏮ 前の曲
// ==========================================

document
    .getElementById("playerPrev")
    ?.addEventListener(
        "click",
        () => {

            spotifyPlayer?.previousTrack();

        }
    );


// ==========================================
// ⏭ 次の曲
// ==========================================

document
    .getElementById("playerNext")
    ?.addEventListener(
        "click",
        () => {

            spotifyPlayer?.nextTrack();

        }
    );


// ==========================================
// 🎚 再生位置
// ==========================================

document
    .getElementById("playerProgress")
    ?.addEventListener(
        "input",
        event => {

            spotifyPlayer?.seek(
                Number(
                    event.target.value
                )
            );

        }
    );


// ==========================================
// ❤️ お気に入り一覧
// ==========================================

function showFavorites() {

    const list =
        document.getElementById(
            "favoritesList"
        );


    if (!list) {
        return;
    }


    if (favoriteSongs.length === 0) {

        list.innerHTML = `

            <div class="empty-message">
                ❤️ まだお気に入りの曲がありません
            </div>

        `;

        return;

    }


    list.innerHTML = "";


    favoriteSongs.forEach(
        (song, index) => {

            const div =
                document.createElement("div");


            div.className =
                "song-card";


            div.innerHTML = `

                <div class="song-number">
                    ${index + 1}
                </div>


                ${
                    song.image
                        ? `
                            <img
                                src="${song.image}"
                                class="song-cover"
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
                        ${escapeHtml(song.title)}
                    </div>


                    <div class="artist-name">
                        ${escapeHtml(song.artist)}
                    </div>

                </div>


                <div class="song-actions">

                    <button
                        class="favorite-button"
                        onclick="removeFavorite('${escapeHtml(song.uri)}')"
                    >
                        ❤️
                    </button>


                    <button
                        class="spotify-button"
                        onclick="playFavoriteSong(${index})"
                    >
                        ▶ 再生
                    </button>

                </div>

            `;


            list.appendChild(div);

        }
    );

}


// ==========================================
// ❤️ お気に入り削除
// ==========================================

function removeFavorite(uri) {

    favoriteSongs =
        favoriteSongs.filter(
            song => song.uri !== uri
        );


    localStorage.setItem(
        "favorite_songs",
        JSON.stringify(favoriteSongs)
    );


    showFavorites();

}


// ==========================================
// ❤️ お気に入り再生
// ==========================================

function playFavoriteSong(index) {

    const song =
        favoriteSongs[index];


    if (!song) {
        return;
    }


    playSingleSongFromList(
        song
    );

}


// ==========================================
// 🕘 履歴表示
// ==========================================

function showHistory() {

    const area =
        document.getElementById(
            "historyList"
        );


    if (!area) {
        return;
    }


    if (playHistory.length === 0) {

        area.innerHTML = `

            <div class="empty-message">
                🕘 まだ再生履歴がありません
            </div>

        `;

        return;

    }


    area.innerHTML = "";


    playHistory.forEach(
        (song, index) => {

            const div =
                document.createElement("div");


            div.className =
                "song-card";


            div.innerHTML = `

                <div class="song-number">
                    ${index + 1}
                </div>


                ${
                    song.image
                        ? `
                            <img
                                src="${song.image}"
                                class="song-cover"
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
                        ${escapeHtml(song.title)}
                    </div>


                    <div class="artist-name">
                        ${escapeHtml(song.artist)}
                    </div>

                </div>


                <button
                    class="spotify-button"
                    onclick="playHistorySong(${index})"
                >
                    ▶ 再生
                </button>

            `;


            area.appendChild(div);

        }
    );

}


// ==========================================
// 🕘 履歴再生
// ==========================================

function playHistorySong(index) {

    const song =
        playHistory[index];


    if (!song) {
        return;
    }


    playSingleSongFromList(
        song
    );

}


// ==========================================
// 🔍 曲・アーティスト検索
// ==========================================

const musicSearchInput =
    document.getElementById(
        "musicSearchInput"
    );


const musicSearchButton =
    document.getElementById(
        "musicSearchButton"
    );


const searchResults =
    document.getElementById(
        "searchResults"
    );


async function searchMusic() {

    const query =
        musicSearchInput?.value.trim();


    if (!query) {

        alert(
            "曲名やアーティスト名を入力してください！"
        );

        return;

    }


    searchResults.innerHTML = `

        <div class="search-loading">
            🔍 検索中...
        </div>

    `;


    try {

        const response =
            await fetch(
                "/api/search?q=" +
                encodeURIComponent(query)
            );


        const data =
            await response.json();


        if (!response.ok) {

            console.error(data);


            searchResults.innerHTML = `

                <div class="search-empty">
                    検索に失敗しました。
                </div>

            `;

            return;

        }


        displaySearchResults(
            data
        );


    } catch (error) {

        console.error(
            "検索エラー:",
            error
        );


        searchResults.innerHTML = `

            <div class="search-empty">
                検索中にエラーが発生しました。
            </div>

        `;

    }

}


// ==========================================
// 🔍 検索結果表示
// ==========================================

function displaySearchResults(data) {

    searchResults.innerHTML = "";


    const tracks =
        data.tracks || [];


    const artists =
        data.artists || [];


    searchSongs =
        tracks;


    if (
        tracks.length === 0 &&
        artists.length === 0
    ) {

        searchResults.innerHTML = `

            <div class="search-empty">
                曲やアーティストが見つかりませんでした。
            </div>

        `;

        return;

    }


    // アーティスト

    if (artists.length > 0) {

        const title =
            document.createElement("h2");


        title.className =
            "search-section-title";


        title.textContent =
            "🎤 アーティスト";


        searchResults.appendChild(
            title
        );


        artists.forEach(
            artist => {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "search-artist-card";


                card.innerHTML = `

                    ${
                        artist.image
                            ? `
                                <img
                                    src="${artist.image}"
                                    class="search-artist-image"
                                    alt=""
                                >
                              `
                            : `
                                <div class="search-artist-image artist-no-image">
                                    🎤
                                </div>
                              `
                    }


                    <div class="search-artist-info">

                        <div class="search-artist-name">
                            ${escapeHtml(artist.name)}
                        </div>

                    </div>


                    ${
                        artist.spotifyUrl
                            ? `
                                <a
                                    href="${artist.spotifyUrl}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="spotify-button"
                                >
                                    Spotify
                                </a>
                              `
                            : ""
                    }

                `;


                searchResults.appendChild(
                    card
                );

            }
        );

    }


    // 曲

    if (tracks.length > 0) {

        const title =
            document.createElement(
                "h2"
            );


        title.className =
            "search-section-title";


        title.textContent =
            "🎵 曲";


        searchResults.appendChild(
            title
        );


        tracks.forEach(
            (song, index) => {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "song-card search-song-card";


                card.innerHTML = `

                    <div class="song-number">
                        ${index + 1}
                    </div>


                    ${
                        song.image
                            ? `
                                <img
                                    src="${song.image}"
                                    class="song-cover"
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
                            ${escapeHtml(song.title)}
                        </div>


                        <div class="artist-name">
                            ${escapeHtml(song.artist)}
                        </div>

                    </div>


                    <div class="song-actions">

                        <button
                            class="play-button"
                            onclick="playSearchSong(${index})"
                        >
                            ▶️
                        </button>


                        <button
                            class="favorite-button"
                            onclick="toggleFavoriteFromSearch(${index})"
                        >
                            ${
                                isFavorite(song.uri)
                                    ? "❤️"
                                    : "♡"
                            }
                        </button>


                        ${
                            song.spotifyUrl
                                ? `
                                    <a
                                        href="${song.spotifyUrl}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="spotify-button"
                                    >
                                        Spotify
                                    </a>
                                  `
                                : ""
                        }

                    </div>

                `;


                searchResults.appendChild(
                    card
                );

            }
        );

    }

}


// ==========================================
// 🔍 検索曲再生
// ==========================================

function playSearchSong(index) {

    const song =
        searchSongs[index];


    if (!song) {
        return;
    }


    playSingleSongFromList(
        song
    );

}


// ==========================================
// ❤️ 検索結果お気に入り
// ==========================================

function toggleFavoriteFromSearch(index) {

    const song =
        searchSongs[index];


    if (!song) {
        return;
    }


    toggleFavorite(
        song
    );


    displaySearchResults({
        tracks: searchSongs,
        artists: []
    });

}


// ==========================================
// 🔍 検索ボタン
// ==========================================

musicSearchButton?.addEventListener(
    "click",
    searchMusic
);


musicSearchInput?.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            searchMusic();

        }

    }
);


// ==========================================
// 🔥 TOP曲
// ==========================================

async function loadTopTracks() {

    const list =
        document.getElementById(
            "topTracksList"
        );


    if (!list) {
        return;
    }


    const token =
        localStorage.getItem(
            "spotify_access_token"
        );


    if (!token) {

        list.innerHTML = `

            <div class="empty-message">
                🎵 Spotifyにログインすると
                TOP曲を表示できます。
            </div>

        `;

        return;

    }


    list.innerHTML = `

        <div class="search-loading">
            🔥 TOP曲を取得中...
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


        const songs =
            await response.json();


        if (!response.ok) {

            console.error(songs);


            list.innerHTML = `

                <div class="empty-message">
                    TOP曲を取得できませんでした。
                </div>

            `;

            return;

        }


        if (
            !songs ||
            songs.length === 0
        ) {

            list.innerHTML = `

                <div class="empty-message">
                    TOP曲がありません。
                </div>

            `;

            return;

        }


        const playlist =
            songs.slice(
                0,
                5
            );


        playlistSongs =
            playlist;


        list.innerHTML = "";


        playlist.forEach(
            (song, index) => {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "song-card";


                card.innerHTML = `

                    <div class="song-number">
                        ${index + 1}
                    </div>


                    ${
                        song.image
                            ? `
                                <img
                                    src="${song.image}"
                                    class="song-cover"
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
                            ${escapeHtml(song.title)}
                        </div>


                        <div class="artist-name">
                            ${escapeHtml(song.artist)}
                        </div>

                    </div>


                    <div class="song-actions">

                        <button
                            class="favorite-button"
                            onclick="toggleFavoriteFromTop(${index})"
                        >
                            ${
                                isFavorite(song.uri)
                                    ? "❤️"
                                    : "♡"
                            }
                        </button>


                        <button
                            class="spotify-button"
                            onclick="playTopSong(${index})"
                        >
                            ▶ 再生
                        </button>

                    </div>

                `;


                list.appendChild(
                    card
                );

            }
        );


    } catch (error) {

        console.error(
            "TOP曲取得エラー:",
            error
        );


        list.innerHTML = `

            <div class="empty-message">
                TOP曲の取得に失敗しました。
            </div>

        `;

    }

}


function playTopSong(index) {

    const song =
        playlistSongs[index];


    if (!song) {
        return;
    }


    playSingleSongFromList(
        song
    );

}


function toggleFavoriteFromTop(index) {

    const song =
        playlistSongs[index];


    if (!song) {
        return;
    }


    toggleFavorite(
        song
    );


    loadTopTracks();

}


// ==========================================
// 📱 ページ切り替え
// ==========================================

function showPage(pageId) {

    const pages = [

        "homePage",
        "searchPage",
        "favoritesPage",
        "historyPage",
        "topTracksPage",
        "settingsPage"

    ];


    pages.forEach(
        id => {

            const page =
                document.getElementById(id);


            if (!page) {
                return;
            }


            page.classList.toggle(
                "active",
                id === pageId
            );

        }
    );


    document
        .querySelectorAll(
            ".bottom-nav-item"
        )
        .forEach(
            button => {

                button.classList.remove(
                    "active"
                );

            }
        );


    if (pageId === "homePage") {

        document
            .getElementById("homeNav")
            ?.classList.add("active");

    }


    if (pageId === "searchPage") {

        document
            .getElementById("searchNav")
            ?.classList.add("active");

    }


    if (pageId === "favoritesPage") {

        document
            .getElementById("favoritesNav")
            ?.classList.add("active");

        showFavorites();

    }


    if (pageId === "topTracksPage") {

        document
            .getElementById("topTracksNav")
            ?.classList.add("active");

        loadTopTracks();

    }

}


// ==========================================
// 🏠 ホーム
// ==========================================

document
    .getElementById("homeNav")
    ?.addEventListener(
        "click",
        () => {

            showPage(
                "homePage"
            );

        }
    );


// ==========================================
// 🔍 検索
// ==========================================

document
    .getElementById("searchNav")
    ?.addEventListener(
        "click",
        () => {

            showPage(
                "searchPage"
            );

        }
    );


// ==========================================
// ❤️ お気に入り
// ==========================================

document
    .getElementById("favoritesNav")
    ?.addEventListener(
        "click",
        () => {

            showPage(
                "favoritesPage"
            );

        }
    );


// ==========================================
// 🔥 TOP曲
// ==========================================

document
    .getElementById("topTracksNav")
    ?.addEventListener(
        "click",
        () => {

            showPage(
                "topTracksPage"
            );

        }
    );


// ==========================================
// ☰ メニュー
// ==========================================

const menuButton =
    document.getElementById(
        "menuButton"
    );


const sideMenu =
    document.getElementById(
        "sideMenu"
    );


const closeMenu =
    document.getElementById(
        "closeMenu"
    );


const menuOverlay =
    document.getElementById(
        "menuOverlay"
    );


menuButton?.addEventListener(
    "click",
    () => {

        sideMenu?.classList.add(
            "active"
        );

        menuOverlay?.classList.add(
            "active"
        );

    }
);


function closeSideMenu() {

    sideMenu?.classList.remove(
        "active"
    );

    menuOverlay?.classList.remove(
        "active"
    );

}


closeMenu?.addEventListener(
    "click",
    closeSideMenu
);


menuOverlay?.addEventListener(
    "click",
    closeSideMenu
);


// ==========================================
// 🕘 履歴 → メニュー
// ==========================================

document
    .getElementById("historyMenu")
    ?.addEventListener(
        "click",
        () => {

            showPage(
                "historyPage"
            );

            closeSideMenu();

        }
    );


// ==========================================
// ⚙️ 設定 → メニュー
// ==========================================

document
    .getElementById("settingsMenu")
    ?.addEventListener(
        "click",
        () => {

            showPage(
                "settingsPage"
            );

            closeSideMenu();

        }
    );


// ==========================================
// 👤 Spotifyアカウント
// ==========================================

document
    .getElementById(
        "spotifyAccountMenu"
    )
    ?.addEventListener(
        "click",
        () => {

            const token =
                localStorage.getItem(
                    "spotify_access_token"
                );


            if (token) {

                alert(
                    "🎵 Spotifyに接続しています！"
                );

            } else {

                alert(
                    "Spotifyにログインしてください。"
                );


                document
                    .getElementById(
                        "spotifyLogin"
                    )
                    ?.click();

            }


            closeSideMenu();

        }
    );


// ==========================================
// 🎨 テーマ
// ==========================================

const themeOptions =
    document.querySelectorAll(
        ".theme-option"
    );


function applyTheme(theme) {

    document.body.classList.remove(

        "theme-light",
        "theme-dark",
        "theme-pink",
        "theme-blue"

    );


    document.body.classList.add(
        `theme-${theme}`
    );


    localStorage.setItem(
        "music_picker_theme",
        theme
    );


    themeOptions.forEach(
        option => {

            option.classList.toggle(
                "selected",
                option.dataset.theme === theme
            );

        }
    );

}


const savedTheme =
    localStorage.getItem(
        "music_picker_theme"
    );


applyTheme(
    savedTheme || "light"
);


themeOptions.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                applyTheme(
                    button.dataset.theme
                );

            }
        );

    }
);


// ==========================================
// 🎵 Spotifyログイン
// ==========================================

document
    .getElementById("spotifyLogin")
    ?.addEventListener(
        "click",
        () => {

            window.location.href =
                "/auth/login";

        }
    );


// ==========================================
// 🚀 起動
// ==========================================

showPage(
    "homePage"
);