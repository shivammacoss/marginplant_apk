import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { useThemeStore } from "@shared/store/theme.store";
import { useTicker } from "@features/trade/hooks/useTicker";
import { useHistory, type ChartInterval } from "@features/charts/hooks/useHistory";

// What we need from the user-facing TradingView Charting Library: real
// candles for any symbol on the platform (Indian indices/equity, F&O,
// MCX commodities, forex, crypto), an interval switcher and live updates.
// The previous build used TradingView's free `tv.js` widget which only
// supports a small whitelist of symbols. The licensed Charting Library
// would solve that but needs hosting + a TV licence.
//
// This component uses **TradingView Lightweight Charts** — free,
// MIT-style licence, ~36 KB — loaded from unpkg in the WebView. Candle
// data comes from our own backend via `useHistory` (React Query cached,
// gcTime 5 min, so chart re-opens paint from memory). Live ticks are
// forwarded from the existing RN ticker store via `webview.postMessage`.

export interface TradingViewChartProps {
  token: string;
  symbol?: string;
  /**
   * Controlled chart interval — owned by ChartScreen so a single
   * timeframe bar at the screen level drives both this WebView chart
   * and the NativeChart used for derivatives.
   */
  interval: ChartInterval;
}

function intervalSeconds(i: ChartInterval): number {
  switch (i) {
    case "1": return 60;
    case "5": return 300;
    case "15": return 900;
    case "60": return 3600;
    case "1D": return 86400;
  }
}

function buildHtml(theme: "light" | "dark"): string {
  const bg = theme === "dark" ? "#0d0d0d" : "#ffffff";
  const grid = theme === "dark" ? "#1f1f1f" : "#e4e4e7";
  const text = theme === "dark" ? "#d4d4d8" : "#3f3f46";
  const upColor = "#22C55E";
  const downColor = "#EF4444";
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body,#wrap{width:100%;height:100%;background:${bg};color:${text};font-family:system-ui,-apple-system,Roboto,sans-serif;overflow:hidden}
  #chart{position:absolute;inset:0}
</style>
</head>
<body>
<div id="wrap"><div id="chart"></div></div>
<script src="https://unpkg.com/lightweight-charts@4.2.3/dist/lightweight-charts.standalone.production.js"
  onerror="postMessage({type:'libFailed'})"></script>
<script>
function postMessage(o){
  try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch(e) {}
}
window.addEventListener('error', function(e){
  postMessage({type:'jsError', message: (e && e.message) || 'error'});
});

var chart = null;
var candleSeries = null;
var lastBar = null;        // most recent bar; anchor for live tick aggregation
var intervalSec = 300;     // default 5m; updated when bars load
var pendingBars = null;    // bars that arrived before lib finished loading
var pendingInterval = null;
var pendingTheme = null;

function ensureChart(){
  if (chart) return;
  if (!window.LightweightCharts) { postMessage({type:'libFailed'}); return; }
  chart = LightweightCharts.createChart(document.getElementById('chart'), {
    layout: { background: { type: 'solid', color: '${bg}' }, textColor: '${text}' },
    grid:   { vertLines: { color: '${grid}' }, horzLines: { color: '${grid}' } },
    crosshair: { mode: 1 },
    rightPriceScale: { borderColor: '${grid}' },
    timeScale: { borderColor: '${grid}', timeVisible: true, secondsVisible: false },
    handleScroll: true,
    handleScale: true,
    autoSize: true,
  });
  candleSeries = chart.addCandlestickSeries({
    upColor: '${upColor}',
    downColor: '${downColor}',
    borderUpColor: '${upColor}',
    borderDownColor: '${downColor}',
    wickUpColor: '${upColor}',
    wickDownColor: '${downColor}',
  });
  postMessage({type:'ready'});
  // Drain anything queued before the lib was ready.
  if (pendingBars) { setBars(pendingBars, pendingInterval); pendingBars = null; }
  if (pendingTheme) { applyTheme(pendingTheme); pendingTheme = null; }
}

if (window.LightweightCharts) ensureChart();
else window.addEventListener('load', function(){ setTimeout(ensureChart, 30); });

function setBars(bars, sec){
  if (!chart || !candleSeries) { pendingBars = bars; pendingInterval = sec; return; }
  intervalSec = sec || 300;
  candleSeries.setData(bars || []);
  lastBar = (bars && bars.length) ? bars[bars.length - 1] : null;
  if (bars && bars.length) {
    chart.timeScale().fitContent();
    // Snap to the right edge so the user lands on the latest candle
    // (and so subsequent live ticks visibly grow the right-most bar
    // instead of being clipped off-screen).
    chart.timeScale().scrollToRealTime();
  }
}

function applyTick(price, ts){
  if (!candleSeries) return;
  if (price == null || !isFinite(price)) return;
  var nowSec = Math.floor((ts || Date.now()) / 1000);
  var bucket = Math.floor(nowSec / intervalSec) * intervalSec;
  // No anchor yet (history was empty or hadn't loaded yet) — bootstrap
  // the chart from this tick so options strikes / freshly-listed
  // instruments still show live candles. Without this branch the chart
  // sat empty forever when /history returned [].
  if (!lastBar) {
    lastBar = { time: bucket, open: price, high: price, low: price, close: price };
    candleSeries.update(lastBar);
    chart.timeScale().scrollToRealTime();
    return;
  }
  if (bucket <= lastBar.time) {
    // Same bucket as the latest bar — extend its high/low/close.
    var b = lastBar;
    b.high = Math.max(b.high, price);
    b.low  = Math.min(b.low,  price);
    b.close = price;
    candleSeries.update(b);
  } else {
    // New bucket — open a fresh bar and snap the visible window to the
    // right edge so the user actually SEES the new candle appearing.
    // Without scrollToRealTime() the chart keeps showing the old window
    // and the new candle grows off-screen.
    var nb = { time: bucket, open: price, high: price, low: price, close: price };
    lastBar = nb;
    candleSeries.update(nb);
    chart.timeScale().scrollToRealTime();
  }
}

document.addEventListener('message', function(e){ handle(e.data); });
window.addEventListener('message', function(e){ handle(e.data); });
function handle(raw){
  try {
    var msg = JSON.parse(raw);
    if (msg.type === 'bars') setBars(msg.bars, msg.intervalSec);
    else if (msg.type === 'tick') applyTick(msg.price, msg.ts);
    else if (msg.type === 'theme') applyTheme(msg.theme);
  } catch (e) {}
}

function applyTheme(t){
  if (!chart) { pendingTheme = t; return; }
  var bg = t === 'light' ? '#ffffff' : '#0d0d0d';
  var tx = t === 'light' ? '#3f3f46' : '#d4d4d8';
  var gr = t === 'light' ? '#e4e4e7' : '#1f1f1f';
  document.body.style.background = bg;
  chart.applyOptions({
    layout: { background: { type: 'solid', color: bg }, textColor: tx },
    grid: { vertLines: { color: gr }, horzLines: { color: gr } },
    rightPriceScale: { borderColor: gr },
    timeScale: { borderColor: gr },
  });
}
</script>
</body>
</html>`;
}

function TradingViewChartImpl({
  token,
  symbol,
  interval,
}: TradingViewChartProps) {
  const resolved = useThemeStore((s) => s.resolved);
  const theme: "light" | "dark" = resolved === "light" ? "light" : "dark";

  const webRef = useRef<WebView | null>(null);
  const [webReady, setWebReady] = useState(false);

  // Build the HTML once per theme — switching interval/symbol just
  // postMessages new bars; the WebView never reloads, which (a) keeps
  // the user's scroll/zoom position and (b) avoids re-downloading the
  // Lightweight Charts script.
  const html = useMemo(() => buildHtml(theme), [theme]);

  // Cached candles via React Query. `useHistory` keeps results for 5 min
  // (gcTime) so re-opening the chart for a symbol you already viewed
  // paints from memory in one frame instead of waiting on a fresh HTTP
  // round-trip. `staleTime: 60s` means we don't re-fetch on every mount.
  const history = useHistory(token, interval);
  const bars = history.data;

  const send = useCallback((payload: object) => {
    if (!webRef.current) return;
    webRef.current.postMessage(JSON.stringify(payload));
  }, []);

  // Push bars as soon as BOTH the WebView is ready AND data is in cache.
  // Whichever lands second triggers the post — usually data wins on a
  // re-open (cache hit) so the bars sit waiting and the WebView paints
  // them the instant it's ready.
  useEffect(() => {
    if (!webReady) return;
    send({
      type: "bars",
      bars: bars ?? [],
      intervalSec: intervalSeconds(interval),
    });
  }, [webReady, bars, interval, send]);

  // Push theme changes without rebuilding the WebView.
  useEffect(() => {
    if (!webReady) return;
    send({ type: "theme", theme });
  }, [theme, webReady, send]);

  // Live ticks → grow the latest bar.
  const tick = useTicker(token);
  useEffect(() => {
    if (!webReady) return;
    const ltp = tick?.ltp;
    if (ltp == null || !Number.isFinite(ltp)) return;
    send({ type: "tick", price: ltp, ts: tick?.ts ?? Date.now() });
  }, [tick?.ltp, tick?.ts, webReady, send]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === "ready") setWebReady(true);
    } catch {
      /* ignore non-JSON */
    }
  }, []);

  const loading = history.isLoading || !webReady;
  const empty = !loading && (bars?.length ?? 0) === 0;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.bg }]}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://unpkg.com/" }}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        cacheMode="LOAD_DEFAULT"
        androidLayerType="hardware"
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        startInLoadingState={false}
        onMessage={onMessage}
        style={{ flex: 1, backgroundColor: colors.bg }}
      />
      {loading ? (
        <View pointerEvents="none" style={[styles.overlay, { backgroundColor: colors.bg }]}>
          <ActivityIndicator color={colors.primary} size="large" />
          {/* Visible loading hint so a slow CDN fetch doesn't look like
              the screen has crashed. The previous "ActivityIndicator
              only" overlay on top of `colors.bg` (#0d0d0d dark mode)
              was indistinguishable from a black-screen crash on slow
              networks — the user reported it as an app crash. */}
          <Text size="sm" tone="muted" style={{ marginTop: 12, fontWeight: "600" }}>
            Loading chart…
          </Text>
        </View>
      ) : null}
      {empty ? (
        <View pointerEvents="none" style={styles.overlay}>
          <Text tone="muted" size="sm">
            No candles available for {symbol ?? token} yet
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});

export const TradingViewChart = memo(TradingViewChartImpl);
