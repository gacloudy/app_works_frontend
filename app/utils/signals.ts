/** シグナル種別の表示名と、チャートの目印に使う短い表記。 */
export const SIGNAL_LABELS: Record<string, string> = {
  golden_cross: "ゴールデンクロス",
  dead_cross: "デッドクロス",
  rsi_oversold: "RSI 売られすぎ",
  rsi_overbought: "RSI 買われすぎ",
  bb_lower_touch: "BB 下限タッチ",
  bb_upper_touch: "BB 上限タッチ",
  volume_surge_up: "出来高急増＋上昇",
};

export const SIGNAL_SHORT: Record<string, string> = {
  golden_cross: "GC",
  dead_cross: "DC",
  rsi_oversold: "RSI↓",
  rsi_overbought: "RSI↑",
  bb_lower_touch: "BB↓",
  bb_upper_touch: "BB↑",
  volume_surge_up: "出来高",
};
