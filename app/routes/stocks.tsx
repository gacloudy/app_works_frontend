import { useState } from "react";
import { Link, useLoaderData } from "react-router";

export function meta() {
  return [{ title: "銘柄一覧 | 株価分析" }];
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

interface LatestPrice {
  code: string;
  current_price: string | null;
  trade_date: string;
}

export async function loader() {
  const [stocksRes, pricesRes] = await Promise.all([
    fetch("http://localhost:8000/api/v1/stock-master/"),
    fetch("http://localhost:8000/api/v1/stock-price/latest"),
  ]);
  if (!stocksRes.ok) throw new Response("取得失敗", { status: stocksRes.status });

  const stocks: Stock[] = await stocksRes.json();
  const prices: Record<string, LatestPrice> = pricesRes.ok
    ? await pricesRes.json()
    : {};

  return { stocks, prices };
}

function fmtPrice(value: string | null): string {
  if (!value) return "—";
  const n = parseFloat(value);
  return new Intl.NumberFormat("ja-JP").format(n);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default function Stocks() {
  const { stocks, prices } = useLoaderData<typeof loader>();
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? stocks.filter(
        (s) =>
          s.code.includes(query) ||
          s.name.includes(query) ||
          s.industry.includes(query)
      )
    : stocks;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          銘柄一覧
        </h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {filtered.length} / {stocks.length} 件
        </span>
      </div>

      {/* 検索バー */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="証券コード・銘柄名・業種で検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* テーブル */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 w-24">
                  証券コード
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  銘柄名
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden md:table-cell">
                  業種
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                  市場
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                  現在値
                </th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-12 text-gray-400 dark:text-gray-500"
                  >
                    該当する銘柄がありません
                  </td>
                </tr>
              ) : (
                filtered.map((stock) => {
                  const p = prices[stock.code];
                  return (
                    <tr
                      key={stock.code}
                      className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-medium text-gray-700 dark:text-gray-200">
                        {stock.code}
                      </td>
                      <td className="px-4 py-3 text-gray-800 dark:text-gray-100">
                        {stock.name}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {stock.industry}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                        {stock.market ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {p ? (
                          <>
                            <span className="font-medium text-gray-800 dark:text-gray-100">
                              {fmtPrice(p.current_price)}
                            </span>
                            <br />
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              ({fmtDate(p.trade_date)})
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/stocks/${stock.code}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium"
                        >
                          詳細 →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
