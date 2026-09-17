import React, { useState } from "react";

interface SpotifyEmbedPlayerProps {
  trackId: string;
  height?: number;
  className?: string;
  compact?: boolean;
}

export const SpotifyEmbedPlayer: React.FC<SpotifyEmbedPlayerProps> = ({
  trackId,
  height = 152,
  className = "",
  compact = false,
}) => {
  const [isLoading, setIsLoading] = useState(true);

  // Sanitized track ID (ensuring 22 alphanumeric characters or fallback)
  const cleanId = trackId ? trackId.replace(/[^a-zA-Z0-9]/g, "") : "0VjIjW4GlUZAMYd2vXMi3b";
  const embedUrl = `https://open.spotify.com/embed/track/${cleanId}?utm_source=generator&theme=0`;
  const actualHeight = compact ? 80 : height;

  return (
    <div
      id={`spotify-embed-container-${cleanId}`}
      className={`relative w-full rounded-xl overflow-hidden bg-[#181818] border border-[#282828] transition-all duration-300 shadow-lg ${className}`}
      style={{ minHeight: `${actualHeight}px` }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#181818] z-10">
          <div className="flex items-center space-x-3 text-neutral-400">
            <div className="w-5 h-5 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-medium text-neutral-400">Spotifyプレイヤー読み込み中...</span>
          </div>
        </div>
      )}
      <iframe
        id={`spotify-embed-iframe-${cleanId}`}
        src={embedUrl}
        width="100%"
        height={actualHeight}
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        onLoad={() => setIsLoading(false)}
        className="w-full transition-opacity duration-300"
        title={`Spotify Web Player - ${cleanId}`}
      />
    </div>
  );
};
