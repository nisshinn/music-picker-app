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

// Spotifyログイン用
let pkceVerifier = "";

// ログインしたユーザーのアクセストークン
let spotifyAccessToken = "";

// Client Credentials用トークン
let clientCredentialsToken = "";
let clientCredentialsExpiresAt = 0;


// ========================================
// 設定確認
// ========================================

console.log("----------------------------------------");
console.log("Music Picker");
console.log("----------------------------------------");
console.log("PORT:", PORT);
console.log(
    "CLIENT_ID:",
    CLIENT_ID ? "設定済み" : "未設定"
);
console.log(
    "CLIENT_SECRET:",
    CLIENT_SECRET ? "設定済み" : "未設定"
);
console.log("REDIRECT_URI:", REDIRECT_URI);
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

app.get("/auth/login", (req, res) => {

    try {

        if (!CLIENT_ID) {

            return res
                .status(500)
                .send(
                    "SPOTIFY_CLIENT_ID が設定されていません。"
                );
        }


        // --------------------------------
        // PKCE verifier
        // --------------------------------

        const verifier = base64url(
            crypto.randomBytes(64)
        );


        // --------------------------------
        // PKCE challenge
        // --------------------------------

        const challenge = base64url(
            crypto
                .createHash("sha256")
                .update(verifier)
                .digest()
        );


        pkceVerifier = verifier;


        // --------------------------------
        // Spotify認証パラメータ
        // --------------------------------

        const params = new URLSearchParams({

            client_id: CLIENT_ID,

            response_type: "code",

            redirect_uri: REDIRECT_URI,

            code_challenge_method: "S256",

            code_challenge: challenge,

            scope: [
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

        const {
            code,
            error
        } = req.query;


        // --------------------------------
        // Spotify側でキャンセル
        // --------------------------------

        if (error) {

            return res
                .status(400)
                .send(
                    `Spotifyログインエラー: ${error}`
                );
        }


        // --------------------------------
        // code確認
        // --------------------------------

        if (!code) {

            return res
                .status(400)
                .send(
                    "認証コードがありません。"
                );
        }


        // --------------------------------
        // PKCE確認
        // --------------------------------

        if (!pkceVerifier) {

            return res
                .status(400)
                .send(
                    "PKCE認証情報がありません。もう一度ログインしてください。"
                );
        }


        // --------------------------------
        // トークン取得
        // --------------------------------

        const body = new URLSearchParams({

            client_id: CLIENT_ID,

            grant_type:
                "authorization_code",

            code: code,

            redirect_uri:
                REDIRECT_URI,

            code_verifier:
                pkceVerifier
        });


        const response = await fetch(
            "https://accounts.spotify.com/api/token",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body: body
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            console.error(
                "Spotify Token Error:",
                data
            );

            return res
                .status(400)
                .send(
                    "Spotify認証に失敗しました。"
                );
        }


        // --------------------------------
        // アクセストークン保存
        // --------------------------------

        spotifyAccessToken =
            data.access_token;


        // 使用済みPKCE削除
        pkceVerifier = "";


        // --------------------------------
        // ブラウザへ戻す
        // --------------------------------

        res.send(`
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>Spotifyログイン完了</title>
</head>

<body>

    <p>Spotifyログイン完了！</p>
    <p>Music Pickerに戻っています...</p>

    <script>

        localStorage.setItem(
            "spotify_access_token",
            ${JSON.stringify(spotifyAccessToken)}
        );

        setTimeout(() => {
            location.href = "/";
        }, 500);

    </script>

</body>
</html>
        `);

    } catch (error) {

        console.error(
            "Callback Error:",
            error
        );

        res
            .status(500)
            .send(
                "ログイン処理中にエラーが発生しました。"
            );
    }
});


// ========================================
// Client Credentials Token
// アーティスト検索・曲検索などに使用
// ========================================

async function getSpotifyToken() {

    // --------------------------------
    // まだ使えるトークンがあれば再利用
    // --------------------------------

    if (
        clientCredentialsToken &&
        Date.now() < clientCredentialsExpiresAt
    ) {
        return clientCredentialsToken;
    }


    if (!CLIENT_ID || !CLIENT_SECRET) {

        throw new Error(
            "Spotify Client ID / Client Secret が設定されていません。"
        );
    }


    const credentials =
        Buffer
            .from(
                `${CLIENT_ID}:${CLIENT_SECRET}`
            )
            .toString("base64");


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

        const error = new Error(
            data.error_description ||
            data.error?.message ||
            "Spotify token取得失敗"
        );

        error.status = response.status;
        error.reason = data.error?.reason;

        throw error;
    }


    clientCredentialsToken =
        data.access_token;


    // 少し余裕を持たせて期限を設定
    const expiresIn =
        Number(data.expires_in || 3600);

    clientCredentialsExpiresAt =
        Date.now() +
        (expiresIn - 60) * 1000;


    return clientCredentialsToken;
}


// ========================================
// アーティスト検索
// ========================================

app.get("/api/artists", async (req, res) => {

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

                q: q,

                type: "artist",

                limit: "10",

                market: "JP"
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
                .map(artist => ({

                    id:
                        artist.id,

                    name:
                        artist.name,

                    image:
                        artist.images?.[0]?.url || "",

                    spotifyUrl:
                        artist.external_urls
                            ?.spotify || ""
                }));


        console.log(
            "Artist Search:",
            q,
            "→",
            artists.length
        );


        res.json(artists);

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
});


// ========================================
// アーティストの曲を取得
//
// ★重要
// アルバムを大量に取得しない
// Spotify Searchを使って取得する
// ========================================

app.get(
    "/api/artist-tracks",
    async (req, res) => {

        try {

            const artistId =
                String(
                    req.query.id || ""
                ).trim();


            if (!artistId) {

                return res
                    .status(400)
                    .json({
                        error:
                            "artist id is required"
                    });
            }


            console.log("----------------------------------------");

            console.log(
                "アーティスト曲取得:",
                artistId
            );


            // --------------------------------
            // Spotifyトークン
            // --------------------------------

            const token =
                await getSpotifyToken();


            // --------------------------------
            // アーティスト情報を取得
            // --------------------------------

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


            // --------------------------------
            // アーティスト名で曲検索
            // --------------------------------

            const query =
                `artist:"${artistName}"`;


            const searchParams =
                new URLSearchParams({

                    q: query,

                    type: "track",

                    market: "JP",

                    limit: "10"
                });


            const searchResponse =
                await fetch(
                    `https://api.spotify.com/v1/search?${searchParams.toString()}`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );


            if (!searchResponse.ok) {

                const errorText =
                    await searchResponse.text();


                console.error(
                    "アーティスト曲検索失敗:",
                    searchResponse.status,
                    errorText
                );


                if (
                    searchResponse.status === 429
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
                        searchResponse.status
                    )
                    .json({
                        error:
                            errorText
                    });
            }


            const searchData =
                await searchResponse.json();


            const items =
                searchData.tracks?.items || [];


            // --------------------------------
            // 選択したアーティストだけに絞る
            // --------------------------------

            const tracks =
                items
                    .filter(track => {

                        return track.artists?.some(
                            artist =>
                                artist.id === artistId
                        );

                    })
                    .map(track => {

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
                            "";


                        return {

                            id:
                                track.id,

                            title:
                                track.name,

                            name:
                                track.name,

                            artist:
                                artists,

                            artists:
                                track.artists || [],

                            artistId:
                                artistId,

                            image:
                                image,

                            spotifyUrl:
                                track.external_urls
                                    ?.spotify || "",

                            uri:
                                track.uri
                        };
                    });


            // --------------------------------
            // 重複削除
            // --------------------------------

            const uniqueTracks =
                Array.from(
                    new Map(
                        tracks.map(
                            track => [
                                track.id,
                                track
                            ]
                        )
                    ).values()
                );


            // --------------------------------
            // シャッフル
            // --------------------------------

            for (
                let i = uniqueTracks.length - 1;
                i > 0;
                i--
            ) {

                const j =
                    Math.floor(
                        Math.random() *
                        (i + 1)
                    );


                [
                    uniqueTracks[i],
                    uniqueTracks[j]
                ] = [
                    uniqueTracks[j],
                    uniqueTracks[i]
                ];
            }


            console.log(
                "取得した曲数:",
                uniqueTracks.length
            );


            if (
                uniqueTracks.length === 0
            ) {

                console.log(
                    "このアーティストの曲が見つかりませんでした"
                );

                return res.json([]);
            }


            console.log(
                "アーティスト曲取得完了:",
                artistName
            );

            console.log(
                "----------------------------------------"
            );


            // 最大10曲
            res.json(
                uniqueTracks.slice(
                    0,
                    10
                )
            );


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
// ========================================

app.get(
    "/api/genre-tracks",
    async (req, res) => {

        try {

            const genre =
                String(
                    req.query.genre || ""
                ).trim();


            if (
                !genre ||
                genre === "all"
            ) {

                return res.json([]);
            }


            const token =
                await getSpotifyToken();


            const params =
                new URLSearchParams({

                    q:
                        `genre:${genre}`,

                    type:
                        "track",

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
                    .map(track => ({

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
                                .join(", ") ||
                            "",

                        artists:
                            track.artists || [],

                        image:
                            track.album
                                ?.images?.[0]?.url ||
                            "",

                        spotifyUrl:
                            track.external_urls
                                ?.spotify || "",

                        uri:
                            track.uri,

                        artistId:
                            track.artists?.[0]?.id ||
                            ""
                    }));


            console.log(
                "Genre:",
                genre,
                "Tracks:",
                tracks.length
            );


            res.json(tracks);

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

                    q: q,

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


            // --------------------------------
            // 曲
            // --------------------------------

            const tracks =
                (data.tracks?.items || [])
                    .map(track => ({

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
                                .join(", ") ||
                            "",

                        artists:
                            track.artists || [],

                        image:
                            track.album
                                ?.images?.[0]?.url ||
                            "",

                        spotifyUrl:
                            track.external_urls
                                ?.spotify || "",

                        uri:
                            track.uri,

                        artistId:
                            track.artists?.[0]?.id ||
                            ""
                    }));


            // --------------------------------
            // アーティスト
            // --------------------------------

            const artists =
                (data.artists?.items || [])
                    .map(artist => ({

                        id:
                            artist.id,

                        name:
                            artist.name,

                        image:
                            artist.images?.[0]?.url ||
                            "",

                        spotifyUrl:
                            artist.external_urls
                                ?.spotify || ""
                    }));


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
// TOP TRACKS
// ========================================

app.get(
    "/api/top-tracks",
    async (req, res) => {

        try {

            // --------------------------------
            // ログイン確認
            // --------------------------------

            if (!spotifyAccessToken) {

                return res
                    .status(401)
                    .json({
                        error:
                            "Spotifyにログインしてください"
                    });
            }


            // --------------------------------
            // Spotifyから取得
            // --------------------------------

            const data =
                await spotifyFetch(
                    "https://api.spotify.com/v1/me/top/tracks?limit=50",
                    {
                        headers: {
                            Authorization:
                                `Bearer ${spotifyAccessToken}`
                        }
                    }
                );


            // --------------------------------
            // 整形
            // --------------------------------

            const tracks =
                (data.items || [])
                    .map(track => ({

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
                                .join(", ") ||
                            "",

                        artists:
                            track.artists || [],

                        image:
                            track.album
                                ?.images?.[0]?.url ||
                            "",

                        spotifyUrl:
                            track.external_urls
                                ?.spotify || "",

                        uri:
                            track.uri,

                        artistId:
                            track.artists?.[0]?.id ||
                            ""
                    }));


            res.json(tracks);


        } catch (error) {

            console.error(
                "Top Tracks Error:",
                error
            );


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