import { api } from "@core/api/client";
import { unwrap } from "@core/api/errors";
import type {
  ActiveTrade,
  Holding,
  PnLSummary,
  Position,
} from "@features/portfolio/types/position.types";

export const PositionsAPI = {
  open: () => unwrap<Position[]>(api.get("/user/positions/open")),
  closed: () => unwrap<Position[]>(api.get("/user/positions/closed")),
  pnlSummary: () => unwrap<PnLSummary>(api.get("/user/positions/pnl-summary")),
  activeTrades: () =>
    unwrap<ActiveTrade[]>(api.get("/user/positions/active-trades")),
  closeActiveTrade: (tradeId: string) =>
    unwrap<{ order_id: string; status: string; closed_lots: number }>(
      api.post(`/user/positions/active-trades/${tradeId}/close`),
    ),
  squareoff: (id: string, lots?: number) =>
    unwrap<{ order_id: string; status: string; closed_lots: number }>(
      api.post(`/user/positions/${id}/squareoff`, undefined, {
        params: lots ? { lots } : {},
      }),
    ),
  squareoffAll: () =>
    unwrap<{ squared_off: number; total: number; blocked_by_hold_time: number }>(
      api.post("/user/positions/squareoff-all"),
    ),
  updateSlTp: (
    id: string,
    body: { stop_loss?: number | null; target?: number | null },
  ) => unwrap<Position>(api.put(`/user/positions/${id}/sl-tp`, body)),
  // Active trades share SL/TP with their parent position on the backend
  // (FIFO/avg accounting) but the endpoint is exposed under the trade
  // ID so the UI can act per-row without first resolving the position.
  updateActiveTradeSlTp: (
    tradeId: string,
    body: { stop_loss?: number | null; target?: number | null },
  ) =>
    unwrap<Position>(
      api.put(`/user/positions/active-trades/${tradeId}/sl-tp`, body),
    ),
};

export const HoldingsAPI = {
  list: () => unwrap<Holding[]>(api.get("/user/holdings")),
};
