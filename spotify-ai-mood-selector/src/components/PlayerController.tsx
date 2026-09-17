import React from "react";
import {
  SkipBack,
  SkipForward,
  Heart,
  ExternalLink,
  Repeat,
  Shuffle,
  Volume2,
  Sparkles,
  Radio,
  Play,
  Pause,
  LogIn,
  Music2,
  CheckCircle2,
} from "lucide-react";
import type { Track } from "../types.ts";
import { SpotifyEmbedPlayer } from "./SpotifyEmbedPlayer.tsx";
import { useSpotifyAuth } from "../context/SpotifyAuthContext.tsx";

interface PlayerControllerProps {
  tracks: Track[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  isFavorite: boolean;
  onToggleFavorite: (track: Track) => void;
  autoAdvance: boolean;
  setAutoAdvance: React.Dispatch<React.SetStateAction<boolean>>;
  isRepeat: boolean;
  setIsRepeat: React.Dispatch<React.SetStateAction<boolean>>;
  isShuffle: boolean;
  setIsShuffle: React.Dispatch<React.SetStateAction<boolean>>;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
}

export const PlayerController: React.FC<PlayerControllerProps> = ({
  tracks,
  currentIndex,
  onSelectIndex,
  isFavorite,
  onToggleFavorite,
  autoAdvance,
  setAutoAdvance,
  isRepeat,
  setIsRepeat,
  isShuffle,
  setIsShuffle,
  isPlaying = false,
  onTogglePlay,
}) => {
  const { isLoggedIn, openLoginModal, isLoggingIn, playSpotifyTrack, isWebPlayerReady } = useSpotifyAuth();

  if (!tracks || tracks.length === 0) return null;

  const currentTrack = tracks[currentIndex] || tracks[0];

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectIndex(currentIndex - 1);
    } else if (isRepeat) {
      onSelectIndex(tracks.length - 1);
    }
  };

  const handleNext = () => {
    if (isShuffle && tracks.length > 1) {
      let nextIdx = Math.floor(Math.random() * tracks.length);
      if (nextIdx === currentIndex) {
        nextIdx = (currentIndex + 1) % tracks.length;
      }
      onSelectIndex(nextIdx);
    } else if (currentIndex < tracks.length - 1) {
      onSelectIndex(currentIndex + 1);
    } else if (isRepeat) {
      onSelectIndex(0);
    }
  };

  const handlePlayFullViaSpotify = () => {
    if (isLoggedIn && currentTrack.spotifyTrackId) {
      playSpotifyTrack(currentTrack.spotifyTrackId);
    }
    if (onTogglePlay) onTogglePlay();
  };

  return (
    <div
      id="continuous-player-controller"
      className="w-full bg-[#181818] rounded-2xl p-5 sm:p-7 border border-[#282828] shadow-2xl relative overflow-hidden"
    >
      {/* Background ambient glow matching Spotify green */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-[#1DB954]/10 blur-3xl pointer-events-none rounded-full -mr-20 -mt-20"></div>

      <div className="relative z-10 space-y-6">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#282828]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#1DB954]/15 text-[#1DB954] border border-[#1DB954]/30">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  連続再生プレイヤー
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#252525] text-[#1DB954] font-semibold">
                  Track {currentIndex + 1} / {tracks.length}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                ブラウザ上で5曲をシームレスに試聴・再生できます
              </p>
            </div>
          </div>

          {/* Quick Playback Mode Toggles */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Auto Advance toggle */}
            <button
              id="btn-toggle-autoadvance"
              type="button"
              onClick={() => setAutoAdvance(!autoAdvance)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                autoAdvance
                  ? "bg-[#1DB954]/20 border-[#1DB954] text-[#1DB954]"
                  : "bg-[#202020] border-[#333] text-neutral-400 hover:text-white"
              }`}
              title="5曲の順番再生モード"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>連続再生: {autoAdvance ? "ON" : "OFF"}</span>
            </button>

            {/* Shuffle */}
            <button
              id="btn-toggle-shuffle"
              type="button"
              onClick={() => setIsShuffle(!isShuffle)}
              className={`p-2 rounded-full border transition-all ${
                isShuffle
                  ? "bg-[#1DB954]/20 border-[#1DB954] text-[#1DB954]"
                  : "bg-[#202020] border-[#333] text-neutral-400 hover:text-white"
              }`}
              title="シャッフル"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            {/* Repeat */}
            <button
              id="btn-toggle-repeat"
              type="button"
              onClick={() => setIsRepeat(!isRepeat)}
              className={`p-2 rounded-full border transition-all ${
                isRepeat
                  ? "bg-[#1DB954]/20 border-[#1DB954] text-[#1DB954]"
                  : "bg-[#202020] border-[#333] text-neutral-400 hover:text-white"
              }`}
              title="リピート"
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Spotify Full Playback Status / Prompt Banner */}
        <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2a2a2a] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#1DB954] shadow-[0_0_8px_#1DB954] shrink-0"></div>
            <div>
              <span className="text-xs font-bold text-white block">
                {isLoggedIn
                  ? "Spotify アカウント連携中（フル楽曲ストリーミング対応）"
                  : "Spotifyでログインすると、ブラウザ上で全曲フル再生が可能です"}
              </span>
              <span className="text-[11px] text-neutral-400">
                {isLoggedIn
                  ? "Spotify Web Playback SDKがアクティブです。下の再生ボタンや画面下の再生バーで操作できます。"
                  : "未ログイン状態でも、公式埋め込みプレイヤーでの即時試聴およびSpotify直接リンクでの再生が可能です。"}
              </span>
            </div>
          </div>

          {!isLoggedIn ? (
            <button
              id="btn-inline-spotify-login"
              type="button"
              onClick={openLoginModal}
              disabled={isLoggingIn}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#1DB954] hover:bg-[#1ed760] text-black shrink-0 shadow-md transition-all self-end sm:self-auto"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isLoggingIn ? "接続中..." : "ログインしてフル再生"}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-[#1DB954] font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>フル再生有効</span>
            </div>
          )}
        </div>

        {/* Currently Active Track Information Card */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl bg-[#121212] border border-[#262626]">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            {currentTrack.albumArt ? (
              <img
                src={currentTrack.albumArt}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-xl object-cover border border-[#333] shrink-0 shadow-md"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-[#222] border border-[#333] flex items-center justify-center shrink-0 shadow-md">
                <div className="flex items-end gap-1 h-5">
                  <span className="w-1 bg-[#1DB954] rounded-full h-3 animate-pulse"></span>
                  <span className="w-1 bg-[#1DB954] rounded-full h-5 animate-pulse delay-75"></span>
                  <span className="w-1 bg-[#1DB954] rounded-full h-4 animate-pulse delay-150"></span>
                  <span className="w-1 bg-[#1DB954] rounded-full h-2 animate-pulse delay-300"></span>
                </div>
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#1DB954] uppercase tracking-wider">
                  NOW PLAYING
                </span>
                <span className="text-[11px] text-neutral-500">•</span>
                <span className="text-xs text-neutral-400 font-medium">
                  {currentTrack.genre}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-white truncate">
                {currentTrack.title}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-400 truncate">
                {currentTrack.artist}
              </p>
            </div>
          </div>

          {/* Right Action buttons for currently active track */}
          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            {/* Quick Play/Pause on active track */}
            {onTogglePlay && (
              <button
                id="btn-controller-play-toggle"
                type="button"
                onClick={handlePlayFullViaSpotify}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-black bg-white hover:bg-neutral-200 transition-all shadow-sm hover:scale-105"
                title={isPlaying ? "一時停止" : "再生"}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-black" />
                    <span>一時停止</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>再生開始</span>
                  </>
                )}
              </button>
            )}

            {/* Favorite button */}
            <button
              id="btn-controller-favorite"
              type="button"
              onClick={() => onToggleFavorite(currentTrack)}
              className={`p-2.5 rounded-full border transition-all duration-200 ${
                isFavorite
                  ? "bg-red-500/15 border-red-500/40 text-red-500 hover:bg-red-500/25"
                  : "bg-[#202020] border-[#333] text-neutral-400 hover:text-white"
              }`}
              title={isFavorite ? "お気に入り解除" : "お気に入り追加"}
            >
              <Heart
                className={`w-4 h-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
              />
            </button>

            {/* Open in full Spotify */}
            <a
              id="btn-controller-full-spotify"
              href={currentTrack.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-black bg-[#1DB954] hover:bg-[#1ed760] transition-colors shadow-sm"
              title="Spotify公式でフル再生する"
            >
              <span>Spotifyで開く</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Embedded Official Spotify Player */}
        <div id="embed-player-wrapper" className="w-full">
          <SpotifyEmbedPlayer
            key={currentTrack.spotifyTrackId}
            trackId={currentTrack.spotifyTrackId}
            height={152}
          />
        </div>

        {/* Sequence Navigation Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            {/* Prev Track Button */}
            <button
              id="btn-player-prev"
              type="button"
              onClick={handlePrev}
              disabled={currentIndex === 0 && !isRepeat}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#222] hover:bg-[#2c2c2c] disabled:opacity-40 disabled:hover:bg-[#222] text-xs font-bold text-neutral-200 border border-[#333] transition-colors"
            >
              <SkipBack className="w-4 h-4" />
              <span className="hidden sm:inline">前の曲へ</span>
            </button>

            {/* Center Track Progress Navigator */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {tracks.map((t, idx) => {
                const isActive = idx === currentIndex;
                return (
                  <button
                    key={t.id || idx}
                    id={`btn-nav-track-${idx}`}
                    type="button"
                    onClick={() => onSelectIndex(idx)}
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-200 ${
                      isActive
                        ? "bg-[#1DB954] text-black ring-2 ring-[#1DB954]/50 scale-110 shadow-md shadow-[#1DB954]/30"
                        : "bg-[#222] text-neutral-400 hover:text-white hover:bg-[#2e2e2e] border border-[#333]"
                    }`}
                    title={`${idx + 1}. ${t.title} - ${t.artist}`}
                  >
                    0{idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Next Track Button */}
            <button
              id="btn-player-next"
              type="button"
              onClick={handleNext}
              disabled={currentIndex === tracks.length - 1 && !isRepeat}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#222] hover:bg-[#2c2c2c] disabled:opacity-40 disabled:hover:bg-[#222] text-xs font-bold text-neutral-200 border border-[#333] transition-colors"
            >
              <span className="hidden sm:inline">次の曲へ</span>
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
