import { useMemo, useState } from "react";
import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/stocks.$code";
import { backendFetch } from "../utils/backend.server";
import { SIGNAL_LABELS, SIGNAL_SHORT } from "../utils/signals";
import { StockPriceChart, type ChartMarker } from "../components/StockPriceChart";

export function meta({ loaderData }: Route.MetaArgs) {
  const name = loaderData?.stock?.name ?? "";
  return [{ title: `${name} | 株価分析` }];
}

interface Stock {
  id: number;
  code: string;
  name: string;
  industry: string;
  market: string | null;
  created_at: string;
  updated_at: string;
}

interface PriceData {
  code: string;
  trade_date: string;
  current_price: string | null;
  open_price: string | null;
  high_price: string | null;
  low_price: string | null;
  prev_close: string | null;
  volume: number | null;
}

interface SignalResult {
  signal_type: string;
  side: "buy" | "sell";
  count: number;
  completed: number;
  win_rate: number | null;
  avg_return: number | null;
  best: number | null;
  worst: number | null;
  cumulative_return: number | null;
  cumulative_trades: number | null;
  vs_industry: number | null;
  all_stocks_avg: number | null;
  few_trades: boolean;
}

interface PairTrade {
  entry_date: string;
  entry_price: number;
  exit_date: string;
  exit_price: number;
  return_pct: number;
  holding_days: number;
  holding: boolean;
}

interface PairResult {
  buy_signal: string;
  sell_signal: string;
  trade_count: number;
  win_rate: number | null;
  avg_return: number | null;
  total_return: number | null;
  avg_holding_days: number | null;
  exposure_pct: number | null;
  trades: PairTrade[];
}

interface SignalEvent {
  signal_date: string;
  signal_type: string;
  side: "buy" | "sell";
  price: number | null;
  entry_date: string | null;
  entry_price: number | null;
  results: Record<string, number | null>;
}

interface SignalPerformance {
  start_date: string | null;
  end_date: string | null;
  trading_days: number;
  buy_hold_return: number | null;
  by_period: { period: number; signals: SignalResult[] }[];
  pairs: PairResult[];
  events: SignalEvent[];
}

interface Disclosure {
  disc_no: string;
  disc_date: string;
  disc_time: string;
  event_type: string;
  direction: string | null;
  metric: string | null;
  change_pct: string | null;
  reaction_excess: string | null;
  drift_5d: string | null;
  drift_20d: string | null;
}

export async function loader({ params }: Route.LoaderArgs) {
  const [stockRes, priceRes, perfRes, discRes] = await Promise.all([
    backendFetch(`/api/v1/stock-master/${params.code}`),
    backendFetch(`/api/v1/stock-price/${params.code}/latest`),
    backendFetch(`/api/v1/stocks/${params.code}/signal-performance`),
    backendFetch(`/api/v1/disclosures/recent?code=${params.code}&limit=20`),
  ]);

  if (stockRes.status === 404) throw new Response("銘柄が見つかりません", { status: 404 });
  if (!stockRes.ok) throw new Response("取得失敗", { status: stockRes.status });

  const stock: Stock = await stockRes.json();
  const price: PriceData | null = priceRes.ok ? await priceRes.json() : null;
  const perf: SignalPerformance | null = perfRes.ok ? await perfRes.json() : null;
  const disclosures: Disclosure[] = discRes.ok ? await discRes.json() : [];

  return { stock, price, perf, disclosures };
}

const PERIODS = [5, 10, 20];

const EVENT_LABELS: Record<string, string> = {
  earn_revision: "業績予想の修正",
  div_revision: "配当予想の修正",
  q_results: "四半期決算",
  fy_results: "通期決算（来期見通し）",
};

const DIRECTION_LABELS: Record<string, string> = { up: "上方", flat: "据え置き", down: "下方" };

const card = "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700";
const th = "px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap";
const td = "px-3 py-1.5 whitespace-nowrap";

function fmt(value: string | null): string {
  if (!value) return "—";
  return new Intl.NumberFormat("ja-JP").format(parseFloat(value));
}

function fmtNum(v: number | null): string {
  return v === null ? "—" : new Intl.NumberFormat("ja-JP").format(v);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function Pct({ v, digits = 1 }: { v: number | string | null; digits?: number }) {
  const n = v === null ? null : typeof v === "number" ? v : parseFloat(v);
  if (n === null || Number.isNaN(n)) return <span className="text-gray-300 dark:text-gray-600">—</span>;
  const color = n > 0 ? "text-emerald-600 dark:text-emerald-400" : n < 0 ? "text-rose-600 dark:text-rose-400" : "text-gray-500";
  return <span className={`tabular-nums ${color}`}>{`${n > 0 ? "+" : ""}${n.toFixed(digits)}%`}</span>;
}

function SideBadge({ side }: { side: "buy" | "sell" }) {
  return side === "buy" ? (
    <span className="inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">買い</span>
  ) : (
    <span className="inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">売り</span>
  );
}

function FewBadge() {
  return (
    <span
      className="ml-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      title="回数が少ないため、偶然の影響が大きい"
    >
      回数少
    </span>
  );
}

function PriceCard({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`font-semibold text-gray-800 dark:text-gray-100 tabular-nums ${large ? "text-2xl" : "text-base"}`}>
        {value}
      </p>
    </div>
  );
}

/** 選んだ保有日数で、回数が十分ある買いシグナルのうち累計が最も良かったものと、最も良かった「買い→売り」のルール。 */
function Highlights({ perf, period }: { perf: SignalPerformance; period: number }) {
  const signals = perf.by_period.find((p) => p.period === period)?.signals ?? [];
  const buys = signals.filter((s) => s.side === "buy" && !s.few_trades && s.cumulative_return !== null);
  const bestBuy = [...buys].sort((a, b) => b.cumulative_return! - a.cumulative_return!)[0];
  const pairs = perf.pairs.filter((p) => p.trade_count >= 3 && p.total_return !== null);
  const bestPair = [...pairs].sort((a, b) => b.total_return! - a.total_return!)[0];
  const bh = perf.buy_hold_return;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">ずっと持ち続けた場合</p>
        <p className="text-xl font-bold mt-1"><Pct v={bh} /></p>
        <p className="text-xs text-gray-400 mt-1">
          {perf.start_date && perf.end_date ? `${fmtDate(perf.start_date)} 〜 ${fmtDate(perf.end_date)}` : ""}
        </p>
      </div>
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">一番良かった買いサイン（{period}日保有）</p>
        {bestBuy ? (
          <>
            <p className="text-base font-semibold text-gray-800 dark:text-gray-100 mt-1">{SIGNAL_LABELS[bestBuy.signal_type]}</p>
            <p className="text-sm">累計 <Pct v={bestBuy.cumulative_return} />（{bestBuy.cumulative_trades}回）</p>
          </>
        ) : (
          <p className="text-sm text-gray-400 mt-1">回数が十分な買いサインがありません</p>
        )}
      </div>
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">一番良かった「買いサイン→売りサイン」</p>
        {bestPair ? (
          <>
            <p className="text-base font-semibold text-gray-800 dark:text-gray-100 mt-1">
              {SIGNAL_SHORT[bestPair.buy_signal]} で買い → {SIGNAL_SHORT[bestPair.sell_signal]} で売り
            </p>
            <p className="text-sm">累計 <Pct v={bestPair.total_return} />（{bestPair.trade_count}回）</p>
          </>
        ) : (
          <p className="text-sm text-gray-400 mt-1">3回以上売買したルールがありません</p>
        )}
      </div>
    </div>
  );
}

function SignalTable({ signals, side }: { signals: SignalResult[]; side: "buy" | "sell" }) {
  const rows = signals.filter((s) => s.side === side);
  const isBuy = side === "buy";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <th className={`${th} text-left`}>{isBuy ? "買いサイン" : "売りサイン"}</th>
            <th className={`${th} text-right`}>回数</th>
            <th className={`${th} text-right`}>{isBuy ? "勝率" : "売って正解"}</th>
            <th className={`${th} text-right`}>{isBuy ? "1回平均" : "平均で避けた値下がり"}</th>
            <th className={`${th} text-right`}>最良</th>
            <th className={`${th} text-right`}>最悪</th>
            {isBuy && <th className={`${th} text-right`}>累計（回数）</th>}
            <th className={`${th} text-right`} title="同じ日に同じ業種の全銘柄で同じ売買をした平均との差">同業種比</th>
            <th className={`${th} text-right`} title="全銘柄で同じサインを使った場合の平均">全銘柄平均</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {rows.map((s) => (
            <tr key={s.signal_type} className={s.few_trades ? "opacity-60" : ""}>
              <td className={`${td} text-gray-800 dark:text-gray-100`}>
                {SIGNAL_LABELS[s.signal_type]}
                {s.few_trades && s.count > 0 && <FewBadge />}
              </td>
              <td className={`${td} text-right text-gray-600 dark:text-gray-300 tabular-nums`}>
                {s.count}
                {s.completed < s.count && <span className="text-xs text-gray-400">（結果{s.completed}）</span>}
              </td>
              <td className={`${td} text-right text-gray-800 dark:text-gray-100 tabular-nums`}>
                {s.win_rate === null ? "—" : `${s.win_rate.toFixed(0)}%`}
              </td>
              <td className={`${td} text-right font-semibold`}><Pct v={s.avg_return} /></td>
              <td className={`${td} text-right`}><Pct v={s.best} /></td>
              <td className={`${td} text-right`}><Pct v={s.worst} /></td>
              {isBuy && (
                <td className={`${td} text-right`}>
                  <Pct v={s.cumulative_return} />
                  {s.cumulative_trades !== null && <span className="text-xs text-gray-400">（{s.cumulative_trades}）</span>}
                </td>
              )}
              <td className={`${td} text-right`}><Pct v={s.vs_industry} /></td>
              <td className={`${td} text-right`}><Pct v={s.all_stocks_avg} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PairTable({ pairs, buyHold }: { pairs: PairResult[]; buyHold: number | null }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <th className={`${th} text-left`}>ルール</th>
              <th className={`${th} text-right`}>売買回数</th>
              <th className={`${th} text-right`}>勝率</th>
              <th className={`${th} text-right`}>1回平均</th>
              <th className={`${th} text-right`}>累計</th>
              <th className={`${th} text-right`}>ずっと持った場合との差</th>
              <th className={`${th} text-right`}>平均保有日数</th>
              <th className={`${th} text-right`} title="期間中に株を持っていた日の割合">保有していた割合</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {pairs.map((p) => (
              <tr key={p.buy_signal} className={p.trade_count < 3 ? "opacity-60" : ""}>
                <td className={`${td} text-gray-800 dark:text-gray-100`}>
                  {SIGNAL_LABELS[p.buy_signal]} → {SIGNAL_LABELS[p.sell_signal]}
                  {p.trade_count > 0 && p.trade_count < 3 && <FewBadge />}
                </td>
                <td className={`${td} text-right tabular-nums text-gray-600 dark:text-gray-300`}>{p.trade_count}</td>
                <td className={`${td} text-right tabular-nums text-gray-800 dark:text-gray-100`}>
                  {p.win_rate === null ? "—" : `${p.win_rate.toFixed(0)}%`}
                </td>
                <td className={`${td} text-right`}><Pct v={p.avg_return} /></td>
                <td className={`${td} text-right font-semibold`}><Pct v={p.total_return} /></td>
                <td className={`${td} text-right`}>
                  <Pct v={p.total_return !== null && buyHold !== null ? p.total_return - buyHold : null} />
                </td>
                <td className={`${td} text-right tabular-nums text-gray-600 dark:text-gray-300`}>
                  {p.avg_holding_days === null ? "—" : `${p.avg_holding_days}日`}
                </td>
                <td className={`${td} text-right tabular-nums text-gray-600 dark:text-gray-300`}>
                  {p.exposure_pct === null ? "—" : `${p.exposure_pct.toFixed(0)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pairs.filter((p) => p.trades.length > 0).map((p) => (
        <details key={p.buy_signal} className="text-sm">
          <summary className="cursor-pointer text-blue-600 dark:text-blue-400">
            {SIGNAL_SHORT[p.buy_signal]} → {SIGNAL_SHORT[p.sell_signal]} の売買履歴（{p.trades.length}回）
          </summary>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-600">
                  {["買った日", "買値", "売った日", "売値", "損益", "保有日数"].map((h) => (
                    <th key={h} className={`${th} text-left`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {[...p.trades].reverse().map((t) => (
                  <tr key={t.entry_date}>
                    <td className={`${td} text-gray-800 dark:text-gray-100`}>{fmtDate(t.entry_date)}</td>
                    <td className={`${td} tabular-nums text-gray-600 dark:text-gray-300`}>{fmtNum(t.entry_price)}</td>
                    <td className={`${td} text-gray-800 dark:text-gray-100`}>
                      {t.holding ? <span className="text-amber-600 dark:text-amber-400">保有中（{fmtDate(t.exit_date)} 終値で評価）</span> : fmtDate(t.exit_date)}
                    </td>
                    <td className={`${td} tabular-nums text-gray-600 dark:text-gray-300`}>{fmtNum(t.exit_price)}</td>
                    <td className={td}><Pct v={t.return_pct} /></td>
                    <td className={`${td} tabular-nums text-gray-600 dark:text-gray-300`}>{t.holding_days}日</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  );
}

function EventTable({ events }: { events: SignalEvent[] }) {
  const [filter, setFilter] = useState("");
  const rows = filter ? events.filter((e) => e.signal_type === filter) : events;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
        >
          <option value="">すべてのシグナル（{events.length}件）</option>
          {Object.keys(SIGNAL_LABELS).map((s) => (
            <option key={s} value={s}>
              {SIGNAL_LABELS[s]}（{events.filter((e) => e.signal_type === s).length}件）
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          買いサインは「翌日始値で買い、N日後の終値で売った損益（手数料込み）」、売りサインは「その日に売って避けられた値下がり」
        </span>
      </div>
      <div className="overflow-x-auto max-h-[28rem]">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              {["シグナル日", "シグナル", "", "終値", "翌日始値", "5日後", "10日後", "20日後"].map((h, i) => (
                <th key={i} className={`${th} ${i >= 3 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-400 dark:text-gray-500">シグナルはありません</td>
              </tr>
            ) : (
              rows.map((e) => (
                <tr key={`${e.signal_date}-${e.signal_type}`} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className={`${td} text-gray-800 dark:text-gray-100`}>{fmtDate(e.signal_date)}</td>
                  <td className={`${td} text-gray-800 dark:text-gray-100`}>{SIGNAL_LABELS[e.signal_type]}</td>
                  <td className={td}><SideBadge side={e.side} /></td>
                  <td className={`${td} text-right tabular-nums text-gray-600 dark:text-gray-300`}>{fmtNum(e.price)}</td>
                  <td className={`${td} text-right tabular-nums text-gray-600 dark:text-gray-300`}>{fmtNum(e.entry_price)}</td>
                  {PERIODS.map((n) => (
                    <td key={n} className={`${td} text-right`}><Pct v={e.results[String(n)]} /></td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function StockDetail() {
  const { stock, price, perf, disclosures } = useLoaderData<typeof loader>();
  const [period, setPeriod] = useState(20);

  // チャートの目印（毎回作り直すとチャートが再描画されるため memo する）
  const markers = useMemo<ChartMarker[]>(
    () =>
      (perf?.events ?? []).map((e) => ({
        time: e.signal_date,
        position: e.side === "buy" ? "belowBar" : "aboveBar",
        shape: e.side === "buy" ? "arrowUp" : "arrowDown",
        color: e.side === "buy" ? "#10b981" : "#ef4444",
        text: SIGNAL_SHORT[e.signal_type],
      })),
    [perf]
  );
  const periodSignals = perf?.by_period.find((p) => p.period === period)?.signals ?? [];

  return (
    <div className="max-w-6xl">
      <Link
        to="/stocks"
        className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-6"
      >
        ← 銘柄一覧に戻る
      </Link>

      <div className="mb-6">
        <span className="inline-block font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded mb-2">
          {stock.code}
        </span>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stock.name}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {stock.industry}{stock.market ? ` / ${stock.market}` : ""}
        </p>
      </div>

      {/* 株価 */}
      <div className={`${card} p-6 mb-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200">株価</h3>
          {price && <span className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(price.trade_date)} 時点</span>}
        </div>
        {price ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <PriceCard label="株価" value={fmt(price.current_price)} large />
            <PriceCard label="始値" value={fmt(price.open_price)} />
            <PriceCard label="前日終値" value={fmt(price.prev_close)} />
            <PriceCard label="高値" value={fmt(price.high_price)} />
            <PriceCard label="安値" value={fmt(price.low_price)} />
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">株価データがありません</p>
        )}
      </div>

      {/* チャート */}
      <div className={`${card} p-6 mb-6`}>
        <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-1">チャートとシグナル</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          <span className="text-emerald-500">▲</span> 買いサイン　<span className="text-rose-500">▼</span> 売りサイン
          （GC: ゴールデンクロス / DC: デッドクロス / RSI↓↑: 売られすぎ・買われすぎ / BB↓↑: ボリンジャーバンド下限・上限 / 出来高: 出来高急増＋上昇）
        </p>
        <StockPriceChart initialCode={stock.code} initialDays={520} markers={markers} />
      </div>

      {perf ? (
        <>
          {/* (A) サイン別 */}
          <div className={`${card} p-6 mb-6`}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200">
                サインを頼りに売買したら（サインの翌日始値で買い、{period}営業日後に売る）
              </h3>
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-sm">
                {PERIODS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setPeriod(n)}
                    className={`px-3 py-1.5 ${period === n ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"}`}
                  >
                    {n}日保有
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              損益は手数料（往復0.1%）込み。「累計」は保有中に出た同じサインは無視して1回ずつ売買した場合の複利。
              「同業種比」は同じ日に同じ業種の全銘柄で同じ売買をした平均との差で、プラスならこの銘柄でサインが特に効いたことを示す。
            </p>
            <Highlights perf={perf} period={period} />
            <SignalTable signals={periodSignals} side="buy" />
            <div className="h-4" />
            <SignalTable signals={periodSignals} side="sell" />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              売りサインの値は「持っていた株をその日に売っていたら避けられた値下がり」。プラスなら売って正解、マイナスなら持ち続けた方が良かった。
            </p>
          </div>

          {/* (B) 買い→売り */}
          <div className={`${card} p-6 mb-6`}>
            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-1">
              買いサインで買い、反対の売りサインで売ったら
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              買いサインの翌日始値で買い、反対の売りサインの翌日始値で売る（持っている間の買いサインは無視）。手数料込み。
              最終日まで売りサインが出ていなければ、最終日の終値で評価。
            </p>
            <PairTable pairs={perf.pairs} buyHold={perf.buy_hold_return} />
          </div>

          {/* 発生したシグナル */}
          <div className={`${card} p-6 mb-6`}>
            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-3">発生したシグナルと、その後の損益</h3>
            <EventTable events={perf.events} />
          </div>
        </>
      ) : (
        <div className={`${card} p-6 mb-6 text-sm text-gray-400 text-center`}>シグナルの成績を取得できませんでした</div>
      )}

      {/* 決算・予想修正 */}
      <div className={`${card} p-6 mb-6`}>
        <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-1">決算・予想修正と株価の反応</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          反応日は開示を株価が反映できる最初の取引日。「その後」は反応日の終値からの市場比。決算データは約12週間遅れで取り込まれる。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                {["開示日時", "種類", "方向", "変化率", "反応日の市場比", "その後5日", "その後20日"].map((h, i) => (
                  <th key={h} className={`${th} ${i >= 3 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {disclosures.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-gray-400 dark:text-gray-500">データがありません</td>
                </tr>
              ) : (
                disclosures.map((d) => (
                  <tr key={d.disc_no}>
                    <td className={`${td} text-gray-800 dark:text-gray-100`}>{fmtDate(d.disc_date)} {d.disc_time}</td>
                    <td className={`${td} text-gray-600 dark:text-gray-300`}>{EVENT_LABELS[d.event_type] ?? d.event_type}</td>
                    <td className={`${td} text-gray-600 dark:text-gray-300`}>{d.direction ? DIRECTION_LABELS[d.direction] : "—"}</td>
                    <td className={`${td} text-right`}><Pct v={d.change_pct} /></td>
                    <td className={`${td} text-right`}><Pct v={d.reaction_excess} digits={2} /></td>
                    <td className={`${td} text-right`}><Pct v={d.drift_5d} digits={2} /></td>
                    <td className={`${td} text-right`}><Pct v={d.drift_20d} digits={2} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
        過去の成績は将来の結果を保証しない。回数が少ないサインの成績は偶然の影響が大きいため、「全銘柄平均」と見比べて判断する。
      </p>
    </div>
  );
}
