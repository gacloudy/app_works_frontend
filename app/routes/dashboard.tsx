import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import { backendFetch } from "../utils/backend.server";

export function meta() {
  return [{ title: "ダッシュボード | 株価分析" }];
}

interface DateCount {
  trade_date: string;
  count: number;
}

interface SignalSkip {
  code: string;
  name: string | null;
  industry: string | null;
  event_date: string;
  reason: string;
  reason_label: string;
  detail: string | null;
  change_pct: string | null;
  skip_from: string;
  skip_until: string;
  is_active: boolean;
}

export async function loader() {
  const [countsRes, skipsRes] = await Promise.all([
    backendFetch("/api/v1/stock-price/counts-by-date"),
    backendFetch("/api/v1/signals/skips"),
  ]);
  const dateCounts: DateCount[] = countsRes.ok ? await countsRes.json() : [];
  const skips: SignalSkip[] = skipsRes.ok ? await skipsRes.json() : [];
  return { dateCounts, skips };
}

const REASON_BADGE: Record<string, string> = {
  split_suspected: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  price_mismatch: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  extreme_move: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default function Dashboard() {
  const { dateCounts, skips } = useLoaderData<typeof loader>();
  const [showExpired, setShowExpired] = useState(false);
  const activeSkips = skips.filter((s) => s.is_active);
  const visibleSkips = showExpired ? skips : activeSkips;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
        ダッシュボード
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">登録銘柄数</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 mt-1">--</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">最終取得日時</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 mt-1">--</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">検出パターン数</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 mt-1">--</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">
          日付ごとの株価データ件数
        </h3>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">
                  取引日
                </th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">
                  件数
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {dateCounts.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="text-center py-8 text-gray-400 dark:text-gray-500"
                  >
                    データがありません
                  </td>
                </tr>
              ) : (
                dateCounts.map((row) => (
                  <tr
                    key={row.trade_date}
                    className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <td className="px-4 py-2 text-gray-800 dark:text-gray-100">
                      {fmtDate(row.trade_date)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-800 dark:text-gray-100">
                      {row.count.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
            シグナル分析スキップ銘柄
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              スキップ中 {activeSkips.length} 件 / 累計 {skips.length} 件
            </span>
          </h3>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showExpired}
              onChange={(e) => setShowExpired(e.target.checked)}
            />
            期間終了分も表示
          </label>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          株式分割の疑い・前日終値の不一致・極端な値動きを検出した銘柄は、スキップ期間中のシグナル検出と統計集計から除外しています。
        </p>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                {["状態", "銘柄", "業種", "発生日", "理由", "詳細", "スキップ期間"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {visibleSkips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400 dark:text-gray-500">
                    スキップ中の銘柄はありません
                  </td>
                </tr>
              ) : (
                visibleSkips.map((s) => (
                  <tr
                    key={`${s.code}-${s.event_date}-${s.reason}`}
                    className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <td className="px-4 py-2 whitespace-nowrap">
                      {s.is_active ? (
                        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">スキップ中</span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">終了</span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Link
                        to={`/stocks/${s.code}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {s.code}
                      </Link>
                      <span className="ml-2 text-gray-800 dark:text-gray-100">{s.name ?? ""}</span>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {s.industry ?? "-"}
                    </td>
                    <td className="px-4 py-2 text-gray-800 dark:text-gray-100 whitespace-nowrap">
                      {fmtDate(s.event_date)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${REASON_BADGE[s.reason] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {s.reason_label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300 min-w-64">
                      {s.detail ?? "-"}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {fmtDate(s.skip_from)} 〜 {fmtDate(s.skip_until)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">
          注目銘柄
        </h3>
        <div className="text-gray-400 dark:text-gray-500 text-sm py-8 text-center">
          データがありません
        </div>
      </div>
    </div>
  );
}
