// ============================================================
// Music Picker - script.js 完全版
// ============================================================

// ============================================================
// グローバル変数
// ============================================================

let selectedMood = "";
let selectedGenre = "all";

let selectedArtistId = "";
let selectedArtistName = "";

let previousSongs = [];

let currentPlaylist = [];
let currentTrackIndex = 0;

let isPlaylistMode = false;
let isChangingTrack = false;

let spotifyPlayer = null;
let spotifyDeviceId = "";
let spotifyToken = "";

let searchRequestId = 0;
let playbackRequestId = 0;


// ============================================================
// 初期設定
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    console.log("Music Picker 起動");

    initHomePage();
    initGlobalEvents();
    initTheme();
    initSettingsPage();
    initAccountPage();
    initTopTracksPage();

    // Spotify SDKがすでに読み込まれている場合
    if (window.Spotify) {
        console.log("Spotify SDK 読み込み済み");
        setupSpotifyPlayer();
    } else {
        console.log("Spotify SDKを待っています...");
    }
});


// ============================================================
// Spotify Web Playback SDK
// ============================================================

// SDKが読み込まれたときに呼ばれる
window.onSpotifyWebPlaybackSDKReady = function () {
    console.log("Spotify Web Playback SDK 準備完了");
    setupSpotifyPlayer();
};


// ============================================================
// ホーム画面
// ============================================================

function initHomePage() {

    const moodButtons = document.querySelectorAll(".moods button");
    const genre = document.getElementById("genre");

    const artistSearch = document.getElementById("artistSearch");
    const artistResults = document.getElementById("artistResults");
    const selectedArtist = document.getElementById("selectedArtist");

    const makePlaylistButton = document.getElementById("makePlaylist");

    // --------------------------------------------------------
    // 気分
    // --------------------------------------------------------

    moodButtons.forEach(button => {

        button.addEventListener("click", () => {

            moodButtons.forEach(btn => {
                btn.classList.remove("selected");
            });

            button.classList.add("selected");

            selectedMood = button.dataset.mood || button.textContent.trim();

            console.log("選択した気分:", selectedMood);
        });

    });


    // --------------------------------------------------------
    // ジャンル
    // --------------------------------------------------------

    if (genre) {

        genre.addEventListener("change", () => {

            selectedGenre = genre.value;

            console.log("選択したジャンル:", selectedGenre);

            // ★ここではアーティストを消さない
            // アーティスト + ジャンルを組み合わせて使えるようにする
        });

    }


    // --------------------------------------------------------
    // アーティスト検索
    // --------------------------------------------------------

    if (artistSearch) {

        artistSearch.addEventListener("input", async () => {

            const keyword = artistSearch.value.trim();

            // 新しい検索として扱う
            const requestId = ++searchRequestId;

            // 入力した場合は、以前のアーティスト選択を解除
            if (keyword.length > 0) {

                selectedArtistId = "";
                selectedArtistName = "";

                if (selectedArtist) {
                    selectedArtist.innerHTML = "";
                    selectedArtist.style.display = "none";
                }
            }


            if (!keyword) {

                if (artistResults) {
                    artistResults.innerHTML = "";
                }

                return;
            }


            if (keyword.length < 1) {
                return;
            }


            if (artistResults) {
                artistResults.innerHTML =
                    `<div class="loading">アーティストを検索中...</div>`;
            }


            try {

                const response = await fetch(
                    `/api/artists?q=${encodeURIComponent(keyword)}`
                );

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const artists = await response.json();


                // 古い検索結果だったら無視
                if (requestId !== searchRequestId) {
                    return;
                }


                if (!Array.isArray(artists) || artists.length === 0) {

                    artistResults.innerHTML =
                        `<div class="no-results">アーティストが見つかりません</div>`;

                    return;
                }


                artistResults.innerHTML = "";


                artists.forEach(artist => {

                    if (!artist || !artist.id) {
                        return;
                    }


                    const item = document.createElement("div");

                    item.className = "artist-result";


                    const image = document.createElement("img");

                    image.src =
                        artist.image ||
                        artist.images?.[0]?.url ||
                        "";

                    image.alt = artist.name || "artist";

                    image.onerror = () => {
                        image.style.display = "none";
                    };


                    const name = document.createElement("span");

                    name.textContent = artist.name || "名前なし";


                    item.appendChild(image);
                    item.appendChild(name);


                    // ★クリックイベントをここで直接設定
                    item.addEventListener("click", () => {

                        selectedArtistId = artist.id;
                        selectedArtistName = artist.name || "";

                        console.log(
                            "アーティスト選択:",
                            selectedArtistName,
                            selectedArtistId
                        );


                        // 選択表示
                       if (selectedArtist) {

    const artistImage =
        artist.image ||
        artist.images?.[0]?.url ||
        "";

    selectedArtist.innerHTML = `
        <div class="selected-artist-card">

            <img
                class="selected-artist-image"
                src="${escapeHtml(artistImage)}"
                alt="${escapeHtml(selectedArtistName)}"
            >

            <div class="selected-artist-info">
                <strong>${escapeHtml(selectedArtistName)}</strong>
                <span class="selected-check">✓ 選択中</span>
            </div>

        </div>
    `;

    selectedArtist.style.display = "block";


    // 画像がない場合
    const selectedImage =
        selectedArtist.querySelector(
            ".selected-artist-image"
        );

    if (selectedImage) {

        selectedImage.onerror = () => {

            selectedImage.style.display = "none";

        };

    }
}


                        // 検索結果を消す
                        artistResults.innerHTML = "";

                        // ★valueを直接変更するだけなので
                        // inputイベントは発生しない
                        // → 選択したアーティストが勝手に消えない
                        artistSearch.value = "";
                    });


                    artistResults.appendChild(item);
                });


            } catch (error) {

                console.error("アーティスト検索エラー:", error);

                if (requestId !== searchRequestId) {
                    return;
                }

                artistResults.innerHTML =
                    `<div class="error-message">検索に失敗しました</div>`;
            }

        });

    }


    // --------------------------------------------------------
    // プレイリスト作成
    // --------------------------------------------------------

    if (makePlaylistButton) {

        makePlaylistButton.addEventListener("click", async () => {

            if (!selectedMood) {

                alert("気分を選んでください！");

                return;
            }


            const originalText = makePlaylistButton.textContent;

            makePlaylistButton.disabled = true;
            makePlaylistButton.textContent = "🎵 曲を探しています...";


            try {

                let tracks = [];


                // ------------------------------------------------
                // アーティスト選択済み
                // ------------------------------------------------

                if (selectedArtistId) {

                    console.log(
                        "アーティストの曲を取得:",
                        selectedArtistName
                    );


                    const response = await fetch(
                        `/api/artist-tracks?id=${encodeURIComponent(selectedArtistId)}`
                    );


                    if (!response.ok) {

                        let errorText = "";

                        try {
                            const errorData = await response.json();
                            errorText = errorData.error || "";
                        } catch (_) {}

                        throw new Error(
                            errorText || `HTTP ${response.status}`
                        );
                    }


                    tracks = await response.json();


                    // ★念のため選択アーティスト以外を完全除外
                    tracks = tracks.filter(track => {

                        if (!track) {
                            return false;
                        }


                        if (track.artistId) {
                            return track.artistId === selectedArtistId;
                        }


                        if (Array.isArray(track.artists)) {

                            return track.artists.some(
                                artist =>
                                    artist &&
                                    artist.id === selectedArtistId
                            );
                        }


                        return false;
                    });

                }


                // ------------------------------------------------
                // アーティスト未選択 → ジャンル
                // ------------------------------------------------

                else {

                    if (!selectedGenre || selectedGenre === "all") {

                        alert("アーティストかジャンルを選んでください！");

                        return;
                    }


                    console.log(
                        "ジャンルの曲を取得:",
                        selectedGenre
                    );


                    const response = await fetch(
                        `/api/genre-tracks?genre=${encodeURIComponent(selectedGenre)}`
                    );


                    if (!response.ok) {

                        let errorText = "";

                        try {
                            const errorData = await response.json();
                            errorText = errorData.error || "";
                        } catch (_) {}

                        throw new Error(
                            errorText || `HTTP ${response.status}`
                        );
                    }


                    tracks = await response.json();
                }


                // ------------------------------------------------
                // 曲を整える
                // ------------------------------------------------

                tracks = tracks
                    .map(normalizeTrack)
                    .filter(track => track && track.uri);


                // 重複削除
                const uniqueTracks = [];

                const usedUris = new Set();

                for (const track of tracks) {

                    if (usedUris.has(track.uri)) {
                        continue;
                    }

                    usedUris.add(track.uri);

                    uniqueTracks.push(track);
                }


                tracks = uniqueTracks;


                if (tracks.length === 0) {

                    alert(
                        selectedArtistName
                            ? `${selectedArtistName} の曲が見つかりませんでした。`
                            : "曲が見つかりませんでした。"
                    );

                    return;
                }


                // ------------------------------------------------
                // シャッフル
                // ------------------------------------------------

                shuffleArray(tracks);


                // 前回と同じ曲ばかりにならないようにする
                let newTracks = tracks.filter(
                    track => !previousSongs.includes(track.uri)
                );


                // 足りなければ元の候補から補充
                if (newTracks.length < 5) {

                    const additionalTracks = tracks.filter(
                        track => !newTracks.includes(track)
                    );

                    newTracks.push(...additionalTracks);
                }


                // 5曲
                const playlist = newTracks.slice(0, 5);


                if (playlist.length === 0) {

                    alert("曲を取得できませんでした。");

                    return;
                }


                // 保存
                currentPlaylist = playlist;
                currentTrackIndex = 0;

                isPlaylistMode = false;


                previousSongs = playlist.map(
                    track => track.uri
                );


                // localStorageにも履歴保存
                saveToHistory(playlist);


                // 表示
                displayPlaylist(playlist);


                console.log(
                    "作成したプレイリスト:",
                    playlist
                );


            } catch (error) {

                console.error(
                    "プレイリスト作成エラー:",
                    error
                );


                if (
                    String(error.message).includes("429") ||
                    String(error.message).includes("QUOTA")
                ) {

                    alert(
                        "Spotify APIの利用上限に達しています。\n" +
                        "少し時間を置いてからもう一度試してください。"
                    );

                } else {

                    alert(
                        "曲を取得できませんでした。\n" +
                        error.message
                    );
                }


            } finally {

                makePlaylistButton.disabled = false;

                makePlaylistButton.textContent = originalText;
            }

        });

    }

}


// ============================================================
// プレイリスト表示
// ============================================================

function displayPlaylist(playlist) {

    const playlistContainer =
        document.getElementById("playlist");

    if (!playlistContainer) {
        return;
    }


    playlistContainer.innerHTML = "";


    // --------------------------------------------------------
    // タイトル
    // --------------------------------------------------------

    const header = document.createElement("div");

    header.className = "playlist-header";


    const title = document.createElement("h2");

    title.textContent = "🎵 あなたへのおすすめ";


    header.appendChild(title);


    // --------------------------------------------------------
    // まとめて再生
    // --------------------------------------------------------

    const playAllButton = document.createElement("button");

    playAllButton.id = "playAllButton";

    playAllButton.className = "play-all-button";

    playAllButton.textContent = "▶ まとめて再生";


    playAllButton.addEventListener("click", async () => {

        if (!currentPlaylist.length) {
            return;
        }


        currentTrackIndex = 0;

        isPlaylistMode = true;


        await playTrack(
            currentPlaylist[0],
            0,
            true
        );

    });


    header.appendChild(playAllButton);

    playlistContainer.appendChild(header);


    // --------------------------------------------------------
    // 曲一覧
    // --------------------------------------------------------

    playlist.forEach((track, index) => {

        const card =
            createPlaylistTrackCard(track, index);

        playlistContainer.appendChild(card);
    });

}


// ============================================================
// プレイリスト曲カード
// ============================================================

function createPlaylistTrackCard(track, index) {

    const card = document.createElement("div");

    card.className = "track-card";


    // --------------------------------------------------------
    // アートワーク
    // --------------------------------------------------------

    const image = document.createElement("img");

    image.className = "track-image";

    image.src =
        track.image ||
        track.album?.images?.[0]?.url ||
        "";

    image.alt = track.title || "曲";

    image.onerror = () => {
        image.style.visibility = "hidden";
    };


    // --------------------------------------------------------
    // 曲情報
    // --------------------------------------------------------

    const info = document.createElement("div");

    info.className = "track-info";


    const title = document.createElement("div");

    title.className = "track-title";

    title.textContent =
        track.title || track.name || "曲名なし";


    const artist = document.createElement("div");

    artist.className = "track-artist";

    artist.textContent =
        getArtistText(track);


    info.appendChild(title);

    info.appendChild(artist);


    // --------------------------------------------------------
    // 操作部分
    // --------------------------------------------------------

    const actions = document.createElement("div");

    actions.className = "track-actions";


    // 再生ボタン
    const playButton = document.createElement("button");

    playButton.className = "track-play-button";

    playButton.textContent = "▶";


    playButton.addEventListener("click", async (event) => {

        event.stopPropagation();

        currentPlaylist = normalizeTracks(currentPlaylist);

        currentTrackIndex = index;

        isPlaylistMode = false;

        await playTrack(
            track,
            index,
            false
        );

    });


    // お気に入り
    const favoriteButton = document.createElement("button");

    favoriteButton.className =
        "favorite-button";


    updateFavoriteButton(
        favoriteButton,
        track
    );


    favoriteButton.addEventListener("click", event => {

        event.stopPropagation();

        toggleFavorite(track);

        updateFavoriteButton(
            favoriteButton,
            track
        );

    });


    // Spotify
    const spotifyButton = document.createElement("a");

    spotifyButton.className =
        "spotify-button";

    spotifyButton.target = "_blank";

    spotifyButton.rel = "noopener noreferrer";

    spotifyButton.textContent =
        "Spotify";


    spotifyButton.href =
        track.spotifyUrl ||
        `https://open.spotify.com/track/${track.id}`;


    spotifyButton.addEventListener(
        "click",
        event => event.stopPropagation()
    );


    actions.appendChild(playButton);

    actions.appendChild(favoriteButton);

    actions.appendChild(spotifyButton);


    card.appendChild(image);

    card.appendChild(info);

    card.appendChild(actions);


    // カード本体クリックでも再生
    card.addEventListener("click", async () => {

        currentPlaylist = normalizeTracks(currentPlaylist);

        currentTrackIndex = index;

        isPlaylistMode = false;

        await playTrack(
            track,
            index,
            false
        );

    });


    return card;
}


// ============================================================
// Spotifyで曲を再生
// ============================================================

async function playTrack(
    track,
    index = 0,
    playlistMode = false
) {

    const requestId = ++playbackRequestId;


    track = normalizeTrack(track);


    if (!track || !track.uri) {

        alert("再生できる曲ではありません。");

        return;
    }


    // --------------------------------------------------------
    // プレイリスト状態を保存
    // --------------------------------------------------------

    if (playlistMode) {

        currentPlaylist =
            normalizeTracks(currentPlaylist);

        currentTrackIndex = index;

        isPlaylistMode = true;

    } else {

        currentPlaylist = [track];

        currentTrackIndex = 0;

        isPlaylistMode = false;
    }


    // --------------------------------------------------------
    // Spotifyログイン確認
    // --------------------------------------------------------

    spotifyToken =
        localStorage.getItem("spotify_access_token") || "";


    if (!spotifyToken) {

        alert(
            "Spotifyにログインしてください。"
        );

        return;
    }


    // --------------------------------------------------------
    // Spotify Player準備
    // --------------------------------------------------------

    if (!spotifyPlayer) {

        setupSpotifyPlayer();
    }


    // デバイスが準備されるまで待つ
    const hasDevice =
        await waitForSpotifyDevice(8000);


    if (requestId !== playbackRequestId) {
        return;
    }


    if (!hasDevice || !spotifyDeviceId) {

        alert(
            "Spotifyプレイヤーがまだ準備できていません。\n" +
            "Spotifyにログインして、もう一度再生してください。"
        );

        return;
    }


    try {

        isChangingTrack = true;


        // ブラウザの自動再生制限対策
        if (spotifyPlayer.activateElement) {

            try {
                await spotifyPlayer.activateElement();
            } catch (error) {
                console.log(
                    "activateElement:",
                    error
                );
            }
        }


        // ----------------------------------------------------
        // 現在のWeb Playback Playerへ転送
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
                        device_ids: [spotifyDeviceId],
                        play: false
                    })
                }
            );


        if (
            !transferResponse.ok &&
            transferResponse.status !== 204
        ) {

            const errorText =
                await readSpotifyError(
                    transferResponse
                );

            throw new Error(
                `再生先の切り替えに失敗しました: ${errorText}`
            );
        }


        // 少し待つ
        await sleep(300);


        if (requestId !== playbackRequestId) {
            return;
        }


        // ----------------------------------------------------
        // 再生するURI
        // ----------------------------------------------------

        let uris = [track.uri];


        // ★まとめて再生
        // Spotify側に複数曲を一度に渡す
        // → JSで無理やり次の曲へ移動する必要がない
        if (
            playlistMode &&
            currentPlaylist.length > 0
        ) {

            uris =
                currentPlaylist
                    .slice(index)
                    .map(item => normalizeTrack(item))
                    .filter(item => item && item.uri)
                    .map(item => item.uri);


            if (uris.length === 0) {
                uris = [track.uri];
            }
        }


        console.log(
            "Spotify再生:",
            uris
        );


        // ----------------------------------------------------
        // 再生開始
        // ----------------------------------------------------

        const playResponse =
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


        if (!playResponse.ok) {

            const errorText =
                await readSpotifyError(
                    playResponse
                );


            if (playResponse.status === 401) {

                throw new Error(
                    "Spotifyのログイン情報が期限切れです。もう一度ログインしてください。"
                );
            }


            if (playResponse.status === 403) {

                throw new Error(
                    "Spotifyの再生権限がありません。Premiumアカウントと再生権限を確認してください。"
                );
            }


            throw new Error(
                `Spotify再生エラー (${playResponse.status}): ${errorText}`
            );
        }


        // ----------------------------------------------------
        // プレイヤー表示
        // ----------------------------------------------------

        showPlayerPanel();

        updatePlayerInfo(track);


    } catch (error) {

        console.error(
            "Spotify再生エラー:",
            error
        );


        alert(
            "曲を再生できませんでした。\n\n" +
            error.message
        );


    } finally {

        isChangingTrack = false;
    }

}


// ============================================================
// Spotifyデバイスが準備されるまで待つ
// ============================================================

async function waitForSpotifyDevice(
    timeout = 8000
) {

    if (spotifyDeviceId) {
        return true;
    }


    const startTime = Date.now();


    while (
        !spotifyDeviceId &&
        Date.now() - startTime < timeout
    ) {

        await sleep(250);

        if (!spotifyPlayer) {
            setupSpotifyPlayer();
        }
    }


    return !!spotifyDeviceId;
}


// ============================================================
// Spotify Playerセットアップ
// ============================================================

function setupSpotifyPlayer() {

    if (spotifyPlayer) {
        return;
    }


    if (!window.Spotify) {

        console.log(
            "Spotify SDKがまだ読み込まれていません。"
        );

        return;
    }


    spotifyToken =
        localStorage.getItem("spotify_access_token") || "";


    if (!spotifyToken) {

        console.log(
            "Spotifyアクセストークンがありません。"
        );

        return;
    }


    console.log(
        "Spotify Playerを作成します。"
    );


    createSpotifyPlayer();
}


// ============================================================
// Spotify Player作成
// ============================================================

function createSpotifyPlayer() {

    if (spotifyPlayer) {
        return;
    }


    spotifyPlayer =
        new Spotify.Player({

            name: "Music Picker",

            getOAuthToken: callback => {

                const token =
                    localStorage.getItem(
                        "spotify_access_token"
                    ) || "";

                spotifyToken = token;

                callback(token);
            },

            volume: getSavedVolume()
        });


    // --------------------------------------------------------
    // Player準備完了
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // デバイスが使用不可
    // --------------------------------------------------------

    spotifyPlayer.addListener(
        "not_ready",
        ({ device_id }) => {

            console.log(
                "Spotify Player Not Ready:",
                device_id
            );


            if (spotifyDeviceId === device_id) {
                spotifyDeviceId = "";
            }


            showSpotifyStatus(
                "Spotify未接続"
            );
        }
    );


    // --------------------------------------------------------
    // 再生状態
    // --------------------------------------------------------

    spotifyPlayer.addListener(
        "player_state_changed",
        state => {

            if (!state) {
                return;
            }


            updatePlayerState(state);


            // 現在の曲を特定
            const currentTrack =
                state.track_window?.current_track;


            if (currentTrack) {

                const currentUri =
                    currentTrack.uri;


                const index =
                    currentPlaylist.findIndex(
                        track =>
                            track &&
                            track.uri === currentUri
                    );


                if (index >= 0) {

                    currentTrackIndex =
                        index;
                }


                updatePlayerInfo(
                    normalizeTrack(
                        currentTrack
                    )
                );
            }


            // ------------------------------------------------
            // 最後の曲まで終わったらモード解除
            // ------------------------------------------------

            if (
                isPlaylistMode &&
                state.paused &&
                state.duration > 0 &&
                state.position >= state.duration - 500
            ) {

                const currentUri =
                    state.track_window
                        ?.current_track
                        ?.uri;


                const index =
                    currentPlaylist.findIndex(
                        track =>
                            track.uri === currentUri
                    );


                if (
                    index >= 0 &&
                    index === currentPlaylist.length - 1
                ) {

                    isPlaylistMode = false;
                }
            }

        }
    );


    // --------------------------------------------------------
    // 自動再生失敗
    // --------------------------------------------------------

    spotifyPlayer.addListener(
        "autoplay_failed",
        () => {

            console.log(
                "Spotify autoplay failed"
            );


            showSpotifyStatus(
                "再生ボタンをもう一度押してください"
            );
        }
    );


    // --------------------------------------------------------
    // 初期化エラー
    // --------------------------------------------------------

    spotifyPlayer.addListener(
        "initialization_error",
        ({ message }) => {

            console.error(
                "Spotify initialization error:",
                message
            );


            showSpotifyStatus(
                "Spotify Player初期化エラー"
            );
        }
    );


    // --------------------------------------------------------
    // 認証エラー
    // --------------------------------------------------------

    spotifyPlayer.addListener(
        "authentication_error",
        ({ message }) => {

            console.error(
                "Spotify authentication error:",
                message
            );


            showSpotifyStatus(
                "Spotify認証エラー"
            );
        }
    );


    // --------------------------------------------------------
    // アカウントエラー
    // --------------------------------------------------------

    spotifyPlayer.addListener(
        "account_error",
        ({ message }) => {

            console.error(
                "Spotify account error:",
                message
            );


            showSpotifyStatus(
                "Spotify Premiumが必要です"
            );
        }
    );


    // --------------------------------------------------------
    // 再生エラー
    // --------------------------------------------------------

    spotifyPlayer.addListener(
        "playback_error",
        ({ message }) => {

            console.error(
                "Spotify playback error:",
                message
            );


            showSpotifyStatus(
                "Spotify再生エラー"
            );
        }
    );


    // --------------------------------------------------------
    // 接続
    // --------------------------------------------------------

    spotifyPlayer.connect()
        .then(success => {

            console.log(
                "Spotify Player connect:",
                success
            );

        })
        .catch(error => {

            console.error(
                "Spotify Player connect error:",
                error
            );
        });

}


// ============================================================
// プレイヤー表示
// ============================================================

function showPlayerPanel() {

    const panel =
        document.getElementById("playerPanel");


    if (!panel) {
        return;
    }


    panel.style.display = "block";


    setupVolumeControl();
}


// ============================================================
// プレイヤー情報更新
// ============================================================

function updatePlayerInfo(track) {

    if (!track) {
        return;
    }


    const title =
        document.getElementById("playerTitle");


    const artist =
        document.getElementById("playerArtist");


    const image =
        document.getElementById("playerImage");


    if (title) {

        title.textContent =
            track.title ||
            track.name ||
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

        image.alt =
            track.title || "曲";
    }

}


// ============================================================
// 再生状態UI
// ============================================================

function updatePlayerState(state) {

    const playPauseButton =
        document.getElementById(
            "playPauseButton"
        );


    if (playPauseButton) {

        playPauseButton.textContent =
            state.paused
                ? "▶"
                : "⏸";
    }


    const progressBar =
        document.getElementById(
            "progressBar"
        );


    if (progressBar && state.duration > 0) {

        progressBar.max =
            state.duration;

        progressBar.value =
            state.position;
    }


    const currentTime =
        document.getElementById(
            "currentTime"
        );


    const duration =
        document.getElementById(
            "duration"
        );


    if (currentTime) {

        currentTime.textContent =
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
            "再生/一時停止エラー:",
            error
        );
    }

}


// ============================================================
// 次の曲
// ============================================================

async function playNext() {

    if (
        !currentPlaylist ||
        currentPlaylist.length === 0
    ) {

        return;
    }


    let nextIndex =
        currentTrackIndex + 1;


    if (
        nextIndex >=
        currentPlaylist.length
    ) {

        nextIndex = 0;
    }


    currentTrackIndex =
        nextIndex;


    const track =
        currentPlaylist[nextIndex];


    if (!track) {
        return;
    }


    isPlaylistMode = true;


    await playTrack(
        track,
        nextIndex,
        true
    );
}


// ============================================================
// 前の曲
// ============================================================

async function playPrevious() {

    if (
        !currentPlaylist ||
        currentPlaylist.length === 0
    ) {

        return;
    }


    let previousIndex =
        currentTrackIndex - 1;


    if (previousIndex < 0) {

        previousIndex =
            currentPlaylist.length - 1;
    }


    currentTrackIndex =
        previousIndex;


    const track =
        currentPlaylist[previousIndex];


    if (!track) {
        return;
    }


    isPlaylistMode = true;


    await playTrack(
        track,
        previousIndex,
        true
    );
}


// ============================================================
// シーク
// ============================================================

async function seekPlayback(value) {

    if (!spotifyPlayer) {
        return;
    }


    const position =
        Number(value);


    if (!Number.isFinite(position)) {
        return;
    }


    try {

        await spotifyPlayer.seek(
            position
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


    const savedVolume =
        getSavedVolume();


    volumeBar.value =
        Math.round(savedVolume * 100);


    if (volumeValue) {

        volumeValue.textContent =
            `${volumeBar.value}%`;
    }


    // oninputなのでイベント重複なし
    volumeBar.oninput = async () => {

        const volume =
            Number(volumeBar.value) / 100;


        localStorage.setItem(
            "spotify_volume",
            String(volume)
        );


        if (volumeValue) {

            volumeValue.textContent =
                `${volumeBar.value}%`;
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


// ============================================================
// 保存音量
// ============================================================

function getSavedVolume() {

    const value =
        Number(
            localStorage.getItem(
                "spotify_volume"
            )
        );


    if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1
    ) {

        return 0.5;
    }


    return value;
}


// ============================================================
// 保存音量を適用
// ============================================================

async function applySavedVolume() {

    if (!spotifyPlayer) {
        return;
    }


    const volume =
        getSavedVolume();


    try {

        await spotifyPlayer.setVolume(
            volume
        );

    } catch (error) {

        console.error(
            "保存音量適用エラー:",
            error
        );
    }


    setupVolumeControl();
}


// ============================================================
// Spotify接続状態
// ============================================================

function showSpotifyStatus(text) {

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
// グローバルイベント
// ============================================================

function initGlobalEvents() {

    // --------------------------------------------------------
    // 再生ボタン
    // --------------------------------------------------------

    document.addEventListener(
        "click",
        event => {

            const target =
                event.target.closest(
                    "#playPauseButton"
                );


            if (!target) {
                return;
            }


            togglePlayback();
        }
    );


    // --------------------------------------------------------
    // 前の曲
    // --------------------------------------------------------

    document.addEventListener(
        "click",
        event => {

            const target =
                event.target.closest(
                    "#previousButton"
                );


            if (!target) {
                return;
            }


            playPrevious();
        }
    );


    // --------------------------------------------------------
    // 次の曲
    // --------------------------------------------------------

    document.addEventListener(
        "click",
        event => {

            const target =
                event.target.closest(
                    "#nextButton"
                );


            if (!target) {
                return;
            }


            playNext();
        }
    );


    // --------------------------------------------------------
    // プログレスバー
    // --------------------------------------------------------

    document.addEventListener(
        "input",
        event => {

            if (
                event.target.id !==
                "progressBar"
            ) {

                return;
            }


            const value =
                Number(event.target.value);


            const currentTime =
                document.getElementById(
                    "currentTime"
                );


            if (currentTime) {

                currentTime.textContent =
                    formatTime(value);
            }

        }
    );


    document.addEventListener(
        "change",
        event => {

            if (
                event.target.id !==
                "progressBar"
            ) {

                return;
            }


            seekPlayback(
                event.target.value
            );
        }
    );

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

    } catch (error) {

        console.error(
            "お気に入り読み込みエラー:",
            error
        );

        return [];
    }

}


// ============================================================
// お気に入り切り替え
// ============================================================

function toggleFavorite(track) {

    const favorites =
        getFavorites();


    const index =
        favorites.findIndex(
            item => item.uri === track.uri
        );


    if (index >= 0) {

        favorites.splice(
            index,
            1
        );

        console.log(
            "お気に入り解除:",
            track.title
        );

    } else {

        favorites.push(
            normalizeTrack(track)
        );

        console.log(
            "お気に入り追加:",
            track.title
        );
    }


    localStorage.setItem(
        "music_picker_favorites",
        JSON.stringify(favorites)
    );


    updateFavoritesPage();
}


// ============================================================
// お気に入りボタン表示
// ============================================================

function updateFavoriteButton(
    button,
    track
) {

    if (!button) {
        return;
    }


    const favorites =
        getFavorites();


    const isFavorite =
        favorites.some(
            item => item.uri === track.uri
        );


    if (isFavorite) {

        button.textContent = "❤️";

        button.classList.add(
            "favorite-active"
        );

        button.title =
            "お気に入りから削除";

    } else {

        button.textContent = "♡";

        button.classList.remove(
            "favorite-active"
        );

        button.title =
            "お気に入りに追加";
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


    if (favorites.length === 0) {

        container.innerHTML =
            `<p>お気に入りはまだありません。</p>`;

        return;
    }


    favorites.forEach(track => {

        container.appendChild(
            createTrackElement(track)
        );

    });

}


// ============================================================
// 共通曲カード
// ============================================================

function createTrackElement(track) {

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
        track.title || "曲";


    image.onerror = () => {
        image.style.visibility =
            "hidden";
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
        track.title ||
        "曲名なし";


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


    const playButton =
        document.createElement("button");


    playButton.className =
        "track-play-button";


    playButton.textContent =
        "▶";


    playButton.addEventListener(
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


    const favoriteButton =
        document.createElement("button");


    favoriteButton.className =
        "favorite-button";


    updateFavoriteButton(
        favoriteButton,
        track
    );


    favoriteButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            toggleFavorite(track);

            updateFavoriteButton(
                favoriteButton,
                track
            );
        }
    );


    const spotifyButton =
        document.createElement("a");


    spotifyButton.className =
        "spotify-button";


    spotifyButton.target =
        "_blank";


    spotifyButton.rel =
        "noopener noreferrer";


    spotifyButton.textContent =
        "Spotify";


    spotifyButton.href =
        track.spotifyUrl ||
        `https://open.spotify.com/track/${track.id}`;


    actions.appendChild(
        playButton
    );

    actions.appendChild(
        favoriteButton
    );

    actions.appendChild(
        spotifyButton
    );


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
// 履歴
// ============================================================

function getHistory() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "music_picker_history"
            ) || "[]"
        );

    } catch (error) {

        console.error(
            "履歴読み込みエラー:",
            error
        );

        return [];
    }

}


// ============================================================
// 履歴保存
// ============================================================

function saveToHistory(tracks) {

    const history =
        getHistory();


    tracks.forEach(track => {

        track =
            normalizeTrack(track);


        const index =
            history.findIndex(
                item => item.uri === track.uri
            );


        if (index >= 0) {

            history.splice(
                index,
                1
            );
        }


        history.unshift({
            ...track,
            playedAt:
                new Date().toISOString()
        });

    });


    // 最大50曲
    const limited =
        history.slice(0, 50);


    localStorage.setItem(
        "music_picker_history",
        JSON.stringify(limited)
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


    if (history.length === 0) {

        container.innerHTML =
            `<p>履歴はまだありません。</p>`;

        return;
    }


    history.forEach(track => {

        container.appendChild(
            createTrackElement(track)
        );

    });

}


// ============================================================
// TOP TRACKS
// ============================================================

function initTopTracksPage() {

    const container =
        document.getElementById(
            "topTracks"
        );


    if (!container) {
        return;
    }


    loadTopTracks();
}


// ============================================================
// TOP TRACKS取得
// ============================================================

async function loadTopTracks() {

    const container =
        document.getElementById(
            "topTracks"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        `<div class="loading">読み込み中...</div>`;


    const token =
        localStorage.getItem(
            "spotify_access_token"
        );


    if (!token) {

        container.innerHTML =
            `<p>Spotifyにログインしてください。</p>`;

        return;
    }


    try {

        const response =
            await fetch(
                "/api/top-tracks"
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const tracks =
            await response.json();


        container.innerHTML = "";


        tracks.forEach(track => {

            container.appendChild(
                createTrackElement(track)
            );

        });


    } catch (error) {

        console.error(
            "TOP TRACKS取得エラー:",
            error
        );


        container.innerHTML =
            `<p>曲を取得できませんでした。</p>`;
    }

}


// ============================================================
// アカウントページ
// ============================================================

function initAccountPage() {

    const loginButton =
        document.getElementById(
            "spotifyLoginButton"
        );


    if (!loginButton) {
        return;
    }


    loginButton.addEventListener(
        "click",
        () => {

            window.location.href =
                "/auth/login";
        }
    );


    const logoutButton =
        document.getElementById(
            "spotifyLogoutButton"
        );


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            () => {

                localStorage.removeItem(
                    "spotify_access_token"
                );


                spotifyToken = "";

                spotifyDeviceId = "";


                if (spotifyPlayer) {

                    try {
                        spotifyPlayer.disconnect();
                    } catch (_) {}

                    spotifyPlayer =
                        null;
                }


                showSpotifyStatus(
                    "Spotify未接続"
                );


                alert(
                    "Spotifyからログアウトしました。"
                );

            }
        );

    }

}


// ============================================================
// 設定ページ
// ============================================================

function initSettingsPage() {

    const clearFavorites =
        document.getElementById(
            "clearFavorites"
        );


    if (clearFavorites) {

        clearFavorites.addEventListener(
            "click",
            () => {

                localStorage.removeItem(
                    "music_picker_favorites"
                );


                updateFavoritesPage();


                alert(
                    "お気に入りを削除しました。"
                );
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

                localStorage.removeItem(
                    "music_picker_history"
                );


                updateHistoryPage();


                alert(
                    "履歴を削除しました。"
                );
            }
        );

    }

}


// ============================================================
// テーマ
// ============================================================

function initTheme() {

    const savedTheme =
        localStorage.getItem(
            "music_picker_theme"
        );


    if (savedTheme) {

        document.body.dataset.theme =
            savedTheme;
    }


    const themeSelect =
        document.getElementById(
            "themeSelect"
        );


    if (!themeSelect) {
        return;
    }


    if (savedTheme) {

        themeSelect.value =
            savedTheme;
    }


    themeSelect.addEventListener(
        "change",
        () => {

            const theme =
                themeSelect.value;


            localStorage.setItem(
                "music_picker_theme",
                theme
            );


            document.body.dataset.theme =
                theme;
        }
    );

}


// ============================================================
// HTMLエスケープ
// ============================================================

function escapeHtml(text) {

    if (text === null || text === undefined) {
        return "";
    }


    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// 曲データを統一
// ============================================================

function normalizeTrack(track) {

    if (!track) {
        return null;
    }


    const artists =
        Array.isArray(track.artists)
            ? track.artists
            : [];


    const artistName =
        track.artist ||
        track.artistName ||
        artists
            .map(a => a?.name)
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
            uri.startsWith("spotify:track:")
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
                    ? [{
                        id: artistId,
                        name: artistName
                    }]
                    : [],

        image,

        spotifyUrl
    };

}


// ============================================================
// 複数曲を統一
// ============================================================

function normalizeTracks(tracks) {

    if (!Array.isArray(tracks)) {
        return [];
    }


    return tracks
        .map(normalizeTrack)
        .filter(track => track && track.uri);

}


// ============================================================
// アーティスト名取得
// ============================================================

function getArtistText(track) {

    if (!track) {
        return "";
    }


    if (track.artist) {
        return track.artist;
    }


    if (track.artistName) {
        return track.artistName;
    }


    if (
        Array.isArray(track.artists)
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
// 配列シャッフル
// ============================================================

function shuffleArray(array) {

    for (
        let i = array.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
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
// 時間表示
// ============================================================

function formatTime(ms) {

    if (
        !Number.isFinite(ms) ||
        ms < 0
    ) {

        return "0:00";
    }


    const totalSeconds =
        Math.floor(ms / 1000);


    const minutes =
        Math.floor(
            totalSeconds / 60
        );


    const seconds =
        totalSeconds % 60;


    return (
        `${minutes}:` +
        String(seconds).padStart(
            2,
            "0"
        )
    );

}


// ============================================================
// 待機
// ============================================================

function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}


// ============================================================
// Spotifyエラー内容を取得
// ============================================================

async function readSpotifyError(
    response
) {

    try {

        const data =
            await response.json();


        if (data?.error?.message) {

            return data.error.message;
        }


        if (data?.message) {

            return data.message;
        }


        return JSON.stringify(data);

    } catch (_) {

        try {

            const text =
                await response.text();


            return text || "Unknown error";

        } catch (_) {

            return "Unknown error";
        }

    }

}
// ============================================================
// ハンバーガーメニュー
// ============================================================

function initHamburgerMenu() {

    const menuButton =
        document.getElementById("menuButton");

    const sideMenu =
        document.getElementById("sideMenu");

    const overlay =
        document.getElementById("menuOverlay");


    if (!menuButton || !sideMenu) {

        console.log(
            "ハンバーガーメニューの要素が見つかりません"
        );

        return;
    }


    // メニューを開く
    menuButton.addEventListener("click", () => {

        sideMenu.classList.toggle("open");

        if (overlay) {
            overlay.classList.toggle("open");
        }

    });


    // オーバーレイをクリックしたら閉じる
    if (overlay) {

        overlay.addEventListener("click", () => {

            sideMenu.classList.remove("open");

            overlay.classList.remove("open");

        });

    }


    // メニュー内のリンクを押したら閉じる
    sideMenu.addEventListener("click", event => {

        const link =
            event.target.closest("a, button");

        if (!link) {
            return;
        }


        sideMenu.classList.remove("open");

        if (overlay) {
            overlay.classList.remove("open");
        }

    });

}


// ページ読み込み時に実行
document.addEventListener(
    "DOMContentLoaded",
    initHamburgerMenu
);