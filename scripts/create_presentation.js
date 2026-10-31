const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");

async function generatePresentation() {
  const pptx = new pptxgen();

  // 16:9 Widescreen presentation
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "情報科 卒業制作";
  pptx.company = "Music Picker Project";
  pptx.title = "Music Picker - AIとWeb APIが織りなす次世代音楽ディスカバリー";
  pptx.subject = "情報実習 卒業制作発表";

  // Brand Palette
  const THEME = {
    bg: "0D0F11",       // Dark backdrop
    card: "181C20",     // Glass/card container
    cardBorder: "2A323D",
    green: "1DB954",    // Spotify Green
    accentRed: "FA2D48",// Music Red
    text: "F4F7F7",     // Clean white/light text
    muted: "8E9AA0",    // Secondary text
    white: "FFFFFF",
  };

  const assetsDir = path.join(__dirname, "../public/assets/aistudio");

  // Helper to safely get image path
  function getAssetPath(filename) {
    const full = path.join(assetsDir, filename);
    return fs.existsSync(full) ? full : null;
  }

  const imgAlbums = getAssetPath("image_c02dd85e.png");
  const imgDiscography = getAssetPath("image_5547d633.png");
  const imgAlbumDetail = getAssetPath("image_ee3dcacb.png");
  const imgTopSongs = getAssetPath("image_4655cc4d.png");
  const imgSearch = getAssetPath("image_91b8240a.png");

  // ==========================================
  // SLIDE 1: Title Slide (0:00〜1:00)
  // ==========================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: THEME.bg };

    // Decorative glow element
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0.8,
      y: 0.8,
      w: 0.15,
      h: 5.6,
      fill: { color: THEME.green },
      line: { type: "none" }
    });

    slide.addText("情報実習 卒業制作発表", {
      x: 1.2,
      y: 1.2,
      w: 11.0,
      h: 0.4,
      fontSize: 16,
      bold: true,
      color: THEME.green,
      fontFace: "Meiryo",
    });

    slide.addText("Music Picker", {
      x: 1.2,
      y: 1.7,
      w: 11.0,
      h: 1.2,
      fontSize: 54,
      bold: true,
      color: THEME.white,
      fontFace: "Arial Black",
    });

    slide.addText("AIとWeb APIを融合させた次世代音楽ディスカバリーWebアプリケーション", {
      x: 1.2,
      y: 3.0,
      w: 10.5,
      h: 0.7,
      fontSize: 20,
      bold: true,
      color: THEME.text,
      fontFace: "Meiryo",
    });

    // Sub points card
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 1.2,
      y: 4.0,
      w: 10.8,
      h: 1.8,
      fill: { color: THEME.card },
      line: { color: THEME.cardBorder, width: 1.5 },
      rectRadius: 0.15,
    });

    slide.addText([
      { text: "✦ Google Gemini AI：", options: { bold: true, color: THEME.green } },
      { text: "自然言語からユーザーの感情・情景・シチュエーションを解析\n", options: { color: THEME.text } },
      { text: "✦ Spotify Web API：", options: { bold: true, color: THEME.green } },
      { text: "数千万曲のカタログ検索、試聴ストリーミング、公式プレイリスト保存\n", options: { color: THEME.text } },
      { text: "✦ 実践的フルスタック開発：", options: { bold: true, color: THEME.green } },
      { text: "RESTful Gateway、ミリ秒同期歌詞、レスポンシブカルーセルUI", options: { color: THEME.text } },
    ], {
      x: 1.5,
      y: 4.2,
      w: 10.2,
      h: 1.4,
      fontSize: 14,
      fontFace: "Meiryo",
      paraSpaceAfter: 6,
    });

    slide.addNotes(
`【発表原稿（スライド1: タイトル）/ 目安時間: 1分00秒】
皆さん、こんにちは。情報科の情報実習卒業制作として、私は『Music Picker（ミュージック・ピッカー）』というWebアプリケーションを開発しました。

このアプリは、Googleの最新AI『Gemini』と、世界最大規模の音楽プラットフォーム『Spotify』の公式APIを融合させた、次世代の音楽ディスカバリー・レコメンドシステムです。

従来の音楽アプリとは異なり、ユーザーの言葉や感情、シチュエーションをAIが深く読み解き、数千万曲の中から『今、本当に聴きたい5曲』を導き出します。

本日は、開発の背景からシステム構成、直面した技術的課題の克服、そしてUIの工夫までをご紹介します。どうぞよろしくお願いいたします。`
    );
  }

  // ==========================================
  // SLIDE 2: Background & Motivation (1:00〜2:00)
  // ==========================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: THEME.bg };

    slide.addText("DEVELOPMENT BACKGROUND", {
      x: 0.8, y: 0.5, w: 10, h: 0.3,
      fontSize: 12, bold: true, color: THEME.green, fontFace: "Arial"
    });
    slide.addText("なぜ作ったのか？ 既存の音楽推薦が抱える3つの課題", {
      x: 0.8, y: 0.8, w: 11.5, h: 0.6,
      fontSize: 26, bold: true, color: THEME.white, fontFace: "Meiryo"
    });

    // 3 Problem Cards
    const problems = [
      {
        num: "01",
        title: "選択のパラドックス（検索疲労）",
        desc: "7,000万曲以上ある中から『今何を聴くべきか』を選べず、探すだけで疲れてしまう。",
        color: THEME.accentRed
      },
      {
        num: "02",
        title: "レコメンドの固定化（マンネリ）",
        desc: "既存のアルゴリズムは過去の再生履歴に縛られ、いつも似た曲ばかり流れて新しい発見がない。",
        color: "FFA000"
      },
      {
        num: "03",
        title: "感性・シチュエーションの分断",
        desc: "『雨の日の帰り道に少し浸りたい』といった人の繊細な気分や情景を言葉で入力できない。",
        color: THEME.green
      }
    ];

    problems.forEach((p, idx) => {
      const xPos = 0.8 + idx * 3.8;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: xPos, y: 1.8, w: 3.5, h: 4.4,
        fill: { color: THEME.card },
        line: { color: THEME.cardBorder, width: 1.5 },
        rectRadius: 0.12,
      });

      slide.addText(p.num, {
        x: xPos + 0.3, y: 2.1, w: 2.9, h: 0.6,
        fontSize: 32, bold: true, color: p.color, fontFace: "Arial Black"
      });
      slide.addText(p.title, {
        x: xPos + 0.3, y: 2.8, w: 2.9, h: 0.8,
        fontSize: 16, bold: true, color: THEME.white, fontFace: "Meiryo"
      });
      slide.addText(p.desc, {
        x: xPos + 0.3, y: 3.7, w: 2.9, h: 2.2,
        fontSize: 13, color: THEME.muted, fontFace: "Meiryo", lineSpacing: 20
      });
    });

    slide.addNotes(
`【発表原稿（スライド2: 開発背景と動機）/ 目安時間: 1分00秒】
私たちが日常で使っているサブスクリプション音楽サービスには、数千万曲もの膨大な楽曲が存在します。
しかし、あまりにも曲数が多すぎるがゆえに、『何を聴けばいいのか迷ってしまう』という『選択のパラドックス』、いわゆる検索疲労が起きています。

また、既存の音楽レコメンドアルゴリズムは、過去に自分が聴いた再生履歴に大きく依存しているため、いつも似たような曲ばかりが提案され、新しい音楽との出会いが生まれにくいという課題がありました。

さらに重要なのが、『雨の日の帰り道に少し感傷的な気分で聴きたい』『深夜のドライブで爽快に走りたい』といった、人の繊細な気分や情景を受け止める仕組みが存在しない点です。
そこで、自然言語を深く扱える生成AIの力を借りて、この3つの課題を解決したいと考えたのが、本プロジェクトの出発点です。`
    );
  }

  // ==========================================
  // SLIDE 3: System Architecture (2:00〜3:00)
  // ==========================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: THEME.bg };

    slide.addText("SYSTEM ARCHITECTURE", {
      x: 0.8, y: 0.5, w: 10, h: 0.3,
      fontSize: 12, bold: true, color: THEME.green, fontFace: "Arial"
    });
    slide.addText("システム構成：AIとWeb APIを安全に繋ぐ多層アーキテクチャ", {
      x: 0.8, y: 0.8, w: 11.5, h: 0.6,
      fontSize: 26, bold: true, color: THEME.white, fontFace: "Meiryo"
    });

    // 4 Layer Columns
    const arch = [
      {
        title: "Client Layer",
        badge: "Frontend",
        points: ["HTML5 / Vanilla JS / CSS3", "PWA (Service Worker) 対応", "ゼロオーバーヘッドの軽快動作", "完全レスポンシブデザイン"]
      },
      {
        title: "Gateway Layer",
        badge: "Node.js Express 5",
        points: ["RESTful API サーバー", "APIキー秘匿とセキュリティ保護", "レートリミット & キャッシュ管理", "データ正規化・フィルタリング"]
      },
      {
        title: "AI Analysis Layer",
        badge: "Google Gemini",
        points: ["@google/genai SDK", "情景・気分の多次元感情分析", "音楽メタデータ（BPM/ジャンル）推論", "選曲理由（Reason）の動的生成"]
      },
      {
        title: "Music Catalog Layer",
        badge: "Spotify & LRCLIB",
        points: ["Spotify Web API (カタログ照合)", "Spotify Web Playback SDK (試聴)", "Spotify プレイリスト公式保存", "LRCLIB リアルタイム同期歌詞"]
      }
    ];

    arch.forEach((a, idx) => {
      const xPos = 0.8 + idx * 2.85;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: xPos, y: 1.8, w: 2.65, h: 4.5,
        fill: { color: THEME.card },
        line: { color: THEME.cardBorder, width: 1.5 },
        rectRadius: 0.1,
      });

      slide.addText(a.badge, {
        x: xPos + 0.2, y: 2.05, w: 2.25, h: 0.35,
        fontSize: 10, bold: true, color: THEME.green, fontFace: "Arial",
      });
      slide.addText(a.title, {
        x: xPos + 0.2, y: 2.4, w: 2.25, h: 0.5,
        fontSize: 15, bold: true, color: THEME.white, fontFace: "Meiryo",
      });

      slide.addText(a.points.map(pt => `• ${pt}`).join("\n\n"), {
        x: xPos + 0.2, y: 3.0, w: 2.25, h: 3.1,
        fontSize: 11.5, color: THEME.muted, fontFace: "Meiryo", lineSpacing: 18,
      });
    });

    slide.addNotes(
`【発表原稿（スライド3: システムアーキテクチャ）/ 目安時間: 1分00秒】
続いて、本システムの技術構成について説明します。

システムは大きく4つの階層で構成されています。
まずクライアント層は、フレームワークのオーバーヘッドを排したVanilla JavaScriptとモダンCSSで構築しており、スマートフォンの低速回線でも瞬時に動作し、PWAとしてホーム画面追加にも対応しています。

バックエンドには最新のExpress 5を採用し、クライアントから直接APIキーが見えないようセキュアなAPIプロキシゲートウェイとして機能させています。ここで後述するデータ整形やキャッシュ制御を一手に担っています。

そしてAI解析層にはGoogle Gemini APIを組み込み、ユーザーの入力文から音楽的パラメータを抽出します。
カタログ・配信層にはSpotify Web APIとWeb Playback SDKを連携させ、リアルタイム同期歌詞にはオープンソースのLRCLIBを採用しました。
各コンポーネントが役割分担することで、堅牢で拡張性の高い設計を実現しています。`
    );
  }

  // ==========================================
  // SLIDE 4: Core Feature 1 - AI Mood Recommendation (3:00〜4:00)
  // ==========================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: THEME.bg };

    slide.addText("CORE FEATURE 01", {
      x: 0.8, y: 0.5, w: 10, h: 0.3,
      fontSize: 12, bold: true, color: THEME.green, fontFace: "Arial"
    });
    slide.addText("AI気分選曲：言葉の行間を読み解き、最適な5曲を推薦", {
      x: 0.8, y: 0.8, w: 11.5, h: 0.6,
      fontSize: 26, bold: true, color: THEME.white, fontFace: "Meiryo"
    });

    // Left Explanation Card
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.8, y: 1.8, w: 5.4, h: 4.5,
      fill: { color: THEME.card },
      line: { color: THEME.cardBorder, width: 1.5 },
      rectRadius: 0.12,
    });

    slide.addText([
      { text: "1. 自由な情景入力\n", options: { fontSize: 16, bold: true, color: THEME.green } },
      { text: "「雨上がりの夕暮れ、散歩しながらリフレッシュしたい」といった文章をそのまま入力可能。\n\n", options: { fontSize: 12.5, color: THEME.text } },
      { text: "2. 多次元感情メタデータ分析\n", options: { fontSize: 16, bold: true, color: THEME.green } },
      { text: "Geminiが感情価（Valence）・テンポ（BPM）・音響的特徴を多角的に推定し、ジャンルと曲調を決定。\n\n", options: { fontSize: 12.5, color: THEME.text } },
      { text: "3. Spotifyカタログ照合 ＆ ハルシネーション排除\n", options: { fontSize: 16, bold: true, color: THEME.green } },
      { text: "架空の曲名を出力させず、実在するSpotifyトラックIDと完全紐付け。納得感のある推薦理由（Reason）も同時表示。", options: { fontSize: 12.5, color: THEME.text } }
    ], {
      x: 1.1, y: 2.1, w: 4.8, h: 3.9,
      fontFace: "Meiryo",
    });

    // Right Side: Screenshot
    if (imgTopSongs) {
      slide.addImage({
        path: imgTopSongs,
        x: 6.5, y: 1.8, w: 5.8, h: 4.5,
        sizing: { type: "contain" }
      });
    }

    slide.addNotes(
`【発表原稿（スライド4: 主要機能① AI気分選曲）/ 目安時間: 1分00秒】
本アプリの中核機能である『AI気分選曲』の仕組みです。

ユーザーは、『明るい』『リラックス』といったボタンだけでなく、『雨上がりの夕暮れに、ゆっくり散歩しながら気持ちを切り替えたい』といった自由な文章を入力できます。

入力されたテキストをGemini AIが解析し、そのシーンにふさわしいテンポ、曲調の明るさや温かみ、音楽ジャンルを推論します。

ここで情報科として特にこだわったのが、『AIのハルシネーション（嘘の選曲）の完全排除』です。生成AIにただ曲名を答えさせると、実在しない架空の曲名を出力することがあります。
本システムでは、AIの分析パラメータをもとにSpotifyの公式データベースを厳密に照合し、実在する曲のみを特定した上で、なぜその曲が選ばれたのかという『推薦理由（Reason）』を添えて5曲を提示します。これにより、高い納得感と新しい発見を両立させています。`
    );
  }

  // ==========================================
  // SLIDE 5: Core Feature 2 - Native-level Experience (4:00〜5:00)
  // ==========================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: THEME.bg };

    slide.addText("CORE FEATURE 02", {
      x: 0.8, y: 0.5, w: 10, h: 0.3,
      fontSize: 12, bold: true, color: THEME.green, fontFace: "Arial"
    });
    slide.addText("ネイティブアプリ級の音楽体験：ディスコグラフィ・全曲再生・同期歌詞", {
      x: 0.8, y: 0.8, w: 11.5, h: 0.6,
      fontSize: 24, bold: true, color: THEME.white, fontFace: "Meiryo"
    });

    // 3 Feature boxes
    const features = [
      {
        title: "横スワイプカルーセル",
        desc: "ディスコグラフィのアルバムやシングルを指先1本で左右に滑らかにスワイプ。展開ボタンを押す手間をゼロに。",
        img: imgDiscography
      },
      {
        title: "アルバム全曲一括再生",
        desc: "アルバム詳細画面の大きな緑のボタンから、全曲をシームレスにキュー投入して最初から連続再生。",
        img: imgAlbumDetail
      },
      {
        title: "リアルタイム同期歌詞",
        desc: "再生中の小節・行に自動追従。タップでその歌詞位置へ瞬時にシーク。文字サイズ変更や全画面モードも搭載。",
        img: null
      }
    ];

    features.forEach((f, idx) => {
      const xPos = 0.8 + idx * 3.8;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: xPos, y: 1.8, w: 3.5, h: 4.4,
        fill: { color: THEME.card },
        line: { color: THEME.cardBorder, width: 1.5 },
        rectRadius: 0.12,
      });

      slide.addText(f.title, {
        x: xPos + 0.25, y: 2.05, w: 3.0, h: 0.45,
        fontSize: 16, bold: true, color: THEME.green, fontFace: "Meiryo"
      });
      slide.addText(f.desc, {
        x: xPos + 0.25, y: 2.55, w: 3.0, h: 1.1,
        fontSize: 11.5, color: THEME.muted, fontFace: "Meiryo", lineSpacing: 16
      });

      if (f.img) {
        slide.addImage({
          path: f.img,
          x: xPos + 0.2, y: 3.8, w: 3.1, h: 2.2,
          sizing: { type: "contain" }
        });
      } else {
        // Feature 3 illustration box
        slide.addShape(pptx.shapes.RECTANGLE, {
          x: xPos + 0.25, y: 3.8, w: 3.0, h: 2.1,
          fill: { color: "111417" },
          line: { color: THEME.cardBorder, width: 1 }
        });
        slide.addText([
          { text: "♪ Synchronized Lyrics\n", options: { fontSize: 13, bold: true, color: THEME.white } },
          { text: "• 小 / 中 / 大 文字サイズ切替\n", options: { fontSize: 11, color: THEME.muted } },
          { text: "• ⛶ 全画面フォーカスモード\n", options: { fontSize: 11, color: THEME.muted } },
          { text: "• LRCLIB連携 ミリ秒同期", options: { fontSize: 11, color: THEME.green } },
        ], {
          x: xPos + 0.35, y: 4.0, w: 2.8, h: 1.7,
          fontFace: "Meiryo"
        });
      }
    });

    slide.addNotes(
`【発表原稿（スライド5: 主要機能② 洗練された音楽体験）/ 目安時間: 1分00秒】
続いて、選んだ曲をいかに心地よく楽しむかという『音楽体験の質』へのこだわりです。

第1に、アーティスト詳細画面では、Apple MusicやSpotifyの公式アプリに匹敵する操作感を目指し、アルバムやシングルを指先で横スワイプできるカルーセルUIを実装しました。無駄な展開ボタンを排除し、直感的に作品を閲覧できます。

第2に、アルバム詳細画面では、ヘッダーに大きな緑の『全曲再生』ボタンを配置しました。ワンタップでそのアルバムの全収録曲が再生キューにセットされ、1曲目から自動で連続再生されます。

第3に、フルスクリーンプレイヤーには『リアルタイム同期歌詞機能』を搭載しました。音楽の再生位置に合わせて歌詞が滑らかに自動スクロールし、特定の歌詞をタップすればその位置へ一瞬で曲がジャンプします。文字サイズの変更や全画面モードも備え、Webアプリとは思えないリッチな音楽体験を実現しました。`
    );
  }

  // ==========================================
  // SLIDE 6: Technical Challenges & Solutions (5:00〜6:00)
  // ==========================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: THEME.bg };

    slide.addText("TECHNICAL CHALLENGES & SOLUTIONS", {
      x: 0.8, y: 0.5, w: 10, h: 0.3,
      fontSize: 12, bold: true, color: THEME.green, fontFace: "Arial"
    });
    slide.addText("直面した技術的課題と、その解決アプローチ", {
      x: 0.8, y: 0.8, w: 11.5, h: 0.6,
      fontSize: 26, bold: true, color: THEME.white, fontFace: "Meiryo"
    });

    const challenges = [
      {
        tag: "CHALLENGE 1: Spotify APIの制限",
        prob: "課題：Client Credentialsトークンでは公式のTop-Tracks APIが403 Forbiddenを返し、人気曲やアルバムが取得できない。",
        sol: "解決策：トラック検索API（market=JP指定）へ多段階オフセット検索をかけ、独自に人気度・一致率をスコアリングして人気20曲を再構築する代替エンジンを開発。"
      },
      {
        tag: "CHALLENGE 2: 音源ノイズ・重複問題",
        prob: "課題：一部のアーティストでライブ盤の重複曲やMC・スキット（Audio 001等）が上位を占有し、代表曲が埋もれてしまう。",
        sol: "解決策：タイトル正規表現解析によるスタジオ音源優先判定ロジックを実装。ノイズ音源を除外し、真の代表曲を抽出するフィルタリング層を追加。"
      },
      {
        tag: "CHALLENGE 3: 再生時間と歌詞の同期ズレ",
        prob: "課題：シークやネットワーク遅延により、プログレスバーと歌詞スクロールのタイミングが徐々にズレてしまう。",
        sol: "解決策：独立したタイマーを廃止し、サーバータイムスタンプと単一の基準クロック（Single Source of Truth）による完全同期アーキテクチャへ刷新。"
      }
    ];

    challenges.forEach((c, idx) => {
      const yPos = 1.7 + idx * 1.6;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.8, y: yPos, w: 11.2, h: 1.4,
        fill: { color: THEME.card },
        line: { color: THEME.cardBorder, width: 1 },
        rectRadius: 0.08,
      });

      slide.addText(c.tag, {
        x: 1.1, y: yPos + 0.12, w: 10.5, h: 0.3,
        fontSize: 11, bold: true, color: THEME.green, fontFace: "Arial"
      });
      slide.addText(c.prob, {
        x: 1.1, y: yPos + 0.45, w: 10.5, h: 0.4,
        fontSize: 12, bold: true, color: THEME.white, fontFace: "Meiryo"
      });
      slide.addText(c.sol, {
        x: 1.1, y: yPos + 0.85, w: 10.5, h: 0.45,
        fontSize: 11.5, color: THEME.muted, fontFace: "Meiryo"
      });
    });

    slide.addNotes(
`【発表原稿（スライド6: 直面した技術的課題と解決）/ 目安時間: 1分00秒】
開発の過程では、情報科の実習として非常に学びの多い、3つの大きな技術的課題に直面しました。

1点目は、Spotify Web APIの認証制限です。ログインなしのトークンでは公式のTop-Tracksエンドポイントが403エラーを返す仕様制限がありました。そこで、日本市場を指定したトラック検索APIを多重オフセットで走らせ、人気度とタイトル一致度を独自にスコアリングして代表20曲を抽出する代替アルゴリズムを開発して克服しました。

2点目は、音源ノイズの問題です。人気曲を取得すると、ライブ音源の重複やアルバムの幕間音声が上位に来てしまう現象が発生しました。これに対し、正規表現によるタイトル解析を行い、通常版（スタジオ音源）を優先判定するフィルタを実装してクリーンな曲リストを実現しました。

3点目は、再生クロックと歌詞スクロールの同期ズレです。ネットワーク遅延やシーク操作で同期が崩れないよう、単一のマスタークロックを設けて全UIに位置情報を配信する設計に改め、ミリ秒精度の安定した追従を実現しました。`
    );
  }

  // ==========================================
  // SLIDE 7: UI/UX Refinement & Polish (6:00〜7:00)
  // ==========================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: THEME.bg };

    slide.addText("UI / UX REFINEMENT", {
      x: 0.8, y: 0.5, w: 10, h: 0.3,
      fontSize: 12, bold: true, color: THEME.green, fontFace: "Arial"
    });
    slide.addText("UI/UXの進化：1タップで完結するストレスフリーな設計", {
      x: 0.8, y: 0.8, w: 11.5, h: 0.6,
      fontSize: 26, bold: true, color: THEME.white, fontFace: "Meiryo"
    });

    // Left 3 points
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.8, y: 1.8, w: 5.4, h: 4.5,
      fill: { color: THEME.card },
      line: { color: THEME.cardBorder, width: 1.5 },
      rectRadius: 0.12,
    });

    slide.addText([
      { text: "✦ 統一された曲行アクション\n", options: { fontSize: 15, bold: true, color: THEME.green } },
      { text: "検索・人気曲・アルバム全画面で『ハート（お気に入り）』と『Spotifyリンク』を統一配置。行タップ再生と干渉しない独立制御。\n\n", options: { fontSize: 12, color: THEME.text } },
      { text: "✦ 検索履歴 ＆ 人気アーティストチップ\n", options: { fontSize: 15, bold: true, color: THEME.green } },
      { text: "入力欄フォーカス時に直近の検索履歴と人気アーティストをクイックタグ表示。文字入力の手間を省きワンタップ検索。\n\n", options: { fontSize: 12, color: THEME.text } },
      { text: "✦ レスポンシブ＆アクセシビリティ\n", options: { fontSize: 15, bold: true, color: THEME.green } },
      { text: "PCの大画面からスマートフォンの片手操作まで、指の届きやすさと十分なタップターゲットを徹底配慮。", options: { fontSize: 12, color: THEME.text } }
    ], {
      x: 1.1, y: 2.1, w: 4.8, h: 3.9,
      fontFace: "Meiryo",
    });

    // Right screenshot
    if (imgSearch) {
      slide.addImage({
        path: imgSearch,
        x: 6.5, y: 1.8, w: 5.8, h: 4.5,
        sizing: { type: "contain" }
      });
    }

    slide.addNotes(
`【発表原稿（スライド7: UI/UXの改善と工夫）/ 目安時間: 1分00秒】
本アプリでは、技術的な堅牢さだけでなく、実際に利用するユーザーの心地よさ、UI/UXデザインの徹底的な洗練を行いました。

まず、画面によって操作感がバラバラにならないよう、検索画面、アーティスト人気曲、アルバム詳細画面のすべての曲リストで、お気に入りボタン（ハート）とSpotifyへの外部リンクアイコンを統一配置しました。行をタップすれば曲が再生され、ハートをタップすれば即座にライブラリに追加されるよう、イベントのバブリング制御を行っています。

次に、検索画面では、スマートフォンで文字を入力する負担を軽減するため、直近の検索履歴や話題のアーティストのクイックタップタグを表示させました。タップ一発で即座に検索結果が表示されます。

スマートフォンの片手操作でも押しやすいボタン配置や、暗い部屋でも目に優しいダークモードの調整など、ユーザー中心設計を徹底しました。`
    );
  }

  // ==========================================
  // SLIDE 8: Summary & Learnings (7:00〜8:00)
  // ==========================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: THEME.bg };

    slide.addText("CONCLUSION & FUTURE WORK", {
      x: 0.8, y: 0.5, w: 10, h: 0.3,
      fontSize: 12, bold: true, color: THEME.green, fontFace: "Arial"
    });
    slide.addText("まとめ：情報実習での学びとこれからの進化", {
      x: 0.8, y: 0.8, w: 11.5, h: 0.6,
      fontSize: 26, bold: true, color: THEME.white, fontFace: "Meiryo"
    });

    // Left Column: What was achieved
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.8, y: 1.8, w: 5.4, h: 4.5,
      fill: { color: THEME.card },
      line: { color: THEME.cardBorder, width: 1.5 },
      rectRadius: 0.12,
    });

    slide.addText("本制作で達成したこと・学び", {
      x: 1.1, y: 2.1, w: 4.8, h: 0.4,
      fontSize: 17, bold: true, color: THEME.green, fontFace: "Meiryo"
    });

    slide.addText([
      { text: "✔ AIと実APIの融合：\n", options: { bold: true, color: THEME.white } },
      { text: "生成AIの曖昧さ（ハルシネーション）をAPIカタログで補正し、実用に耐えるレコメンドシステムを実現。\n\n", options: { color: THEME.muted } },
      { text: "✔ 堅牢なエンジニアリング：\n", options: { bold: true, color: THEME.white } },
      { text: "全65件の単体テストをパスし、API制限や例外ケースにも屈しないフォールバック機構を構築。\n\n", options: { color: THEME.muted } },
      { text: "✔ 一貫したユーザー体験：\n", options: { bold: true, color: THEME.white } },
      { text: "カルーセル、同期歌詞、クイック検索など、細部まで磨き上げたUI/UXを完成。", options: { color: THEME.muted } }
    ], {
      x: 1.1, y: 2.6, w: 4.8, h: 3.4,
      fontSize: 12, fontFace: "Meiryo"
    });

    // Right Column: Future Outlook
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 6.6, y: 1.8, w: 5.4, h: 4.5,
      fill: { color: THEME.card },
      line: { color: THEME.cardBorder, width: 1.5 },
      rectRadius: 0.12,
    });

    slide.addText("今後の展望（Future Work）", {
      x: 6.9, y: 2.1, w: 4.8, h: 0.4,
      fontSize: 17, bold: true, color: THEME.white, fontFace: "Meiryo"
    });

    slide.addText([
      { text: "1. 継続的パーソナライズ学習\n", options: { bold: true, color: THEME.green } },
      { text: "再生履歴やお気に入りの傾向からユーザー固有の音楽的嗜好を学習し、より精度の高い選曲を行う。\n\n", options: { color: THEME.muted } },
      { text: "2. 音響特徴量（Audio Features）の活用\n", options: { bold: true, color: THEME.green } },
      { text: "SpotifyのDanceabilityやEnergyパラメータをAIのプロンプトにフィードバックし、選曲精度をさらに向上。\n\n", options: { color: THEME.muted } },
      { text: "3. 複数人でのリアルタイム選曲\n", options: { bold: true, color: THEME.green } },
      { text: "友人と一緒にドライブする際、お互いの好みを掛け合わせたプレイリストを共同生成する機能。", options: { color: THEME.muted } }
    ], {
      x: 6.9, y: 2.6, w: 4.8, h: 3.4,
      fontSize: 12, fontFace: "Meiryo"
    });

    slide.addNotes(
`【発表原稿（スライド8: まとめと今後の展望）/ 目安時間: 1分00秒】
まとめに入ります。

今回の卒業制作を通して、単にWeb APIを呼び出すだけでなく、生成AIの感性理解能力と実世界のWebサービスを組み合わせることで、従来の検索では到達できなかった『言葉と気分による音楽ディスカバリー』を具現化することができました。

また、API制限に対する代替アルゴリズムの開発や、データ正規化、ミリ秒単位のクロック制御、そして65件の自動テストを通した品質担保など、実用的なWebシステムを開発するための確かなエンジニアリングスキルを身につけることができました。

今後は、ユーザーの好みを継続的に学習するパーソナライズ機能や、友達同士で気分をシェアできる共同選曲機能へと発展させていきたいと考えています。

以上で私の卒業制作発表を終わります。ご清聴いただき、誠にありがとうございました。`
    );
  }

  // Output destination
  const outputPath = path.join(__dirname, "../public/graduation_presentation_music_picker.pptx");
  await pptx.writeFile({ fileName: outputPath });
  console.log(`PowerPoint presentation generated successfully: ${outputPath}`);
}

generatePresentation().catch(err => {
  console.error("Error generating presentation:", err);
  process.exit(1);
});
