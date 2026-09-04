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

// ================================
// PKCE用
// ================================
function base64url(buffer) {
    return buffer
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

// ================================
// Spotifyログイン
// ================================
app.get("/auth/login", (req, res) => {
    const verifier = base64url(crypto.randomBytes(64));

    const challenge = base64url(
        crypto
            .createHash("sha256")
            .update(verifier)
            .digest()
    );

    pkceVerifier = verifier;

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

    res.redirect(
        `https://accounts.spotify.com/authorize?${params.toString()}`
    );
});

// ================================
// Spotifyログイン callback
// ================================
app.get("/auth/callback", async (req, res) => {
    try {
        const { code, error } = req.query;

        if (error) {
            return res.status(400).send(`Spotifyログインエラー: ${error}`);
        }

        if (!code) {
            return res.status(400).send("認証コードがありません");
        }

        const body = new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: "authorization_code",
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: pkceVerifier
        });

        const response = await fetch(
            "https://accounts.spotify.com/api/token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Spotify Token Error:", data);
            return res.status(400).send("Spotify認証に失敗しました");
        }

        spotifyAccessToken = data.access_token;

        res.send(`
            <script>
                localStorage.setItem(
                    "spotify_access_token",
                    ${JSON.stringify(spotifyAccessToken)}
                );

                location.href = "/";
            </script>
        `);

    } catch (error) {
        console.error("Callback Error:", error);
        res.status(500).send("ログイン処理中にエラーが発生しました");
    }
});

// ================================
// Client Credentials Token
// ================================
async function getSpotifyToken() {
    const credentials = Buffer
        .from(`${CLIENT_ID}:${CLIENT_SECRET}`)
        .toString("base64");

    const response = await fetch(
        "https://accounts.spotify.com/api/token",
        {
            method: "POST",
            headers: {
                "Authorization": `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: "grant_type=client_credentials"
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error_description || "Spotify token取得失敗"
        );
    }

    return data.access_token;
}

// ================================
// アーティスト検索
// ================================
app.get("/api/artists", async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();

        if (!q) {
            return res.json([]);
        }

        const token = await getSpotifyToken();

        const params = new URLSearchParams({
            q,
            type: "artist",
            limit: "10"
        });

        const response = await fetch(
            `https://api.spotify.com/v1/search?${params}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Artist Search Error:", data);
            return res.status(response.status).json({
                error: data.error?.message || "アーティスト検索に失敗しました"
            });
        }

        const artists = (data.artists?.items || []).map(artist => ({
            id: artist.id,
            name: artist.name,
            image: artist.images?.[0]?.url || "",
            spotifyUrl: artist.external_urls?.spotify || ""
        }));

        res.json(artists);

    } catch (error) {
        console.error("Artist Search Error:", error);
        res.status(500).json({
            error: "アーティスト検索に失敗しました"
        });
    }
});

// ================================
// アーティストの曲取得
// ================================
app.get("/api/artist-tracks", async (req, res) => {
    try {
        const artistId = String(req.query.id || "").trim();

        if (!artistId) {
            return res.json([]);
        }

        const token = await getSpotifyToken();

        // アーティストのアルバムを取得
        const albumParams = new URLSearchParams({
            include_groups: "album,single,compilation",
            limit: "10"
        });

        const albumResponse = await fetch(
            `https://api.spotify.com/v1/artists/${artistId}/albums?${albumParams}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const albumData = await albumResponse.json();

        if (!albumResponse.ok) {
            console.error("Artist Album Error:", albumData);

            return res.status(albumResponse.status).json({
                error: albumData.error?.message || "アルバム取得に失敗しました"
            });
        }

        const albums = albumData.items || [];

        const allTracks = [];

        for (const album of albums) {
            const trackResponse = await fetch(
                `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=50`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const trackData = await trackResponse.json();

            if (!trackResponse.ok) {
                continue;
            }

            const tracks = (trackData.items || [])
                // ★重要
                // 選択したアーティスト本人が参加している曲だけ
                .filter(track =>
                    track.artists?.some(
                        artist => artist.id === artistId
                    )
                )
                .map(track => ({
                    id: track.id,
                    title: track.name,
                    artist: track.artists
                        ?.map(a => a.name)
                        .join(", ") || "",
                    image: album.images?.[0]?.url || "",
                    spotifyUrl:
                        track.external_urls?.spotify || "",
                    uri: track.uri,
                    artistId
                }));

            allTracks.push(...tracks);
        }

        // 重複削除
        const uniqueTracks = Array.from(
            new Map(
                allTracks.map(track => [track.id, track])
            ).values()
        );

        // シャッフル
        uniqueTracks.sort(() => Math.random() - 0.5);

        res.json(uniqueTracks.slice(0, 30));

    } catch (error) {
        console.error("Artist Tracks Error:", error);

        res.status(500).json({
            error: "アーティストの曲取得に失敗しました"
        });
    }
});

// ================================
// ジャンル検索
// ================================
app.get("/api/genre-tracks", async (req, res) => {
    try {
        const genre = String(req.query.genre || "").trim();

        if (!genre || genre === "all") {
            return res.json([]);
        }

        const token = await getSpotifyToken();

        const params = new URLSearchParams({
            q: `genre:${genre}`,
            type: "track",
            limit: "10"
        });

        const response = await fetch(
            `https://api.spotify.com/v1/search?${params}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: data.error?.message || "ジャンル検索に失敗しました"
            });
        }

        const tracks = (data.tracks?.items || []).map(track => ({
            id: track.id,
            title: track.name,
            artist: track.artists
                ?.map(a => a.name)
                .join(", ") || "",
            image: track.album?.images?.[0]?.url || "",
            spotifyUrl:
                track.external_urls?.spotify || "",
            uri: track.uri,
            artistId: track.artists?.[0]?.id || ""
        }));

        res.json(tracks);

    } catch (error) {
        console.error("Genre Tracks Error:", error);

        res.status(500).json({
            error: "ジャンル検索に失敗しました"
        });
    }
});

// ================================
// 曲・アーティスト検索
// ================================
app.get("/api/search", async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();

        if (!q) {
            return res.json({
                tracks: [],
                artists: []
            });
        }

        const token = await getSpotifyToken();

        const params = new URLSearchParams({
            q,
            type: "track,artist",
            limit: "10"
        });

        const response = await fetch(
            `https://api.spotify.com/v1/search?${params}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: data.error?.message || "検索に失敗しました"
            });
        }

        const tracks = (data.tracks?.items || []).map(track => ({
            id: track.id,
            title: track.name,
            artist: track.artists
                ?.map(a => a.name)
                .join(", ") || "",
            image: track.album?.images?.[0]?.url || "",
            spotifyUrl:
                track.external_urls?.spotify || "",
            uri: track.uri,
            artistId: track.artists?.[0]?.id || ""
        }));

        const artists = (data.artists?.items || []).map(artist => ({
            id: artist.id,
            name: artist.name,
            image: artist.images?.[0]?.url || "",
            spotifyUrl:
                artist.external_urls?.spotify || ""
        }));

        res.json({
            tracks,
            artists
        });

    } catch (error) {
        console.error("Search Error:", error);

        res.status(500).json({
            error: "検索に失敗しました"
        });
    }
});

// ================================
// Top Tracks
// ================================
app.get("/api/top-tracks", async (req, res) => {
    try {
        if (!spotifyAccessToken) {
            return res.status(401).json({
                error: "Spotifyにログインしてください"
            });
        }

        const response = await fetch(
            "https://api.spotify.com/v1/me/top/tracks?limit=50",
            {
                headers: {
                    Authorization:
                        `Bearer ${spotifyAccessToken}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error:
                    data.error?.message ||
                    "トップ曲取得に失敗しました"
            });
        }

        const tracks = (data.items || []).map(track => ({
            id: track.id,
            title: track.name,
            artist: track.artists
                ?.map(a => a.name)
                .join(", ") || "",
            image: track.album?.images?.[0]?.url || "",
            spotifyUrl:
                track.external_urls?.spotify || "",
            uri: track.uri,
            artistId: track.artists?.[0]?.id || ""
        }));

        res.json(tracks);

    } catch (error) {
        console.error("Top Tracks Error:", error);

        res.status(500).json({
            error: "トップ曲取得に失敗しました"
        });
    }
});

// ================================
// サーバー起動
// ================================
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Music Picker起動！ Port: ${PORT}`);
});