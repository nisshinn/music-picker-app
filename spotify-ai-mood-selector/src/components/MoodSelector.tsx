import React, { useState } from "react";
import { Sparkles, SlidersHorizontal, Dices, ChevronDown, ChevronUp, Music, UserCheck, Mic2 } from "lucide-react";
import { PRESET_MOODS, GENRE_OPTIONS, TEMPO_OPTIONS, PresetMood } from "../data/presetMoods.ts";
import type { RecommendRequest } from "../types.ts";

interface MoodSelectorProps {
  onRecommend: (req: RecommendRequest) => Promise<void>;
  isLoading: boolean;
}

const POPULAR_ARTISTS = [
  "YOASOBI",
  "藤井 風",
  "Vaundy",
  "米津玄師",
  "Official髭男dism",
  "King Gnu",
  "Mrs. GREEN APPLE",
  "Ado",
  "星野源",
  "RADWIMPS",
  "The Weeknd",
  "Taylor Swift",
  "Bruno Mars",
  "Billie Eilish",
  "Coldplay",
  "Daft Punk",
];

const INSPIRATION_IDEAS = [
  "月曜日の朝、気合を入れてスタートしたい",
  "夜更けの静かな部屋で読書しながら",
  "夕暮れの海辺をのんびり散歩",
  "締め切り前の集中モード！没頭できるサウンド",
  "昔懐かしい友達を思い出してエモい夜",
  "お気に入りのコーヒーを淹れてくつろぐ昼下がり",
  "夜の首都高を流しながら聴く都会的な曲",
  "部屋の掃除が爆速で終わるノリノリな曲",
];

export const MoodSelector: React.FC<MoodSelectorProps> = ({
  onRecommend,
  isLoading,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("upbeat");
  const [moodInput, setMoodInput] = useState<string>("テンションを上げたい");
  const [preferredArtist, setPreferredArtist] = useState<string>("");
  const [genrePreference, setGenrePreference] = useState<string>("すべて（AIおまかせ）");
  const [tempoPreference, setTempoPreference] = useState<string>("おまかせ");
  const [customNotes, setCustomNotes] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const handleSelectPreset = (preset: PresetMood) => {
    setSelectedPresetId(preset.id);
    setMoodInput(preset.label);
    if (preset.suggestedGenre) {
      const match = GENRE_OPTIONS.find((g) => g.includes(preset.suggestedGenre!.split(" ")[0]));
      if (match) setGenrePreference(match);
    }
    if (preset.suggestedTempo) {
      const match = TEMPO_OPTIONS.find((t) => t.includes(preset.suggestedTempo!));
      if (match) setTempoPreference(match);
    }
  };

  const handleRandomize = () => {
    const randomIdea = INSPIRATION_IDEAS[Math.floor(Math.random() * INSPIRATION_IDEAS.length)];
    setMoodInput(randomIdea);
    setSelectedPresetId("");
  };

  const toggleArtistChip = (artist: string) => {
    if (preferredArtist === artist) {
      setPreferredArtist("");
    } else {
      setPreferredArtist(artist);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!moodInput.trim() || isLoading) return;

    onRecommend({
      mood: moodInput.trim(),
      preferredArtist: preferredArtist.trim() ? preferredArtist.trim() : undefined,
      genrePreference: genrePreference !== "すべて（AIおまかせ）" ? genrePreference : undefined,
      tempoPreference: tempoPreference !== "おまかせ" ? tempoPreference : undefined,
      customNotes: customNotes.trim() ? customNotes.trim() : undefined,
    });
  };

  return (
    <section
      id="mood-selector-container"
      className="w-full bg-[#181818] rounded-2xl p-5 sm:p-7 border border-[#282828] shadow-2xl transition-all"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header & Description */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-[#282828]/60">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span className="text-[#1DB954]">AI選曲</span>
              <span>いまの気分・シチュエーション</span>
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Geminiが今のあなたに最もフィットするSpotify楽曲を5曲キュレーションします
            </p>
          </div>

          <button
            type="button"
            id="btn-random-mood"
            onClick={handleRandomize}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-neutral-300 hover:text-white bg-[#222] hover:bg-[#2e2e2e] border border-[#333] transition-colors"
            title="ランダムなアイデアを入力"
          >
            <Dices className="w-3.5 h-3.5 text-[#1DB954]" />
            <span>アイデアおまかせ</span>
          </button>
        </div>

        {/* Preset Chips */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2.5">
            人気のシチュエーションから選ぶ
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESET_MOODS.map((preset) => {
              const isSelected = selectedPresetId === preset.id || moodInput === preset.label;
              return (
                <button
                  key={preset.id}
                  id={`preset-${preset.id}`}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-200 group ${
                    isSelected
                      ? "bg-[#1DB954]/15 border-[#1DB954] text-white shadow-lg shadow-[#1DB954]/10"
                      : "bg-[#202020] border-[#2c2c2c] text-neutral-300 hover:border-neutral-500 hover:bg-[#252525]"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xl">{preset.emoji}</span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-[#1DB954] shadow-[0_0_8px_#1DB954]"></span>
                    )}
                  </div>
                  <span className={`text-xs font-bold leading-snug line-clamp-1 ${isSelected ? "text-[#1DB954]" : "text-white"}`}>
                    {preset.label}
                  </span>
                  <span className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                    {preset.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Free Custom Mood Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="mood-text-input"
              className="text-xs font-bold uppercase tracking-wider text-neutral-400"
            >
              自由に入力・調整する
            </label>
            <span className="text-[11px] text-neutral-500">
              例: 雨の首都高ドライブ、金曜の夜チル、勉強用インスト
            </span>
          </div>
          <div className="relative">
            <input
              id="mood-text-input"
              type="text"
              value={moodInput}
              onChange={(e) => {
                setMoodInput(e.target.value);
                setSelectedPresetId("");
              }}
              placeholder="今の気分やシチュエーションを自由に入力してください..."
              className="w-full px-4 py-3.5 rounded-xl bg-[#121212] border border-[#333] focus:border-[#1DB954] focus:ring-2 focus:ring-[#1DB954]/20 text-white placeholder-neutral-500 text-sm font-medium transition-all outline-none"
              required
            />
            {moodInput && (
              <button
                type="button"
                onClick={() => {
                  setMoodInput("");
                  setSelectedPresetId("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs px-2 py-1"
              >
                クリア
              </button>
            )}
          </div>
        </div>

        {/* Artist Selection (Requested: 今の気分のところにアーティストを選ぶ場所を追加) */}
        <div id="artist-selector-section" className="pt-1">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="artist-preference-input"
              className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5"
            >
              <Mic2 className="w-3.5 h-3.5 text-[#1DB954]" />
              <span>アーティストを選ぶ・指定する（任意）</span>
            </label>
            {preferredArtist && (
              <span className="text-xs text-[#1DB954] font-semibold flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                <span>「{preferredArtist}」を中心に選曲</span>
              </span>
            )}
          </div>

          <div className="relative mb-2.5">
            <input
              id="artist-preference-input"
              type="text"
              value={preferredArtist}
              onChange={(e) => setPreferredArtist(e.target.value)}
              placeholder="アーティスト名を入力（例: 藤井 風, YOASOBI, Coldplay, 星野源...）"
              className="w-full px-4 py-3 rounded-xl bg-[#121212] border border-[#333] focus:border-[#1DB954] focus:ring-2 focus:ring-[#1DB954]/20 text-white placeholder-neutral-500 text-xs sm:text-sm font-medium transition-all outline-none"
            />
            {preferredArtist && (
              <button
                type="button"
                onClick={() => setPreferredArtist("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs px-2 py-1"
              >
                解除
              </button>
            )}
          </div>

          {/* Popular Artist Quick Select Chips */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-neutral-500 font-medium">
              <span>人気のアーティストから選ぶ:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_ARTISTS.map((artist) => {
                const isSelected = preferredArtist.toLowerCase() === artist.toLowerCase();
                return (
                  <button
                    key={artist}
                    type="button"
                    onClick={() => toggleArtistChip(artist)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${
                      isSelected
                        ? "bg-[#1DB954] text-black border-[#1DB954] font-bold shadow-md shadow-[#1DB954]/20 scale-105"
                        : "bg-[#202020] text-neutral-300 border-[#303030] hover:border-neutral-500 hover:text-white"
                    }`}
                  >
                    {artist}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Advanced Filter Toggle */}
        <div className="pt-1">
          <button
            type="button"
            id="toggle-advanced-filters"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-[#1DB954] transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>詳細な好みを指定する（ジャンル・テンポ・追加指示）</span>
            {showAdvanced ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showAdvanced && (
            <div
              id="advanced-filters-panel"
              className="mt-4 p-4 rounded-xl bg-[#121212] border border-[#2a2a2a] space-y-4 animate-in fade-in duration-200"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Genre Filter */}
                <div>
                  <label
                    htmlFor="genre-select"
                    className="block text-xs font-semibold text-neutral-400 mb-1.5"
                  >
                    ジャンルの好み
                  </label>
                  <select
                    id="genre-select"
                    value={genrePreference}
                    onChange={(e) => setGenrePreference(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#202020] border border-[#333] text-neutral-200 text-xs focus:border-[#1DB954] focus:outline-none"
                  >
                    {GENRE_OPTIONS.map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tempo Filter */}
                <div>
                  <label
                    htmlFor="tempo-select"
                    className="block text-xs font-semibold text-neutral-400 mb-1.5"
                  >
                    テンポの希望
                  </label>
                  <select
                    id="tempo-select"
                    value={tempoPreference}
                    onChange={(e) => setTempoPreference(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#202020] border border-[#333] text-neutral-200 text-xs focus:border-[#1DB954] focus:outline-none"
                  >
                    {TEMPO_OPTIONS.map((tempo) => (
                      <option key={tempo} value={tempo}>
                        {tempo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Notes */}
              <div>
                <label
                  htmlFor="custom-notes-input"
                  className="block text-xs font-semibold text-neutral-400 mb-1.5"
                >
                  追加のリクエスト（任意）
                </label>
                <input
                  id="custom-notes-input"
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="例: インストゥルメンタル多め、最近流行っている曲、ギターリフが綺麗な曲"
                  className="w-full px-3 py-2 rounded-lg bg-[#202020] border border-[#333] text-neutral-200 text-xs focus:border-[#1DB954] focus:outline-none placeholder-neutral-600"
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            id="btn-submit-recommend"
            disabled={isLoading || !moodInput.trim()}
            className="w-full relative group overflow-hidden bg-[#1DB954] hover:bg-[#1ed760] active:scale-[0.99] text-black font-extrabold text-sm sm:text-base py-3.5 px-6 rounded-xl shadow-lg shadow-[#1DB954]/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2.5"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                <span>Geminiが今の気分に合う名曲を5曲選定中...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 fill-black/20" />
                <span>AIに今の気分で5曲選んでもらう</span>
                <Music className="w-4 h-4 opacity-70 ml-1" />
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
};
