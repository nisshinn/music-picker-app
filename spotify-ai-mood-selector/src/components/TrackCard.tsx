import React, { useState } from "react";
import { Play, Pause, Heart, ExternalLink, Sparkles, ChevronDown, ChevronUp, Music } from "lucide-react";
import type { Track } from "../types.ts";
import { SpotifyEmbedPlayer } from "./SpotifyEmbedPlayer.tsx";

interface TrackCardProps {
  track: Track;
  index: number;
  isActive: boolean;
  onSelectTrack: (index: number) => void;
  isFavorite: boolean;
  onToggleFavorite: (track: Track) => void;
}

export const TrackCard: React.FC<TrackCardProps> = ({
  track,
  index,
  isActive,
  onSelectTrack,
  isFavorite,
  onToggleFavorite,
}) => {
  const [showEmbed, setShowEmbed] = useState(false);

  return (
    <div
      id={`track-card-${index}`}
      className={`group relative rounded-2xl p-4 sm:p-6 transition-all duration-300 border ${
        isActive
          ? "bg-[#222222] border-[#1DB954] shadow-xl shadow-[#1DB954]/10 ring-1 ring-[#1DB954]"
          : "bg-[#181818] border-[#282828] hover:border-[#383838] hover:bg-[#1e1e1e]"
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        {/* Left: Index badge & Track details */}
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          {/* Track Number / Play button / Album Art */}
          <div className="relative group/art shrink-0">
            {track.albumArt ? (
              <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-md border border-[#333]">
                <img
                  src={track.albumArt}
                  alt={track.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <button
                  id={`btn-play-track-${index}`}
                  onClick={() => onSelectTrack(index)}
                  aria-label={`${track.title}を再生`}
                  className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                    isActive ? "opacity-100 bg-[#1DB954]/70" : "opacity-0 group-hover/art:opacity-100"
                  }`}
                >
                  {isActive ? (
                    <div className="flex items-end gap-[2px] h-4">
                      <span className="w-1 bg-black rounded-full h-3 animate-pulse"></span>
                      <span className="w-1 bg-black rounded-full h-4 animate-pulse delay-75"></span>
                      <span className="w-1 bg-black rounded-full h-2 animate-pulse delay-150"></span>
                    </div>
                  ) : (
                    <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <button
                  id={`btn-play-track-${index}`}
                  onClick={() => onSelectTrack(index)}
                  aria-label={`${track.title}を再生`}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                    isActive
                      ? "bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/30 scale-105"
                      : "bg-[#282828] text-neutral-300 group-hover:bg-[#1DB954] group-hover:text-black"
                  }`}
                >
                  {isActive ? (
                    <div className="flex items-end gap-[2px] h-4">
                      <span className="w-1 bg-black rounded-full h-3 animate-pulse"></span>
                      <span className="w-1 bg-black rounded-full h-4 animate-pulse delay-75"></span>
                      <span className="w-1 bg-black rounded-full h-2 animate-pulse delay-150"></span>
                    </div>
                  ) : (
                    <Play className="w-4 h-4 ml-0.5 fill-current" />
                  )}
                </button>
              </div>
            )}
            <span className="block text-center text-[10px] font-bold text-neutral-500 mt-1">
              0{index + 1}
            </span>
          </div>

          {/* Track Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-[#252525] text-[#1DB954] border border-[#333]">
                {track.genre}
              </span>
              {track.tempo && (
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[#252525] text-neutral-400">
                  {track.tempo}
                </span>
              )}
              {track.durationMs && (
                <span className="text-[10px] text-neutral-500 font-mono">
                  {Math.floor(track.durationMs / 60000)}:
                  {String(Math.floor((track.durationMs % 60000) / 1000)).padStart(2, "0")}
                </span>
              )}
              {isActive && (
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/30 animate-pulse">
                  選択中
                </span>
              )}
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight truncate group-hover:text-[#1DB954] transition-colors">
              {track.title}
            </h3>
            <p className="text-xs sm:text-sm font-medium text-neutral-400 truncate mb-3">
              {track.artist}
            </p>

            {/* AI Recommendation Reason */}
            <div className="p-3 rounded-xl bg-[#141414] border border-[#262626] text-xs text-neutral-300 relative leading-relaxed">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#1DB954] mb-1">
                <Sparkles className="w-3 h-3" />
                <span>AI選曲の理由</span>
              </div>
              <p className="text-neutral-300 line-clamp-3">
                {track.reason}
              </p>
              {track.vibeKeywords && track.vibeKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-[#222]">
                  {track.vibeKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e1e] text-neutral-400"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Action buttons */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#252525]">
          {/* Favorite Toggle */}
          <button
            id={`btn-fav-track-${index}`}
            type="button"
            onClick={() => onToggleFavorite(track)}
            aria-label={isFavorite ? "お気に入りから削除" : "お気に入りに追加"}
            className={`p-2.5 rounded-full border transition-all duration-200 ${
              isFavorite
                ? "bg-red-500/15 border-red-500/40 text-red-500 hover:bg-red-500/25 scale-105"
                : "bg-[#252525] border-[#333] text-neutral-400 hover:text-white hover:border-neutral-500"
            }`}
            title={isFavorite ? "お気に入りを解除" : "お気に入りに追加"}
          >
            <Heart
              className={`w-4 h-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
            />
          </button>

          {/* Full Spotify Play Link */}
          <a
            id={`btn-spotify-full-${index}`}
            href={track.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-black bg-[#1DB954] hover:bg-[#1ed760] transition-colors shadow-sm"
            title="Spotifyアプリ / Webでフル再生"
          >
            <span>Spotifyでフル再生</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* Toggle inline embed */}
          <button
            id={`btn-toggle-embed-${index}`}
            type="button"
            onClick={() => setShowEmbed(!showEmbed)}
            className="flex items-center gap-1 text-[11px] font-semibold text-neutral-400 hover:text-neutral-200 transition-colors py-1 px-2"
          >
            <span>{showEmbed ? "プレイヤーを閉じる" : "この曲を試聴"}</span>
            {showEmbed ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* Inline Spotify Embed Player Drawer */}
      {showEmbed && (
        <div className="mt-4 pt-4 border-t border-[#262626] animate-in fade-in duration-200">
          <SpotifyEmbedPlayer trackId={track.spotifyTrackId} height={152} />
        </div>
      )}
    </div>
  );
};
