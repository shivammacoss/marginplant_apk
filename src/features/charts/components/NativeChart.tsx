import { memo, useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@core/api/client";
import { unwrap } from "@core/api/errors";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { useThemeStore } from "@shared/store/theme.store";
import { useTickerStore } from "@features/trade/store/ticker.store";
import { marketdata } from "@features/trade/services/marketdata.service";
import { daysForInterval } from "@features/charts/hooks/useHistory";

// Lightweight Charts (https://github.com/tradingview/lightweight-charts) is
// TradingView's free, open-source, MIT-licensed charting library — ~35KB
// gzipped. Loaded from unpkg's CDN inside a WebView so we get full HTML5
// canvas candles for ANY token the backend exposes a /history endpoint for —
// including options/futures that the public TradingView widget can't
// resolve. This is the workaround for the "chart shows wrong instrument when
// I open an option" bug. The bhartfunded app uses the full (licensed)
// Charting Library; we use Lightweight which is free and good enough for the
// candle + live-tick use case.
const LIGHTWEIGHT_CHARTS_URL =
  "https://unpkg.com/lightweight-charts@4.2.3/dist/lightweight-charts.standalone.production.js";

export type ChartInterval = "1" | "5" | "15" | "60" | "1D";

interface Candle {
  time: number; // unix seconds (Lightweight Charts spec)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface BackendCandle {
  date?: string;
  time?: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Props {
  token: string;
  interval?: ChartInterval;
  /** Optional symbol label shown in the chart's overlay. */
  displaySymbol?: string;
}

function toApiInterval(i: ChartInterval): string {
  switch (i) {
    case "1":
      return "minute";
    case "5":
      return "5minute";
    case "15":
      return "15minute";
    case "60":
      return "60minute";
    case "1D":
      return "day";
  }
}

function toUnixSec(input: string | number | undefined): number {
  if (input == null) return 0;
  if (typeof input === "number") {
    return input > 1e12 ? Math.floor(input / 1000) : Math.floor(input);
  }
  const ms = new Date(input).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function useHistory(token: string, interval: ChartInterval) {
  return useQuery<Candle[]>({
    queryKey: ["history", token, interval],
    queryFn: async () => {
      const rows = await unwrap<BackendCandle[]>(
        // Lookback window scales with the interval — 5m wants ~3 weeks of
        // context, 1D wants ~2 years. Previously hardcoded `days: 5` so
        // daily-interval charts had only 5 candles and 5m charts on fresh
        // option contracts came back nearly empty.
        api.get(`/user/instruments/${encodeURIComponent(token)}/history`, {
          params: {
            interval: toApiInterval(interval),
            days: daysForInterval(interval),
          },
        }),
      );
      return rows
        .map((r) => ({
          time: toUnixSec(r.date ?? r.time),
          open: Number(r.open) || 0,
          high: Number(r.high) || 0,
          low: Number(r.low) || 0,
          close: Number(r.close) || 0,
          volume: r.volume != null ? Number(r.volume) : undefined,
        }))
        .filter((c) => c.time > 0);
    },
    enabled: !!token,
    staleTime: 30_000,
    retry: 1,
    // Keep the previous interval's candles visible while a new interval
    // fetch is in flight — eliminates the "blank chart for a beat" the
    // user saw on every timeframe tap.
    placeholderData: keepPreviousData,
  });
}

function buildHtml(args: {
  bg: string;
  text: string;
  grid: string;
  upColor: string;
  downColor: string;
}): string {
  const { bg, text, grid, upColor, downColor } = args;
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<style>
  html,body { margin:0; padding:0; height:100%; background:${bg}; -webkit-tap-highlight-color: transparent; }
  #chart { position:absolute; inset:0; }
  #status { position:absolute; top:8px; left:8px; right:8px; color:${text};
    font: 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    pointer-events:none; opacity:0.85; }
  #err { position:absolute; bottom:8px; left:8px; right:8px; color:${downColor};
    font: 11px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    pointer-events:none; opacity:0.9; }
</style>
</head>
<body>
<div id="chart"></div>
<div id="status"></div>
<div id="err"></div>
<script src="${LIGHTWEIGHT_CHARTS_URL}"
  onerror="document.getElementById('err').textContent='Chart library failed to load. Check internet.'"></script>
<script>
(function(){
  function post(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){}}
  function waitForLib(cb, tries){
    if (typeof LightweightCharts !== 'undefined') return cb();
    if ((tries||0) > 100) { post({type:'libFailed'}); return; }
    setTimeout(function(){ waitForLib(cb, (tries||0)+1); }, 50);
  }

  var chart = null;
  var candleSeries = null;
  var lastBar = null; // {time, open, high, low, close}

  waitForLib(function(){
    var el = document.getElementById('chart');
    chart = LightweightCharts.createChart(el, {
      layout: { background: { type:'solid', color:'${bg}' }, textColor:'${text}' },
      grid: { vertLines:{ color:'${grid}' }, horzLines:{ color:'${grid}' } },
      rightPriceScale: { borderColor:'${grid}' },
      timeScale: { borderColor:'${grid}', timeVisible:true, secondsVisible:false },
      crosshair: { mode: 0 },
      autoSize: true,
    });
    candleSeries = chart.addCandlestickSeries({
      upColor: '${upColor}', borderUpColor:'${upColor}', wickUpColor:'${upColor}',
      downColor: '${downColor}', borderDownColor:'${downColor}', wickDownColor:'${downColor}',
    });
    post({type:'ready'});
  });

  // Bridged from RN.
  window.__setBars = function(bars){
    if (!candleSeries) return;
    candleSeries.setData(bars || []);
    lastBar = (bars && bars.length) ? Object.assign({}, bars[bars.length-1]) : null;
    if (lastBar) {
      try { chart.timeScale().scrollToPosition(0, false); } catch(_) {}
    }
    post({type:'bars', count:(bars||[]).length});
  };

  // Apply a live tick to the latest bar. The host computes which interval
  // we're on; here we just continue the last bar's OHLC (or extend it).
  window.__tick = function(price){
    if (!candleSeries || !lastBar) return;
    var p = Number(price);
    if (!isFinite(p) || p <= 0) return;
    lastBar.high = Math.max(lastBar.high, p);
    lastBar.low  = Math.min(lastBar.low, p);
    lastBar.close = p;
    candleSeries.update(lastBar);
  };

  window.__setStatus = function(s){
    var n = document.getElementById('status');
    if (n) n.textContent = s || '';
  };
})();
true;
</script>
</body></html>`;
}

function NativeChartImpl({ token, interval = "5", displaySymbol }: Props) {
  const wv = useRef<WebView>(null);
  const ready = useRef(false);
  const pendingBars = useRef<Candle[] | null>(null);

  const { data: history, isLoading, isError, error } = useHistory(token, interval);

  // Live ticker subscription so the latest bar updates tick-to-tick.
  const tick = useTickerStore((s) => s.ticks[token]);
  useEffect(() => {
    if (!token) return;
    marketdata.subscribe([token]);
    return () => marketdata.unsubscribe([token]);
  }, [token]);

  const themeMode = useThemeStore((s) => s.resolved);
  const html = useMemo(
    () =>
      buildHtml({
        bg: colors.bg,
        text: colors.text,
        grid: colors.border,
        upColor: colors.buy,
        downColor: colors.sell,
      }),
    [themeMode],
  );

  // Push bars to WebView once both the chart is ready and history loaded.
  useEffect(() => {
    const bars = history ?? null;
    if (!bars || !wv.current) return;
    if (!ready.current) {
      pendingBars.current = bars;
      return;
    }
    const payload = JSON.stringify(bars);
    wv.current.injectJavaScript(`window.__setBars(${payload});true;`);
  }, [history]);

  // Live tick → update last bar.
  useEffect(() => {
    if (!ready.current || !wv.current || !tick?.ltp) return;
    wv.current.injectJavaScript(`window.__tick(${Number(tick.ltp)});true;`);
  }, [tick?.ltp]);

  // Status line in WebView shows symbol + last tick time so the chart
  // visibly reacts even before the first historical fetch lands.
  useEffect(() => {
    if (!ready.current || !wv.current) return;
    const label = displaySymbol ?? token;
    const ltpStr =
      tick?.ltp != null ? `  ·  ${Number(tick.ltp).toFixed(2)}` : "";
    const safe = `${label}${ltpStr}`.replace(/`/g, "");
    wv.current.injectJavaScript(`window.__setStatus(\`${safe}\`);true;`);
  }, [displaySymbol, token, tick?.ltp]);

  function onMessage(e: WebViewMessageEvent) {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { type?: string };
      if (m.type === "ready") {
        ready.current = true;
        if (pendingBars.current && wv.current) {
          const payload = JSON.stringify(pendingBars.current);
          wv.current.injectJavaScript(`window.__setBars(${payload});true;`);
          pendingBars.current = null;
        }
      }
    } catch {
      /* noop */
    }
  }

  const noCandles =
    !isLoading && !isError && (history?.length ?? 0) === 0;

  return (
    <View style={styles.root}>
      <WebView
        ref={wv}
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://localhost/" }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        // Block navigation outside the WebView — only the CDN script tag is
        // allowed to load, taps don't navigate away.
        onShouldStartLoadWithRequest={(req) =>
          req.url.startsWith("https://localhost/") ||
          req.url.startsWith("about:") ||
          req.url.includes("lightweight-charts")
        }
        androidLayerType="hardware"
        style={styles.web}
      />
      {isLoading ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
          <Text tone="muted" size="xs" style={{ marginTop: 6 }}>
            Loading candles…
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text tone="sell" size="sm">
            {(error as Error)?.message ?? "Couldn't load chart"}
          </Text>
        </View>
      ) : noCandles ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text tone="muted" size="sm">
            No candles available for this contract yet
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  web: { flex: 1, backgroundColor: colors.bg },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});

export const NativeChart = memo(NativeChartImpl);
