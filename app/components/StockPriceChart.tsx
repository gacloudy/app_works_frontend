import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  type IChartApi,
} from "lightweight-charts";

export interface PriceRecord {
  code: string;
  trade_date: string;
  current_price: string | null;
  open_price: string | null;
  high_price: string | null;
  low_price: string | null;
  volume: number | null;
}

export interface StockOption {
  code: string;
  name: string;
  industry?: string;
  market?: string | null;
}

export const MA_COLORS = ["#f59e0b", "#8b5cf6", "#10b981"] as const;

const PERIOD_OPTIONS = [
  { label: "30営業日",  days: 30  },
  { label: "60営業日",  days: 60  },
  { label: "90営業日",  days: 90  },
  { label: "180営業日", days: 180 },
  { label: "1年",       days: 252 },
] as const;

const MA_OPTIONS = [0, ...Array.from({ length: 50 }, (_, i) => i + 1)]; // 0 = なし

function calcMA(
  data: { time: string; value: number }[],
  period: number
): { time: string; value: number }[] {
  const result: { time: string; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    result.push({
      time: data[i].time,
      value: slice.reduce((sum, d) => sum + d.value, 0) / period,
    });
  }
  return result;
}

interface StockPriceChartProps {
  /** 初期選択銘柄コード。以降の銘柄切り替えは内部状態で完結する。 */
  initialCode?: string;
  initialDays?: number;
  /** 移動平均線の期間設定（最大3本）。0 は「なし」を表す。 */
  initialMaSettings?: number[];
  /** 指定した場合のみ銘柄選択セレクトボックスを表示する。 */
  stocks?: StockOption[];
  priceHeight?: number;
  volumeHeight?: number;
}

const selectClass =
  "border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm " +
  "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500";

/**
 * 銘柄選択・期間選択・移動平均選択のツールバーと、ロウソク足＋出来高チャートを
 * まとめた自己完結コンポーネント。データ取得（/api/price-history）も内部で行う。
 * `/chart` ページとチャットのチャート表示の両方で共有する。
 */
export function StockPriceChart({
  initialCode = "",
  initialDays = 60,
  initialMaSettings = [5, 25, 0],
  stocks,
  priceHeight = 360,
  volumeHeight = 140,
}: StockPriceChartProps) {
  const [code, setCode] = useState(initialCode);
  const [days, setDays] = useState(initialDays);
  const [maSettings, setMaSettings] = useState<number[]>(initialMaSettings);

  const fetcher = useFetcher<PriceRecord[]>();

  useEffect(() => {
    if (!code) return;
    fetcher.load(`/api/price-history?code=${code}&days=${days}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, days]);

  const history = fetcher.data ?? [];

  const priceRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const priceChartRef = useRef<IChartApi | null>(null);
  const volumeChartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maSeriesRefs = useRef<(any | null)[]>([null, null, null]);

  // ── チャート本体（ロウソク足 + 出来高）: history が変わった時のみ再生成
  useEffect(() => {
    const priceContainer = priceRef.current;
    const volumeContainer = volumeRef.current;

    priceChartRef.current?.remove();
    volumeChartRef.current?.remove();
    priceChartRef.current = null;
    volumeChartRef.current = null;
    maSeriesRefs.current = [null, null, null]; // 古いチャートのMA参照をクリア

    if (!priceContainer || !volumeContainer || !history.length) return;

    const isDark = document.documentElement.classList.contains("dark");
    const bg = isDark ? "#1f2937" : "#ffffff";
    const text = isDark ? "#d1d5db" : "#374151";
    const grid = isDark ? "#374151" : "#f3f4f6";
    const border = isDark ? "#4b5563" : "#e5e7eb";
    const w = priceContainer.clientWidth;

    const baseLayout = {
      layout: { background: { type: ColorType.Solid, color: bg }, textColor: text },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border, timeVisible: true },
    };

    const priceChart = createChart(priceContainer, {
      ...baseLayout,
      width: w,
      height: priceHeight,
      timeScale: { ...baseLayout.timeScale, visible: false },
    });
    priceChartRef.current = priceChart;

    const hasOhlc = history.some(
      (d) => d.open_price !== null && d.high_price !== null && d.low_price !== null
    );

    if (hasOhlc) {
      const candle = priceChart.addSeries(CandlestickSeries, {
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderVisible: false,
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
      });
      candle.setData(
        history
          .filter((d) => d.open_price && d.high_price && d.low_price && d.current_price)
          .map((d) => ({
            time: d.trade_date,
            open: parseFloat(d.open_price!),
            high: parseFloat(d.high_price!),
            low: parseFloat(d.low_price!),
            close: parseFloat(d.current_price!),
          }))
      );
    } else {
      const line = priceChart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 2 });
      line.setData(
        history
          .filter((d) => d.current_price !== null)
          .map((d) => ({ time: d.trade_date, value: parseFloat(d.current_price!) }))
      );
    }

    const volumeChart = createChart(volumeContainer, {
      ...baseLayout,
      width: w,
      height: volumeHeight,
    });
    volumeChartRef.current = volumeChart;

    const volSeries = volumeChart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
    });
    volSeries.setData(
      history
        .filter((d) => d.volume !== null)
        .map((d) => {
          const isUp =
            d.current_price && d.open_price
              ? parseFloat(d.current_price) >= parseFloat(d.open_price)
              : true;
          return { time: d.trade_date, value: d.volume!, color: isUp ? "#26a69a" : "#ef5350" };
        })
    );

    priceChart.timeScale().fitContent();
    volumeChart.timeScale().fitContent();

    let fromPrice = false,
      fromVolume = false;
    priceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (fromVolume || !range) return;
      fromPrice = true;
      volumeChart.timeScale().setVisibleLogicalRange(range);
      fromPrice = false;
    });
    volumeChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (fromPrice || !range) return;
      fromVolume = true;
      priceChart.timeScale().setVisibleLogicalRange(range);
      fromVolume = false;
    });

    const ro = new ResizeObserver(() => {
      const newW = priceContainer.clientWidth;
      priceChart.applyOptions({ width: newW });
      volumeChart.applyOptions({ width: newW });
    });
    ro.observe(priceContainer);

    return () => {
      ro.disconnect();
      priceChart.remove();
      volumeChart.remove();
      priceChartRef.current = null;
      volumeChartRef.current = null;
      maSeriesRefs.current = [null, null, null];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, priceHeight, volumeHeight]);

  // ── 移動平均線: maSettings か history が変わった時に差し替え
  useEffect(() => {
    const chart = priceChartRef.current;

    // 既存のMA線を削除
    maSeriesRefs.current.forEach((s, i) => {
      if (s && chart) {
        try {
          chart.removeSeries(s);
        } catch (_) {
          /* チャートが既に破棄済みの場合は無視 */
        }
      }
      maSeriesRefs.current[i] = null;
    });

    if (!chart || !history.length) return;

    const closeData = history
      .filter((d) => d.current_price !== null)
      .map((d) => ({ time: d.trade_date, value: parseFloat(d.current_price!) }));

    maSettings.forEach((period, i) => {
      if (period === 0) return;
      const maData = calcMA(closeData, period);
      if (!maData.length) return;

      const s = chart.addSeries(LineSeries, {
        color: MA_COLORS[i],
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(maData);
      maSeriesRefs.current[i] = s;
    });
  }, [history, maSettings]);

  const selectedStock = stocks?.find((s) => s.code === code);

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center mb-3">
        {stocks && (
          <select
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${selectClass} w-full sm:w-72`}
          >
            <option value="">銘柄を選択してください</option>
            {stocks.map((s) => (
              <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
            ))}
          </select>
        )}

        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className={selectClass}
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.days} value={o.days}>{o.label}</option>
          ))}
        </select>

        {maSettings.map((val, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-lg leading-none" style={{ color: MA_COLORS[i] }}>●</span>
            <select
              value={val}
              onChange={(e) => {
                const next = [...maSettings];
                next[i] = Number(e.target.value);
                setMaSettings(next);
              }}
              className={selectClass}
            >
              <option value={0}>なし</option>
              {MA_OPTIONS.slice(1).map((n) => (
                <option key={n} value={n}>{n}日</option>
              ))}
            </select>
          </div>
        ))}

        {selectedStock && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {selectedStock.industry}{selectedStock.market ? ` / ${selectedStock.market}` : ""}
          </span>
        )}
      </div>

      {!code ? (
        <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-500 text-sm">
          銘柄を選択するとチャートが表示されます
        </div>
      ) : !fetcher.data ? (
        <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-500 text-sm">
          読み込み中...
        </div>
      ) : history.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-500 text-sm">
          株価データがありません
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            直近 {history.length} 営業日
          </p>
          <div ref={priceRef} className="w-full" />
          <div className="border-t border-gray-200 dark:border-gray-600" />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 mb-1">出来高</p>
          <div ref={volumeRef} className="w-full" />
        </>
      )}
    </div>
  );
}
