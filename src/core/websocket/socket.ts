import { log } from "@shared/utils/logger";

type Listener = (msg: unknown) => void;

export interface SocketOptions {
  url: string;
  protocols?: string | string[];
  heartbeatMs?: number;
  maxBackoffMs?: number;
  staleAfterMs?: number;
}

export class ReconnectingSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private opens = new Set<() => void>();
  private closes = new Set<() => void>();
  private attempt = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private staleTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  private lastRxAt = 0;

  constructor(private opts: SocketOptions) {}

  connect(): void {
    this.closedByUser = false;
    this.open();
  }

  close(): void {
    this.closedByUser = true;
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
  }

  send(payload: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(typeof payload === "string" ? payload : JSON.stringify(payload));
  }

  onMessage(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  onOpen(l: () => void): () => void {
    this.opens.add(l);
    return () => this.opens.delete(l);
  }
  onClose(l: () => void): () => void {
    this.closes.add(l);
    return () => this.closes.delete(l);
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private open(): void {
    try {
      this.ws = new WebSocket(this.opts.url, this.opts.protocols);
    } catch (e) {
      log.warn("ws ctor failed", e);
      this.scheduleReconnect();
      return;
    }
    this.ws.onopen = () => {
      this.attempt = 0;
      this.lastRxAt = Date.now();
      this.startHeartbeat();
      this.opens.forEach((cb) => cb());
    };
    this.ws.onmessage = (ev) => {
      this.lastRxAt = Date.now();
      let parsed: unknown = ev.data;
      try {
        parsed = JSON.parse(ev.data as string);
      } catch {
        /* keep raw */
      }
      this.listeners.forEach((l) => l(parsed));
    };
    this.ws.onerror = (e) => log.warn("ws error", e);
    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.closes.forEach((cb) => cb());
      if (!this.closedByUser) this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    const max = this.opts.maxBackoffMs ?? 15_000;
    const wait = Math.min(max, 500 * 2 ** this.attempt++);
    setTimeout(() => this.open(), wait);
  }

  private startHeartbeat(): void {
    const ms = this.opts.heartbeatMs ?? 25_000;
    const stale = this.opts.staleAfterMs ?? 60_000;
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "ping", ts: Date.now() });
      if (Date.now() - this.lastRxAt > stale) {
        log.warn("ws stale; forcing reconnect");
        this.ws?.close();
      }
    }, ms);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.heartbeatTimer = null;
    this.staleTimer = null;
  }
}
