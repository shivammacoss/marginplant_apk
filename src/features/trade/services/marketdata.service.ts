import { env } from "@core/config/env";
import { ReconnectingSocket } from "@core/websocket/socket";
import { createBatcher } from "@core/websocket/tickThrottle";
import { useTickerStore } from "@features/trade/store/ticker.store";
import { getAccessToken } from "@core/api/tokens";
import { log } from "@shared/utils/logger";
import type { Tick } from "@features/trade/types/instrument.types";

interface BackendQuote {
  token: string;
  ltp: number;
  open?: number;
  high?: number;
  low?: number;
  prev_close?: number;
  change: number;
  change_pct: number;
  volume?: number;
  bid?: number;
  ask?: number;
  ts?: number;
}

function toTick(q: BackendQuote): Tick {
  return {
    symbol: q.token,
    ltp: q.ltp,
    change: q.change ?? 0,
    change_pct: q.change_pct ?? 0,
    volume: q.volume,
    bid: q.bid,
    ask: q.ask,
    // Pass intraday OHLC straight through — backend's /ws/marketdata pump
    // calls `market_data_service.get_quote()` which embeds open/high/low/
    // prev_close in every push (Zerodha full-mode quotes for NSE/NFO/MCX,
    // Infoway snapshot for crypto/forex/metals). Earlier we dropped these
    // fields on the floor → TradeSheet's "LTP High / Low / Open" tiles
    // stayed at "—" forever because they had no fallback besides the
    // /quote REST poll. Now the WS hydrates them tick-by-tick.
    open: q.open,
    high: q.high,
    low: q.low,
    close: q.prev_close,
    ts: q.ts ?? Date.now(),
  };
}

let socket: ReconnectingSocket | null = null;
const batcher = createBatcher<Tick>((batch) => {
  useTickerStore.getState().setManyTicks(batch);
});
const subscribed = new Set<string>();

function buildUrl(): string {
  const token = getAccessToken();
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${env.WS_URL}/ws/marketdata${qs}`;
}

function ensureSocket(): ReconnectingSocket {
  if (socket) return socket;
  socket = new ReconnectingSocket({
    url: buildUrl(),
    heartbeatMs: 20_000,
    staleAfterMs: 45_000,
    maxBackoffMs: 15_000,
  });
  socket.onOpen(() => {
    log.info("marketdata ws open");
    if (subscribed.size > 0) {
      socket?.send({ type: "subscribe", tokens: Array.from(subscribed) });
    }
  });
  socket.onMessage((msg) => {
    if (!msg || typeof msg !== "object") return;
    const m = msg as { type?: string; payload?: BackendQuote[]; message?: string };
    if ((m.type === "tick" || m.type === "snapshot") && Array.isArray(m.payload)) {
      for (const q of m.payload) {
        if (q && typeof q.token === "string") batcher.push(toTick(q));
      }
    } else if (m.type === "error") {
      log.warn("marketdata err", m.message);
    }
  });
  socket.onClose(() => log.info("marketdata ws closed"));
  socket.connect();
  return socket;
}

export const marketdata = {
  subscribe(tokens: string[]): void {
    const s = ensureSocket();
    const next = tokens.filter((t) => !subscribed.has(t));
    next.forEach((t) => subscribed.add(t));
    if (next.length > 0) s.send({ type: "subscribe", tokens: next });
  },

  unsubscribe(tokens: string[]): void {
    const next = tokens.filter((t) => subscribed.has(t));
    next.forEach((t) => subscribed.delete(t));
    if (next.length > 0) socket?.send({ type: "unsubscribe", tokens: next });
  },

  disconnect(): void {
    socket?.close();
    socket = null;
    subscribed.clear();
    batcher.clear();
  },

  isConnected(): boolean {
    return !!socket?.isOpen();
  },
};
