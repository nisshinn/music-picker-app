// ==========================================
// 選択中のアーティスト
// ==========================================
let selectedMood = "";
let selectedGenre = "all";
let selectedArtistId = "";
let selectedArtistName = "";

let previousSongs = [];


// ==========================================
// アーティスト検索
// ==========================================

const artistSearch =
    document.getElementById("artistSearch");

const artistResults =
    document.getElementById("artistResults");

const selectedArtist =
    document.getElementById("selectedArtist");

let searchTimer;


// 入力されたらSpotify検索
artistSearch.addEventListener("input", () => {

    clearTimeout(searchTimer);

    const keyword =
        artistSearch.value.trim();

    if (!keyword) {
        artistResults.innerHTML = "";
        return;
    }

    searchTimer =
        setTimeout(() => {
            searchArtists(keyword);
        }, 400);

});


// ==========================================
// Spotifyからアーティスト検索
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
            throw new Error("Artist search error");
        }

        const artists =
            await response.json();

        artistResults.innerHTML = "";

        if (artists.length === 0) {

            artistResults.innerHTML = `
                <div class="no-results">
                    アーティストが見つかりませんでした
                </div>
            `;

            return;
        }

        artists.forEach(artist => {

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

        });

    } catch (error) {

        console.error(error);

        artistResults.innerHTML = `
            <div class="no-results">
                Spotifyとの通信に失敗しました
            </div>
        `;

    }

}


// ==========================================
// アーティストを選択
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
// 気分選択
// ==========================================

document
    .querySelectorAll(".moods button")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(".moods button")
                    .forEach(b => {

                        b.classList.remove(
                            "selected"
                        );

                    });

                button.classList.add(
                    "selected"
                );

                selectedMood =
                    button.dataset.mood;

            }
        );

    });


// ==========================================
// ジャンル選択
// ==========================================

const genreSelect =
    document.getElementById("genre");

genreSelect.addEventListener(
    "change",
    () => {

        selectedGenre =
            genreSelect.value;

        console.log(
            "選択したジャンル:",
            selectedGenre
        );

    }
);


// ==========================================
// プレイリスト作成
// ==========================================

document
    .getElementById("makePlaylist")
    .addEventListener(
        "click",
        async () => {

            // 気分は必須
            if (!selectedMood) {

                alert(
                    "気分を選んでください！"
                );

                return;
            }


            // ジャンル
            if (!selectedGenre) {

                alert(
                    "ジャンルを選んでください！"
                );

                return;
            }


            const genre =
                selectedGenre;


            const button =
                document.getElementById(
                    "makePlaylist"
                );


            button.disabled = true;

            button.textContent =
                "🎵 Spotifyから曲を取得中...";


            try {

                let songs = [];


                // ======================================
                // アーティストが選択されている場合
                // ======================================

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


                // ======================================
                // アーティストが選択されていない場合
                // ======================================

                else {

                    const response =
                        await fetch(
                            "/api/genre-tracks?genre=" +
                            encodeURIComponent(
                                genre
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


                // ======================================
                // 曲がなかった場合
                // ======================================

                if (
                    !songs ||
                    songs.length === 0
                ) {

                    alert(
                        "曲が見つかりませんでした。"
                    );

                    return;

                }


                // ======================================
                // 前回と同じ曲をできるだけ避ける
                // ======================================

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


                // ======================================
                // シャッフル
                // ======================================

                const shuffled =
                    [...candidates].sort(
                        () =>
                            Math.random() - 0.5
                    );


                const playlist =
                    shuffled.slice(0, 5);


                // ======================================
                // 前回の曲を記録
                // ======================================

                previousSongs =
                    playlist.map(
                        song =>
                            song.title
                    );


                // ======================================
                // 表示するアーティスト名
                // ======================================

                const displayArtist =
                    selectedArtistId
                        ? selectedArtistName
                        : "Spotify";


                showPlaylist(
                    selectedMood,
                    displayArtist,
                    playlist
                );


            } catch (error) {

                console.error(error);

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
// プレイリスト表示
// ==========================================

// ==========================================
// プレイリスト表示
// ==========================================

function showPlaylist(
    mood,
    artist,
    playlist
) {

    const area =
        document.getElementById("playlist");

    // 今再生しているプレイリストを保存
    playlistSongs = playlist;

    area.innerHTML = `

        <div class="playlist-title">

            <h2>
                🎧 Spotifyおすすめ
            </h2>

            <p>
                ${escapeHtml(artist)}
                ×
                ${escapeHtml(mood)}
                のおすすめ5曲
            </p>

            <button
                id="playAllButton"
                class="play-all-button"
            >
                ▶️ 5曲まとめて再生
            </button>

        </div>

        <div class="song-list"></div>

    `;


    const songList =
        area.querySelector(".song-list");


    // ======================================
    // 5曲を表示
    // ======================================

    playlist.forEach(
        (song, index) => {

            const div =
                document.createElement("div");


            div.className =
                "song-card";


            div.dataset.uri =
                song.uri || "";


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


                <a
                    class="spotify-button"
                    href="${song.spotifyUrl}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    🎵 Spotify
                </a>

            `;


            songList.appendChild(div);

        }
    );


    // ======================================
    // 5曲まとめて再生
    // ======================================

    const playAllButton =
        document.getElementById(
            "playAllButton"
        );


    if (playAllButton) {

        playAllButton.addEventListener(
            "click",
            () => {

                playPlaylist(playlist);

            }
        );

    }

}


// ==========================================
// ユーティリティ
// ==========================================

function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text;

    return div.innerHTML;

}


// ==========================================
// Spotifyログイン
// ==========================================

const spotifyLogin =
    document.getElementById(
        "spotifyLogin"
    );


if (spotifyLogin) {

    spotifyLogin.addEventListener(
        "click",
        () => {

            console.log(
                "Spotifyログイン開始"
            );

            window.location.href =
                "/auth/login";

        }
    );

}


// ==========================================
// Spotify Web Playback SDK
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

            console.log(
                "Spotifyアクセストークンなし"
            );


            if (status) {

                status.textContent =
                    "🔴 Spotify未接続";

            }

            return;

        }


        console.log(
            "Spotifyアクセストークン確認"
        );


        spotifyPlayer =
            new Spotify.Player({

                name: "Music Picker",

                volume: 0.5,

                getOAuthToken:
                    function (callback) {

                        callback(token);

                    }

            });


        // ==========================================
        // 接続成功
        // ==========================================

        spotifyPlayer.addListener(
            "ready",
            function ({ device_id }) {

                console.log(
                    "Spotify接続成功！"
                );

                console.log(
                    "Device ID:",
                    device_id
                );


                spotifyDeviceId =
                    device_id;


                const status =
                    document.getElementById(
                        "spotifyStatus"
                    );


                if (status) {

                    status.textContent =
                        "🟢 Spotify接続中";

                }

            }
        );


        // ==========================================
        // 接続解除
        // ==========================================

        spotifyPlayer.addListener(
            "not_ready",
            function ({ device_id }) {

                console.log(
                    "Spotify接続解除:",
                    device_id
                );


                const status =
                    document.getElementById(
                        "spotifyStatus"
                    );


                if (status) {

                    status.textContent =
                        "🔴 Spotify未接続";

                }

            }
        );


        // ==========================================
        // 認証エラー
        // ==========================================

        spotifyPlayer.addListener(
            "authentication_error",
            function ({ message }) {

                console.error(
                    "Spotify認証エラー:",
                    message
                );

            }
        );


        // ==========================================
        // Premiumなどのアカウントエラー
        // ==========================================

        spotifyPlayer.addListener(
            "account_error",
            function ({ message }) {

                console.error(
                    "Spotifyアカウントエラー:",
                    message
                );

            }
        );


        // ==========================================
        // 初期化エラー
        // ==========================================

        spotifyPlayer.addListener(
            "initialization_error",
            function ({ message }) {

                console.error(
                    "Spotify初期化エラー:",
                    message
                );

            }
        );


        // ==========================================
        // 再生エラー
        // ==========================================

        spotifyPlayer.addListener(
            "playback_error",
            function ({ message }) {

                console.error(
                    "Spotify再生エラー:",
                    message
                );

            }
        );


        // ==========================================
        // ★再生状況
        // ==========================================

spotifyPlayer.addListener(
    "player_state_changed",
    function (state) {

        const panel =
            document.getElementById("playerPanel");

        if (!state) {

            // 再生状態がない → 非表示
            if (panel) {
                panel.classList.remove("show");
            }

            return;
        }


        const track =
            state.track_window.current_track;


        if (!track) {
            return;
        }


        // ======================================
        // プレイヤーを表示
        // ======================================

        if (panel) {
            panel.classList.add("show");
        }


        // 曲名
        const title =
            document.getElementById("playerTitle");

        if (title) {
            title.textContent =
                track.name;
        }


        // アーティスト
        const artist =
            document.getElementById("playerArtist");

        if (artist) {
            artist.textContent =
                track.artists
                    .map(a => a.name)
                    .join(", ");
        }


        // ジャケット
        const image =
            document.getElementById("playerImage");

        if (image) {

            image.src =
                track.album.images?.[0]?.url || "";

        }


        // 再生 / 一時停止ボタン
        const playButton =
            document.getElementById("playerPlay");

        if (playButton) {

            playButton.textContent =
                state.paused
                    ? "▶"
                    : "Ⅱ";

        }


        // 再生状態
        const status =
            document.getElementById("playerStatus");

        if (status) {

            status.textContent =
                state.paused
                    ? "一時停止中"
                    : "▶ 再生中";

        }


        // プログレスバー
        updatePlayerProgress(state);


        // 何曲目か
        updatePlaylistPosition(track);

    }
);
setInterval(async () => {

    if (!spotifyPlayer) {
        return;
    }

    try {

        const state =
            await spotifyPlayer.getCurrentState();

        const panel =
            document.getElementById("playerPanel");


        if (!state) {

            if (panel) {
                panel.classList.remove("show");
            }

            return;
        }


        // 再生中なら表示
        if (panel) {
            panel.classList.add("show");
        }


        updatePlayerProgress(state);

    } catch (error) {

        console.error(
            "プレイヤー状態取得エラー:",
            error
        );

    }

}, 500);


        // ==========================================
        // Spotify Player接続
        // ==========================================

        spotifyPlayer
            .connect()
            .then(
                function (success) {

                    console.log(
                        "Spotify Player connect:",
                        success
                    );

                }
            );

    };


// ==========================================
// 5曲プレイリスト
// ==========================================

let playlistSongs = [];


// ==========================================
// 5曲まとめて再生
// ==========================================

async function playPlaylist(songs) {

    if (
        !spotifyPlayer ||
        !spotifyDeviceId
    ) {

        alert(
            "Spotifyが接続されていません！"
        );

        return;

    }


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


    // プレイリストを保存
    playlistSongs =
        songs;


    // Spotify URIを取得
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
                `https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`,
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
                            uris: uris
                        })

                }
            );


        if (!response.ok) {

            const errorText =
                await response.text();

            console.error(
                "再生エラー:",
                errorText
            );


            alert(
                "Spotifyで再生できませんでした！"
            );

            return;

        }


        console.log(
            "🎵 5曲のプレイリストを再生開始！"
        );


    } catch (error) {

        console.error(
            "再生エラー:",
            error
        );


        alert(
            "再生中にエラーが発生しました！"
        );

    }

}


// ==========================================
// 再生状況の更新
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
        !duration
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
// 時間を 0:00 に変換
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
        `${minutes}:` +
        `${String(seconds).padStart(2, "0")}`
    );

}


// ==========================================
// 何曲目か表示
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

        const playingText =
            "▶ 再生中";

        status.textContent =
            `${playingText}　${index + 1} / ${playlistSongs.length}曲`;

    }

}


// ==========================================
// 再生 / 一時停止ボタン
// ==========================================

const playerPlay =
    document.getElementById(
        "playerPlay"
    );


if (playerPlay) {

    playerPlay.addEventListener(
        "click",
        () => {

            if (!spotifyPlayer) {
                return;
            }


            spotifyPlayer.togglePlay();

        }
    );

}


// ==========================================
// 前の曲
// ==========================================

const playerPrev =
    document.getElementById(
        "playerPrev"
    );


if (playerPrev) {

    playerPrev.addEventListener(
        "click",
        () => {

            if (!spotifyPlayer) {
                return;
            }


            spotifyPlayer.previousTrack();

        }
    );

}


// ==========================================
// 次の曲
// ==========================================

const playerNext =
    document.getElementById(
        "playerNext"
    );


if (playerNext) {

    playerNext.addEventListener(
        "click",
        () => {

            if (!spotifyPlayer) {
                return;
            }


            spotifyPlayer.nextTrack();

        }
    );

}


// ==========================================
// 再生バーをクリックして曲の位置変更
// ==========================================

const playerProgress =
    document.getElementById(
        "playerProgress"
    );


if (playerProgress) {

    playerProgress.addEventListener(
        "input",
        () => {

            if (!spotifyPlayer) {
                return;
            }


            const position =
                Number(
                    playerProgress.value
                );


            spotifyPlayer.seek(
                position
            );

        }
    );

}