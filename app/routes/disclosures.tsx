import { Link, useLoaderData } from "react-router";
import { backendFetch } from "../utils/backend.server";

export function meta() {
  return [{ title: "決算・開示 | 株価分析" }];
}

interface DisclosureStats {
  event_type: string;
  direction: string;
  sample_count: number;
  date_count: number;
  avg_reaction: number | null;
  reaction_win_rate: number | null;
  avg_drift_5d: number | null;
  avg_drift_20d: number | null;
  drift_20d_count: number;
  drift_20d_t_stat: number | null;
}

interface Disclosure {
  disc_no: string;
  code: string;
  name: string | null;
  industry: string | null;
  disc_date: string;
  disc_time: string;
  event_type: string;
  direction: string | null;
  metric: string | null;
  change_pct: string | null;
  reaction_date: string | null;
  reaction_excess: string | null;
  drift_5d: string | null;
  drift_20d: string | null;
}

export async function loader() {
  const [statsRes, recentRes] = await Promise.all([
    backendFetch("/api/v1/disclosures/stats"),
    backendFetch("/api/v1/disclosures/recent?limit=200"),
  ]);
  const stats: DisclosureStats[] = statsRes.ok ? await statsRes.json() : [];
  const recent: Disclosure[] = recentRes.ok ? await recentRes.json() : [];
  return { stats, recent };
}

const EVENT_LABELS: Record<string, string> = {
  earn_revision: "業績予想の修正",
  div_revision: "配当予想の修正",
  q_results: "四半期決算（予想の変更）",
  fy_results: "通期決算（来期見通し）",
};

const DIRECTION_LABELS: Record<string, { label: string; badge: string }> = {
  up: { label: "上方", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  flat: { label: "据え置き", badge: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
  down: { label: "下方", badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
};

const METRIC_LABELS: Record<string, string> = { op: "営業利益", odp: "経常利益", np: "純利益", div: "年間配当" };

const card = "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700";
const th = "px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap";

function toNum(v: string | number | null): number | null {
  return v === null ? null : typeof v === "number" ? v : parseFloat(v);
}

function Pct({ v, digits = 2 }: { v: string | number | null; digits?: number }) {
  const n = toNum(v);
  if (n === null) return <span className="text-gray-300 dark:text-gray-600">-</span>;
  const color = n > 0 ? "text-emerald-600 dark:text-emerald-400" : n < 0 ? "text-rose-600 dark:text-rose-400" : "text-gray-500";
  return <span className={color}>{`${n > 0 ? "+" : ""}${n.toFixed(digits)}%`}</span>;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default function Disclosures() {
  const { stats, recent } = useLoaderData<typeof loader>();
  const ordered = Object.keys(EVENT_LABELS).flatMap((e) =>
    ["up", "flat", "down"].map((d) => stats.find((s) => s.event_type === e && s.direction === d)).filter(Boolean)
  ) as DisclosureStats[];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">決算・開示</h2>

      <div className={`${card} p-6 mb-8`}>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">開示の種類ごとの株価の反応</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          J-Quants の財務情報から、予想の上方・下方修正などを数値で判定し、開示後の市場比リターンを集計したもの。
          「反応日」は開示を株価が反映できる最初の取引日（15:30以降の開示は翌取引日）。
          「その後」は反応日の終値で買った場合のN取引日後の市場比で、プラスなら反応後も同じ方向に動き続けた（ドリフト）ことを示す。
          t値は |t| ≥ 2 を目安に参考にする。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <th className={`${th} text-left`}>開示の種類</th>
                <th className={`${th} text-left`}>方向</th>
                <th className={`${th} text-right`}>件数</th>
                <th className={`${th} text-right`}>反応日</th>
                <th className={`${th} text-right`}>反応日に市場超え</th>
                <th className={`${th} text-right`}>その後5日</th>
                <th className={`${th} text-right`}>その後20日</th>
                <th className={`${th} text-right`}>20日 t値（件数）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {ordered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400 dark:text-gray-500">
                    データがありません（J-Quants からの取得後に表示されます）
                  </td>
                </tr>
              ) : (
                ordered.map((s) => {
                  const t = s.drift_20d_t_stat;
                  return (
                    <tr key={`${s.event_type}-${s.direction}`}>
                      <td className="px-3 py-2 text-gray-800 dark:text-gray-100 whitespace-nowrap">{EVENT_LABELS[s.event_type]}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${DIRECTION_LABELS[s.direction]?.badge}`}>
                          {DIRECTION_LABELS[s.direction]?.label ?? s.direction}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">{s.sample_count}</td>
                      <td className="px-3 py-2 text-right"><Pct v={s.avg_reaction} /></td>
                      <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-100">
                        {s.reaction_win_rate === null ? "-" : `${s.reaction_win_rate.toFixed(0)}%`}
                      </td>
                      <td className="px-3 py-2 text-right"><Pct v={s.avg_drift_5d} /></td>
                      <td className="px-3 py-2 text-right"><Pct v={s.avg_drift_20d} /></td>
                      <td className={`px-3 py-2 text-right ${t !== null && Math.abs(t) >= 2 ? "font-semibold text-gray-800 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}>
                        {t === null ? "-" : t.toFixed(1)}（{s.drift_20d_count}）
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`${card} p-6`}>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">最近の開示</h3>
        <div className="overflow-x-auto max-h-[36rem]">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                {["開示日時", "銘柄", "種類", "方向", "変化率", "反応日", "その後5日", "その後20日"].map((h) => (
                  <th key={h} className={`${th} text-left`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400 dark:text-gray-500">データがありません</td>
                </tr>
              ) : (
                recent.map((d) => (
                  <tr key={d.disc_no} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-3 py-1.5 text-gray-800 dark:text-gray-100 whitespace-nowrap">
                      {fmtDate(d.disc_date)} {d.disc_time}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <Link to={`/stocks/${d.code}`} className="text-blue-600 dark:text-blue-400 hover:underline">{d.code}</Link>
                      <span className="ml-2 text-gray-800 dark:text-gray-100">{d.name ?? ""}</span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">{EVENT_LABELS[d.event_type]}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {d.direction ? (
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${DIRECTION_LABELS[d.direction]?.badge}`}>
                          {DIRECTION_LABELS[d.direction]?.label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">比較不可</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <Pct v={d.change_pct} digits={1} />
                      {d.metric && <span className="ml-1 text-xs text-gray-400">{METRIC_LABELS[d.metric]}</span>}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap"><Pct v={d.reaction_excess} /></td>
                    <td className="px-3 py-1.5 whitespace-nowrap"><Pct v={d.drift_5d} /></td>
                    <td className="px-3 py-1.5 whitespace-nowrap"><Pct v={d.drift_20d} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
