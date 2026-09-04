const express = require("express");
const dotenv = require("dotenv");
const crypto = require("crypto");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const REDIRECT_URI =
    process.env.SPOTIFY_REDIRECT_URI ||
    `http://127.0.0.1:${PORT}/auth/callback`;

let pkceVerifier = "";
let spotifyAccessToken = "";


// ==================================================
// 共通：Spotify APIを呼ぶ
// ==================================================

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

        throw new Error(message);
    }

    return data;
}


// ==================================================
// Base64 URL
// ==================================================

function base64url(buffer) {

    return buffer
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

}


// ==================================================
// Spotifyログイン
// ==================================================

app.get("/auth/login", (req, res) => {

    try {

        if (!CLIENT_ID) {

            return res
                .status(500)
                .send("SPOTIFY_CLIENT_ID が設定されていません。");

        }

        const verifier =
            base64url(
                crypto.randomBytes(64)
            );

        const challenge =
            base64url(
                crypto
                    .createHash("sha256")
                    .update(verifier)
                    .digest()
            );

        pkceVerifier = verifier;


        const params =
            new URLSearchParams({

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


        const url =
            `https://accounts.spotify.com/authorize?${params.toString()}`;


        res.redirect(url);

    } catch (error) {

        console.error(
            "Login Error:",
            error
        );

        res
            .status(500)
            .send("Spotifyログインの準備に失敗しました。");

    }

});


// ==================================================
// Spotifyログイン callback
// ==================================================

app.get("/auth/callback", async (req, res) => {

    try {

        const {
            code,
            error
        } = req.query;


        if (error) {

            return res
                .status(400)
                .send(
                    `Spotifyログインエラー: ${error}`
                );

        }


        if (!code) {

            return res
                .status(400)
                .send(
                    "認証コードがありません。"
                );

        }


        if (!pkceVerifier) {

            return res
                .status(400)
                .send(
                    "PKCE認証情報がありません。もう一度ログインしてください。"
                );

        }


        const body =
            new URLSearchParams({

                client_id: CLIENT_ID,

                grant_type: "authorization_code",

                code: code,

                redirect_uri: REDIRECT_URI,

                code_verifier: pkceVerifier

            });


        const response =
            await fetch(
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


        spotifyAccessToken =
            data.access_token;


        // 使用済みPKCEを消す
        pkceVerifier = "";


        res.send(`

            <!DOCTYPE html>

            <html lang="ja">

            <head>

                <meta charset="UTF-8">

                <title>Spotifyログイン完了</title>

            </head>

            <body>

                <p>
                    Spotifyログイン完了！
                    ページを戻しています...
                </p>

                <script>

                    localStorage.setItem(
                        "spotify_access_token",
                        ${JSON.stringify(
                            spotifyAccessToken
                        )}
                    );

                    location.href = "/";

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


// ==================================================
// Client Credentials Token
// ==================================================

async function getSpotifyToken() {

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


    const response =
        await fetch(
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
            data
        );

        throw new Error(
            data.error_description ||
            "Spotify token取得失敗"
        );

    }


    return data.access_token;

}


// ==================================================
// アーティスト検索
// ==================================================

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

                limit: "10"

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
                            artist.images?.[0]?.url || "",

                        spotifyUrl:
                            artist.external_urls?.spotify || ""

                    })
                );


        console.log(
            "Artist Search:",
            q,
            artists.length
        );


        res.json(artists);

    } catch (error) {

        console.error(
            "Artist Search Error:",
            error
        );

        res
            .status(500)
            .json({

                error:
                    error.message ||
                    "アーティスト検索に失敗しました"

            });

    }

});


// ==================================================
// アーティストの曲取得
// ==================================================

app.get("/api/artist-tracks", async (req, res) => {

    try {

        const artistId =
            String(
                req.query.id || ""
            ).trim();


        if (!artistId) {

            return res.json([]);

        }


        const token =
            await getSpotifyToken();


        // ==================================================
        // ★重要
        // 日本のSpotifyカタログを指定
        // ==================================================

        const albumParams =
            new URLSearchParams({

                include_groups:
                    "album,single,compilation",

                limit:
                    "10",

                market:
                    "JP"

            });


        const albumUrl =
            `https://api.spotify.com/v1/artists/${encodeURIComponent(
                artistId
            )}/albums?${albumParams.toString()}`;


        const albumData =
            await spotifyFetch(
                albumUrl,
                {

                    headers: {

                        Authorization:
                            `Bearer ${token}`

                    }

                }
            );


        const albums =
            albumData.items || [];


        console.log(
            "Artist:",
            artistId
        );

        console.log(
            "Albums:",
            albums.length
        );


        if (albums.length === 0) {

            console.log(
                "アルバムがありません"
            );

            return res.json([]);

        }


        const allTracks = [];


        // ==================================================
        // 各アルバムの曲を取得
        // ==================================================

        for (const album of albums) {

            try {

                const trackParams =
                    new URLSearchParams({

                        limit:
                            "50",

                        market:
                            "JP"

                    });


                const trackUrl =
                    `https://api.spotify.com/v1/albums/${encodeURIComponent(
                        album.id
                    )}/tracks?${trackParams.toString()}`;


                const trackData =
                    await spotifyFetch(
                        trackUrl,
                        {

                            headers: {

                                Authorization:
                                    `Bearer ${token}`

                            }

                        }
                    );


                const tracks =
                    trackData.items || [];


                // ==================================================
                // ★選択したアーティスト本人が参加している曲だけ
                // ==================================================

                const artistTracks =
                    tracks
                        .filter(
                            track =>

                                track.artists?.some(
                                    artist =>
                                        artist.id ===
                                        artistId
                                )
                        )
                        .map(
                            track => ({

                                id:
                                    track.id,

                                title:
                                    track.name,

                                artist:
                                    track.artists
                                        ?.map(
                                            artist =>
                                                artist.name
                                        )
                                        .join(", ") ||
                                    "",

                                image:
                                    album.images?.[0]?.url ||
                                    "",

                                spotifyUrl:
                                    track.external_urls
                                        ?.spotify ||
                                    "",

                                uri:
                                    track.uri,

                                artistId:
                                    artistId

                            })
                        );


                allTracks.push(
                    ...artistTracks
                );


            } catch (error) {

                console.error(
                    `アルバム ${album.id} の曲取得失敗:`,
                    error.message
                );

            }

        }


        // ==================================================
        // 重複削除
        // ==================================================

        const uniqueTracks =
            Array.from(

                new Map(

                    allTracks.map(
                        track =>
                            [
                                track.id,
                                track
                            ]
                    )

                ).values()

            );


        // ==================================================
        // シャッフル
        // ==================================================

        uniqueTracks.sort(
            () =>
                Math.random() - 0.5
        );


        console.log(
            "取得した曲数:",
            uniqueTracks.length
        );


        // 最大30曲
        res.json(
            uniqueTracks.slice(
                0,
                30
            )
        );


    } catch (error) {

        console.error(
            "Artist Tracks Error:",
            error
        );

        res
            .status(500)
            .json({

                error:
                    error.message ||
                    "アーティストの曲取得に失敗しました"

            });

    }

});


// ==================================================
// ジャンル検索
// ==================================================

app.get("/api/genre-tracks", async (req, res) => {

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
                .map(
                    track => ({

                        id:
                            track.id,

                        title:
                            track.name,

                        artist:
                            track.artists
                                ?.map(
                                    artist =>
                                        artist.name
                                )
                                .join(", ") ||
                            "",

                        image:
                            track.album
                                ?.images?.[0]?.url ||
                            "",

                        spotifyUrl:
                            track.external_urls
                                ?.spotify ||
                            "",

                        uri:
                            track.uri,

                        artistId:
                            track.artists?.[0]?.id ||
                            ""

                    })
                );


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

        res
            .status(500)
            .json({

                error:
                    error.message ||
                    "ジャンル検索に失敗しました"

            });

    }

});


// ==================================================
// 曲・アーティスト検索
// ==================================================

app.get("/api/search", async (req, res) => {

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
                    track => ({

                        id:
                            track.id,

                        title:
                            track.name,

                        artist:
                            track.artists
                                ?.map(
                                    artist =>
                                        artist.name
                                )
                                .join(", ") ||
                            "",

                        image:
                            track.album
                                ?.images?.[0]?.url ||
                            "",

                        spotifyUrl:
                            track.external_urls
                                ?.spotify ||
                            "",

                        uri:
                            track.uri,

                        artistId:
                            track.artists?.[0]?.id ||
                            ""

                    })
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

        res
            .status(500)
            .json({

                error:
                    error.message ||
                    "検索に失敗しました"

            });

    }

});


// ==================================================
// TOP TRACKS
// ==================================================

app.get("/api/top-tracks", async (req, res) => {

    try {

        if (!spotifyAccessToken) {

            return res
                .status(401)
                .json({

                    error:
                        "Spotifyにログインしてください"

                });

        }


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


        const tracks =
            (data.items || [])
                .map(
                    track => ({

                        id:
                            track.id,

                        title:
                            track.name,

                        artist:
                            track.artists
                                ?.map(
                                    artist =>
                                        artist.name
                                )
                                .join(", ") ||
                            "",

                        image:
                            track.album
                                ?.images?.[0]?.url ||
                            "",

                        spotifyUrl:
                            track.external_urls
                                ?.spotify ||
                            "",

                        uri:
                            track.uri,

                        artistId:
                            track.artists?.[0]?.id ||
                            ""

                    })
                );


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

});


// ==================================================
// サーバー起動
// ==================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Music Picker起動！ http://127.0.0.1:${PORT}`
        );

    }
);