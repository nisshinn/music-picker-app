const express = require("express");
const dotenv = require("dotenv");
const crypto = require("crypto");

dotenv.config();

const app = express();

// ==========================================
// Render対応ポート
// ==========================================
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

// ==========================================
// Spotifyログイン（PKCE）
// ==========================================

const spotifyRedirectUri =
    process.env.SPOTIFY_REDIRECT_URI ||
    `http://127.0.0.1:${PORT}/auth/callback`;

let pkceVerifier = "";

// Base64 URL形式
function base64url(buffer) {
    return buffer
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

// ==========================================
// Spotifyログイン開始
// ==========================================

app.get("/auth/login", (req, res) => {

    pkceVerifier =
        base64url(
            crypto.randomBytes(64)
        );

    const challenge =
        base64url(
            crypto
                .createHash("sha256")
                .update(pkceVerifier)
                .digest()
        );

    const params =
        new URLSearchParams({
            response_type: "code",

            client_id:
                process.env.SPOTIFY_CLIENT_ID,

            scope:
                "streaming user-read-email user-read-private user-modify-playback-state user-top-read",

            redirect_uri:
                spotifyRedirectUri,

            code_challenge_method:
                "S256",

            code_challenge:
                challenge
        });

    res.redirect(
        "https://accounts.spotify.com/authorize?" +
        params.toString()
    );
});

// ==========================================
// Spotifyから認証コードを受け取る
// ==========================================

app.get("/auth/callback", async (req, res) => {

    try {

        const code = req.query.code;

        if (!code) {
            return res.status(400).send(
                "Spotify認証コードがありません"
            );
        }

        const response =
            await fetch(
                "https://accounts.spotify.com/api/token",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded"
                    },

                    body:
                        new URLSearchParams({

                            client_id:
                                process.env.SPOTIFY_CLIENT_ID,

                            grant_type:
                                "authorization_code",

                            code:
                                code,

                            redirect_uri:
                                spotifyRedirectUri,

                            code_verifier:
                                pkceVerifier

                        })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            console.error(
                "Spotify OAuth Error:",
                data
            );

            return res.status(500).send(
                "Spotifyログインに失敗しました"
            );
        }

        // ブラウザにアクセストークンを渡す
        res.send(`
            <script>

                localStorage.setItem(
                    "spotify_access_token",
                    ${JSON.stringify(
                        data.access_token
                    )}
                );

                window.location.href = "/";

            </script>
        `);

    } catch (error) {

        console.error(
            "Spotify Callback Error:",
            error
        );

        res.status(500).send(
            "Spotify認証中にエラーが発生しました"
        );
    }
});

// ==========================================
// Spotifyアクセストークン取得
// ==========================================

async function getSpotifyToken() {

    const credentials =
        Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64");

    const response =
        await fetch(
            "https://accounts.spotify.com/api/token",
            {
                method: "POST",

                headers: {
                    "Authorization":
                        `Basic ${credentials}`,

                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body:
                    "grant_type=client_credentials"
            }
        );

    if (!response.ok) {

        const error =
            await response.text();

        console.error(
            "Spotify Token Error:",
            response.status,
            error
        );

        throw new Error(
            `Spotify Token Error ${response.status}`
        );
    }

    const data =
        await response.json();

    return data.access_token;
}

// ==========================================
// Spotifyアーティスト検索
// ==========================================

app.get(
    "/api/artists",
    async (req, res) => {

        try {

            const query =
                req.query.q?.trim();

            if (!query) {
                return res.json([]);
            }

            const token =
                await getSpotifyToken();

            const url =
                "https://api.spotify.com/v1/search" +
                "?q=" +
                encodeURIComponent(query) +
                "&type=artist" +
                "&limit=10";

            const response =
                await fetch(
                    url,
                    {
                        headers: {
                            "Authorization":
                                `Bearer ${token}`
                        }
                    }
                );

            if (!response.ok) {

                const error =
                    await response.text();

                console.error(
                    "Spotify Artist Search Error:",
                    response.status,
                    error
                );

                throw new Error(
                    `Spotify Artist Search Error ${response.status}`
                );
            }

            const data =
                await response.json();

            const artists =
                data.artists.items.map(
                    artist => ({

                        id:
                            artist.id,

                        name:
                            artist.name,

                        image:
                            artist.images?.[0]?.url || ""

                    })
                );

            res.json(artists);

        } catch (error) {

            console.error(
                "Spotify Artist Search Error:",
                error
            );

            res.status(500).json({
                error:
                    "アーティスト検索に失敗しました"
            });
        }
    }
);

// ==========================================
// 選択したアーティストの曲を取得
// ==========================================

app.get(
    "/api/artist-tracks",
    async (req, res) => {

        try {

            const artistId =
                req.query.id;

            if (!artistId) {

                return res.status(400).json({
                    error:
                        "アーティストIDがありません"
                });
            }

            const token =
                await getSpotifyToken();

            // アーティストのアルバム取得
            const albumsUrl =
                `https://api.spotify.com/v1/artists/${artistId}/albums` +
                "?include_groups=album,single" +
                "&market=JP" +
                "&limit=10";

            const albumsResponse =
                await fetch(
                    albumsUrl,
                    {
                        headers: {
                            "Authorization":
                                `Bearer ${token}`
                        }
                    }
                );

            if (!albumsResponse.ok) {

                const error =
                    await albumsResponse.text();

                throw new Error(error);
            }

            const albumsData =
                await albumsResponse.json();

            // ==================================
            // 各アルバムから曲を取得
            // ==================================

            const trackResults =
                await Promise.all(

                    albumsData.items.map(
                        async album => {

                            const tracksUrl =
                                `https://api.spotify.com/v1/albums/${album.id}/tracks` +
                                "?market=JP" +
                                "&limit=10";

                            const response =
                                await fetch(
                                    tracksUrl,
                                    {
                                        headers: {
                                            "Authorization":
                                                `Bearer ${token}`
                                        }
                                    }
                                );

                            if (!response.ok) {
                                return [];
                            }

                            const data =
                                await response.json();

                            return data.items.map(
                                track => ({

                                    title:
                                        track.name,

                                    artist:
                                        track.artists
                                            .map(
                                                artist =>
                                                    artist.name
                                            )
                                            .join(", "),

                                    image:
                                        album.images?.[0]?.url
                                        || "",

                                    spotifyUrl:
                                        track.external_urls
                                            ?.spotify
                                        || "",

                                    uri:
                                        track.uri,

                                    artistId:
                                        artistId

                                })
                            );
                        }
                    )
                );

            // ==================================
            // 重複削除
            // ==================================

            const uniqueSongs = [];

            const usedSongs =
                new Set();

            for (
                const song
                of trackResults.flat()
            ) {

                const key =
                    song.title.toLowerCase();

                if (!usedSongs.has(key)) {

                    usedSongs.add(key);

                    uniqueSongs.push(
                        song
                    );
                }
            }

            // ==================================
            // ランダム
            // ==================================

            uniqueSongs.sort(
                () =>
                    Math.random() - 0.5
            );

            res.json(
                uniqueSongs.slice(0, 30)
            );

        } catch (error) {

            console.error(
                "Spotify Track Error:",
                error
            );

            res.status(500).json({
                error:
                    "曲の取得に失敗しました"
            });
        }
    }
);

// ==========================================
// ジャンルからSpotifyの曲を取得
// ==========================================
// ==============================
// 🔥 Spotify TOP曲
// ==============================
app.get("/api/top-tracks", async (req, res) => {
    try {
        const accessToken = req.headers.authorization?.replace("Bearer ", "");

        if (!accessToken) {
            return res.status(401).json({
                error: "Spotifyログインが必要です"
            });
        }

        const response = await fetch(
            "https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=medium_term",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Spotify TOP Tracks Error:", data);

            return res.status(response.status).json(data);
        }

        const songs = (data.items || []).map(track => ({
            title: track.name,
            artist: track.artists
                .map(artist => artist.name)
                .join(", "),
            image: track.album?.images?.[0]?.url || "",
            uri: track.uri,
            spotifyUrl: track.external_urls?.spotify || ""
        }));

        res.json(songs);

    } catch (error) {
        console.error("TOP Tracks Error:", error);

        res.status(500).json({
            error: "TOP曲の取得に失敗しました"
        });
    }
});

app.get(
    "/api/genre-tracks",
    async (req, res) => {

        try {

            const genre =
                req.query.genre?.trim();

            if (!genre) {

                return res.status(400).json({
                    error:
                        "ジャンルがありません"
                });
            }

            const token =
                await getSpotifyToken();

            // Spotify検索用ジャンル
            const genreMap = {

                "J-POP":
                    "j-pop",

                "ロック":
                    "rock",

                "ポップ":
                    "pop",

                "アニメ":
                    "anime",

                "ボカロ":
                    "vocaloid",

                "ヒップホップ":
                    "hip-hop",

                "EDM":
                    "edm",

                "クラシック":
                    "classical",

                "ジャズ":
                    "jazz",

                "バラード":
                    "ballad"
            };

            const spotifyGenre =
                genreMap[genre] || genre;

            let query;

if (genre === "all") {
    query = "year:2020-2026";
} else {
    query = `genre:${spotifyGenre}`;
}

            const url =
                "https://api.spotify.com/v1/search" +
                "?q=" +
                encodeURIComponent(query) +
                "&type=track" +
                "&market=JP" +
                "&limit=10";

            const response =
                await fetch(
                    url,
                    {
                        headers: {
                            "Authorization":
                                `Bearer ${token}`
                        }
                    }
                );

            if (!response.ok) {

                const error =
                    await response.text();

                console.error(
                    "Spotify Genre Search Error:",
                    response.status,
                    error
                );

                throw new Error(
                    `Spotify Genre Search Error ${response.status}`
                );
            }

            const data =
                await response.json();

            const tracks =
                data.tracks.items.map(
                    track => ({

                        title:
                            track.name,

                        artist:
                            track.artists
                                .map(
                                    artist =>
                                        artist.name
                                )
                                .join(", "),

                        image:
                            track.album
                                .images?.[0]?.url
                            || "",

                        spotifyUrl:
                            track.external_urls
                                ?.spotify
                            || "",

                        uri:
                            track.uri
                    })
                );

            // シャッフル
            tracks.sort(
                () =>
                    Math.random() - 0.5
            );

            res.json(
                tracks.slice(0, 5)
            );

        } catch (error) {

            console.error(
                "Genre Track Error:",
                error
            );

            res.status(500).json({
                error:
                    "ジャンルから曲を取得できませんでした"
            });
        }
    }
);

// ==========================================
// サーバー起動
// ==========================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "Music Picker起動！"
        );

        console.log(
            `Server running on port ${PORT}`
        );
    }
);