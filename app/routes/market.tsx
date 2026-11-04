import { useEffect, useRef, useState } from "react";
import { useLoaderData } from "react-router";
import { createChart, ColorType, LineSeries, LineStyle } from "lightweight-charts";
import { backendFetch } from "../utils/backend.server";

export function meta() {
  return [{ title: "地合い・業種 | 株価分析" }];
}

interface Breadth {
  trade_date: string;
  stock_count: number;
  adv_count: number;
  dec_count: number;
  adv_dec_ratio_25: string | null;
  pct_above_ma25: string | null;
  avg_rsi14: string | null;
  mkt_return: string | null;
  mkt_index: string | null;
  regime: string | null;
}

interface Industry {
  trade_date: string;
  industry: string;
  member_count: number;
  return_5d: string | null;
  return_20d: string | null;
  excess_5d: string | null;
  excess_20d: string | null;
  rank_5d: number | null;
  rank_20d: number | null;
  pct_above_ma25: string | null;
}

interface ContextStats {
  signal_type: string;
  context_type: string;
  context_value: string;
  period: number;
  sample_count: number;
  date_count: number | null;
  avg_excess: string | null;
  t_stat: string | null;
  first_half_excess: string | null;
  second_half_excess: string | null;
  is_consistent: boolean | null;
}

interface MomentumStats {
  lookback: number;
  horizon: number;
  bucket: string;
  date_count: number;
  avg_excess: string | null;
  win_rate: string | null;
  t_stat: string | null;
  is_consistent: boolean | null;
}

export async function loader() {
  const paths = [
    "/api/v1/market/breadth?days=250",
    "/api/v1/market/industries",
    "/api/v1/market/context-stats",
    "/api/v1/market/industry-momentum-stats",
  ];
  const responses = await Promise.all(paths.map((p) => backendFetch(p)));
  const [breadth, industries, contextStats, momentumStats] = await Promise.all(
    responses.map((r) => (r.ok ? r.json() : []))
  );
  return {
    breadth: breadth as Breadth[],
    industries: industries as Industry[],
    contextStats: contextStats as ContextStats[],
    momentumStats: momentumStats as MomentumStats[],
  };
}

const SIGNAL_LABELS: Record<string, string> = {
  golden_cross: "ゴールデンクロス",
  dead_cross: "デッドクロス",
  rsi_oversold: "RSI 売られすぎ",
  rsi_overbought: "RSI 買われすぎ",
  bb_lower_touch: "BB 下限タッチ",
  bb_upper_touch: "BB 上限タッチ",
  volume_surge_up: "出来高急増＋上昇",
};

const REGIME_LABELS: Record<string, { label: string; badge: string }> = {
  strong: { label: "強い", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  neutral: { label: "中立", badge: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
  weak: { label: "弱い", badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
};

const CONTEXTS = [
  {
    type: "industry_trend",
    title: "業種の勢い別",
    note: "シグナル発生日に、その銘柄の業種が過去20日で市場より強かったか（33業種の上位1/3＝強い、下位1/3＝弱い）。",
    values: [["strong", "強い業種"], ["middle", "中位"], ["weak", "弱い業種"]],
  },
  {
    type: "regime",
    title: "地合い別",
    note: "シグナル発生日の地合い（25日線より上の銘柄が60%以上＝強い、40%以下＝弱い）。地合いは数週間単位で続くため、現状は前半・後半の両方に同じ地合いが揃わず、再現性（✓）を確認できないものが多い。",
    values: [["strong", "強い地合い"], ["neutral", "中立"], ["weak", "弱い地合い"]],
  },
] as const;

const card = "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700";
const th = "px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap";

function num(v: string | null): number | null {
  return v === null ? null : parseFloat(v);
}

function fmtPct(v: string | null, digits = 2): string {
  const n = num(v);
  return n === null ? "-" : `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

function signColor(v: string | null): string {
  const n = num(v);
  if (n === null || n === 0) return "text-gray-500 dark:text-gray-400";
  return n > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** |t| が 2 以上かつ前半・後半で符号が一致したもの（参考にしてよい結果）か。 */
function isReliable(t: string | null, consistent: boolean | null): boolean {
  const n = num(t);
  return n !== null && Math.abs(n) >= 2 && consistent === true;
}

function StatCell({ avg, t, consistent, n }: { avg: string | null; t: string | null; consistent: boolean | null; n?: number | null }) {
  if (avg === null) return <span className="text-gray-300 dark:text-gray-600">-</span>;
  const reliable = isReliable(t, consistent);
  return (
    <div className={reliable ? "font-semibold" : "opacity-70"}>
      <span className={signColor(avg)}>{fmtPct(avg)}</span>
      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
        t {num(t)?.toFixed(1) ?? "-"}
        {consistent === true ? " ✓" : consistent === false ? " ✗" : ""}
        {n != null ? ` / ${n}日` : ""}
      </span>
    </div>
  );
}

function BreadthChart({ breadth }: { breadth: Breadth[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container || !breadth.length) return;

    const isDark = document.documentElement.classList.contains("dark");
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 280,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? "#1f2937" : "#ffffff" },
        textColor: isDark ? "#d1d5db" : "#374151",
      },
      grid: {
        vertLines: { color: isDark ? "#374151" : "#f3f4f6" },
        horzLines: { color: isDark ? "#374151" : "#f3f4f6" },
      },
      leftPriceScale: { visible: true, borderColor: isDark ? "#4b5563" : "#e5e7eb" },
      rightPriceScale: { borderColor: isDark ? "#4b5563" : "#e5e7eb" },
      timeScale: { borderColor: isDark ? "#4b5563" : "#e5e7eb" },
    });

    const pct = chart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 2, priceScaleId: "right" });
    pct.setData(
      breadth
        .filter((b) => b.pct_above_ma25 !== null)
        .map((b) => ({ time: b.trade_date, value: parseFloat(b.pct_above_ma25!) }))
    );
    pct.createPriceLine({ price: 60, color: "#10b981", lineStyle: LineStyle.Dashed, lineWidth: 1, title: "強い" });
    pct.createPriceLine({ price: 40, color: "#ef4444", lineStyle: LineStyle.Dashed, lineWidth: 1, title: "弱い" });

    const idx = chart.addSeries(LineSeries, {
      color: "#9ca3af",
      lineWidth: 1,
      priceScaleId: "left",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    idx.setData(
      breadth
        .filter((b) => b.mkt_index !== null)
        .map((b) => ({ time: b.trade_date, value: parseFloat(b.mkt_index!) }))
    );
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => chart.applyOptions({ width: container.clientWidth }));
    ro.observe(container);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [breadth]);

  return <div ref={ref} className="w-full" />;
}

export default function Market() {
  const { breadth, industries, contextStats, momentumStats } = useLoaderData<typeof loader>();
  const [period, setPeriod] = useState(20);
  const latest = breadth.length ? breadth[breadth.length - 1] : null;
  const regime = latest?.regime ? REGIME_LABELS[latest.regime] : null;
  const signalTypes = Object.keys(SIGNAL_LABELS).filter((s) => contextStats.some((c) => c.signal_type === s));

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">地合い・業種</h2>

      {/* 地合いのサマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`${card} p-5`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">地合い{latest ? `（${fmtDate(latest.trade_date)}）` : ""}</p>
          <p className="mt-2">
            {regime ? (
              <span className={`inline-block rounded px-3 py-1 text-xl font-bold ${regime.badge}`}>{regime.label}</span>
            ) : (
              <span className="text-3xl font-bold text-gray-400">--</span>
            )}
          </p>
        </div>
        <div className={`${card} p-5`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">25日線より上の銘柄</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 mt-1">
            {num(latest?.pct_above_ma25 ?? null)?.toFixed(1) ?? "--"}
            <span className="text-base font-normal">%</span>
          </p>
        </div>
        <div className={`${card} p-5`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">騰落レシオ（25日）</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 mt-1">
            {num(latest?.adv_dec_ratio_25 ?? null)?.toFixed(1) ?? "--"}
          </p>
        </div>
        <div className={`${card} p-5`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">平均RSI（14日）</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 mt-1">
            {num(latest?.avg_rsi14 ?? null)?.toFixed(1) ?? "--"}
          </p>
        </div>
      </div>

      <div className={`${card} p-6 mb-8`}>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">地合いの推移</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          <span className="text-blue-500">━</span> 25日線より上の銘柄の割合（右軸, %）
          <span className="text-gray-400">━</span> 全銘柄の等加重指数（左軸, 初日=100）
        </p>
        {breadth.length ? (
          <BreadthChart breadth={breadth} />
        ) : (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">データがありません</div>
        )}
      </div>

      {/* 業種ランキング */}
      <div className={`${card} p-6 mb-8`}>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">
          業種の強弱
          {industries.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              {fmtDate(industries[0].trade_date)} 時点
            </span>
          )}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          業種内の銘柄の等加重平均を、市場全体（全銘柄の等加重平均）と比べたもの。順位は市場との差が大きい順。
        </p>
        <div className="overflow-x-auto max-h-[32rem]">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <th className={`${th} text-right`}>20日順位</th>
                <th className={`${th} text-left`}>業種</th>
                <th className={`${th} text-right`}>銘柄数</th>
                <th className={`${th} text-right`}>20日 市場比</th>
                <th className={`${th} text-right`}>5日 市場比</th>
                <th className={`${th} text-right`}>5日順位</th>
                <th className={`${th} text-right`}>25日線より上</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {industries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400 dark:text-gray-500">データがありません</td>
                </tr>
              ) : (
                industries.map((r) => (
                  <tr key={r.industry} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-3 py-1.5 text-right text-gray-800 dark:text-gray-100">{r.rank_20d ?? "-"}</td>
                    <td className="px-3 py-1.5 text-gray-800 dark:text-gray-100 whitespace-nowrap">{r.industry}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500 dark:text-gray-400">{r.member_count}</td>
                    <td className={`px-3 py-1.5 text-right ${signColor(r.excess_20d)}`}>{fmtPct(r.excess_20d)}</td>
                    <td className={`px-3 py-1.5 text-right ${signColor(r.excess_5d)}`}>{fmtPct(r.excess_5d)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500 dark:text-gray-400">{r.rank_5d ?? "-"}</td>
                    <td className="px-3 py-1.5 text-right text-gray-800 dark:text-gray-100">
                      {num(r.pct_above_ma25)?.toFixed(0) ?? "-"}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 業種モメンタムの検証 */}
      <div className={`${card} p-6 mb-8`}>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">検証: 強い業種はその後も強いか</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          毎日、過去N日の市場比で上位5業種・下位5業種を選び、その後M日の市場比リターンを日ごとに平均したもの。
          差（上位−下位）がプラスなら「勢いが続く」、マイナスなら「反転しやすい」。
          太字は |t| ≥ 2 かつ前半・後半で符号が一致（✓）したもの。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <th className={`${th} text-left`}>判定期間 → 保有期間</th>
                <th className={`${th} text-left`}>上位5業種</th>
                <th className={`${th} text-left`}>下位5業種</th>
                <th className={`${th} text-left`}>差（上位−下位）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {momentumStats.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-400 dark:text-gray-500">データがありません</td>
                </tr>
              ) : (
                [...new Set(momentumStats.map((m) => `${m.lookback}-${m.horizon}`))].map((key) => {
                  const [lb, h] = key.split("-").map(Number);
                  const get = (bucket: string) =>
                    momentumStats.find((m) => m.lookback === lb && m.horizon === h && m.bucket === bucket);
                  return (
                    <tr key={key}>
                      <td className="px-3 py-2 text-gray-800 dark:text-gray-100 whitespace-nowrap">
                        過去{lb}日 → その後{h}日
                      </td>
                      {["top", "bottom", "spread"].map((b) => {
                        const m = get(b);
                        return (
                          <td key={b} className="px-3 py-2 whitespace-nowrap">
                            {m ? <StatCell avg={m.avg_excess} t={m.t_stat} consistent={m.is_consistent} n={m.date_count} /> : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* シグナル × 状況 */}
      <div className={`${card} p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">検証: シグナルは状況によって効き方が変わるか</h3>
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
          >
            {[3, 5, 10, 20].map((p) => (
              <option key={p} value={p}>{p}営業日後</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          シグナル発生から{period}営業日後の市場比リターンの平均。プラスなら買い、マイナスなら売りのサインとして働いたことを示す。
          太字は |t| ≥ 2 かつ前半・後半で符号が一致（✓）したもの。
        </p>

        {CONTEXTS.map((ctx) => (
          <div key={ctx.type} className="mb-6 last:mb-0">
            <h4 className="font-semibold text-gray-700 dark:text-gray-200 text-sm mb-1">{ctx.title}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{ctx.note}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <th className={`${th} text-left`}>シグナル</th>
                    {ctx.values.map(([, label]) => (
                      <th key={label} className={`${th} text-left`}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {signalTypes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-gray-400 dark:text-gray-500">データがありません</td>
                    </tr>
                  ) : (
                    signalTypes.map((s) => (
                      <tr key={s}>
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-100 whitespace-nowrap">{SIGNAL_LABELS[s]}</td>
                        {ctx.values.map(([value]) => {
                          const c = contextStats.find(
                            (x) => x.signal_type === s && x.context_type === ctx.type && x.context_value === value && x.period === period
                          );
                          return (
                            <td key={value} className="px-3 py-2 whitespace-nowrap">
                              {c ? <StatCell avg={c.avg_excess} t={c.t_stat} consistent={c.is_consistent} /> : "-"}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
