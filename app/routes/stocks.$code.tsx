import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/stocks.$code";

export function meta({ data }: Route.MetaArgs) {
  const name = data?.stock?.name ?? "";
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

export async function loader({ params }: Route.LoaderArgs) {
  const [stockRes, priceRes] = await Promise.all([
    fetch(`http://localhost:8000/api/v1/stock-master/${params.code}`),
    fetch(`http://localhost:8000/api/v1/stock-price/${params.code}/latest`),
  ]);

  if (stockRes.status === 404) throw new Response("銘柄が見つかりません", { status: 404 });
  if (!stockRes.ok) throw new Response("取得失敗", { status: stockRes.status });

  const stock: Stock = await stockRes.json();
  const price: PriceData | null = priceRes.ok ? await priceRes.json() : null;

  return { stock, price };
}

function fmt(value: string | null): string {
  if (!value) return "—";
  const n = parseFloat(value);
  return new Intl.NumberFormat("ja-JP").format(n);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <dt className="w-36 shrink-0 text-sm text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800 dark:text-gray-100 font-medium">{value}</dd>
    </div>
  );
}

function PriceCard({
  label,
  value,
  large,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p
        className={`font-semibold text-gray-800 dark:text-gray-100 tabular-nums ${
          large ? "text-2xl" : "text-base"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function StockDetail() {
  const { stock, price } = useLoaderData<typeof loader>();

  const fmtDatetime = (iso: string) =>
    new Date(iso).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="max-w-2xl">
      {/* 戻るリンク */}
      <Link
        to="/stocks"
        className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-6"
      >
        ← 銘柄一覧に戻る
      </Link>

      {/* ヘッダー */}
      <div className="mb-6">
        <span className="inline-block font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded mb-2">
          {stock.code}
        </span>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          {stock.name}
        </h2>
      </div>

      {/* 株価データ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200">
            株価データ
          </h3>
          {price && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {fmtDate(price.trade_date)} 時点
            </span>
          )}
        </div>

        {price ? (
          <div className="space-y-3">
            {/* 株価（大きく） */}
            <PriceCard label="株価" value={fmt(price.current_price)} large />

            {/* OHLC グリッド */}
            <div className="grid grid-cols-2 gap-3">
              <PriceCard label="始値"     value={fmt(price.open_price)} />
              <PriceCard label="前日終値" value={fmt(price.prev_close)} />
              <PriceCard label="高値"     value={fmt(price.high_price)} />
              <PriceCard label="安値"     value={fmt(price.low_price)} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
            株価データがありません
          </p>
        )}
      </div>

      {/* 銘柄情報 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-6 py-2">
        <dl>
          <InfoRow label="証券コード" value={stock.code} />
          <InfoRow label="銘柄名"    value={stock.name} />
          <InfoRow label="業種"      value={stock.industry} />
          <InfoRow label="市場"      value={stock.market ?? "—"} />
          <InfoRow label="登録日時"  value={fmtDatetime(stock.created_at)} />
          <InfoRow label="更新日時"  value={fmtDatetime(stock.updated_at)} />
        </dl>
      </div>
    </div>
  );
}
