/** 「今日の売買サイン」の推奨と、そのその後の結果。picks / track-record 画面で共有する。 */
export interface Pick {
  pick_date: string;
  rank: number;
  code: string;
  name: string | null;
  industry: string | null;
  signal_type: string;
  side: "buy" | "sell";
  close_price: string;
  hold_days: number;
  past_count: number;
  past_win_rate: string;
  past_avg: string;
  all_stocks_avg: string | null;
  is_live: boolean;
  status: "pending" | "holding" | "closed" | "no_data" | null;
  entry_date: string | null;
  entry_price: string | null;
  exit_date: string | null;
  exit_price: string | null;
  days_held: number | null;
  return_pct: string | null;
  market_return_pct: string | null;
  excess_pct: string | null;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  const w = "日月火水木金土"[d.getDay()];
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${w}）`;
}

export function Pct({ v }: { v: string | number | null }) {
  if (v === null) return <span className="text-gray-400">—</span>;
  const n = typeof v === "number" ? v : parseFloat(v);
  const color = n > 0 ? "text-emerald-600 dark:text-emerald-400" : n < 0 ? "text-rose-600 dark:text-rose-400" : "text-gray-500";
  return <span className={`tabular-nums ${color}`}>{`${n > 0 ? "+" : ""}${n.toFixed(1)}%`}</span>;
}

/** 勝ち・負けなどの結果ラベル（確定したものだけ）。 */
export function outcomeLabel(p: Pick): { text: string; win: boolean } | null {
  if (p.status !== "closed" || p.return_pct === null) return null;
  const win = parseFloat(p.return_pct) > 0;
  if (p.side === "buy") return { text: win ? "勝ち" : "負け", win };
  return { text: win ? "売って正解" : "売らない方が良かった", win };
}

export function OutcomeBadge({ p }: { p: Pick }) {
  const label = outcomeLabel(p);
  if (!label) return null;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
        label.win
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
      }`}
    >
      {label.text}
    </span>
  );
}

/** 状態の表示名（買付前 / 保有中 / 確定）。 */
export function statusText(p: Pick): string {
  const isBuy = p.side === "buy";
  switch (p.status) {
    case "pending":
      return isBuy ? "買付前" : "売却前";
    case "holding":
      return `${isBuy ? "保有中" : "売却後"}（${p.days_held}/${p.hold_days}営業日）`;
    case "closed":
      return "確定";
    default:
      return "データなし";
  }
}

/** 推奨のその後の結果（カード用）。 */
export function PickOutcome({ p }: { p: Pick }) {
  if (!p.status || p.status === "no_data") {
    return <p className="text-xs text-gray-400">結果: データなし</p>;
  }
  if (p.status === "pending") {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-300">
        結果: <span className="font-semibold">{statusText(p)}</span>（翌営業日の寄り付きから集計）
      </p>
    );
  }
  return (
    <div className="text-sm text-gray-700 dark:text-gray-200">
      <p>
        結果: <span className="font-semibold">{statusText(p)}</span>
        {p.status === "closed" && p.exit_date ? `（${fmtDate(p.exit_date)}）` : ""}{" "}
        {p.status === "holding" && "現在 "}
        <span className="font-bold"><Pct v={p.return_pct} /></span> <OutcomeBadge p={p} />
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        同じ期間の市場との差 <Pct v={p.excess_pct} />
      </p>
    </div>
  );
}
