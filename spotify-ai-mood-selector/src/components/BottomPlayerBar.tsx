import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Volume2,
  VolumeX,
  Heart,
  ExternalLink,
  Music2,
  Radio,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Track } from "../types.ts";
import { useSpotifyAuth } from "../context/SpotifyAuthContext.tsx";

interface BottomPlayerBarProps {
  currentTrack: Track | null;
  tracks: Track[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  isFavorite: boolean;
  onToggleFavorite: (track: Track) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  isShuffle: boolean;
  setIsShuffle: React.Dispatch<React.SetStateAction<boolean>>;
  isRepeat: boolean;
  setIsRepeat: React.Dispatch<React.SetStateAction<boolean>>;
}

export const BottomPlayerBar: React.FC<BottomPlayerBarProps> = ({
  currentTrack,
  tracks,
  currentIndex,
  onSelectIndex,
  isFavorite,
  onToggleFavorite,
  isPlaying,
  onTogglePlay,
  isShuffle,
  setIsShuffle,
  isRepeat,
  setIsRepeat,
}) => {
  const { isLoggedIn, openLoginModal, playerState, seekSpotifyTrack, isWebPlayerReady } = useSpotifyAuth();

  const [positionSec, setPositionSec] = useState<number>(0);
  const [durationSec, setDurationSec] = useState<number>(210); // default ~3:30
  const [volume, setVolume] = useState<number>(80);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Sync track duration if available
  useEffect(() => {
    if (currentTrack?.durationMs) {
      setDurationSec(Math.round(currentTrack.durationMs / 1000));
    } else {
      setDurationSec(210);
    }
    setPositionSec(0);
  }, [currentTrack?.id, currentTrack?.durationMs]);

  // Sync with Spotify SDK player state if active
  useEffect(() => {
    if (playerState?.duration) {
      setDurationSec(Math.round(playerState.duration / 1000));
      setPositionSec(Math.round(playerState.position / 1000));
    }
  }, [playerState?.position, playerState?.duration]);

  // Simulation timer if local playback is running
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setPositionSec((prev) => {
        if (prev >= durationSec) {
          // Track ended, trigger next track
          handleNext();
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, durationSec]);

  if (!currentTrack) return null;

  const handlePrev = () => {
    if (positionSec > 4) {
      setPositionSec(0);
      return;
    }
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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPos = Number(e.target.value);
    setPositionSec(newPos);
    if (isLoggedIn && isWebPlayerReady) {
      seekSpotifyTrack(newPos * 1000);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = Math.floor(secs % 60);
    return `${mins}:${remaining < 10 ? "0" : ""}${remaining}`;
  };

  const progressPercent = durationSec > 0 ? (positionSec / durationSec) * 100 : 0;

  return (
    <div
      id="bottom-playback-bar"
      className={`fixed bottom-0 left-0 right-0 z-50 bg-[#121212]/95 backdrop-blur-xl border-t border-[#282828] shadow-[0_-8px_30px_rgba(0,0,0,0.8)] transition-all duration-300 ${
        isCollapsed ? "translate-y-[calc(100%-28px)]" : "translate-y-0"
      }`}
    >
      {/* Mini Toggle tab */}
      <div className="flex justify-center -mt-3.5 mb-1">
        <button
          id="btn-collapse-playback-bar"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="px-3 py-0.5 rounded-full bg-[#202020] hover:bg-[#2e2e2e] border border-[#333] text-neutral-400 hover:text-white text-[10px] flex items-center gap-1 shadow-md transition-all"
          title={isCollapsed ? "プレイヤーを展開" : "プレイヤーを最小化"}
        >
          {isCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <span>{isCollapsed ? "再生バーを表示" : "最小化"}</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Left: Track Information */}
        <div className="flex items-center gap-3.5 w-full md:w-1/4 min-w-0 justify-between md:justify-start">
          <div className="flex items-center gap-3 min-w-0">
            {currentTrack.albumArt ? (
              <img
                src={currentTrack.albumArt}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-lg object-cover shadow-md shrink-0 border border-[#333]"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-[#222] border border-[#333] flex items-center justify-center shrink-0 shadow-md">
                <Music2 className="w-5 h-5 text-[#1DB954]" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-extrabold text-white truncate hover:underline cursor-pointer leading-tight">
                  {currentTrack.title}
                </h4>
              </div>
              <p className="text-xs text-neutral-400 truncate mt-0.5">{currentTrack.artist}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Favorite toggle */}
            <button
              id="bottom-btn-favorite"
              onClick={() => onToggleFavorite(currentTrack)}
              className="p-2 text-neutral-400 hover:text-white transition-colors"
              title={isFavorite ? "お気に入り解除" : "お気に入り追加"}
            >
              <Heart
                className={`w-4 h-4 ${
                  isFavorite ? "fill-red-500 text-red-500" : "hover:text-red-400"
                }`}
              />
            </button>

            {/* External Spotify full track link */}
            <a
              id="bottom-btn-open-spotify"
              href={currentTrack.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-neutral-400 hover:text-[#1DB954] transition-colors"
              title="Spotify公式でフル再生"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Center: Controls and Progress Bar */}
        <div className="flex flex-col items-center gap-1.5 w-full md:w-2/4 max-w-xl">
          {/* Action Buttons */}
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Shuffle */}
            <button
              id="bottom-btn-shuffle"
              onClick={() => setIsShuffle(!isShuffle)}
              className={`p-1.5 rounded-full transition-colors ${
                isShuffle ? "text-[#1DB954]" : "text-neutral-400 hover:text-white"
              }`}
              title="シャッフル"
            >
              <Shuffle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Prev */}
            <button
              id="bottom-btn-prev"
              onClick={handlePrev}
              disabled={currentIndex === 0 && !isRepeat && positionSec <= 4}
              className="p-1.5 text-neutral-300 hover:text-white disabled:opacity-30 transition-colors"
              title="前の曲へ"
            >
              <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Main Play / Pause Circle */}
            <button
              id="bottom-btn-play-pause"
              onClick={onTogglePlay}
              className="w-10 h-10 rounded-full bg-white hover:bg-neutral-200 text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
              title={isPlaying ? "一時停止" : "再生"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-black" />
              ) : (
                <Play className="w-5 h-5 fill-black translate-x-0.5" />
              )}
            </button>

            {/* Next */}
            <button
              id="bottom-btn-next"
              onClick={handleNext}
              disabled={currentIndex === tracks.length - 1 && !isRepeat}
              className="p-1.5 text-neutral-300 hover:text-white disabled:opacity-30 transition-colors"
              title="次の曲へ"
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Repeat */}
            <button
              id="bottom-btn-repeat"
              onClick={() => setIsRepeat(!isRepeat)}
              className={`p-1.5 rounded-full transition-colors ${
                isRepeat ? "text-[#1DB954]" : "text-neutral-400 hover:text-white"
              }`}
              title="リピート"
            >
              <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Time scrubber bar */}
          <div className="w-full flex items-center gap-2 text-[11px] font-medium text-neutral-400">
            <span className="w-9 text-right font-mono text-[10px] sm:text-xs">
              {formatTime(positionSec)}
            </span>

            <div className="relative flex-1 flex items-center group py-1">
              <input
                id="bottom-progress-slider"
                type="range"
                min={0}
                max={durationSec}
                value={positionSec}
                onChange={handleSeek}
                className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#1DB954] group-hover:h-1.5 transition-all"
              />
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-white group-hover:bg-[#1DB954] rounded-lg pointer-events-none group-hover:h-1.5 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <span className="w-9 text-left font-mono text-[10px] sm:text-xs">
              {formatTime(durationSec)}
            </span>
          </div>
        </div>

        {/* Right: Status badge & Volume */}
        <div className="hidden md:flex items-center justify-end gap-3 w-1/4">
          <div
            onClick={!isLoggedIn ? openLoginModal : undefined}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1e1e1e] border border-[#333] text-[11px] text-neutral-300 ${
              !isLoggedIn
                ? "cursor-pointer hover:border-[#1DB954] hover:text-[#1DB954] transition-all"
                : ""
            }`}
            title={
              !isLoggedIn
                ? "クリックしてSpotifyにログインしフル再生を有効化"
                : "フル楽曲ストリーミング中"
            }
          >
            {isLoggedIn ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#1DB954] animate-pulse"></span>
                <span className="text-[#1DB954] font-semibold">フル再生</span>
              </>
            ) : (
              <>
                <Radio className="w-3 h-3 text-[#1DB954]" />
                <span className="text-neutral-300 hover:text-[#1DB954]">ログインでフル再生</span>
              </>
            )}
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              id="bottom-btn-volume"
              onClick={() => setIsMuted(!isMuted)}
              className="p-1 text-neutral-400 hover:text-white"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-neutral-500" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              id="bottom-volume-slider"
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-16 lg:w-20 h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#1DB954] hover:h-1.5 transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
