// Trade tab — renders the chart screen INSIDE the tab stack so the bottom
// tab bar stays visible while the user looks at a chart. Previously this
// route redirected to `/trade/chart` which lives outside `(tabs)`, so the
// tab bar disappeared the moment the user tapped a stock anywhere in the
// app. Keeping the chart inside `(tabs)` means tap-from-market still
// shows Home / Market / Orders / Position pills at the bottom.
//
// The legacy `app/trade/[symbol].tsx` route still exists for deep links
// (notifications, etc.) — it renders the same ChartScreen but without the
// tab bar overlay.
export { ChartScreen as default } from "@features/charts/screens/ChartScreen";
