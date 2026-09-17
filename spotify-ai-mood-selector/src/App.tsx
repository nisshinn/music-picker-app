import React, { useState, useEffect } from "react";
import { Sparkles, Heart, Music, Share2, Copy, Check, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";
import { Navbar } from "./components/Navbar.tsx";
import { MoodSelector } from "./components/MoodSelector.tsx";
import { PlayerController } from "./components/PlayerController.tsx";
import { TrackCard } from "./components/TrackCard.tsx";
import { FavoritesView } from "./components/FavoritesView.tsx";
import { HistoryView, HistoryItem } from "./components/HistoryView.tsx";
import { BottomPlayerBar } from "./components/BottomPlayerBar.tsx";
import { SpotifyLoginModal } from "./components/SpotifyLoginModal.tsx";
import { useSpotifyAuth } from "./context/SpotifyAuthContext.tsx";
import type { RecommendRequest, RecommendResponse, Track, FavoriteTrack } from "./types.ts";

const INITIAL_DEFAULT_RESPONSE: RecommendResponse = {
  mood: "テンションを上げたい",
  curatorNote: "エネルギッシュな高揚感と爽快な疾走感で、モチベーションを一気に最大値まで引き上げる名曲5選です。",
  tracks: [
    {
      id: "0VjIjW4GlUZAMYd2vXMi3b",
      title: "Blinding Lights",
      artist: "The Weeknd",
      spotifyTrackId: "0VjIjW4GlUZAMYd2vXMi3b",
      spotifyUrl: "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b",
      albumArt: "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36",
      reason: "80年代風の疾走感あふれるシンセウェーブサウンドが、一気にモチベーションと高揚感を高めてくれます。",
      genre: "Synth-pop",
      tempo: "アップテンポ (171 BPM)",
      vibeKeywords: ["高揚感", "疾走感", "エネルギッシュ"],
      durationMs: 200040,
    },
    {
      id: "463CkQjx2Zk1yXoBuierM9",
      title: "Levitating",
      artist: "Dua Lipa",
      spotifyTrackId: "463CkQjx2Zk1yXoBuierM9",
      spotifyUrl: "https://open.spotify.com/track/463CkQjx2Zk1yXoBuierM9",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273bd26ede1ae69327010d49946",
      reason: "軽快なディスコビートとキャッチーなフックが自然と体を揺らし、ポジティブな気分へと引き上げます。",
      genre: "Nu-Disco / Pop",
      tempo: "アップテンポ (103 BPM)",
      vibeKeywords: ["ディスコ", "グルーヴ", "ハッピー"],
      durationMs: 203064,
    },
    {
      id: "6MCjmrxpJ9JalqrEjgpou2",
      title: "夜に駆ける",
      artist: "YOASOBI",
      spotifyTrackId: "6MCjmrxpJ9JalqrEjgpou2",
      spotifyUrl: "https://open.spotify.com/track/6MCjmrxpJ9JalqrEjgpou2",
      albumArt: "https://i.scdn.co/image/ab67616d0000b27329712aab7cf4dcfbe4f169f4",
      reason: "ピアノの速いパッセージと爽快なリズム展開で、テンションを最高潮まで上げてくれる一曲です。",
      genre: "J-Pop",
      tempo: "アップテンポ (130 BPM)",
      vibeKeywords: ["ピアノロック", "爽快", "ドラマチック"],
      durationMs: 261013,
    },
    {
      id: "2Foc5Q5nqNiosCNqttzHof",
      title: "Get Lucky (feat. Pharrell Williams and Nile Rodgers)",
      artist: "Daft Punk",
      spotifyTrackId: "2Foc5Q5nqNiosCNqttzHof",
      spotifyUrl: "https://open.spotify.com/track/2Foc5Q5nqNiosCNqttzHof",
      albumArt: "https://i.scdn.co/image/ab67616d0000b2739b9b36b0e22870b9f542d935",
      reason: "ナイル・ロジャースのカッティングギターとファレルの歌声が心地よく、気分転換に最適です。",
      genre: "Funk / Nu-Disco",
      tempo: "ミディアムアップ (116 BPM)",
      vibeKeywords: ["ファンキー", "洗練", "ダンサブル"],
      durationMs: 369626,
    },
    {
      id: "6b8Be6ljOzmk1zslL0Yg9W",
      title: "24K Magic",
      artist: "Bruno Mars",
      spotifyTrackId: "6b8Be6ljOzmk1zslL0Yg9W",
      spotifyUrl: "https://open.spotify.com/track/6b8Be6ljOzmk1zslL0Yg9W",
      albumArt: "https://i.scdn.co/image/ab67616d0000b2739665e8a71d7986060c5db611",
      reason: "華やかなトークボックスと分厚いファンクベースで、一瞬で主役気分になれるパーティーチューンです。",
      genre: "Funk / R&B",
      tempo: "アップテンポ (106 BPM)",
      vibeKeywords: ["華やか", "グルーヴィー", "ゴージャス"],
      durationMs: 225983,
    },
  ],
};

export default function App() {
  const {
    isLoggedIn,
    playSpotifyTrack,
    pauseSpotifyTrack,
    playerState,
    openLoginModal,
    sdkError,
    loginErrorDetails,
  } = useSpotifyAuth();

  const [activeTab, setActiveTab] = useState<"recommend" | "favorites" | "history">("recommend");
  const [recommendation, setRecommendation] = useState<RecommendResponse>(INITIAL_DEFAULT_RESPONSE);
  const [activeTrackIndex, setActiveTrackIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Playback state (Requested: 再生し始めたら画面したに再生バーが出てくるように)
  const [hasStartedPlaying, setHasStartedPlaying] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Playback mode options
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [isRepeat, setIsRepeat] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);

  // LocalStorage state for Favorites
  const [favorites, setFavorites] = useState<FavoriteTrack[]>(() => {
    try {
      const saved = localStorage.getItem("spotify_ai_favorites");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // LocalStorage state for History
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem("spotify_ai_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync favorites with localStorage
  useEffect(() => {
    try {
      localStorage.setItem("spotify_ai_favorites", JSON.stringify(favorites));
    } catch (e) {
      console.error("Failed to save favorites to localStorage", e);
    }
  }, [favorites]);

  // Sync history with localStorage
  useEffect(() => {
    try {
      localStorage.setItem("spotify_ai_history", JSON.stringify(history));
    } catch (e) {
      console.error("Failed to save history to localStorage", e);
    }
  }, [history]);

  // Sync Spotify SDK player state if paused/playing
  useEffect(() => {
    if (playerState) {
      setIsPlaying(!playerState.paused);
      if (!playerState.paused) {
        setHasStartedPlaying(true);
      }
    }
  }, [playerState?.paused]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleRecommend = async (req: RecommendRequest) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });

      if (!res.ok) {
        throw new Error(`API error status: ${res.status}`);
      }

      const data: RecommendResponse = await res.json();
      setRecommendation(data);
      setActiveTrackIndex(0);

      // Add to history
      const newHistoryItem: HistoryItem = {
        id: `hist-${Date.now()}`,
        timestamp: Date.now(),
        response: data,
      };
      setHistory((prev) => [newHistoryItem, ...prev.slice(0, 19)]); // keep last 20
      showToast(`「${data.mood}」の5曲を厳選しました！`);

      // Smooth scroll to player on mobile
      const playerEl = document.getElementById("continuous-player-controller");
      if (playerEl) {
        playerEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } catch (err: any) {
      console.error("Failed to fetch recommendation:", err);
      showToast("選曲データの取得でエラーが発生しました。フォールバック曲を表示します。");
    } finally {
      setIsLoading(false);
    }
  };

  const isTrackFavorite = (trackId: string) => {
    return favorites.some((f) => f.spotifyTrackId === trackId || f.id === trackId);
  };

  const handleToggleFavorite = (track: Track) => {
    const exists = isTrackFavorite(track.spotifyTrackId || track.id);
    if (exists) {
      setFavorites((prev) =>
        prev.filter((f) => f.spotifyTrackId !== track.spotifyTrackId && f.id !== track.id)
      );
      showToast(`「${track.title}」をお気に入りから削除しました`);
    } else {
      const newFav: FavoriteTrack = {
        ...track,
        favoritedAt: Date.now(),
      };
      setFavorites((prev) => [newFav, ...prev]);
      showToast(`「${track.title}」をお気に入りに追加しました！`);
    }
  };

  const handleSelectTrack = (index: number) => {
    setActiveTrackIndex(index);
    setHasStartedPlaying(true);
    setIsPlaying(true);

    const selectedTrack = recommendation.tracks[index];
    if (isLoggedIn && selectedTrack?.spotifyTrackId) {
      playSpotifyTrack(selectedTrack.spotifyTrackId);
    }
  };

  const handleTogglePlay = () => {
    setHasStartedPlaying(true);
    const newPlaying = !isPlaying;
    setIsPlaying(newPlaying);

    const activeTrack = recommendation.tracks[activeTrackIndex] || recommendation.tracks[0];
    if (isLoggedIn && activeTrack?.spotifyTrackId) {
      if (newPlaying) {
        playSpotifyTrack(activeTrack.spotifyTrackId);
      } else {
        pauseSpotifyTrack();
      }
    }
  };

  const handleRestoreHistory = (item: HistoryItem) => {
    setRecommendation(item.response);
    setActiveTrackIndex(0);
    setActiveTab("recommend");
    showToast(`「${item.response.mood}」の選曲を復元しました`);
  };

  const handlePlayFavoriteInController = (track: Track) => {
    const foundIdx = recommendation.tracks.findIndex(
      (t) => t.spotifyTrackId === track.spotifyTrackId
    );
    if (foundIdx !== -1) {
      setActiveTrackIndex(foundIdx);
    } else {
      setRecommendation((prev) => ({
        ...prev,
        tracks: [track, ...prev.tracks.filter((t) => t.spotifyTrackId !== track.spotifyTrackId).slice(0, 4)],
      }));
      setActiveTrackIndex(0);
    }
    setHasStartedPlaying(true);
    setIsPlaying(true);
    if (isLoggedIn && track.spotifyTrackId) {
      playSpotifyTrack(track.spotifyTrackId);
    }
    setActiveTab("recommend");
    showToast(`「${track.title}」をプレイヤーで再生します`);
  };

  const handleCopyAllTracks = () => {
    if (!recommendation.tracks || recommendation.tracks.length === 0) return;
    const text = `【${recommendation.mood} - AI選曲プレイリスト】\n` +
      recommendation.tracks
        .map((t, i) => `${i + 1}. ${t.title} - ${t.artist}\n   Spotify: ${t.spotifyUrl}`)
        .join("\n\n");
    navigator.clipboard.writeText(text);
    showToast("5曲のリストをクリップボードにコピーしました！");
  };

  const currentTrack = recommendation.tracks[activeTrackIndex] || recommendation.tracks[0];
  const isCurrentFav = currentTrack ? isTrackFavorite(currentTrack.spotifyTrackId || currentTrack.id) : false;

  return (
    <div className="min-h-screen bg-[#121212] text-neutral-100 flex flex-col font-sans selection:bg-[#1DB954] selection:text-black">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="toast-notification"
          className="fixed bottom-24 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#282828] text-white text-xs sm:text-sm font-semibold border border-[#383838] shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <Sparkles className="w-4 h-4 text-[#1DB954]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        favoritesCount={favorites.length}
        historyCount={history.length}
      />

      {/* Login Error Notification Banner (if any) */}
      {(loginErrorDetails || sdkError) && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-200 shadow-md">
            <div className="flex items-center gap-2 truncate">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="truncate">
                {loginErrorDetails?.message || sdkError}
              </span>
            </div>
            <button
              onClick={openLoginModal}
              className="px-3 py-1 rounded-lg bg-red-900 hover:bg-red-800 text-white font-bold text-xs shrink-0 transition-colors"
            >
              設定・ログイン画面を開く
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main
        className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 transition-all ${
          hasStartedPlaying ? "pb-32 sm:pb-36" : "pb-12"
        }`}
      >
        {activeTab === "recommend" && (
          <div className="space-y-8">
            {/* Mood Input & Presets & Artist Selector */}
            <MoodSelector
              onRecommend={handleRecommend}
              isLoading={isLoading}
            />

            {/* AI Curation Insights Banner */}
            <div
              id="curator-insight-banner"
              className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#181818] via-[#1a1f1b] to-[#181818] border border-[#282828] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-[#1DB954]/20 text-[#1DB954] shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-[#1DB954] uppercase tracking-wider">
                      AI CURATOR COMMENT
                    </span>
                    <span className="text-xs text-neutral-500">•</span>
                    <span className="text-xs text-neutral-300 font-bold">
                      「{recommendation.mood}」
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                    {recommendation.curatorNote}
                  </p>
                </div>
              </div>

              {/* Action: Copy list / Share */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  id="btn-copy-all-tracks"
                  onClick={handleCopyAllTracks}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#252525] hover:bg-[#303030] text-xs font-semibold text-neutral-300 border border-[#333] transition-colors"
                  title="5曲の曲名とURLをまとめてコピー"
                >
                  <Copy className="w-3.5 h-3.5 text-[#1DB954]" />
                  <span>5曲をコピー</span>
                </button>
              </div>
            </div>

            {/* Continuous Playback Controller & Embedded Player */}
            <PlayerController
              tracks={recommendation.tracks}
              currentIndex={activeTrackIndex}
              onSelectIndex={handleSelectTrack}
              isFavorite={isCurrentFav}
              onToggleFavorite={handleToggleFavorite}
              autoAdvance={autoAdvance}
              setAutoAdvance={setAutoAdvance}
              isRepeat={isRepeat}
              setIsRepeat={setIsRepeat}
              isShuffle={isShuffle}
              setIsShuffle={setIsShuffle}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
            />

            {/* 5 Tracks Detailed Grid */}
            <section id="recommended-tracks-section" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                    <Music className="w-5 h-5 text-[#1DB954]" />
                    <span>厳選された5曲リスト</span>
                  </h3>
                  <p className="text-xs text-neutral-400">
                    カードをクリックして再生、または各曲ごとに即時試聴・Spotifyでフル再生できます
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                {recommendation.tracks.map((track, idx) => (
                  <TrackCard
                    key={track.id || idx}
                    track={track}
                    index={idx}
                    isActive={idx === activeTrackIndex}
                    onSelectTrack={handleSelectTrack}
                    isFavorite={isTrackFavorite(track.spotifyTrackId || track.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Favorites View */}
        {activeTab === "favorites" && (
          <FavoritesView
            favorites={favorites}
            onSelectTrack={handlePlayFavoriteInController}
            onRemoveFavorite={(id) => {
              setFavorites((prev) => prev.filter((f) => f.id !== id && f.spotifyTrackId !== id));
              showToast("お気に入りから削除しました");
            }}
            onClearAllFavorites={() => {
              setFavorites([]);
              showToast("すべてのお気に入りをクリアしました");
            }}
            onGoToRecommend={() => setActiveTab("recommend")}
          />
        )}

        {/* History View */}
        {activeTab === "history" && (
          <HistoryView
            history={history}
            onRestoreHistory={handleRestoreHistory}
            onClearHistory={() => {
              setHistory([]);
              showToast("選曲履歴をクリアしました");
            }}
            onGoToRecommend={() => setActiveTab("recommend")}
          />
        )}
      </main>

      {/* Persistent Bottom Playback Bar (Requested: 再生し始めたら画面したに再生バーが出てくるように) */}
      {hasStartedPlaying && currentTrack && (
        <BottomPlayerBar
          currentTrack={currentTrack}
          tracks={recommendation.tracks}
          currentIndex={activeTrackIndex}
          onSelectIndex={handleSelectTrack}
          isFavorite={isCurrentFav}
          onToggleFavorite={handleToggleFavorite}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          isShuffle={isShuffle}
          setIsShuffle={setIsShuffle}
          isRepeat={isRepeat}
          setIsRepeat={setIsRepeat}
        />
      )}

      {/* Footer */}
      <footer
        id="app-footer"
        className={`w-full bg-[#0d0d0d] border-t border-[#222] py-6 px-4 text-center text-xs text-neutral-500 mt-auto ${
          hasStartedPlaying ? "mb-20" : ""
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1DB954]"></span>
            <span className="font-semibold text-neutral-400">Spotify AI Mood Selector</span>
            <span>— Powered by Gemini 3.8 Flash & Spotify Web API</span>
          </div>

          <div className="flex items-center gap-4 text-neutral-500">
            <span>Spotify is a trademark of Spotify AB</span>
            <a
              href="https://open.spotify.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#1DB954] transition-colors flex items-center gap-1"
            >
              <span>Spotify Web</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>

      {/* Spotify Login & Troubleshooting Modal */}
      <SpotifyLoginModal />
    </div>
  );
}
