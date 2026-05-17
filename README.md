# MarginPlant Mobile (Expo)

Native Android/iOS client for the MarginPlant B-Book trading platform. Talks to the same FastAPI backend as `marginplant_ind/frontend-user` (`/api/v1/user/*`, `/ws/user/{id}`, `/ws/marketdata`).

## Stack

- **Expo SDK 52** with the New Architecture (Fabric + TurboModules) and Hermes
- **Expo Router 4** — file-based routing with typed routes
- **TanStack Query** + **Zustand** — server state + tiny client stores
- **react-native-mmkv** — sync, ~30× faster than AsyncStorage (used for ticker cache, user data); **expo-secure-store** holds refresh token only
- **react-hook-form + Zod** — form layer with backend-shared validation rules (PAN/IFSC/Aadhaar)
- **@shopify/flash-list** — recycled lists for orders/trades/depth
- **react-native-reanimated 3** — animations on UI thread (LTP flash, sheets)
- **react-native-wagmi-charts** — Skia-based charts, 60fps with 10k candles
- **decimal.js** — money math; never floats (mirrors backend `Decimal128`)

## Conventions

- **Every file ≤ 200 LOC.** Split components aggressively; this is enforced by review, not lint.
- **Money:** `@/utils/decimal.ts` — `toDecimal()`, `quantizeMoney()`. Never `parseFloat` a price.
- **Theme tokens:** colors/spacing/typography from `@/theme`. Hardcoded hex banned outside `@/theme/colors.ts`.
- **API:** all calls go through `@/api/client.ts` (axios + single-flight refresh + `ApiError` unwrap). Mirrors web pattern.
- **WS:** subscribe via `@/hooks/useTicker(symbol)`. Ticks are coalesced to 60fps in `@/ws/tickThrottle.ts`.
- **Optimistic order placement:** `usePlaceOrder` merges into Zustand `ordersStore` then pauses polling 3s (same fix as web commits `6da10cb`, `0be5a0d`, `891d668`).

## Quickstart

```bash
# 1. Install
npm install

# 2. Configure env (Android emulator points host at 10.0.2.2)
cp .env.example .env

# 3. Run with dev client (required — MMKV + reanimated are native modules)
npx expo prebuild
npm run android

# Or build a shareable APK
npm run build:dev       # development APK
npm run build:preview   # internal preview APK
npm run build:prod      # production AAB
```

> **Why no Expo Go:** `react-native-mmkv`, `expo-local-authentication`, and the Reanimated worklets need a custom dev client. First run takes ~5 min; after that it's HMR.

## Folder map

```
app/         Routes (file-based, code-split per route)
src/
  api/       REST client + endpoint modules
  ws/        WebSocket clients (marketdata, user)
  stores/    Zustand slices (auth, ticker, orders, ui)
  queries/   React Query hooks + mutations
  components/  ui/ trade/ chart/ orders/ portfolio/ wallet/ auth/ kyc/ layout/
  forms/     RHF + Zod schemas
  hooks/     useTicker, useAuth, useNetworkState, useBiometric, ...
  utils/     decimal, format, validators, time, storage, logger
  theme/     colors, spacing, typography, shadows, radii
  types/     api, instrument, order, position, wallet, user, ws
  providers/ AppProviders (composes query/theme/auth/ws/toast)
  config/    env, queryClient
```

## 5M concurrent users — what makes it not lag

1. **WS tick coalescing** to a single 16ms flush — UI thread is never starved even at 100Hz feed.
2. **`tickerStore`** is a flat `Map<symbol, Tick>`; rows subscribe to **only their symbol** via selector. No global re-render storm.
3. **FlashList** for orders/positions/depth — recycled cells, constant memory regardless of count.
4. **MMKV** for hot reads (user, watchlist, last LTP snapshot) — sync access, no Promise overhead.
5. **Optimistic updates + polling pause** — no flicker on order placement.
6. **Hermes precompiled bytecode** + production minification — cold start ~1.2s on mid-range Android.
7. **Code-split routes** — only the screen you open is parsed.
