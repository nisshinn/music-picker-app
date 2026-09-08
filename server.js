const express = require("express");
const dotenv = require("dotenv");
const crypto = require("crypto");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// 基本設定
// ========================================

app.use(express.json());
app.use(express.static("public"));

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const REDIRECT_URI =
    process.env.SPOTIFY_REDIRECT_URI ||
    `http://127.0.0.1:${PORT}/auth/callback`;

// ========================================
// Spotifyログイン用
// ========================================

let pkceVerifier = "";
let spotifyAccessToken = "";
let spotifyRefreshToken = "";
let spotifyAccessTokenExpiresAt = 0;

// ========================================
// Client Credentials用
// ========================================

let clientCredentialsToken = "";
let clientCredentialsExpiresAt = 0;

// ========================================
// 設定確認
// ========================================

console.log("----------------------------------------");
console.log("Music Picker");
console.log("----------------------------------------");

console.log(
    "PORT:",
    PORT
);

console.log(
    "CLIENT_ID:",
    CLIENT_ID ? "設定済み" : "未設定"
);

console.log(
    "CLIENT_SECRET:",
    CLIENT_SECRET ? "設定済み" : "未設定"
);

console.log(
    "REDIRECT_URI:",
    REDIRECT_URI
);

console.log("----------------------------------------");

// ========================================
// Base64 URL形式
// ========================================

function base64url(buffer) {
    return buffer
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

// ========================================
// Spotifyユーザートークン管理
// ========================================

function clearSpotifySession() {
    spotifyAccessToken = "";
    spotifyRefreshToken = "";
    spotifyAccessTokenExpiresAt = 0;
}
function getCookie(req, name) {
    const cookieHeader = req.headers.cookie || "";
    const cookies = {};

    cookieHeader.split(";").forEach(part => {
        const index = part.indexOf("=");
        if (index === -1) return;

        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        cookies[key] = decodeURIComponent(value);
    });

    return cookies[name] || "";
}

function setRefreshTokenCookie(res, refreshToken) {
    if (!refreshToken) return;

    res.setHeader(
        "Set-Cookie",
        `spotify_refresh_token=${encodeURIComponent(refreshToken)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=15552000`
    );
}

function clearRefreshTokenCookie(res) {
    res.setHeader(
        "Set-Cookie",
        "spotify_refresh_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
    );
}


async function refreshSpotifyAccessToken(force = false) {
    if (
        spotifyAccessToken &&
        !force &&
        Date.now() < spotifyAccessTokenExpiresAt - 60_000
    ) {
        return spotifyAccessToken;
    }

    if (!spotifyRefreshToken) {
        const error = new Error("Spotifyの再認証が必要です");
        error.status = 401;
        error.reason = "NO_REFRESH_TOKEN";
        throw error;
    }

    const response = await fetch(
        "https://accounts.spotify.com/api/token",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: spotifyRefreshToken,
                client_id: CLIENT_ID
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error("Spotify Refresh Token Error:", response.status, data);

        if (data?.error === "invalid_grant") {
            clearSpotifySession();
        }

        const error = new Error(
            data?.error_description ||
            "Spotifyアクセストークンの更新に失敗しました"
        );
        error.status = 401;
        error.reason = data?.error || "REFRESH_FAILED";
        throw error;
    }

    spotifyAccessToken = data.access_token || "";

    if (data.refresh_token) {
        spotifyRefreshToken = data.refresh_token;
    }

    spotifyAccessTokenExpiresAt =
        Date.now() + Number(data.expires_in || 3600) * 1000;

    console.log("Spotifyアクセストークンを自動更新しました");

    return spotifyAccessToken;
}

async function getValidSpotifyAccessToken() {
    return refreshSpotifyAccessToken(false);
}

// ========================================
// Spotify API 共通処理
// ========================================

async function spotifyFetch(url, options = {}) {
    const response = await fetch(url, options);

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        console.error(
            "Spotify API Error:",
            response.status,
            data
        );

        const message =
            data?.error?.message ||
            data?.error_description ||
            `Spotify API Error ${response.status}`;

        const error = new Error(message);

        error.status = response.status;
        error.reason = data?.error?.reason;

        throw error;
    }

    return data;
}

// ========================================
// Spotifyログイン
// ========================================
// ========================================
// Spotifyアカウント変更ページ
// ========================================

app.get("/account/change", (req, res) => {

    res.send(`
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Spotifyアカウント変更</title>

    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;

            display: flex;
            justify-content: center;
            align-items: center;

            background: #121212;
            color: white;

            font-family:
                Arial,
                "Noto Sans JP",
                sans-serif;
        }

        .box {
            width: min(90%, 420px);
            padding: 35px;

            background: #1e1e1e;
            border-radius: 20px;

            text-align: center;

            box-shadow:
                0 10px 40px rgba(0, 0, 0, 0.4);
        }

        h1 {
            margin-bottom: 10px;
        }

        p {
            color: #b3b3b3;
            line-height: 1.7;
        }

        button {
            width: 100%;
            margin-top: 20px;
            padding: 15px;

            border: none;
            border-radius: 30px;

            background: #1ed760;
            color: #000;

            font-size: 16px;
            font-weight: bold;

            cursor: pointer;
        }

        button:hover {
            opacity: 0.9;
        }

        .back {
            background: #333;
            color: white;
        }
    </style>
</head>

<body>

    <div class="box">

        <h1>🎵 Spotifyアカウント変更</h1>

        <p>
            現在のMusic Pickerのログイン情報を削除して、
            Spotifyの認証画面へ進みます。
        </p>

        <button onclick="changeAccount()">
            Spotifyアカウントを変更
        </button>

        <button
            class="back"
            onclick="location.href='/'">
            Music Pickerに戻る
        </button>

    </div>

    <script>

        function changeAccount() {

            // Music Picker側のトークンを削除
            localStorage.removeItem(
                "spotifyAccessToken"
            );

            // Spotify認証へ
            location.href =
                "/auth/login";
        }

    </script>

</body>

</html>
    `);
});

app.get("/auth/login", (req, res) => {
    try {
        if (!CLIENT_ID) {
            return res
                .status(500)
                .send(
                    "SPOTIFY_CLIENT_ID が設定されていません。"
                );
        }

        // PKCE verifier
        const verifier = base64url(
            crypto.randomBytes(64)
        );

        // PKCE challenge
        const challenge = base64url(
            crypto
                .createHash("sha256")
                .update(verifier)
                .digest()
        );

        pkceVerifier = verifier;

        // Spotify認証パラメータ
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            response_type: "code",
            redirect_uri: REDIRECT_URI,
            code_challenge_method: "S256",
            code_challenge: challenge,
            show_dialog: "true",

            scope: [
                "playlist-read-private",
                "playlist-modify-private",
                "playlist-modify-public",
                "streaming",
                "user-read-email",
                "user-read-private",
                "user-read-playback-state",
                "user-modify-playback-state",
                "user-read-recently-played",
                "user-top-read",
                "user-library-read",
                "user-library-modify"
            ].join(" ")
        });

        const spotifyLoginUrl =
            `https://accounts.spotify.com/authorize?${params.toString()}`;

        res.redirect(spotifyLoginUrl);

    } catch (error) {
        console.error(
            "Login Error:",
            error
        );

        res
            .status(500)
            .send(
                "Spotifyログインの準備に失敗しました。"
            );
    }
});

// ========================================
// Spotifyログイン callback
// ========================================

app.get("/auth/callback", async (req, res) => {
    try {
        const code = req.query.code;

        if (!code) {
            return res.status(400).send("認証コードがありません");
        }

        const tokenResponse = await fetch(
            "https://accounts.spotify.com/api/token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: REDIRECT_URI,
                    code_verifier: pkceVerifier
                })
            }
        );

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error("Spotify Token Error:", tokenData);

            return res.status(500).send(`
                <h1>Spotifyログインエラー</h1>
                <pre>${JSON.stringify(tokenData, null, 2)}</pre>
            `);
        }

        spotifyAccessToken = tokenData.access_token;
        spotifyRefreshToken = tokenData.refresh_token || spotifyRefreshToken;
        setRefreshTokenCookie(res, spotifyRefreshToken);
        spotifyAccessTokenExpiresAt =
            Date.now() + Number(tokenData.expires_in || 3600) * 1000;

        console.log("Spotifyログイン成功");

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>ログイン成功</title>
            </head>
            <body>
                <p>Spotifyログイン成功！</p>

                <script>
                    localStorage.setItem(
                        "spotifyAccessToken",
                        ${JSON.stringify(tokenData.access_token)}
                    );

                    location.href = "/";
                </script>
            </body>
            </html>
        `);

    } catch (error) {
        console.error("Callback Error:", error);

        res.status(500).send(`
            <h1>Callback Error</h1>
            <pre>${error.message}</pre>
        `);
    }
});

// ========================================
// ブラウザへ最新のSpotifyアクセストークンを渡す
// ========================================
app.get("/api/spotify-token", async (req, res) => {
    try {
        if (!spotifyRefreshToken) {
            spotifyRefreshToken = getCookie(req, "spotify_refresh_token");
        }

        const force = req.query.force === "1";
        const accessToken = await refreshSpotifyAccessToken(force);
        setRefreshTokenCookie(res, spotifyRefreshToken);

        res.json({
            success: true,
            accessToken
        });
    } catch (error) {
        console.error("Spotify Token Endpoint Error:", error);

        res.status(error.status === 401 ? 401 : 500).json({
            error:
                error.status === 401
                    ? "Spotifyのログイン期限が切れています。再ログインしてください。"
                    : error.message || "Spotifyトークン取得に失敗しました",
            reason: error.reason || "TOKEN_ERROR"
        });
    }
});

// ========================================
// Client Credentials Token
// ========================================

async function getSpotifyToken() {

    // まだ使えるトークンがあれば再利用
    if (
        clientCredentialsToken &&
        Date.now() < clientCredentialsExpiresAt
    ) {
        return clientCredentialsToken;
    }

    // 設定確認
    if (
        !CLIENT_ID ||
        !CLIENT_SECRET
    ) {
        throw new Error(
            "Spotify Client ID / Client Secret が設定されていません。"
        );
    }

    // Basic認証
    const credentials =
        Buffer
            .from(
                `${CLIENT_ID}:${CLIENT_SECRET}`
            )
            .toString("base64");

    // トークン取得
    const response = await fetch(
        "https://accounts.spotify.com/api/token",
        {
            method: "POST",

            headers: {
                Authorization:
                    `Basic ${credentials}`,

                "Content-Type":
                    "application/x-www-form-urlencoded"
            },

            body:
                "grant_type=client_credentials"
        }
    );

    const data =
        await response.json();
    if (!response.ok) {

        console.error(
            "Client Credentials Error:",
            response.status,
            data
        );

        const error =
            new Error(
                data.error_description ||
                data.error?.message ||
                "Spotify token取得失敗"
            );

        error.status =
            response.status;

        error.reason =
            data.error?.reason;

        throw error;
    }

    clientCredentialsToken =
        data.access_token;

    const expiresIn =
        Number(
            data.expires_in || 3600
        );

    clientCredentialsExpiresAt =
        Date.now() +
        Math.max(
            expiresIn - 60,
            60
        ) * 1000;

    return clientCredentialsToken;
}
// ========================================
// ユーザーのSpotifyアクセストークン取得
// ========================================
function getUserAccessToken(req) {

    const auth =
        req.headers.authorization || "";

    if (!auth.startsWith("Bearer ")) {
        return "";
    }

    return auth
        .slice(7)
        .trim();
}

// ========================================
// 曲データを共通形式にする
// ========================================

function formatTrack(track) {

    return {

        id:
            track.id,

        title:
            track.name,

        name:
            track.name,

        artist:
            track.artists
                ?.map(
                    artist =>
                        artist.name
                )
                .join(", ") || "",

        artists:
            track.artists || [],

        image:
            track.album
                ?.images?.[0]?.url || "",

        spotifyUrl:
            track.external_urls
                ?.spotify || "",

        uri:
            track.uri,

        artistId:
            track.artists?.[0]?.id || ""
    };
}

// ========================================
// 重複削除
// ========================================

function uniqueTracks(tracks) {

    return Array.from(
        new Map(
            tracks
                .filter(
                    track =>
                        track?.id
                )
                .map(
                    track => [
                        track.id,
                        track
                    ]
                )
        ).values()
    );
}

// ========================================
// Spotify検索
//
// Spotifyは1回最大50曲
// ========================================

async function searchSpotifyTracks(
    token,
    query,
    limit,
    offset = 0
) {

    const params =
        new URLSearchParams({

            q:
                query,

            type:
                "track",

            market:
                "JP",

            limit:
                String(limit),

            offset:
                String(offset)
        });

    return await spotifyFetch(
        `https://api.spotify.com/v1/search?${params.toString()}`,
        {
            headers: {
                Authorization:
                    `Bearer ${token}`
            }
        }
    );
}

async function get80Tracks(token, query) {
    console.log("Spotifyから最大80曲取得:", query);

    const all = [];

    // 10曲ずつ最大8ページ取得
    for (let offset = 0; offset < 80; offset += 10) {
        try {
            const data = await searchSpotifyTracks(
                token,
                query,
                10,
                offset
            );
    console.log(
    "Spotify検索結果total:",
    data.tracks?.total
);
            const tracks = data.tracks?.items || [];

            console.log(
                `${offset + 1}～${offset + tracks.length}曲目:`,
                tracks.length,
                "曲"
            );

            all.push(...tracks);

            // ★重要
            // 5曲しか返ってこなくても、
            // ここでは終了しない。
            //
            // Spotifyの検索結果が少ない場合でも
            // 次のoffsetを試す。
            
            // APIへの連続アクセスを少し空ける
            if (offset < 70) {
                await new Promise(resolve =>
                    setTimeout(resolve, 300)
                );
            }

        } catch (error) {
            console.error(
                `offset ${offset} の取得失敗:`,
                error
            );

            if (
                error.status === 429 ||
                error.reason === "QUOTA_EXCEEDED"
            ) {
                throw error;
            }

            // その他のエラーなら終了
            break;
        }
    }

    console.log(
        "取得合計:",
        all.length,
        "曲"
    );

    // 重複削除
    const unique = uniqueTracks(all);

    console.log(
        "重複削除後:",
        unique.length,
        "曲"
    );


    return unique.slice(0, 80);
}
// ========================================
// アーティスト検索
// ========================================

app.get(
    "/api/artists",
    async (req, res) => {

        try {

            const q =
                String(
                    req.query.q || ""
                ).trim();

            if (!q) {
                return res.json([]);
            }

            const token =
                await getSpotifyToken();

            const params =
                new URLSearchParams({

                    q:
                        q,

                    type:
                        "artist",

                    limit:
                        "10",

                    market:
                        "JP"
                });

            const data =
                await spotifyFetch(
                    `https://api.spotify.com/v1/search?${params.toString()}`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

            const artists =
                (data.artists?.items || [])
                    .map(
                        artist => ({

                            id:
                                artist.id,

                            name:
                                artist.name,

                            image:
                                artist.images?.[0]?.url ||
                                "",

                            spotifyUrl:
                                artist.external_urls
                                    ?.spotify ||
                                ""
                        })
                    );

            console.log(
                "Artist Search:",
                q,
                "→",
                artists.length
            );

            res.json(
                artists
            );

        } catch (error) {

            console.error(
                "Artist Search Error:",
                error
            );

            if (
                error.status === 429 ||
                error.reason === "QUOTA_EXCEEDED"
            ) {

                return res
                    .status(429)
                    .json({

                        error:
                            "Spotify APIの利用上限に達しています。",

                        reason:
                            "QUOTA_EXCEEDED"
                    });
            }

            res
                .status(500)
                .json({

                    error:
                        error.message ||
                        "アーティスト検索に失敗しました"
                });
        }
    }
);

// ========================================
// アーティストの曲を取得
//
// 最大80曲
// ========================================

app.get(
    "/api/artist-tracks",
    async (req, res) => {

        try {

            const artistId =
                String(
                    req.query.id || ""
                ).trim();

            const mood =
                String(
                    req.query.mood || ""
                ).trim();

            if (!artistId) {

                return res
                    .status(400)
                    .json({

                        error:
                            "artist id is required"
                    });
            }

            console.log(
                "----------------------------------------"
            );

            console.log(
                "アーティスト曲取得:",
                artistId
            );

            console.log(
                "選択された気分:",
                mood || "なし"
            );

            // ====================================
            // Spotifyトークン
            // ====================================

            const token =
                await getSpotifyToken();

            // ====================================
            // アーティスト情報
            // ====================================

            const artistResponse =
                await fetch(
                    `https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

            if (!artistResponse.ok) {

                const errorText =
                    await artistResponse.text();

                console.error(
                    "アーティスト取得失敗:",
                    artistResponse.status,
                    errorText
                );

                if (
                    artistResponse.status === 429
                ) {

                    return res
                        .status(429)
                        .json({

                            error:
                                "Spotify APIの利用上限に達しています。",

                            reason:
                                "QUOTA_EXCEEDED"
                        });
                }

                return res
                    .status(
                        artistResponse.status
                    )
                    .json({

                        error:
                            errorText
                    });
            }

            const artist =
                await artistResponse.json();

            const artistName =
                artist.name;

            console.log(
                "アーティスト名:",
                artistName
            );

            // ====================================
            // アーティスト名で80曲検索
            // ====================================

            const query =
                `artist:"${artistName}"`;

            const items =
                await get80Tracks(
                    token,
                    query
                );

            // ====================================
            // 選択したアーティストだけ
            // ====================================

            const tracks =
                items
                    .filter(
                        track => {

                            return track.artists?.some(
                                artist =>
                                    artist.id ===
                                    artistId
                            );
                        }
                    )
                    .map(
                        formatTrack
                    );

            // ====================================
            // 重複削除
            // ====================================

            const unique =
                uniqueTracks(
                    tracks
                );

            console.log(
                "選択アーティストの曲:",
                unique.length,
                "曲"
            );

            // ====================================
            // シャッフルしない
            //
            // script.js側で
            // 気分ごとに並び替える
            // ====================================

            const result =
                unique.slice(0, 80);

            console.log(
                "アーティスト曲取得完了:",
                artistName
            );

            console.log(
                "最終候補:",
                result.length,
                "曲"
            );

            console.log(
                "----------------------------------------"
            );

            res.json(result);

        } catch (error) {

            console.error(
                "Artist Tracks Error:",
                error
            );

            if (
                error.status === 429 ||
                error.reason === "QUOTA_EXCEEDED"
            ) {

                return res
                    .status(429)
                    .json({

                        error:
                            "Spotify APIの利用上限に達しています。",

                        reason:
                            "QUOTA_EXCEEDED"
                    });
            }

            res
                .status(500)
                .json({

                    error:
                        error.message ||
                        "アーティストの曲取得に失敗しました"
                });
        }
    }
);

// ========================================
// ジャンル検索
//
// 最大80曲
// ========================================

app.get(
    "/api/genre-tracks",
    async (req, res) => {

        try {

            const genre =
                String(
                    req.query.genre || ""
                ).trim();

            const mood =
                String(
                    req.query.mood || ""
                ).trim();

            if (
                !genre ||
                genre === "all"
            ) {

                return res.json([]);
            }

            console.log(
                "----------------------------------------"
            );

            console.log(
                "ジャンル:",
                genre
            );

            console.log(
                "気分:",
                mood || "なし"
            );

            const token =
                await getSpotifyToken();

            // ====================================
            // ジャンル検索
            // ====================================

            const query =
                `genre:${genre}`;

            console.log(
                "Spotify検索:",
                query
            );

            // ====================================
            // 最大80曲
            // ====================================

            const items =
                await get80Tracks(
                    token,
                    query
                );

            // ====================================
            // 共通形式
            // ====================================

            const tracks =
                items.map(
                    formatTrack
                );

            // ====================================
            // 重複削除
            // ====================================

            const unique =
                uniqueTracks(
                    tracks
                );

            console.log(
                "ジャンル重複削除後:",
                unique.length,
                "曲"
            );

            // ====================================
            // シャッフルしない
            //
            // script.js側で
            // 気分ごとに並び替える
            // ====================================

            const result =
                unique.slice(0, 80);

            console.log(
                "Genre Tracks:",
                result.length
            );

            console.log(
                "----------------------------------------"
            );

            res.json(result);

        } catch (error) {

            console.error(
                "Genre Tracks Error:",
                error
            );

            if (
                error.status === 429 ||
                error.reason === "QUOTA_EXCEEDED"
            ) {

                return res
                    .status(429)
                    .json({

                        error:
                            "Spotify APIの利用上限に達しています。",

                        reason:
                            "QUOTA_EXCEEDED"
                    });
            }

            res
                .status(500)
                .json({

                    error:
                        error.message ||
                        "ジャンル検索に失敗しました"
                });
        }
    }
);

// ========================================
// 曲・アーティスト検索
// ========================================

app.get(
    "/api/search",
    async (req, res) => {

        try {

            const q =
                String(
                    req.query.q || ""
                ).trim();

            if (!q) {

                return res.json({

                    tracks: [],
                    artists: []
                });
            }

            const token =
                await getSpotifyToken();

            const params =
                new URLSearchParams({

                    q:
                        q,

                    type:
                        "track,artist",

                    limit:
                        "10",

                    market:
                        "JP"
                });

            const data =
                await spotifyFetch(
                    `https://api.spotify.com/v1/search?${params.toString()}`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

            const tracks =
                (data.tracks?.items || [])
                    .map(
                        formatTrack
                    );

            const artists =
                (data.artists?.items || [])
                    .map(
                        artist => ({

                            id:
                                artist.id,

                            name:
                                artist.name,

                            image:
                                artist.images?.[0]?.url ||
                                "",

                            spotifyUrl:
                                artist.external_urls
                                    ?.spotify ||
                                ""
                        })
                    );

            res.json({

                tracks,
                artists
            });

        } catch (error) {

            console.error(
                "Search Error:",
                error
            );

            if (
                error.status === 429 ||
                error.reason === "QUOTA_EXCEEDED"
            ) {

                return res
                    .status(429)
                    .json({

                        error:
                            "Spotify APIの利用上限に達しています。",

                        reason:
                            "QUOTA_EXCEEDED"
                    });
            }

            res
                .status(500)
                .json({

                    error:
                        error.message ||
                        "検索に失敗しました"
                });
        }
    }
);
// ========================================
// Spotifyプレイリスト作成・5曲追加
// ========================================

app.post(
    "/api/create-playlist",
    async (req, res) => {

        try {


            // --------------------------------
            // Spotifyログイン確認
            // --------------------------------

            let accessToken;

            try {
                accessToken = await getValidSpotifyAccessToken();
            } catch (tokenError) {
                return res
                    .status(401)
                    .json({
                        error:
                            "Spotifyのログイン期限が切れています。再ログインしてください。"
                    });
            }


            // --------------------------------
            // リクエスト
            // --------------------------------

            const {
                name,
                public: isPublic,
                tracks
            } = req.body;


            // --------------------------------
            // プレイリスト名
            // --------------------------------

            const playlistName =
                String(
                    name || "Music Picker"
                ).trim();


            if (!playlistName) {

                return res
                    .status(400)
                    .json({
                        error:
                            "プレイリスト名を入力してください"
                    });

            }


            // --------------------------------
            // 曲確認
            // --------------------------------

            if (
                !Array.isArray(tracks) ||
                tracks.length === 0
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "追加する曲がありません"
                    });

            }


            // 最大100曲
            const uris =
                tracks
                    .map(track => {

                        if (
                            typeof track ===
                            "string"
                        ) {
                            return track;
                        }

                        return track?.uri || "";

                    })
                    .filter(uri =>
                        uri.startsWith(
                            "spotify:track:"
                        )
                    );


            // 重複削除
            const uniqueUris =
                [
                    ...new Set(uris)
                ].slice(0, 100);


            if (!uniqueUris.length) {

                return res
                    .status(400)
                    .json({
                        error:
                            "有効なSpotify曲がありません"
                    });

            }


            console.log(
                "Spotifyプレイリスト作成:",
                playlistName
            );

            console.log(
                "追加曲数:",
                uniqueUris.length
            );


            // --------------------------------
            // ① プレイリスト作成
            // --------------------------------

            const playlistResponse =
                await fetch(
                    "https://api.spotify.com/v1/me/playlists",
                    {
                        method: "POST",

                        headers: {
                            Authorization:
                                `Bearer ${accessToken}`,

                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                name:
                                    playlistName,

                                public:
                                    Boolean(
                                        isPublic
                                    ),

                                collaborative:
                                    false,

                                description:
                                    "Music Pickerで作成しました"
                            })
                    }
                );


            const playlistData =
                await playlistResponse.json();


            if (
                !playlistResponse.ok
            ) {

                console.error(
                    "プレイリスト作成エラー:",
                    playlistResponse.status,
                    playlistData
                );


                if (
                    playlistResponse.status ===
                    401
                ) {

                    spotifyAccessToken =
                        "";

                    return res
                        .status(401)
                        .json({
                            error:
                                "Spotifyのログイン期限が切れています。再ログインしてください。"
                        });

                }


                return res
                    .status(
                        playlistResponse.status
                    )
                    .json({
                        error:
                            playlistData?.error?.message ||
                            "プレイリストの作成に失敗しました"
                    });

            }


            // --------------------------------
            // ② 5曲を追加
            // --------------------------------

            const addResponse =
                await fetch(
                    `https://api.spotify.com/v1/playlists/${encodeURIComponent(
                        playlistData.id
                    )}/items`,
                    {
                        method: "POST",

                        headers: {
                            Authorization:
                                `Bearer ${accessToken}`,

                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                uris:
                                    uniqueUris
                            })
                    }
                );


            const addData =
                await addResponse.json();


            if (
                !addResponse.ok
            ) {

                console.error(
                    "曲追加エラー:",
                    addResponse.status,
                    addData
                );


                return res
                    .status(
                        addResponse.status
                    )
                    .json({
                        error:
                            addData?.error?.message ||
                            "プレイリストへの曲追加に失敗しました",

                        playlistId:
                            playlistData.id
                    });

            }


            // --------------------------------
            // 完了
            // --------------------------------

            const spotifyUrl =
                playlistData
                    .external_urls
                    ?.spotify || "";


            console.log(
                "Spotifyプレイリスト作成完了:",
                spotifyUrl
            );


            res.json({
                success:
                    true,

                playlistId:
                    playlistData.id,

                playlistName:
                    playlistData.name,

                spotifyUrl:
                    spotifyUrl,

                addedTracks:
                    uniqueUris.length
            });


        } catch (error) {

            console.error(
                "Create Playlist Error:",
                error
            );


            res
                .status(500)
                .json({
                    error:
                        error.message ||
                        "Spotifyプレイリストの作成に失敗しました"
                });

        }

    }
);

// ========================================
// Spotifyの自分のプレイリスト一覧を取得
// ========================================
app.get(
    "/api/my-playlists",
    async (req, res) => {

        try {

            // ブラウザから送られたトークンを優先
            const accessToken =
                getUserAccessToken(req) ||
                spotifyAccessToken;

            if (!accessToken) {

                return res
                    .status(401)
                    .json({
                        error:
                            "Spotifyにログインしてください"
                    });
            }


            console.log(
                "Spotifyプレイリスト一覧を取得"
            );


            const response =
                await fetch(
                    "https://api.spotify.com/v1/me/playlists?limit=50",
                    {
                        headers: {
                            Authorization:
                                `Bearer ${accessToken}`
                        }
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                console.error(
                    "Spotify Playlist List Error:",
                    response.status,
                    data
                );

                return res
                    .status(response.status)
                    .json({
                        error:
                            data?.error?.message ||
                            "プレイリスト取得に失敗しました"
                    });
            }


            const playlists =
                (data.items || [])
                    .filter(Boolean)
                    .map(
                        playlist => ({

                            id:
                                playlist.id,

                            name:
                                playlist.name,

                            image:
                                playlist.images?.[0]?.url ||
                                "",

                            description:
                                playlist.description ||
                                "",

                            tracksTotal:
                                playlist.items?.total ??
                                0,

                            spotifyUrl:
                                playlist.external_urls
                                    ?.spotify ||
                                "",

                            owner:
                                playlist.owner
                                    ?.display_name ||
                                ""
                        })
                    );


            console.log(
                "取得プレイリスト数:",
                playlists.length
            );


            res.json({
                success:
                    true,

                playlists:
                    playlists
            });


        } catch (error) {

            console.error(
                "My Playlists Error:",
                error
            );


            res
                .status(500)
                .json({
                    error:
                        error.message ||
                        "プレイリスト取得中にエラーが発生しました"
                });
        }
    }
);

// ========================================
// Spotifyプレイリスト内の曲を取得
// ========================================
app.get(
    "/api/my-playlists/:playlistId/items",
    async (req, res) => {

        try {

            let accessToken;

            try {
                accessToken = await getValidSpotifyAccessToken();
            } catch (tokenError) {
                return res
                    .status(401)
                    .json({
                        error:
                            "Spotifyのログイン期限が切れています。再ログインしてください。"
                    });
            }


            const playlistId =
                req.params.playlistId;


            console.log(
                "Spotifyプレイリスト曲取得:",
                playlistId
            );


            const response =
                await fetch(
                    `https://api.spotify.com/v1/playlists/${encodeURIComponent(
                        playlistId
                    )}/items?limit=50`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${accessToken}`
                        }
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                console.error(
                    "Spotify Playlist Items Error:",
                    response.status,
                    data
                );

                return res
                    .status(response.status)
                    .json({
                        error:
                            data?.error?.message ||
                            "プレイリストの曲取得に失敗しました"
                    });
            }


            const tracks =
    (data.items || [])
        .map(item => item.item || item.track)
        .filter(
            track =>
                track &&
                track.type === "track"
        )
        .map(track => ({
            id: track.id,
            uri: track.uri,
            title: track.name,
            name: track.name,

            artist:
                track.artists
                    ?.map(a => a.name)
                    .join(", ") || "",

            artists:
                track.artists || [],

            image:
                track.album
                    ?.images?.[0]?.url || "",

            album: {
                name:
                    track.album?.name || "",
                images:
                    track.album?.images || []
            },

            duration_ms:
                track.duration_ms,

            spotifyUrl:
                track.external_urls
                    ?.spotify || ""
        }));

           res.json({
    success: true,
    tracks
});


        } catch (error) {

            console.error(
                "My Playlist Items Error:",
                error
            );


            res
                .status(500)
                .json({
                    error:
                        error.message ||
                        "プレイリストの曲取得中にエラーが発生しました"
                });
        }
    }
);
// ========================================
// Spotifyログアウト / セッション破棄
// ========================================
app.post("/api/spotify-logout", (req, res) => {
    clearSpotifySession();
    clearRefreshTokenCookie(res);
    res.json({ success: true });
});

// ========================================
// TOP TRACKS
// ========================================

app.get(
    "/api/top-tracks",
    async (req, res) => {

        try {

            let accessToken;

            try {
                accessToken = await getValidSpotifyAccessToken();
            } catch (tokenError) {
                return res
                    .status(401)
                    .json({
                        error:
                            "Spotifyのログイン期限が切れています。再ログインしてください。"
                    });
            }

            const data =
                await spotifyFetch(
                    "https://api.spotify.com/v1/me/top/tracks?limit=50",
                    {
                        headers: {
                            Authorization:
                                `Bearer ${accessToken}`
                        }
                    }
                );

            const tracks =
                (data.items || [])
                    .map(
                        formatTrack
                    );

            res.json(
                tracks
            );

        } catch (error) {

            console.error(
                "Top Tracks Error:",
                error
            );

            if (
                error.status === 401
            ) {

                clearSpotifySession();

                return res
                    .status(401)
                    .json({

                        error:
                            "Spotifyに再ログインしてください"
                    });
            }

            res
                .status(500)
                .json({

                    error:
                        error.message ||
                        "トップ曲取得に失敗しました"
                });
        }
    }
);

// ========================================
// サーバー起動
// ========================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");

        console.log(
            "========================================"
        );

        console.log(
            "Music Picker起動！"
        );

        console.log(
            `http://127.0.0.1:${PORT}`
        );

        console.log(
            "========================================"
        );
    }
);