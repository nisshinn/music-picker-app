import React, { useState, useEffect } from "react";
import {
  X,
  Key,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  ShieldCheck,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Info
} from "lucide-react";
import { useSpotifyAuth } from "../context/SpotifyAuthContext.tsx";

export const SpotifyLoginModal: React.FC = () => {
  const {
    isLoginModalOpen,
    closeLoginModal,
    login,
    loginWithToken,
    isLoggingIn,
    sdkError,
    loginErrorDetails,
    clearLoginError,
  } = useSpotifyAuth();

  const [activeTab, setActiveTab] = useState<"oauth" | "token">("oauth");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isVerifyingToken, setIsVerifyingToken] = useState<boolean>(false);
  const [hasCopiedUri, setHasCopiedUri] = useState<boolean>(false);
  const [showConfigGuide, setShowConfigGuide] = useState<boolean>(false);
  const [directAuthUrl, setDirectAuthUrl] = useState<string | null>(null);

  // Derive current expected redirect URI
  const currentRedirectUri = `${window.location.origin}/auth/callback`;

  // Fetch direct auth URL so user can open in new tab if popup is blocked
  useEffect(() => {
    if (isLoginModalOpen) {
      fetch(`/api/auth/spotify/url?origin=${encodeURIComponent(window.location.origin)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.url) setDirectAuthUrl(data.url);
        })
        .catch(() => {});
    }
  }, [isLoginModalOpen]);

  // If there's an active error, automatically show the config guide
  useEffect(() => {
    if (loginErrorDetails || sdkError) {
      setShowConfigGuide(true);
    }
  }, [loginErrorDetails, sdkError]);

  if (!isLoginModalOpen) return null;

  const handleCopyUri = () => {
    const uriToCopy = loginErrorDetails?.redirectUri || currentRedirectUri;
    navigator.clipboard.writeText(uriToCopy);
    setHasCopiedUri(true);
    setTimeout(() => setHasCopiedUri(false), 2500);
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setTokenError("アクセストークンを入力してください");
      return;
    }

    setTokenError(null);
    setIsVerifyingToken(true);
    const result = await loginWithToken(tokenInput.trim());
    setIsVerifyingToken(false);

    if (!result.success) {
      setTokenError(result.error || "トークンの検証に失敗しました。正しいトークンかご確認ください。");
    } else {
      setTokenInput("");
    }
  };

  return (
    <div
      id="spotify-login-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          clearLoginError();
          closeLoginModal();
        }
      }}
    >
      <div
        id="spotify-login-modal"
        className="w-full max-w-lg bg-[#181818] border border-[#282828] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#282828] bg-[#1f1f1f]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center shadow-md">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="black">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.58 14.42c-.2.3-.58.4-.88.2-2.42-1.48-5.46-1.82-9.05-1-.34-.08-.68.14-.76.48-.08.34.14.68.48.76 3.93.9 7.31.52 10.01 1.14.3.2.4.58.2.9zm1.22-2.72c-.25.4-.76.53-1.16.28-2.77-1.7-7-2.2-10.28-1.2-.45.14-.94-.12-1.07-.58-.14-.45.12-.94.58-1.07 3.75-1.14 8.43-.59 11.65 1.39.4.25.53.76.28 1.18zm.13-2.84C14.62 9.06 9.17 8.87 5.96 9.84c-.5.15-1.03-.14-1.18-.64-.15-.5.14-1.03.64-1.18 3.7-1.12 9.71-.9 13.56 1.38.45.27.6.86.33 1.31-.27.45-.86.6-1.38.35z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Spotify ログイン & 連携</h3>
              <p className="text-xs text-neutral-400">ログインすると楽曲のフル再生が可能になります</p>
            </div>
          </div>
          <button
            id="btn-close-login-modal"
            onClick={() => {
              clearLoginError();
              closeLoginModal();
            }}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#2a2a2a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Active Error Notice */}
          {(loginErrorDetails || sdkError) && (
            <div
              id="login-error-banner"
              className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs space-y-1.5"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold text-red-300">ログインでエラーが発生しました:</span>
                  <p className="mt-0.5 text-neutral-300 text-xs break-all">
                    {loginErrorDetails?.message || sdkError}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#121212] rounded-xl border border-[#282828]">
            <button
              id="tab-oauth-login"
              onClick={() => setActiveTab("oauth")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                activeTab === "oauth"
                  ? "bg-[#282828] text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              ワンクリック認証
            </button>
            <button
              id="tab-token-login"
              onClick={() => setActiveTab("token")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "token"
                  ? "bg-[#282828] text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Key className="w-3.5 h-3.5 text-[#1DB954]" />
              トークンで直接ログイン
            </button>
          </div>

          {/* Tab 1: OAuth Popup / Direct Tab */}
          {activeTab === "oauth" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#1e1e1e] border border-[#2c2c2c] space-y-3">
                <div className="flex items-center gap-2 text-[#1DB954] text-xs font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Spotify公式アカウント連携</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Spotifyアカウントで認証を行うと、Spotify Web Playback SDKがアクティベートされ、ブラウザ内で楽曲を最初から最後までフル再生できます。
                </p>

                <button
                  id="btn-modal-oauth-login"
                  onClick={login}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 text-black font-extrabold text-sm transition-transform active:scale-95 shadow-md shadow-[#1DB954]/25"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="black">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.58 14.42c-.2.3-.58.4-.88.2-2.42-1.48-5.46-1.82-9.05-1-.34-.08-.68.14-.76.48-.08.34.14.68.48.76 3.93.9 7.31.52 10.01 1.14.3.2.4.58.2.9zm1.22-2.72c-.25.4-.76.53-1.16.28-2.77-1.7-7-2.2-10.28-1.2-.45.14-.94-.12-1.07-.58-.14-.45.12-.94.58-1.07 3.75-1.14 8.43-.59 11.65 1.39.4.25.53.76.28 1.18zm.13-2.84C14.62 9.06 9.17 8.87 5.96 9.84c-.5.15-1.03-.14-1.18-.64-.15-.5.14-1.03.64-1.18 3.7-1.12 9.71-.9 13.56 1.38.45.27.6.86.33 1.31-.27.45-.86.6-1.38.35z" />
                  </svg>
                  <span>{isLoggingIn ? "接続中..." : "Spotifyでログインする"}</span>
                </button>

                {/* Direct link in new tab if popup is blocked */}
                {directAuthUrl && (
                  <div className="pt-1 text-center">
                    <a
                      id="link-direct-auth-tab"
                      href={directAuthUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-[#1DB954] transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>ポップアップが開かない場合はこちら（別タブで認証）</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Developer Configuration Details (Toggleable or Auto-Shown on Error) */}
              <div className="border border-[#2a2a2a] rounded-xl overflow-hidden bg-[#141414]">
                <button
                  type="button"
                  onClick={() => setShowConfigGuide(!showConfigGuide)}
                  className="w-full flex items-center justify-between p-3.5 text-left text-xs font-semibold text-neutral-300 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-400" />
                    <span>Spotify Developer Dashboard の登録確認・設定</span>
                  </span>
                  <span className="text-xs text-neutral-500 font-normal">
                    {showConfigGuide ? "閉じる" : "表示する"}
                  </span>
                </button>

                {showConfigGuide && (
                  <div className="p-4 pt-1 border-t border-[#222] space-y-3 text-xs text-neutral-300">
                    <p className="leading-relaxed">
                      Spotifyの仕様上、開発中モードのアプリでは<strong>Redirect URI</strong>の登録と、<strong>Users and Access</strong>へのログインメールアドレス登録が必要です。
                    </p>

                    <div>
                      <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                        1. 登録が必要な Redirect URI (コールバックURL)
                      </label>
                      <div className="flex items-center gap-2 bg-[#1c1c1c] border border-[#333] p-2 rounded-lg">
                        <code className="text-[11px] text-[#1DB954] flex-1 break-all select-all font-mono">
                          {loginErrorDetails?.redirectUri || currentRedirectUri}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopyUri}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md bg-[#2a2a2a] hover:bg-[#333] text-white flex-shrink-0 transition-colors"
                        >
                          {hasCopiedUri ? (
                            <>
                              <Check className="w-3 h-3 text-[#1DB954]" />
                              <span>コピー済</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>コピー</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <p className="font-bold text-neutral-400 text-[11px]">2. 設定手順:</p>
                      <ol className="list-decimal list-inside space-y-1 text-neutral-400 leading-normal pl-1">
                        <li>
                          <a
                            href="https://developer.spotify.com/dashboard"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#1DB954] underline hover:text-[#1ed760]"
                          >
                            Spotify Developer Dashboard
                          </a>
                          を開きます
                        </li>
                        <li>作成したアプリの「Settings」を開きます</li>
                        <li>「Redirect URIs」に上のURLを追加し「Save」をクリック</li>
                        <li>
                          「Users and Access」タブを開き、ログインするメールアドレス（例:{" "}
                          <span className="text-white font-mono">yuuto20050107@gmail.com</span>）を追加
                        </li>
                      </ol>
                    </div>

                    <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-300/90">
                      💡 設定が完了するまでは、上部の「トークンで直接ログイン」タブからでも即座にログインしてフル再生を有効化できます！
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Manual Access Token Login */}
          {activeTab === "token" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#1e1e1e] border border-[#2c2c2c] space-y-3">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                  <Key className="w-4 h-4" />
                  <span>Spotify Access Token 直接入力</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Spotify Developerのアクセストークンを貼り付けることで、Redirect URIの設定状態に関わらず、即座にログインを完了してフル再生を有効化できます。
                </p>

                <form onSubmit={handleTokenSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                      Spotify Access Token
                    </label>
                    <textarea
                      id="input-spotify-access-token"
                      rows={3}
                      value={tokenInput}
                      onChange={(e) => {
                        setTokenInput(e.target.value);
                        setTokenError(null);
                      }}
                      placeholder="BQ... または SpotifyのOAuth Access Token"
                      className="w-full bg-[#121212] border border-[#333] focus:border-[#1DB954] focus:outline-none rounded-xl p-3 text-xs text-white font-mono placeholder:text-neutral-600 transition-colors"
                    />
                  </div>

                  {tokenError && (
                    <div className="text-xs text-red-400 flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{tokenError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isVerifyingToken || !tokenInput.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 text-black font-extrabold text-sm transition-transform active:scale-95 shadow-md shadow-[#1DB954]/25"
                  >
                    <span>{isVerifyingToken ? "トークン検証中..." : "トークンでログインする"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>

              {/* Instructions on how to get token */}
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] text-xs text-neutral-300 space-y-2">
                <span className="font-bold text-neutral-300 text-xs flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-neutral-400" />
                  トークンの取得方法（10秒で取得可能）:
                </span>
                <ol className="list-decimal list-inside space-y-1 text-neutral-400 pl-1">
                  <li>
                    <a
                      href="https://developer.spotify.com/documentation/web-api/reference/get-current-users-profile"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1DB954] underline hover:text-[#1ed760]"
                    >
                      Spotify Web API ドキュメント
                    </a>
                    または Console を開く
                  </li>
                  <li>ページ内の「Try it」または「Get Token」をクリック</li>
                  <li>表示されたアクセストークンをコピーして上の枠に貼り付ける</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#282828] bg-[#1a1a1a] flex items-center justify-between">
          <span className="text-[11px] text-neutral-400">
            Spotify API Client ID: <code className="font-mono text-neutral-300">93ee9a60e...</code>
          </span>
          <button
            onClick={() => {
              clearLoginError();
              closeLoginModal();
            }}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white hover:bg-[#252525] transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
