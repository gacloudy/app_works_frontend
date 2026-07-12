import { backendFetch } from "../utils/backend.server";
import type { PriceRecord } from "../components/StockPriceChart";

/**
 * チャット画面からクライアント側で株価履歴を取得するためのリソースルート。
 * backendFetch はサーバー専用（GCPのIDトークン付与など）のため、ブラウザから
 * 直接バックエンドを叩けず、このルート経由でプロキシする。
 */
export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const days = url.searchParams.get("days") ?? "60";

  if (!code) {
    return Response.json([] satisfies PriceRecord[]);
  }

  const res = await backendFetch(`/api/v1/stock-price/${code}/history?days=${days}`);
  if (!res.ok) {
    return Response.json([] satisfies PriceRecord[]);
  }

  const history: PriceRecord[] = await res.json();
  return Response.json(history);
}
