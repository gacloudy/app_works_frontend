import { Link, useLoaderData } from "react-router";
import { backendFetch } from "../utils/backend.server";
import { SIGNAL_LABELS } from "../utils/signals";
import { fmtDate, OutcomeBadge, Pct, statusText, type Pick } from "../components/PickOutcome";

export function meta() {
  return [{ title: "推奨の実績 | 株価分析" }];
}

interface RecordSummary {
  total: number;
  closed: number;
  holding: number;
  pending: number;
  wins: number;
  losses: number;
  win_rate: number | null;
  avg_return: number | null;
  median_return: number | null;
  best: number | null;
  worst: number | null;
  avg_excess: number | null;
  beat_market_rate: number | null;
}

interface TrackRecord {
  live: RecordSummary;
  backfill: RecordSummary;
  live_buy: RecordSummary;
  live_sell: RecordSummary;
  backfill_buy: RecordSummary;
  backfill_sell: RecordSummary;
  picks: Pick[];
}

export async function loader() {
  const res = await backendFetch("/api/v1/picks/track-record");
  if (!res.ok) throw new Response("実績を取得できませんでした", { status: res.status });
  const data: TrackRecord = await res.json();
  return data;
}

const card = "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700";
const th = "px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap";
const td = "px-3 py-1.5 whitespace-nowrap";

function Stat({ label, children, sub }: { label: string; children: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-1 tabular-nums">{children}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SummaryGrid({ s }: { s: RecordSummary }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Stat label="推奨した件数" sub={`確定 ${s.closed} / 保有中 ${s.holding} / 買付前 ${s.pending}`}>
        {s.total}件
      </Stat>
      <Stat label="勝率（確定分）" sub={`${s.wins}勝 ${s.losses}敗`}>
        {s.win_rate === null ? "—" : `${s.win_rate.toFixed(1)}%`}
      </Stat>
      <Stat label="1回あたりの平均損益" sub={s.median_return === null ? undefined : `中央値 ${s.median_return > 0 ? "+" : ""}${s.median_return.toFixed(1)}%`}>
        <Pct v={s.avg_return} />
      </Stat>
      <Stat label="市場に勝った割合" sub={s.avg_excess === null ? undefined : `市場との差の平均 ${s.avg_excess > 0 ? "+" : ""}${s.avg_excess.toFixed(2)}%`}>
        {s.beat_market_rate === null ? "—" : `${s.beat_market_rate.toFixed(1)}%`}
      </Stat>
      <Stat label="最良 / 最悪の1回">
        <span className="text-base"><Pct v={s.best} /> / <Pct v={s.worst} /></span>
      </Stat>
    </div>
  );
}

function SideRow({ label, s }: { label: string; s: RecordSummary }) {
  return (
    <tr>
      <td className={`${td} text-gray-800 dark:text-gray-100`}>{label}</td>
      <td className={`${td} text-right tabular-nums text-gray-600 dark:text-gray-300`}>{s.closed}</td>
      <td className={`${td} text-right tabular-nums text-gray-800 dark:text-gray-100`}>
        {s.win_rate === null ? "—" : `${s.win_rate.toFixed(1)}%`}
      </td>
      <td className={`${td} text-right`}><Pct v={s.avg_return} /></td>
      <td className={`${td} text-right`}><Pct v={s.median_return} /></td>
      <td className={`${td} text-right tabular-nums text-gray-800 dark:text-gray-100`}>
        {s.beat_market_rate === null ? "—" : `${s.beat_market_rate.toFixed(1)}%`}
      </td>
      <td className={`${td} text-right`}><Pct v={s.avg_excess} /></td>
    </tr>
  );
}

function SideTable({ buy, sell }: { buy: RecordSummary; sell: RecordSummary }) {
  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <th className={`${th} text-left`}></th>
            <th className={`${th} text-right`}>確定件数</th>
            <th className={`${th} text-right`}>勝率</th>
            <th className={`${th} text-right`}>平均</th>
            <th className={`${th} text-right`}>中央値</th>
            <th className={`${th} text-right`}>市場に勝った割合</th>
            <th className={`${th} text-right`}>市場との差の平均</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          <SideRow label="買い推奨" s={buy} />
          <SideRow label="売り推奨（売って避けた値下がり）" s={sell} />
        </tbody>
      </table>
    </div>
  );
}

export default function TrackRecordPage() {
  const data = useLoaderData<typeof loader>();
  const firstLive = data.picks.length ? data.picks[data.picks.length - 1].pick_date : null;

  return (
    <div className="max-w-6xl">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">推奨の実績</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        「今日の売買サイン」で出した推奨が、その後どうなったかの記録です。悪い結果も含めて、すべて記録・表示しています。
      </p>

      {/* 実際に表示した推奨 */}
      <div className={`${card} p-6 mb-6`}>
        <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-1">実際に表示した推奨の成績</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {firstLive ? `${fmtDate(firstLive)} の推奨から記録しています。` : "まだ推奨がありません。"}
          推奨日の翌営業日の始値で買い（売り）、20営業日後の終値で決済した場合の損益（買いは手数料0.1%込み）。
          {data.live.closed === 0 && data.live.total > 0 && " 最初の推奨の損益は、20営業日後に確定します。"}
        </p>
        <SummaryGrid s={data.live} />
        <SideTable buy={data.live_buy} sell={data.live_sell} />
      </div>

      {/* 推奨の一覧 */}
      <div className={`${card} p-6 mb-6`}>
        <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-3">実際に表示した推奨の一覧（{data.picks.length}件）</h3>
        <div className="overflow-x-auto max-h-[36rem]">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                {["推奨日", "銘柄", "推奨", "サイン", "買値（翌日始値）", "決済日", "決済値", "状態", "損益", "市場との差", ""].map((h, i) => (
                  <th key={i} className={`${th} ${[4, 6, 8, 9].includes(i) ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.picks.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-gray-400 dark:text-gray-500">まだ推奨がありません</td>
                </tr>
              ) : (
                data.picks.map((p) => (
                  <tr key={`${p.pick_date}-${p.rank}`} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className={`${td} text-gray-800 dark:text-gray-100`}>{fmtDate(p.pick_date)}</td>
                    <td className={td}>
                      <Link to={`/stocks/${p.code}`} className="text-blue-600 dark:text-blue-400 hover:underline">{p.code}</Link>
                      <span className="ml-2 text-gray-800 dark:text-gray-100">{p.name ?? ""}</span>
                    </td>
                    <td className={td}>
                      <span className={p.side === "buy" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        {p.side === "buy" ? "買い" : "売り"}
                      </span>
                    </td>
                    <td className={`${td} text-gray-600 dark:text-gray-300`}>{SIGNAL_LABELS[p.signal_type] ?? p.signal_type}</td>
                    <td className={`${td} text-right tabular-nums text-gray-600 dark:text-gray-300`}>
                      {p.entry_price ? new Intl.NumberFormat("ja-JP").format(parseFloat(p.entry_price)) : "—"}
                    </td>
                    <td className={`${td} text-gray-600 dark:text-gray-300`}>{p.exit_date ? fmtDate(p.exit_date) : "—"}</td>
                    <td className={`${td} text-right tabular-nums text-gray-600 dark:text-gray-300`}>
                      {p.exit_price ? new Intl.NumberFormat("ja-JP").format(parseFloat(p.exit_price)) : "—"}
                    </td>
                    <td className={`${td} text-gray-600 dark:text-gray-300`}>{statusText(p)}</td>
                    <td className={`${td} text-right font-semibold`}><Pct v={p.return_pct} /></td>
                    <td className={`${td} text-right`}><Pct v={p.excess_pct} /></td>
                    <td className={td}><OutcomeBadge p={p} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          保有中の損益は最新の終値で計算した途中経過。売り推奨の損益は「その日に売って避けられた値下がり」（プラスなら売って正解）。
        </p>
      </div>

      {/* 参考: 遡り計算 */}
      <div className={`${card} p-6 mb-6`}>
        <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-1">
          参考: 同じ選び方を過去に当てはめた場合
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          実際にその日に表示したものではなく、後から同じ方法で遡って計算した推奨の成績です（各日の推奨は、その日までに結果が確定していた過去のデータだけで選んでいます）。
          実際の成績は上の「実際に表示した推奨の成績」を見てください。
        </p>
        <SummaryGrid s={data.backfill} />
        <SideTable buy={data.backfill_buy} sell={data.backfill_sell} />
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
        市場との差は、同じ期間の全銘柄の等加重平均との比較（推奨日の終値から決済日の終値までの近似値）。過去の成績は将来の結果を保証しません。
      </p>
    </div>
  );
}
