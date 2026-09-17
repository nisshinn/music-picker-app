import React, { useState } from "react";
import { Heart, Play, ExternalLink, Trash2, Copy, Check, Music2, Sparkles } from "lucide-react";
import type { FavoriteTrack, Track } from "../types.ts";

interface FavoritesViewProps {
  favorites: FavoriteTrack[];
  onSelectTrack: (track: Track) => void;
  onRemoveFavorite: (trackId: string) => void;
  onClearAllFavorites: () => void;
  onGoToRecommend: () => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  favorites,
  onSelectTrack,
  onRemoveFavorite,
  onClearAllFavorites,
  onGoToRecommend,
}) => {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFavorites = favorites.filter(
    (f) =>
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopyPlaylistText = () => {
    if (favorites.length === 0) return;
    const text = favorites.map((f, i) => `${i + 1}. ${f.title} - ${f.artist}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (favorites.length === 0) {
    return (
      <div
        id="favorites-empty-view"
        className="w-full bg-[#181818] rounded-2xl p-8 sm:p-12 border border-[#282828] text-center space-y-4"
      >
        <div className="w-16 h-16 rounded-full bg-[#242424] text-neutral-500 mx-auto flex items-center justify-center">
          <Heart className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-white">お気に入りの楽曲はまだありません</h3>
        <p className="text-sm text-neutral-400 max-w-md mx-auto">
          AIが選曲した5曲の中から、気に入った曲の「ハート」マークを押すと、いつでもここに保存して再生できます。
        </p>
        <div className="pt-2">
          <button
            type="button"
            id="btn-go-to-ai"
            onClick={onGoToRecommend}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-sm transition-all shadow-lg shadow-[#1DB954]/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>AIで曲を探す</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="favorites-container" className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#181818] p-5 sm:p-6 rounded-2xl border border-[#282828]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-500/15 text-red-500 border border-red-500/30">
              <Heart className="w-5 h-5 fill-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">お気に入り保存した曲</h2>
              <p className="text-xs text-neutral-400">
                合計 {favorites.length} 曲がローカルストレージに保存されています
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Copy list button */}
          <button
            id="btn-copy-favorites"
            type="button"
            onClick={handleCopyPlaylistText}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#252525] hover:bg-[#303030] text-xs font-semibold text-neutral-200 border border-[#333] transition-colors"
            title="曲名とアーティスト名をまとめてコピー"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#1DB954]" />
                <span className="text-[#1DB954]">コピーしました！</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>リストをコピー</span>
              </>
            )}
          </button>

          {/* Clear all */}
          <button
            id="btn-clear-favorites"
            type="button"
            onClick={() => {
              if (window.confirm("すべてのお気に入りを削除しますか？")) {
                onClearAllFavorites();
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#252525] hover:bg-red-950/40 text-neutral-400 hover:text-red-400 text-xs font-semibold border border-[#333] hover:border-red-900 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>全削除</span>
          </button>
        </div>
      </div>

      {/* Search within favorites */}
      {favorites.length > 4 && (
        <div className="relative">
          <input
            id="search-favorites-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="お気に入り内を検索 (曲名・アーティスト・ジャンル)..."
            className="w-full px-4 py-2.5 rounded-xl bg-[#181818] border border-[#282828] focus:border-[#1DB954] text-xs text-white placeholder-neutral-500 outline-none"
          />
        </div>
      )}

      {/* Favorites Track List */}
      <div className="grid grid-cols-1 gap-3">
        {filteredFavorites.map((fav, index) => (
          <div
            key={fav.id || index}
            id={`fav-card-${fav.id}`}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#181818] border border-[#282828] hover:border-[#333] hover:bg-[#1f1f1f] transition-all group"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <button
                id={`btn-play-fav-${fav.id}`}
                onClick={() => onSelectTrack(fav)}
                className="w-10 h-10 rounded-full bg-[#252525] group-hover:bg-[#1DB954] text-neutral-300 group-hover:text-black flex items-center justify-center shrink-0 transition-colors shadow-sm"
                title="プレイヤーで再生"
              >
                <Play className="w-4 h-4 ml-0.5 fill-current" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#252525] text-[#1DB954]">
                    {fav.genre}
                  </span>
                  {fav.tempo && (
                    <span className="text-[10px] text-neutral-500">{fav.tempo}</span>
                  )}
                </div>
                <h4 className="text-sm font-bold text-white truncate group-hover:text-[#1DB954] transition-colors">
                  {fav.title}
                </h4>
                <p className="text-xs text-neutral-400 truncate">{fav.artist}</p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#252525]">
              {/* Full play in Spotify */}
              <a
                id={`link-fav-spotify-${fav.id}`}
                href={fav.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-black bg-[#1DB954] hover:bg-[#1ed760] transition-colors"
              >
                <span>Spotifyで再生</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              {/* Remove Favorite */}
              <button
                id={`btn-remove-fav-${fav.id}`}
                type="button"
                onClick={() => onRemoveFavorite(fav.id)}
                className="p-2 rounded-full text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="お気に入りから削除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
