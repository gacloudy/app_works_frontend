import { Link, useLoaderData, useNavigate } from "react-router";
import { backendFetch } from "../utils/backend.server";
import { SIGNAL_LABELS } from "../utils/signals";
import { fmtDate, Pct, PickOutcome, type Pick } from "../components/PickOutcome";

export function meta() {
  return [{ title: "今日の売買サイン | 株価分析" }];
}

interface DayPicks {
  pick_date: string | null;
  trading_dates: string[];
  picks: Pick[];
}

export async function loader({ request }: { request: Request }) {
  const date = new URL(request.url).searchParams.get("date");
  const res = await backendFetch(`/api/v1/picks${date ? `?pick_date=${date}` : ""}`);
  const data: DayPicks = res.ok ? await res.json() : { pick_date: null, trading_dates: [], picks: [] };
  return data;
}

const card = "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700";

function PickCard({ p }: { p: Pick }) {
  const isBuy = p.side === "buy";
  return (
    <div className={`${card} p-5 flex flex-col`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-400 dark:text-gray-500">#{p.rank}</span>
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold ${
            isBuy
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
          }`}
        >
          {isBuy ? "買い時" : "売り時（保有中なら）"}
        </span>
      </div>

      <Link to={`/stocks/${p.code}`} className="group">
        <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{p.code}</p>
        <p className="text-xl font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
          {p.name ?? p.code}
        </p>
      </Link>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{p.industry ?? ""}</p>

      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2 mb-3 text-sm text-gray-700 dark:text-gray-200">
        <p>
          サイン: <span className="font-semibold">{SIGNAL_LABELS[p.signal_type] ?? p.signal_type}</span>
        </p>
        <p>
          終値: <span className="font-semibold tabular-nums">{new Intl.NumberFormat("ja-JP").format(parseFloat(p.close_price))}円</span>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {isBuy
            ? `目安: 翌営業日の寄り付きで買い、${p.hold_days}営業日後に売る`
            : `目安: 保有しているなら翌営業日の寄り付きで売る（${p.hold_days}営業日の値下がりを避ける想定）`}
        </p>
      </div>

      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">この銘柄でこのサインが出たときの過去の成績</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-gray-500 dark:text-gray-400">回数</dt>
        <dd className="text-right tabular-nums text-gray-800 dark:text-gray-100">{p.past_count}回</dd>
        <dt className="text-gray-500 dark:text-gray-400">{isBuy ? "勝率" : "売って正解"}</dt>
        <dd className="text-right tabular-nums text-gray-800 dark:text-gray-100">{parseFloat(p.past_win_rate).toFixed(0)}%</dd>
        <dt className="text-gray-500 dark:text-gray-400">{isBuy ? "1回平均" : "平均で避けた値下がり"}</dt>
        <dd className="text-right font-semibold"><Pct v={p.past_avg} /></dd>
        <dt className="text-gray-500 dark:text-gray-400">全銘柄の平均</dt>
        <dd className="text-right"><Pct v={p.all_stocks_avg} /></dd>
      </dl>

      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <PickOutcome p={p} />
      </div>

      <div className="mt-auto pt-3 flex items-center justify-between">
        {!p.is_live ? (
          <span className="text-[11px] text-amber-700 dark:text-amber-400" title="この日の夜に実際に表示したものではなく、後から同じ方法で計算した参考値">
            参考: 後から同じ方法で計算
          </span>
        ) : (
          <span />
        )}
        <Link to={`/stocks/${p.code}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          詳細を見る →
        </Link>
      </div>
    </div>
  );
}

export default function Picks() {
  const { pick_date, trading_dates, picks } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const idx = pick_date ? trading_dates.indexOf(pick_date) : -1;
  const newer = idx > 0 ? trading_dates[idx - 1] : null;
  const older = idx >= 0 && idx < trading_dates.length - 1 ? trading_dates[idx + 1] : null;
  const go = (d: string | null) => d && navigate(`/picks?date=${d}`);

  return (
    <div className="max-w-6xl">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">今日の売買サイン</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        終値確定後に出たサインのうち、その銘柄で過去によく効いていたものを最大3件表示します。翌営業日の寄り付きでの売買を想定しています。
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => go(older)}
          disabled={!older}
          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-40"
        >
          ← 前の日
        </button>
        <select
          value={pick_date ?? ""}
          onChange={(e) => go(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
        >
          {pick_date && !trading_dates.includes(pick_date) && <option value={pick_date}>{fmtDate(pick_date)}</option>}
          {trading_dates.map((d) => (
            <option key={d} value={d}>{fmtDate(d)}</option>
          ))}
        </select>
        <button
          onClick={() => go(newer)}
          disabled={!newer}
          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-40"
        >
          次の日 →
        </button>
        {pick_date && (
          <span className="text-sm text-gray-600 dark:text-gray-300 ml-2">
            {fmtDate(pick_date)} の終値で出たサイン
          </span>
        )}
      </div>

      {picks.length === 0 ? (
        <div className={`${card} p-10 text-center text-gray-500 dark:text-gray-400`}>
          この日は、条件を満たすサインはありませんでした。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {picks.map((p) => (
            <PickCard key={p.rank} p={p} />
          ))}
        </div>
      )}

      <div className={`${card} p-5 mt-6 text-xs text-gray-500 dark:text-gray-400 space-y-1`}>
        <p className="font-semibold text-gray-600 dark:text-gray-300">選び方</p>
        <p>・その日にサインが出た銘柄のうち、その銘柄でそのサインが過去8回以上出ていて、勝率60%以上、1回平均がプラスのもの。</p>
        <p>・成績は「サインの翌営業日の始値で買い、20営業日後の終値で売る」想定（手数料込み）。売りサインは「その日に売って避けられた値下がり」。</p>
        <p>・回数が少ないほど全銘柄の平均に寄せて評価し、その値が+5%以上のものを良い順に最大3件（1銘柄1件）。該当がなければ、その日は推奨なし。成績はその日までに結果が確定していた過去のサインだけで計算しています。</p>
        <p>・過去の成績は将来の結果を保証しません。1銘柄あたりの回数は少なく、偶然の影響を受けやすい点に注意してください。</p>
      </div>
    </div>
  );
}
