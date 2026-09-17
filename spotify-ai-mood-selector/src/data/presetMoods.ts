export interface PresetMood {
  id: string;
  label: string;
  emoji: string;
  description: string;
  suggestedGenre?: string;
  suggestedTempo?: string;
}

export const PRESET_MOODS: PresetMood[] = [
  {
    id: "upbeat",
    label: "テンションを上げたい",
    emoji: "🔥",
    description: "高揚感とエネルギーに満ちたアップビートなナンバー",
    suggestedGenre: "Pop / Rock",
    suggestedTempo: "アップテンポ",
  },
  {
    id: "rain_focus",
    label: "雨の日に集中して作業",
    emoji: "🌧️",
    description: "雨音と溶け合う心地よいリズムと深い集中",
    suggestedGenre: "Lo-Fi / Indie",
    suggestedTempo: "ミディアム",
  },
  {
    id: "night_drive",
    label: "夜のドライブ",
    emoji: "🚗",
    description: "街灯のネオンと夜風に揺れるハイウェイ・アンセム",
    suggestedGenre: "City Pop / Synth-pop",
    suggestedTempo: "ミディアムアップ",
  },
  {
    id: "relax",
    label: "リラックス",
    emoji: "☕",
    description: "張り詰めた気持ちを優しく解きほぐす安らぎの時間",
    suggestedGenre: "Acoustic / R&B",
    suggestedTempo: "スロー",
  },
  {
    id: "morning_cafe",
    label: "休日の朝カフェ",
    emoji: "☀️",
    description: "爽やかな日差しと挽きたてコーヒーに似合う清々しいメロディ",
    suggestedGenre: "Acoustic / Bossanova",
    suggestedTempo: "ミディアム",
  },
  {
    id: "workout",
    label: "ワークアウト・筋トレ",
    emoji: "💪",
    description: "重い身体を突き動かすヘヴィなキックとアッパービート",
    suggestedGenre: "EDM / Hip Hop",
    suggestedTempo: "アップテンポ",
  },
  {
    id: "late_night_chill",
    label: "深夜のチルアウト",
    emoji: "🌙",
    description: "一人静かに物思いに耽るディープでメロウなサウンド",
    suggestedGenre: "Lo-Fi / Neo-Soul",
    suggestedTempo: "スロー",
  },
  {
    id: "emotional",
    label: "切ない・エモい気分",
    emoji: "🎧",
    description: "胸の奥をぎゅっと掴むエモーショナルな旋律とリリック",
    suggestedGenre: "J-Rock / Ballad",
    suggestedTempo: "ミディアムスロー",
  },
];

export const GENRE_OPTIONS = [
  "すべて（AIおまかせ）",
  "J-Pop / 邦楽",
  "洋楽 Pop / R&B",
  "Lo-Fi / チルホップ",
  "Rock / バンドサウンド",
  "City Pop / ネオソウル",
  "EDM / エレクトロ",
  "アコースティック / カフェ",
];

export const TEMPO_OPTIONS = [
  "おまかせ",
  "アップテンポ（疾走感）",
  "ミディアム（心地よいリズム）",
  "スロー（落ち着いた安らぎ）",
];
