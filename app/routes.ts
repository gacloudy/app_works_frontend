import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/layout.tsx", [
    index("routes/dashboard.tsx"),
    route("stocks", "routes/stocks.tsx"),
    route("stocks/:code", "routes/stocks.$code.tsx"),
    route("chart", "routes/chart.tsx"),
  ]),
] satisfies RouteConfig;
