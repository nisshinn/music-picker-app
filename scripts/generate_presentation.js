const pptxgen = require("pptxgenjs");
const path = require("path");
const fs = require("fs");

async function createPresentation() {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Music Picker Developer";
  pptx.company = "情報科 情報実習 卒業制作";
  pptx.title = "Music Picker - 卒業制作発表資料";

  const BG_DARK = "0F1115";
  const CARD_BG = "171B21";
  const CARD_BORDER = "2A323D";
  const TEXT_WHITE = "FFFFFF";
  const TEXT_MUTED = "94A3B8";
  const ACCENT_GREEN = "1ED760";
  const ACCENT_RED = "FA2D48";
  const ACCENT_BLUE = "38BDF8";

  const assetsDir = path.join(__dirname, "../public/assets/aistudio");
  const albumImg = path.join(assetsDir, "image_ee3dcacb.png");
  const discoImg = path.join(assetsDir, "image_5547d633.png");
  const topTracksImg = path.join(assetsDir, "image_4655cc4d.png");
  const searchImg = path.join(assetsDir, "image_91b8240a.png");

  // Helper to add card
  function addCard(slide, x, y, w, h, bg = CARD_BG, border = CARD_BORDER) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w, h,
      fill: { color: bg },
      line: { color: border, width: 1 },
      rectRadius: 0.15
    });
  }

  // -------------------------------------------------------------
  // Slide 1: Cover
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    slide.background = { color: BG_DARK };

    // Decorative accent line
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.8, y: 1.2, w: 0.8, h: 0.08,
      fill: { color: ACCENT_GREEN },
      line: { color: ACCENT_GREEN }
    });

    slide.addText("情報科 情報実習 卒業制作発表", {
      x: 0.8, y: 1.45, w: 8.0, h: 0.4,
      fontSize: 16, fontFace: "Meiryo", color: ACCENT_GREEN, bold: true
    });

    slide.addText("Music Picker", {
      x: 0.8, y: 1.9, w: 8.5, h: 1.2,
      fontSize: 54, fontFace: "Meiryo", color: TEXT_WHITE, bold: true
    });

    slide.addText("AIとWeb APIが織りなす次世代感情駆動型音楽ディスカバリー", {
      x: 0.8, y: 3.1, w: 8.5, h: 0.6,
      fontSize: 22, fontFace: "Meiryo", color: TEXT_MUTED
    });

    // Tag pills
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.8, y: 4.1, w: 2.2, h: 0.45,
      fill: { color: "1E2631" }, line: { color: ACCENT_GREEN, width: 1 }, rectRadius: 0.2
    });
    slide.addText("Google Gemini AI", {
      x: 0.8, y: 4.1, w: 2.2, h: 0.45,
      fontSize: 13, fontFace: "Meiryo", color: ACCENT_GREEN, bold: true, align: "center", valign: "middle"
    });

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 3.2, y: 4.1, w: 2.3, h: 0.45,
      fill: { color: "1E2631" }, line: { color: "1DB954", width: 1 }, rectRadius: 0.2
    });
    slide.addText("Spotify Web API", {
      x: 3.2, y: 4.1, w: 2.3, h: 0.45,
      fontSize: 13, fontFace: "Meiryo", color: "1DB954", bold: true, align: "center", valign: "middle"
    });

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 5.7, y: 4.1, w: 2.2, h: 0.45,
      fill: { color: "1E2631" }, line: { color: ACCENT_BLUE, width: 1 }, rectRadius: 0.2
    });
    slide.addText("Full-Stack SPA", {
      x: 5.7, y: 4.1, w: 2.2, h: 0.45,
      fontSize: 13, fontFace: "Meiryo", color: ACCENT_BLUE, bold: true, align: "center", valign: "middle"
    });

    slide.addNotes(
`【発表時間目安: 0:00 〜 0:55（約55秒）】
「皆さん、こんにちは。情報科の卒業制作発表を始めさせていただきます。
私が今回制作したのは、Webアプリケーション『Music Picker（ミュージックピッカー）』です。

私たちが日常の中で音楽を聴こうとするとき、『今の気分にぴったりな曲が聴きたいけれど、具体的に何の曲を検索すればいいのか分からない』という経験はないでしょうか。
本制作では、生成AIの高度な自然言語理解と、世界最大規模の音楽プラットフォームであるSpotifyの公式Web APIをリアルタイムに融合させ、ユーザーの曖昧な気分や言葉のニュアンスから、まさに『今この瞬間に聴くべき5曲』を瞬時に提示する次世代の音楽ディスカバリー体験を形にしました。

本日は、開発の背景と動機、主要な機能、そして開発の中で直面した技術的な壁とその解決策について詳しくお話しします。よろしくお願いいたします。」`
    );
  }

  // -------------------------------------------------------------
  // Slide 2: Background & Problem
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    slide.background = { color: BG_DARK };

    slide.addText("BACKGROUND & MOTIVATION", {
      x: 0.8, y: 0.6, w: 8.0, h: 0.3,
      fontSize: 12, fontFace: "Meiryo", color: ACCENT_GREEN, bold: true, letterSpacing: 2
    });
    slide.addText("7,000万曲の迷宮：音楽検索の限界と課題", {
      x: 0.8, y: 0.9, w: 8.4, h: 0.6,
      fontSize: 28, fontFace: "Meiryo", color: TEXT_WHITE, bold: true
    });

    // Left Card (Problem)
    addCard(slide, 0.8, 1.8, 4.0, 3.2);
    slide.addText("⚠️ 従来の音楽検索・推薦の課題", {
      x: 1.1, y: 2.1, w: 3.4, h: 0.4,
      fontSize: 16, fontFace: "Meiryo", color: ACCENT_RED, bold: true
    });
    slide.addText("・検索疲労 (Search Fatigue)\n　曲名や歌手名を知らないと検索できない\n\n・推薦の固定化\n　過去の履歴に偏り、新しいジャンルに出会えない\n\n・言葉の曖昧さに非対応\n　「雨の日の帰り道」「静かに作業したい」\n　といった感情・シチュエーションを汲めない", {
      x: 1.1, y: 2.6, w: 3.4, h: 2.2,
      fontSize: 13, fontFace: "Meiryo", color: TEXT_MUTED, lineSpacing: 22
    });

    // Right Card (Solution)
    addCard(slide, 5.2, 1.8, 4.0, 3.2);
    slide.addText("✨ Music Pickerの着眼点", {
      x: 5.5, y: 2.1, w: 3.4, h: 0.4,
      fontSize: 16, fontFace: "Meiryo", color: ACCENT_GREEN, bold: true
    });
    slide.addText("・感情駆動型ディスカバリー\n　日常の自由な言葉から音楽的特徴を自動抽出\n\n・セレンディピティの創出\n　AIが未知の良曲をキュレーションして提案\n\n・文脈の言語化\n　「なぜこの曲なのか」をAIキュレーターが解説し\n　音楽との新しい接点を生み出す", {
      x: 5.5, y: 2.6, w: 3.4, h: 2.2,
      fontSize: 13, fontFace: "Meiryo", color: TEXT_WHITE, lineSpacing: 22
    });

    slide.addNotes(
`【発表時間目安: 0:55 〜 1:55（約60秒）】
「まず、開発の背景と動機です。
現在、Spotifyをはじめとする主要な音楽サブスクリプションには7,000万曲を超える膨大な楽曲が存在しています。しかし曲が多すぎるあまり、ユーザーには『検索疲労』が起きています。
従来の音楽アプリは『曲名やアーティスト名があらかじめ分かっていること』を前提としているか、過去の再生履歴に基づいて似た曲ばかりを推薦するため、新しい音楽との偶然の出会い、いわゆるセレンディピティが失われがちでした。

例えば、『雨の日の帰り道、少し疲れたけど前向きになりたい』というシチュエーションや感情そのものを直接入力して曲を探す手段はほとんどありませんでした。

そこで私は、『言葉のニュアンスを深く理解する生成AI』と『世界規模のSpotifyカタログ』をリアルタイムに直結させれば、名前を知らない素晴らしい楽曲に直感的に出会えるのではないかと考え、本アプリの制作を決意しました。」`
    );
  }

  // -------------------------------------------------------------
  // Slide 3: System Architecture
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    slide.background = { color: BG_DARK };

    slide.addText("SYSTEM ARCHITECTURE", {
      x: 0.8, y: 0.6, w: 8.0, h: 0.3,
      fontSize: 12, fontFace: "Meiryo", color: ACCENT_GREEN, bold: true, letterSpacing: 2
    });
    slide.addText("3層ハイブリッド・システムアーキテクチャ", {
      x: 0.8, y: 0.9, w: 8.4, h: 0.6,
      fontSize: 28, fontFace: "Meiryo", color: TEXT_WHITE, bold: true
    });

    // 3 Columns: Client, Server, External APIs
    // Col 1: Client
    addCard(slide, 0.8, 1.8, 2.6, 3.2);
    slide.addText("1. Client SPA", {
      x: 1.0, y: 2.0, w: 2.2, h: 0.35,
      fontSize: 15, fontFace: "Meiryo", color: ACCENT_BLUE, bold: true
    });
    slide.addText("・Vanilla HTML5 / CSS3\n・Vanilla JavaScript\n・フレームワークレス設計\n・PWA オフライン基盤\n・リアルタイム同期アニメーション\n・WebKit スワイプカルーセル", {
      x: 1.0, y: 2.45, w: 2.2, h: 2.3,
      fontSize: 12, fontFace: "Meiryo", color: TEXT_WHITE, lineSpacing: 20
    });

    // Col 2: Server
    addCard(slide, 3.7, 1.8, 2.6, 3.2);
    slide.addText("2. Express Server", {
      x: 3.9, y: 2.0, w: 2.2, h: 0.35,
      fontSize: 15, fontFace: "Meiryo", color: ACCENT_GREEN, bold: true
    });
    slide.addText("・Node.js (Express 5)\n・APIキー隠蔽プロキシ\n・トークン自動リフレッシュ\n・マルチページ検索キャッシュ\n・正規化・音源ノイズ除去\n・Rate Limit (429) 指数リトライ", {
      x: 3.9, y: 2.45, w: 2.2, h: 2.3,
      fontSize: 12, fontFace: "Meiryo", color: TEXT_WHITE, lineSpacing: 20
    });

    // Col 3: External APIs
    addCard(slide, 6.6, 1.8, 2.6, 3.2);
    slide.addText("3. Cloud APIs", {
      x: 6.8, y: 2.0, w: 2.2, h: 0.35,
      fontSize: 15, fontFace: "Meiryo", color: "F59E0B", bold: true
    });
    slide.addText("・Google Gemini AI\n　プロンプト感情解析・特徴量化\n\n・Spotify Web API\n　PKCE + Client Credentials\n　楽曲メタデータ & 試聴再生\n\n・LRCLIB API\n　LRC同期歌詞タイムスタンプ", {
      x: 6.8, y: 2.45, w: 2.2, h: 2.3,
      fontSize: 12, fontFace: "Meiryo", color: TEXT_WHITE, lineSpacing: 18
    });

    slide.addNotes(
`【発表時間目安: 1:55 〜 2:55（約60秒）】
「システムの全体構成です。情報実習の集大成として、外部の大規模フレームワークに頼り切るのではなく、Web標準技術であるJavaScript、HTML5、モダンCSSを駆使したシングルページアプリケーション（SPA）として構築しました。

サーバーサイドはNode.jsとExpress 5で稼働し、APIキーの安全な隠蔽プロキシとしての役割を果たします。
外部との連携は大きく3つあります。
1つ目はGoogle Gemini AIです。ユーザーが入力した自由文を自然言語処理し、感情、テンポ、楽器構成などの音楽的パラメータへ瞬時に変換します。
2つ目はSpotify Web APIです。AIが推論したパラメータを検索クエリに変換し、公式カタログから実在する楽曲群を高速に取得します。
3つ目はLRCLIBです。再生中の楽曲とミリ秒単位で歌詞を自動スクロールさせるため、LRC形式の同期歌詞を取得してクライアントへ配信しています。」`
    );
  }

  // -------------------------------------------------------------
  // Slide 4: Feature 1 - AI Mood Recommendation
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    slide.background = { color: BG_DARK };

    slide.addText("CORE FEATURE 01", {
      x: 0.8, y: 0.6, w: 8.0, h: 0.3,
      fontSize: 12, fontFace: "Meiryo", color: ACCENT_GREEN, bold: true, letterSpacing: 2
    });
    slide.addText("AI感情分析 ＆ ハイブリッド選曲アルゴリズム", {
      x: 0.8, y: 0.9, w: 8.4, h: 0.6,
      fontSize: 28, fontFace: "Meiryo", color: TEXT_WHITE, bold: true
    });

    // Left info
    addCard(slide, 0.8, 1.8, 4.4, 3.2);
    slide.addText("言葉のニュアンスを音楽パラメータへ変換", {
      x: 1.1, y: 2.1, w: 3.8, h: 0.4,
      fontSize: 16, fontFace: "Meiryo", color: ACCENT_GREEN, bold: true
    });
    slide.addText("・自然文プロンプト解析\n　「帰り道、少し寂しいけど落ち着きたい」などの情景を入力\n\n・ハイブリッド選曲パイプライン\n　Gemini AIが感情・テンポ(BPM)・ジャンルを推論\n　SpotifyのJPカタログから最適な5曲を選出\n\n・AIキュレーター解説 (Curator Insight)\n　なぜこの5曲が選ばれたのかを言語化して提示\n\n・柔軟なフィルター\n　通常音源/ライブ音源の指定、直近50曲の重複自動除外", {
      x: 1.1, y: 2.55, w: 3.8, h: 2.2,
      fontSize: 12.5, fontFace: "Meiryo", color: TEXT_WHITE, lineSpacing: 20
    });

    // Right screenshot (searchImg or fallback card)
    if (fs.existsSync(searchImg)) {
      slide.addImage({
        path: searchImg,
        x: 5.5, y: 1.8, w: 3.7, h: 3.2,
        sizing: { type: "contain" }
      });
    } else {
      addCard(slide, 5.5, 1.8, 3.7, 3.2);
    }

    slide.addNotes(
`【発表時間目安: 2:55 〜 3:55（約60秒）】
「ここからは開発した主要機能をご紹介します。まず1つ目が『AI感情分析によるハイブリッド選曲機能』です。

画面の入力欄に『雨の日の夕暮れ、リラックスして作業したい』といった自由な情景や気分を入力して選曲ボタンを押すと、バックエンドのGemini AIが文章を感情分析します。
単にキーワードを部分一致検索するのではなく、『BPM80前後のミドルテンポ、アコースティックまたはチルな曲調、落ち着いたボーカル』といった音楽的特徴量へ多次元に分解します。

その上で、Spotifyのカタログから実在する5曲を厳選し、画面上には『なぜこの曲が選ばれたのか』というAIキュレーターの解説文とともに提示されます。
過去に聴いた履歴を除外する機能や、スタジオ音源のみに絞り込む詳細設定も備え、ユーザーの現在の心情に深く寄り添う推薦を実現しました。」`
    );
  }

  // -------------------------------------------------------------
  // Slide 5: Feature 2 - Album & Lyrics Experience
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    slide.background = { color: BG_DARK };

    slide.addText("CORE FEATURE 02", {
      x: 0.8, y: 0.6, w: 8.0, h: 0.3,
      fontSize: 12, fontFace: "Meiryo", color: ACCENT_GREEN, bold: true, letterSpacing: 2
    });
    slide.addText("アプリ内完結のアルバム再生 ＆ リアルタイム同期歌詞", {
      x: 0.8, y: 0.9, w: 8.4, h: 0.6,
      fontSize: 28, fontFace: "Meiryo", color: TEXT_WHITE, bold: true
    });

    // Left screenshot (albumImg)
    if (fs.existsSync(albumImg)) {
      slide.addImage({
        path: albumImg,
        x: 0.8, y: 1.8, w: 4.2, h: 3.2,
        sizing: { type: "contain" }
      });
    }

    // Right info
    addCard(slide, 5.3, 1.8, 3.9, 3.2);
    slide.addText("外部アプリに飛ばない没入型UI", {
      x: 5.6, y: 2.1, w: 3.4, h: 0.4,
      fontSize: 16, fontFace: "Meiryo", color: ACCENT_GREEN, bold: true
    });
    slide.addText("・アルバム専用詳細ページ\n　公式Spotifyプレイヤーに遷移せずアプリ内で完結\n\n・ワンタップ「全曲再生」ボタン\n　アルバム1曲目から最後まで順番に自動キューイング\n\n・リアルタイム同期歌詞 (LRC)\n　ボーカルの歌声に合わせて歌詞が自動スクロール\n\n・歌詞カスタマイズ機能\n　文字サイズ3段階（小・中・大）切替 ＆ 全画面没入モード", {
      x: 5.6, y: 2.55, w: 3.4, h: 2.2,
      fontSize: 12.5, fontFace: "Meiryo", color: TEXT_WHITE, lineSpacing: 20
    });

    slide.addNotes(
`【発表時間目安: 3:55 〜 4:55（約60秒）】
「2つ目の主要機能は、外部サービスに飛ばずにアプリ内で完結する『アルバム再生とリアルタイム同期歌詞』です。

従来の類似アプリでは、アルバムをクリックするとSpotifyの公式Webページへ飛ばされてしまい、ユーザー体験が分断されてしまう課題がありました。Music Pickerでは、アルバムやシングルの詳細ページを独自に実装し、ヘッダーに配置した緑の『全曲再生』ボタンを押すだけで、全収録曲を瞬時に再生キューに投入し、1曲目から自動で連続再生できるようにしました。

さらに、下部の再生バーをタップするとApple MusicやSpotifyのネイティブアプリのようなフルスクリーンプレイヤーが開き、ボーカルの歌声に合わせて歌詞が一行ずつ光りながら自動スクロールします。
ユーザーテストのフィードバックを取り入れ、歌詞の文字サイズ調整機能や、歌詞だけに集中できる全画面モードも新設しました。」`
    );
  }

  // -------------------------------------------------------------
  // Slide 6: Technical Challenges & Problem Solving
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    slide.background = { color: BG_DARK };

    slide.addText("TECHNICAL CHALLENGES & BREAKTHROUGHS", {
      x: 0.8, y: 0.6, w: 8.0, h: 0.3,
      fontSize: 12, fontFace: "Meiryo", color: ACCENT_GREEN, bold: true, letterSpacing: 2
    });
    slide.addText("直面した3つの技術的課題とその解決", {
      x: 0.8, y: 0.9, w: 8.4, h: 0.6,
      fontSize: 28, fontFace: "Meiryo", color: TEXT_WHITE, bold: true
    });

    // 3 Cards for 3 Challenges
    // Challenge 1
    addCard(slide, 0.8, 1.8, 2.6, 3.2);
    slide.addText("課題① Spotify APIの403制限", {
      x: 1.0, y: 2.0, w: 2.2, h: 0.35,
      fontSize: 13.5, fontFace: "Meiryo", color: ACCENT_RED, bold: true
    });
    slide.addText("【問題】\nClient Credentials認証でTop-Tracks取得時に403 Forbiddenが発生。\n\n【解決策】\n検索エンドポイントを活用した独自アルゴリズムへ転換。JP市場でオフセットを並列取得し、人気度ソートとタイトル正規化で重複を排除して安定取得に成功。", {
      x: 1.0, y: 2.45, w: 2.2, h: 2.3,
      fontSize: 11.5, fontFace: "Meiryo", color: TEXT_WHITE, lineSpacing: 17
    });

    // Challenge 2
    addCard(slide, 3.7, 1.8, 2.6, 3.2);
    slide.addText("課題② 音源ノイズの混入", {
      x: 3.9, y: 2.0, w: 2.2, h: 0.35,
      fontSize: 13.5, fontFace: "Meiryo", color: ACCENT_RED, bold: true
    });
    slide.addText("【問題】\n人気曲検索でライブ盤の同名重複や短尺MC音声（Audio 015等）が上位を占める。\n\n【解決策】\n正規表現によるタイトル解析フィルターを設計。LiveやSkit表記を自動検出し、オリジナルスタジオ音源を優先的にスコアリング・ランク付けするロジックを実装。", {
      x: 3.9, y: 2.45, w: 2.2, h: 2.3,
      fontSize: 11.5, fontFace: "Meiryo", color: TEXT_WHITE, lineSpacing: 17
    });

    // Challenge 3
    addCard(slide, 6.6, 1.8, 2.6, 3.2);
    slide.addText("課題③ 歌詞の同期ズレ", {
      x: 6.8, y: 2.0, w: 2.2, h: 0.35,
      fontSize: 13.5, fontFace: "Meiryo", color: ACCENT_RED, bold: true
    });
    slide.addText("【問題】\nsetIntervalの累積誤差により、曲の後半で歌詞スクロールがずれてしまう。\n\n【解決策】\nシークバーと歌詞同期を同一のマスタークロックでミリ秒計算するアーキテクチャに刷新。シーク操作時も即座に再同期し、ドリフト（時間ズレ）をゼロに抑制。", {
      x: 6.8, y: 2.45, w: 2.2, h: 2.3,
      fontSize: 11.5, fontFace: "Meiryo", color: TEXT_WHITE, lineSpacing: 17
    });

    slide.addNotes(
`【発表時間目安: 4:55 〜 6:05（約70秒）】
「本制作の中で、最も苦労し、同時に情報実習の学びが深く活きたのが『技術的課題の克服』です。大きく3つの壁がありました。

1つ目は、Spotify Web APIの仕様制限です。アーティストの人気曲を取得する公式エンドポイントが、ユーザー未ログイン状態の認証トークンでは403 Forbiddenを返すという制限に直面しました。そこで私は、楽曲検索エンドポイントを活用し、日本市場を指定した上で複数ページのオフセットを並列取得し、独自の人気スコアとタイトル正規化で重複を排除する代替アルゴリズムをゼロから設計・実装し、人気20曲の安定取得を成し遂げました。

2つ目は、音源ノイズの混入です。人気曲を検索すると、同じ曲のライブ盤やドームツアー音源、数十秒のMC音声が上位を埋め尽くしてしまう問題が発生しました。これに対し、正規表現によるタイトル解析フィルターを実装し、スタジオ音源を最優先で抽出し重複を排除するロジックを構築しました。

3つ目は、歌詞同期のズレです。JavaScriptのタイマーでは誤差が蓄積し、曲の後半で歌詞がずれてしまいます。これを解決するため、音楽の再生シークバーと歌詞スクロールを同一の単一マスタークロックからミリ秒単位で位置計算するアーキテクチャへと刷新し、ズレを完全に解消しました。」`
    );
  }

  // -------------------------------------------------------------
  // Slide 7: UI/UX Evolution
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    slide.background = { color: BG_DARK };

    slide.addText("UI/UX DESIGN & ACCESSIBILITY", {
      x: 0.8, y: 0.6, w: 8.0, h: 0.3,
      fontSize: 12, fontFace: "Meiryo", color: ACCENT_GREEN, bold: true, letterSpacing: 2
    });
    slide.addText("ネイティブアプリ級の快適な操作性を追求", {
      x: 0.8, y: 0.9, w: 8.4, h: 0.6,
      fontSize: 28, fontFace: "Meiryo", color: TEXT_WHITE, bold: true
    });

    // Left screenshot (discoImg)
    if (fs.existsSync(discoImg)) {
      slide.addImage({
        path: discoImg,
        x: 0.8, y: 1.8, w: 4.2, h: 3.2,
        sizing: { type: "contain" }
      });
    }

    // Right info
    addCard(slide, 5.3, 1.8, 3.9, 3.2);
    slide.addText("洗練された操作体験の3つのこだわり", {
      x: 5.6, y: 2.1, w: 3.4, h: 0.4,
      fontSize: 16, fontFace: "Meiryo", color: ACCENT_GREEN, bold: true
    });
    slide.addText("・横スワイプ・カルーセル\n　スクロールスナップ採用。展開ボタンを押さず\n　スマホでもPCでも指先で次々と作品を閲覧可能\n\n・クイック検索チップ\n　検索履歴の保存・削除機能と話題のアーティスト\n　（Vaundy, YOASOBI等）のワンタップ検索\n\n・一貫した曲アクション\n　人気曲・アルバム曲の全行にお気に入り（ハート）と\n　Spotify動線を統一。再生動作と干渉しないイベント設計", {
      x: 5.6, y: 2.55, w: 3.4, h: 2.2,
      fontSize: 12.5, fontFace: "Meiryo", color: TEXT_WHITE, lineSpacing: 19
    });

    slide.addNotes(
`【発表時間目安: 6:05 〜 7:05（約60秒）】
「機能が動くだけでなく、毎日使いたくなるような『UIとUXの完成度』にも徹底的にこだわりました。

アルバム一覧は、当初は縦に並ぶグリッド表示でしたが、スマートフォンで見たときに画面を占領しすぎてしまう問題がありました。そこでCSSのスクロールスナップを活用し、指で左右にスワイプしてアルバムやシングルを次々と見渡せる横一列カルーセルへと進化させました。

また、検索画面を開いた瞬間によく聴かれる人気アーティストや過去の検索履歴をタグとして提示し、文字を打たなくても1タップで検索できるように工夫しました。
さらに、アーティスト人気曲でもアルバム詳細でも、すべての曲行に共通のお気に入りハートボタンを配置し、タップしても曲の再生と干渉しないようイベントバブリングを制御しています。」`
    );
  }

  // -------------------------------------------------------------
  // Slide 8: Conclusion & Learning
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    slide.background = { color: BG_DARK };

    slide.addText("CONCLUSION & LEARNING", {
      x: 0.8, y: 0.6, w: 8.0, h: 0.3,
      fontSize: 12, fontFace: "Meiryo", color: ACCENT_GREEN, bold: true, letterSpacing: 2
    });
    slide.addText("情報実習での学びと今後の展望", {
      x: 0.8, y: 0.9, w: 8.4, h: 0.6,
      fontSize: 28, fontFace: "Meiryo", color: TEXT_WHITE, bold: true
    });

    // 3 Highlight Boxes
    addCard(slide, 0.8, 1.8, 8.4, 0.9);
    slide.addText("💡 API統合とアルゴリズム設計力", {
      x: 1.1, y: 1.95, w: 8.0, h: 0.3,
      fontSize: 15, fontFace: "Meiryo", color: ACCENT_GREEN, bold: true
    });
    slide.addText("仕様制限や音源ノイズを乗り越えるため、データの正規化とフォールバックアルゴリズムを構築する実践的スキルを習得。", {
      x: 1.1, y: 2.25, w: 7.9, h: 0.4,
      fontSize: 12, fontFace: "Meiryo", color: TEXT_WHITE
    });

    addCard(slide, 0.8, 2.85, 8.4, 0.9);
    slide.addText("🤖 AIの実践的システム組み込み", {
      x: 1.1, y: 3.0, w: 8.0, h: 0.3,
      fontSize: 15, fontFace: "Meiryo", color: ACCENT_BLUE, bold: true
    });
    slide.addText("単なるチャット対話にとどまらず、人間の曖昧な感情とWeb APIの定型パラメータを繋ぐインターフェースとしてAIを活用。", {
      x: 1.1, y: 3.3, w: 7.9, h: 0.4,
      fontSize: 12, fontFace: "Meiryo", color: TEXT_WHITE
    });

    addCard(slide, 0.8, 3.9, 8.4, 0.9);
    slide.addText("🚀 今後の展望", {
      x: 1.1, y: 4.05, w: 8.0, h: 0.3,
      fontSize: 15, fontFace: "Meiryo", color: "F59E0B", bold: true
    });
    slide.addText("聴取時間帯・天候データの自動連携、Spotifyプレイリストへの完全自動同期、オフラインキャッシュのさらなる拡張。", {
      x: 1.1, y: 4.35, w: 7.9, h: 0.4,
      fontSize: 12, fontFace: "Meiryo", color: TEXT_WHITE
    });

    // Thank you message
    slide.addText("ご清聴ありがとうございました  |  質疑応答", {
      x: 0.8, y: 4.95, w: 8.4, h: 0.4,
      fontSize: 15, fontFace: "Meiryo", color: TEXT_MUTED, align: "center", bold: true
    });

    slide.addNotes(
`【発表時間目安: 7:05 〜 8:00（約55秒）】
「最後に、まとめです。
本卒業制作を通して、単に既存のAPIを繋ぎ合わせるだけでなく、APIの仕様制限やデータの不整合といった現実に直面する技術的課題に対し、アルゴリズムの工夫によって堅牢なシステムを作り上げる重要性を深く学びました。
また、生成AIを単なるチャットボットとして使うのではなく、人間の曖昧な言葉をデータ構造へと翻訳する強力なインターフェースとして組み込むことで、新しいWebサービスの可能性を実感しました。

今後は、時間帯や天候データの自動連携によるさらなるレコメンド精度の向上や、プレイリスト自動同期機能の強化を進めていきたいと考えています。

以上をもちまして、私の卒業制作『Music Picker』の発表を終了いたします。ご清聴いただき、誠にありがとうございました。」`
    );
  }

  const outputPath = path.join(__dirname, "../public/Music_Picker_Graduation_Presentation.pptx");
  await pptx.writeFile({ fileName: outputPath });
  console.log("Successfully generated presentation:", outputPath);
}

createPresentation().catch((err) => {
  console.error("Presentation generation failed:", err);
  process.exit(1);
});
