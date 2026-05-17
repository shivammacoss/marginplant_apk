import { env } from "@core/config/env";
import { ReconnectingSocket } from "@core/websocket/socket";
import { getAccessToken } from "@core/api/tokens";
import { log } from "@shared/utils/logger";

/**
 * Per-user WebSocket — backend publishes order fills, position changes,
 * wallet balance updates and KYC status via Redis pub/sub.
 *
 * Protocol:
 *   Server → Client:
 *     {"type":"hello"}
 *     {"type":"order", "payload": Order}        — fill / cancel / reject
 *     {"type":"position", "payload": Position}  — open / update / close
 *     {"type":"wallet", "payload": Wallet}      — balance / margin change
 *     {"type":"kyc", "payload": {status}}       — KYC status update
 *     {"type":"notification", "payload": Notif} — new alert / system notice
 *   Client → Server:
 *     {"type":"ping"}
 */
export interface UserEvent {
  type: string;
  payload?: unknown;
}

type Listener = (event: UserEvent) => void;

let socket: ReconnectingSocket | null = null;
const listeners = new Set<Listener>();

function buildUrl(): string {
  const token = getAccessToken();
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${env.WS_URL}/ws/user${qs}`;
}

function ensureSocket(): ReconnectingSocket {
  if (socket) return socket;
  socket = new ReconnectingSocket({
    url: buildUrl(),
    heartbeatMs: 25_000,
    staleAfterMs: 60_000,
    maxBackoffMs: 15_000,
  });
  socket.onOpen(() => log.info("user ws open"));
  socket.onMessage((msg) => {
    if (!msg || typeof msg !== "object") return;
    const ev = msg as UserEvent;
    if (!ev.type) return;
    listeners.forEach((l) => {
      try {
        l(ev);
      } catch (e) {
        log.warn("user ws listener threw", e);
      }
    });
  });
  socket.onClose(() => log.info("user ws closed"));
  socket.connect();
  return socket;
}

export const userSocket = {
  connect(): void {
    ensureSocket();
  },
  disconnect(): void {
    socket?.close();
    socket = null;
    listeners.clear();
  },
  on(listener: Listener): () => void {
    listeners.add(listener);
    ensureSocket();
    return () => listeners.delete(listener);
  },
  isConnected(): boolean {
    return !!socket?.isOpen();
  },
};
