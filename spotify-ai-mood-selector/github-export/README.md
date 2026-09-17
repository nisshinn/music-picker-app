# 🎵 Music Picker (Spotify × Google Gemini AI)

気分やシチュエーション、アーティスト・ジャンルから、Google Gemini AIが感性に響く5曲を厳選し、Spotify公式カタログからフル試聴・Web再生・プレイリスト作成ができる音楽キュレーションアプリです。

---

## 🌟 特徴・いいとこどりポイント

1. **AI感情・シチュエーション分析（Google Gemini 3.8 Flash）**
   - 自由な日本語文章（例:「雨の帰り道、少し前向きになりたい」「集中して作業に没頭したい」）からエネルギー・ポジティブ度・キーワードをAIが自動分析。
   - なぜその曲を選んだのか、1曲ごとの**推薦理由**や**雰囲気タグ（疾走感、チル等）**を自動生成。
   - 一時的な混雑（503エラー）に対する**指数バックオフ自動リトライ**と**複数モデルへの自動フォールバック**を搭載。

2. **Spotify Web Playback SDK & Web API フル連携**
   - **ブラウザ内フル再生**: Spotify Premiumアカウントでログインすれば、Web上でそのままフル楽曲再生。
   - **Spotifyへ一括保存**: 気に入った5曲を、ワンクリックであなたのSpotify公式プレイリストへ即時追加。
   - **ライブラリ連携**: 自分のSpotifyプレイリスト一覧の取得・再生、TOP曲一覧に対応。
   - **NOW PLAYING & MediaSession**: PC/スマホのロック画面・通知バーから再生・一時停止・スキップが可能。

---

## 🛠️ 技術スタック

- **バックエンド**: Node.js, Express 5
- **フロントエンド**: HTML5, CSS3, Vanilla JavaScript (Spotify Web Playback SDK)
- **AI**: `@google/genai` (Gemini 3.8 Flash, Flash-Latest)
- **外部API**: Spotify Web API (PKCE + Client Credentials フロー)

---

## 🚀 セットアップ & 起動手順 (VS Code / ローカル)

### 1. リポジトリをクローンまたはダウンロード
```bash
git clone https://github.com/YOUR_USERNAME/music-picker.git
cd music-picker
```

### 2. パッケージをインストール
```bash
npm install
```

### 3. 環境変数（`.env`）を作成
`.env.example` をコピーして `.env` を作成します：
```bash
cp .env.example .env
```

`.env` にAPIキーを記入します：
```env
# Spotify Developer Dashboard (https://developer.spotify.com/dashboard)
SPOTIFY_CLIENT_ID=あなたのSpotify_Client_ID
SPOTIFY_CLIENT_SECRET=あなたのSpotify_Client_Secret

# Google AI Studio (https://aistudio.google.com/apikey)
GEMINI_API_KEY=あなたのGemini_APIキー

PORT=3000
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/auth/callback
```

> **Spotify Developer Dashboard の設定:**
> 1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) でアプリを作成します。
> 2. アプリの **Settings** を開き、**Redirect URIs** に `http://127.0.0.1:3000/auth/callback` を追加して保存してください。
> 3. **Users and Access** タブで、ログインに使うご自身のメールアドレスを登録してください。

### 4. サーバーを起動
```bash
npm run dev
# または Windows の場合は start.bat をダブルクリック
```

ブラウザで `http://127.0.0.1:3000` を開きます。

---

## 🐳 Docker での起動

Dockerがインストールされている環境では、1コマンドで起動できます：
```bash
docker compose up -d
```

---

## 📁 ディレクトリ構成

```text
music-picker/
├── .env.example          # 環境変数のサンプル
├── .gitignore            # Git除外設定（APIキー漏洩防止）
├── docker-compose.yml    # Docker構成
├── package.json
├── server.js             # Express サーバー（Spotify API + Gemini AIハイブリッド）
├── start.bat             # Windows用ワンクリック起動スクリプト
├── README.md
└── public/
    ├── index.html        # メイン画面（AI気分入力、アーティスト、ジャンル選択）
    ├── search.html       # 楽曲検索
    ├── favorites.html    # お気に入り
    ├── history.html      # 履歴
    ├── top-tracks.html   # Spotify TOP曲
    ├── account.html      # アカウント接続
    ├── settings.html     # 設定・テーマ
    ├── style.css         # UIスタイル
    ├── ui-fix.css
    ├── script.js         # プレイヤー制御・AI理由レンダリング
    └── icon.svg          # アプリアイコン
```

---

## 📄 ライセンス
ISC License
