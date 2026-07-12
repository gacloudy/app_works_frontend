import { useLoaderData } from "react-router";
import { backendFetch } from "../utils/backend.server";
import { StockPriceChart, type StockOption } from "../components/StockPriceChart";

export function meta() {
  return [{ title: "株価チャート | 株価分析" }];
}

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const days = Number(url.searchParams.get("days") ?? 60);

  const stocksRes = await backendFetch("/api/v1/stock-master/?is_delisted=false");
  if (!stocksRes.ok) throw new Response("銘柄一覧の取得に失敗", { status: stocksRes.status });
  const stocks: StockOption[] = await stocksRes.json();

  return { stocks, code, days };
}

export default function Chart() {
  const { stocks, code, days } = useLoaderData<typeof loader>();

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
        株価チャート
      </h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <StockPriceChart stocks={stocks} initialCode={code} initialDays={days} />
      </div>
    </div>
  );
}
