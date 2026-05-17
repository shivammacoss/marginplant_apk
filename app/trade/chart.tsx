import { ChartScreen } from "@features/charts/screens/ChartScreen";
import { ErrorBoundary } from "@shared/components/ErrorBoundary";

// Wrap the chart screen in its OWN ErrorBoundary so any render-phase
// throw on this complex screen (WebView lib failure, ticker store
// corruption, charts library missing on the CDN, etc.) shows the
// recoverable "Something went wrong → Reload" UI from
// shared/components/ErrorBoundary instead of a fully black screen.
// The root-level ErrorBoundary in app/_layout.tsx is a safety net for
// crashes BELOW this one — but unmounting/remounting the chart screen
// via this nested boundary recovers without losing the whole app.
export default function TradeChartRoute() {
  return (
    <ErrorBoundary>
      <ChartScreen />
    </ErrorBoundary>
  );
}
