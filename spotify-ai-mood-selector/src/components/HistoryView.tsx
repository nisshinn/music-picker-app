import React from "react";
import { History, Sparkles, Clock, Music2, ArrowRight, Trash2 } from "lucide-react";
import type { RecommendResponse } from "../types.ts";

export interface HistoryItem {
  id: string;
  timestamp: number;
  response: RecommendResponse;
}

interface HistoryViewProps {
  history: HistoryItem[];
  onRestoreHistory: (item: HistoryItem) => void;
  onClearHistory: () => void;
  onGoToRecommend: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onRestoreHistory,
  onClearHistory,
  onGoToRecommend,
}) => {
  if (history.length === 0) {
    return (
      <div
        id="history-empty-view"
        className="w-full bg-[#181818] rounded-2xl p-8 sm:p-12 border border-[#282828] text-center space-y-4"
      >
        <div className="w-16 h-16 rounded-full bg-[#242424] text-neutral-500 mx-auto flex items-center justify-center">
          <History className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-white">過去の選曲履歴はありません</h3>
        <p className="text-sm text-neutral-400 max-w-md mx-auto">
          AIに選曲をリクエストすると、過去の気分や選出された5曲のリストがここに自動保存され、いつでも再訪できます。
        </p>
        <div className="pt-2">
          <button
            type="button"
            id="btn-history-start"
            onClick={onGoToRecommend}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-sm transition-all shadow-lg shadow-[#1DB954]/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI選曲を試す</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="history-container" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#181818] p-5 sm:p-6 rounded-2xl border border-[#282828]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[#282828] text-neutral-300">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">選曲履歴</h2>
            <p className="text-xs text-neutral-400">
              最近のAI選曲履歴 ({history.length}件)
            </p>
          </div>
        </div>

        <button
          type="button"
          id="btn-clear-history"
          onClick={() => {
            if (window.confirm("選曲履歴をすべて削除しますか？")) {
              onClearHistory();
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#252525] hover:bg-red-950/40 text-neutral-400 hover:text-red-400 text-xs font-semibold border border-[#333] transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>履歴クリア</span>
        </button>
      </div>

      {/* History Items */}
      <div className="grid grid-cols-1 gap-4">
        {history.map((item) => {
          const date = new Date(item.timestamp);
          const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

          return (
            <div
              key={item.id}
              id={`history-item-${item.id}`}
              className="p-5 rounded-2xl bg-[#181818] border border-[#282828] hover:border-[#383838] transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#252525] pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/30">
                    気分・状況
                  </span>
                  <h3 className="text-base font-extrabold text-white">
                    {item.response.mood}
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {dateStr}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRestoreHistory(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#1DB954] text-black hover:bg-[#1ed760] transition-colors"
                  >
                    <span>この選曲を開く</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Tracks preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 pt-1">
                {item.response.tracks.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-[#141414] border border-[#222] text-xs"
                  >
                    <span className="text-[10px] font-bold text-[#1DB954] block mb-0.5">
                      0{idx + 1}
                    </span>
                    <p className="font-semibold text-neutral-200 truncate">{t.title}</p>
                    <p className="text-[11px] text-neutral-400 truncate">{t.artist}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
