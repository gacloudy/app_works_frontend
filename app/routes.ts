import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/chat.tsx"),
  route("api/price-history", "routes/api.price-history.tsx"),
  layout("routes/layout.tsx", [
    route("dashboard", "routes/dashboard.tsx"),
    route("market", "routes/market.tsx"),
    route("disclosures", "routes/disclosures.tsx"),
    route("stocks", "routes/stocks.tsx"),
    route("stocks/:code", "routes/stocks.$code.tsx"),
    route("chart", "routes/chart.tsx"),
  ]),
] satisfies RouteConfig;
