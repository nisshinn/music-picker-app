import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { SpotifyUser, SpotifyTokens } from "../types.ts";

interface SpotifyAuthContextType {
  user: SpotifyUser | null;
  tokens: SpotifyTokens | null;
  isLoggedIn: boolean;
  isLoggingIn: boolean;
  isWebPlayerReady: boolean;
  deviceId: string | null;
  sdkError: string | null;
  loginErrorDetails: { message: string; redirectUri?: string } | null;
  isPremium: boolean;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  login: () => Promise<void>;
  loginWithToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  clearLoginError: () => void;
  playSpotifyTrack: (trackId: string, positionMs?: number) => Promise<boolean>;
  pauseSpotifyTrack: () => Promise<boolean>;
  resumeSpotifyTrack: () => Promise<boolean>;
  seekSpotifyTrack: (positionMs: number) => Promise<boolean>;
  playerState: SpotifyPlayerState | null;
}

export interface SpotifyPlayerState {
  paused: boolean;
  position: number;
  duration: number;
  currentTrackId?: string;
  currentTrackName?: string;
  currentTrackArtist?: string;
  currentAlbumArt?: string;
}

const SpotifyAuthContext = createContext<SpotifyAuthContextType | undefined>(undefined);

const STORAGE_USER_KEY = "spotify_mood_user";
const STORAGE_TOKENS_KEY = "spotify_mood_tokens";

export const SpotifyAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SpotifyUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [tokens, setTokens] = useState<SpotifyTokens | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TOKENS_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isWebPlayerReady, setIsWebPlayerReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [loginErrorDetails, setLoginErrorDetails] = useState<{ message: string; redirectUri?: string } | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [playerState, setPlayerState] = useState<SpotifyPlayerState | null>(null);

  const playerRef = useRef<any>(null);

  const openLoginModal = useCallback(() => {
    setIsLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setIsLoginModalOpen(false);
  }, []);

  const clearLoginError = useCallback(() => {
    setSdkError(null);
    setLoginErrorDetails(null);
  }, []);

  // Check token expiry and refresh if needed
  const refreshTokenIfNeeded = useCallback(async (): Promise<string | null> => {
    if (!tokens?.refresh_token) return tokens?.access_token || null;

    const obtainedAt = tokens.obtained_at || Date.now();
    const expiresIn = (tokens.expires_in || 3600) * 1000;
    const isExpired = Date.now() > obtainedAt + expiresIn - 300000; // 5 min buffer

    if (!isExpired && tokens.access_token) {
      return tokens.access_token;
    }

    try {
      const res = await fetch("/api/auth/spotify/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: tokens.refresh_token }),
      });
      if (!res.ok) return tokens.access_token;
      const data = await res.json();
      const newTokens: SpotifyTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || tokens.refresh_token,
        expires_in: data.expires_in,
        token_type: data.token_type,
        scope: data.scope,
        obtained_at: Date.now(),
      };
      setTokens(newTokens);
      localStorage.setItem(STORAGE_TOKENS_KEY, JSON.stringify(newTokens));
      return newTokens.access_token;
    } catch (e) {
      console.warn("Token refresh failed:", e);
      return tokens.access_token;
    }
  }, [tokens]);

  // Initialize Spotify Web Playback SDK when logged in
  useEffect(() => {
    if (!tokens?.access_token) {
      if (playerRef.current) {
        try {
          playerRef.current.disconnect();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
      setIsWebPlayerReady(false);
      setDeviceId(null);
      return;
    }

    let isMounted = true;

    const setupPlayer = () => {
      try {
        if (!window.Spotify || playerRef.current) return;

        const player = new window.Spotify.Player({
          name: "Spotify AI Mood Web Player",
          getOAuthToken: async (cb: (token: string) => void) => {
            const freshToken = await refreshTokenIfNeeded();
            if (freshToken) cb(freshToken);
          },
          volume: 0.8,
        });

        player.addListener("ready", ({ device_id }: { device_id: string }) => {
          if (!isMounted) return;
          setDeviceId(device_id);
          setIsWebPlayerReady(true);
          setSdkError(null);
        });

        player.addListener("not_ready", () => {
          if (!isMounted) return;
          setIsWebPlayerReady(false);
        });

        player.addListener("player_state_changed", (state: any) => {
          if (!isMounted) return;
          if (!state) {
            setPlayerState(null);
            return;
          }

          const currentTrack = state.track_window?.current_track;
          setPlayerState({
            paused: state.paused,
            position: state.position,
            duration: state.duration,
            currentTrackId: currentTrack?.id,
            currentTrackName: currentTrack?.name,
            currentTrackArtist: currentTrack?.artists?.map((a: any) => a.name).join(", "),
            currentAlbumArt: currentTrack?.album?.images?.[0]?.url,
          });
        });

        player.addListener("initialization_error", ({ message }: { message: string }) => {
          console.info("Spotify SDK init status:", message);
        });

        player.addListener("authentication_error", ({ message }: { message: string }) => {
          console.info("Spotify SDK auth refresh notice:", message);
          refreshTokenIfNeeded();
        });

        player.addListener("account_error", ({ message }: { message: string }) => {
          setSdkError("Spotify Premiumアカウントが必要です（無料プランはSpotify埋め込みプレイヤーまたはアプリでフル再生をご利用いただけます）");
        });

        player.connect().catch((err: any) => {
          console.info("Spotify SDK connection notice:", err);
        });

        playerRef.current = player;
      } catch (err) {
        console.info("Spotify Web Playback SDK is not active in this container environment:", err);
      }
    };

    if (window.Spotify) {
      setupPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = setupPlayer;
      // Dynamically load SDK script if not already present
      if (!document.getElementById("spotify-player-sdk-script")) {
        const script = document.createElement("script");
        script.id = "spotify-player-sdk-script";
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        script.onerror = () => {
          console.info("Spotify SDK script could not be loaded in preview iframe.");
        };
        document.body.appendChild(script);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [tokens?.access_token, refreshTokenIfNeeded]);

  // Login with Spotify via OAuth Popup
  const login = useCallback(async () => {
    try {
      setIsLoggingIn(true);
      setSdkError(null);
      setLoginErrorDetails(null);

      const width = 520;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      // Open popup synchronously on user gesture to avoid popup blocker
      const popup = window.open(
        "about:blank",
        "spotify_oauth_popup",
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
      );

      if (popup) {
        try {
          popup.document.write(`
            <!DOCTYPE html>
            <html>
              <head><meta charset="utf-8"/><title>Spotify 接続中...</title></head>
              <body style="background:#121212;color:white;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                <div style="text-align:center;padding:20px;">
                  <div style="width:40px;height:40px;border:3px solid #333;border-top-color:#1DB954;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px;"></div>
                  <p style="font-size:15px;font-weight:600;margin:0 0 6px;">Spotify 認証画面に接続中...</p>
                  <p style="font-size:12px;color:#888;margin:0;">まもなくログイン画面が開きます</p>
                  <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
                </div>
              </body>
            </html>
          `);
        } catch {
          // ignore cross-origin error if any
        }
      } else {
        // Browser blocked popup
        setIsLoginModalOpen(true);
        throw new Error("ブラウザのポップアップがブロックされました。ログインガイドモーダルから直接開くか設定をご確認ください。");
      }

      const clientOrigin = window.location.origin;
      const res = await fetch(`/api/auth/spotify/url?origin=${encodeURIComponent(clientOrigin)}`);
      if (!res.ok) {
        if (popup && !popup.closed) popup.close();
        throw new Error("認証URLの取得に失敗しました");
      }
      const { url, redirectUri } = await res.json();

      if (popup && !popup.closed) {
        popup.location.href = url;
      }

      // Listen for postMessage from popup callback
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "OAUTH_AUTH_SUCCESS" && event.data?.provider === "spotify") {
          window.removeEventListener("message", handleMessage);
          const receivedTokens: SpotifyTokens = event.data.tokens;
          const receivedUser: SpotifyUser = event.data.user;

          setTokens(receivedTokens);
          setUser(receivedUser);
          localStorage.setItem(STORAGE_TOKENS_KEY, JSON.stringify(receivedTokens));
          localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(receivedUser));
          setIsLoggingIn(false);
          setIsLoginModalOpen(false);
          setSdkError(null);
          setLoginErrorDetails(null);
        } else if (event.data?.type === "OAUTH_AUTH_ERROR") {
          window.removeEventListener("message", handleMessage);
          setIsLoggingIn(false);
          const errDetail = event.data?.error || "認証がキャンセルされたか失敗しました";
          const errRedirect = event.data?.redirectUri || redirectUri;
          setLoginErrorDetails({ message: errDetail, redirectUri: errRedirect });
          setSdkError(`Spotifyログインエラー: ${errDetail}`);
          setIsLoginModalOpen(true);
        }
      };

      window.addEventListener("message", handleMessage);

      // Check popup close timer fallback
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          window.removeEventListener("message", handleMessage);
          setIsLoggingIn(false);
        }
      }, 1000);
    } catch (err: any) {
      setIsLoggingIn(false);
      const msg = err.message || "ログイン処理中にエラーが発生しました";
      setSdkError(msg);
      setLoginErrorDetails({ message: msg });
      setIsLoginModalOpen(true);
    }
  }, []);

  // Direct login with Spotify User Access Token (instant fallback)
  const loginWithToken = useCallback(async (token: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoggingIn(true);
      setSdkError(null);
      setLoginErrorDetails(null);

      const res = await fetch("/api/auth/spotify/validate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "トークンの検証に失敗しました。正しいSpotifyアクセストークンを入力してください。");
      }

      setTokens(data.tokens);
      setUser(data.user);
      localStorage.setItem(STORAGE_TOKENS_KEY, JSON.stringify(data.tokens));
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user));
      setIsLoggingIn(false);
      setIsLoginModalOpen(false);
      return { success: true };
    } catch (err: any) {
      setIsLoggingIn(false);
      const msg = err.message || "トークンの検証に失敗しました";
      setSdkError(msg);
      setLoginErrorDetails({ message: msg });
      return { success: false, error: msg };
    }
  }, []);

  // Logout
  const logout = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.disconnect();
      } catch {
        // ignore
      }
      playerRef.current = null;
    }
    setUser(null);
    setTokens(null);
    setDeviceId(null);
    setIsWebPlayerReady(false);
    setPlayerState(null);
    setSdkError(null);
    setLoginErrorDetails(null);
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(STORAGE_TOKENS_KEY);
  }, []);

  // Play track via Spotify Web API / Web Playback SDK
  const playSpotifyTrack = useCallback(
    async (trackId: string, positionMs = 0): Promise<boolean> => {
      const activeToken = await refreshTokenIfNeeded();
      if (!activeToken) return false;

      try {
        const res = await fetch("/api/spotify/play", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${activeToken}`,
          },
          body: JSON.stringify({
            trackId,
            deviceId: deviceId || undefined,
            positionMs,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          if (data.reason === "PREMIUM_REQUIRED" || data.error?.includes("Premium")) {
            setSdkError("Spotify Premiumアカウントが必要です。無料プランの場合はSpotify公式プレイヤーまたはアプリでフル再生をご利用ください。");
          }
          return false;
        }
        return true;
      } catch (err) {
        console.warn("Play error:", err);
        return false;
      }
    },
    [deviceId, refreshTokenIfNeeded]
  );

  const pauseSpotifyTrack = useCallback(async (): Promise<boolean> => {
    if (playerRef.current && isWebPlayerReady) {
      await playerRef.current.pause();
      return true;
    }

    const activeToken = await refreshTokenIfNeeded();
    if (!activeToken) return false;

    try {
      const res = await fetch("/api/spotify/pause", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({ deviceId: deviceId || undefined }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [deviceId, isWebPlayerReady, refreshTokenIfNeeded]);

  const resumeSpotifyTrack = useCallback(async (): Promise<boolean> => {
    if (playerRef.current && isWebPlayerReady) {
      await playerRef.current.resume();
      return true;
    }
    return false;
  }, [isWebPlayerReady]);

  const seekSpotifyTrack = useCallback(
    async (positionMs: number): Promise<boolean> => {
      if (playerRef.current && isWebPlayerReady) {
        await playerRef.current.seek(positionMs);
        return true;
      }
      return false;
    },
    [isWebPlayerReady]
  );

  const isPremium = user?.product === "premium";

  return (
    <SpotifyAuthContext.Provider
      value={{
        user,
        tokens,
        isLoggedIn: !!tokens?.access_token,
        isLoggingIn,
        isWebPlayerReady,
        deviceId,
        sdkError,
        loginErrorDetails,
        isPremium,
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal,
        login,
        loginWithToken,
        logout,
        clearLoginError,
        playSpotifyTrack,
        pauseSpotifyTrack,
        resumeSpotifyTrack,
        seekSpotifyTrack,
        playerState,
      }}
    >
      {children}
    </SpotifyAuthContext.Provider>
  );
};

export const useSpotifyAuth = () => {
  const context = useContext(SpotifyAuthContext);
  if (!context) {
    throw new Error("useSpotifyAuth must be used within a SpotifyAuthProvider");
  }
  return context;
};

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}
