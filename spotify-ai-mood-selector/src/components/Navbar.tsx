import React from "react";
import { Music2, Heart, History, ExternalLink, Sparkles, LogIn, LogOut, CheckCircle2 } from "lucide-react";
import { useSpotifyAuth } from "../context/SpotifyAuthContext.tsx";

interface NavbarProps {
  activeTab: "recommend" | "favorites" | "history";
  setActiveTab: (tab: "recommend" | "favorites" | "history") => void;
  favoritesCount: number;
  historyCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  favoritesCount,
  historyCount,
}) => {
  const { user, isLoggedIn, isLoggingIn, login, openLoginModal, logout, isPremium } = useSpotifyAuth();

  return (
    <header
      id="app-navbar"
      className="sticky top-0 z-40 w-full bg-[#121212]/95 backdrop-blur-md border-b border-[#282828] px-4 lg:px-8 py-3.5 transition-colors"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <div
          id="brand-logo-container"
          onClick={() => setActiveTab("recommend")}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-full bg-[#1DB954] flex items-center justify-center shadow-lg shadow-[#1DB954]/20 group-hover:scale-105 transition-transform duration-200">
            {/* Spotify-style Sound Wave / Music Note */}
            <div className="flex items-end gap-[3px] h-5">
              <span className="w-1 bg-black rounded-full h-3 animate-pulse"></span>
              <span className="w-1 bg-black rounded-full h-5 animate-pulse delay-75"></span>
              <span className="w-1 bg-black rounded-full h-4 animate-pulse delay-150"></span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white group-hover:text-[#1DB954] transition-colors">
                Spotify AI Mood
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#1DB954]/15 text-[#1DB954] border border-[#1DB954]/30">
                <Sparkles className="w-2.5 h-2.5" />
                Gemini
              </span>
            </div>
            <p className="text-xs text-neutral-400 hidden sm:block">
              AIが今の気分に寄り添う5曲をブラウザ即時再生
            </p>
          </div>
        </div>

        {/* Navigation & Spotify Login */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Tab Navigation */}
          <nav id="nav-tabs" className="flex items-center gap-1 sm:gap-2">
            <button
              id="tab-btn-recommend"
              onClick={() => setActiveTab("recommend")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeTab === "recommend"
                  ? "bg-[#282828] text-white shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-[#1a1a1a]"
              }`}
            >
              <Music2 className="w-4 h-4 text-[#1DB954]" />
              <span>AI選曲</span>
            </button>

            <button
              id="tab-btn-favorites"
              onClick={() => setActiveTab("favorites")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 relative ${
                activeTab === "favorites"
                  ? "bg-[#282828] text-white shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-[#1a1a1a]"
              }`}
            >
              <Heart
                className={`w-4 h-4 ${
                  favoritesCount > 0 ? "fill-red-500 text-red-500" : "text-neutral-400"
                }`}
              />
              <span>お気に入り</span>
              {favoritesCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#1DB954] text-black leading-none">
                  {favoritesCount}
                </span>
              )}
            </button>

            <button
              id="tab-btn-history"
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeTab === "history"
                  ? "bg-[#282828] text-white shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-[#1a1a1a]"
              }`}
            >
              <History className="w-4 h-4 text-neutral-400" />
              <span className="hidden sm:inline">履歴</span>
              {historyCount > 0 && (
                <span className="text-[10px] text-neutral-500 hidden sm:inline">
                  ({historyCount})
                </span>
              )}
            </button>
          </nav>

          {/* Spotify Login Button / User Profile */}
          <div className="flex items-center pl-1 sm:pl-2 border-l border-[#2e2e2e]">
            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-[#1e1e1e] border border-[#333]">
                  {user?.images?.[0]?.url ? (
                    <img
                      src={user.images[0].url}
                      alt={user.display_name}
                      referrerPolicy="no-referrer"
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-[#1DB954] flex items-center justify-center text-[10px] font-bold text-black">
                      {(user?.display_name || "S")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-semibold text-white leading-tight max-w-[100px] truncate">
                      {user?.display_name || "Spotify User"}
                    </span>
                    <span className="text-[10px] text-[#1DB954] font-medium leading-none">
                      {isPremium ? "Premium (フル再生)" : "ログイン中"}
                    </span>
                  </div>
                  <button
                    id="btn-spotify-logout"
                    onClick={logout}
                    className="p-1 text-neutral-400 hover:text-white transition-colors"
                    title="Spotifyからログアウト"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                id="btn-spotify-login"
                onClick={openLoginModal}
                disabled={isLoggingIn}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-black bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 transition-all shadow-sm shadow-[#1DB954]/20 hover:scale-105"
                title="Spotifyにログインしてブラウザ上でフル楽曲再生を有効化"
              >
                <LogIn className="w-3.5 h-3.5 text-black" />
                <span className="whitespace-nowrap">
                  {isLoggingIn ? "接続中..." : "Spotifyログインでフル再生"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
