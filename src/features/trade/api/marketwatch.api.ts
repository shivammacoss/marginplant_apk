import { api } from "@core/api/client";
import { unwrap } from "@core/api/errors";

export interface MarketwatchItem {
  id?: string;
  token: string;
  instrument_token?: string;
  symbol?: string;
  added_at?: string;
}

export interface Marketwatch {
  id: string;
  name: string;
  is_default?: boolean;
  items: MarketwatchItem[];
  created_at: string;
  updated_at?: string;
}

export interface MarketwatchQuote {
  token: string;
  instrument_token?: string;
  symbol: string;
  name?: string;
  exchange?: string;
  ltp: number | null;
  bid?: number | null;
  ask?: number | null;
  change: number | null;
  change_pct: number | null;
  volume?: number | null;
  segment_type?: string;
  currency_quote?: string;
}

export interface SegmentItem {
  id?: string;
  instrument_token: string;
  symbol: string;
  name?: string;
  exchange?: string;
  segment_type?: string;
}

export const MarketwatchAPI = {
  list: () => unwrap<Marketwatch[]>(api.get("/user/marketwatch")),
  create: (name: string) =>
    unwrap<Marketwatch>(api.post("/user/marketwatch", { name })),
  rename: (id: string, name: string) =>
    unwrap<Marketwatch>(api.put(`/user/marketwatch/${encodeURIComponent(id)}`, { name })),
  remove: (id: string) =>
    unwrap(api.delete(`/user/marketwatch/${encodeURIComponent(id)}`)),
  addItem: (id: string, token: string) =>
    unwrap<Marketwatch>(
      api.post(`/user/marketwatch/${encodeURIComponent(id)}/items`, { token }),
    ),
  removeItem: (id: string, token: string) =>
    unwrap(
      api.delete(
        `/user/marketwatch/${encodeURIComponent(id)}/items/${encodeURIComponent(token)}`,
      ),
    ),
  // Live quotes for every instrument in a watchlist. Backend returns the
  // last-known LTP even after market close so the row never goes blank.
  quotes: (id: string) =>
    unwrap<MarketwatchQuote[]>(
      api.get(`/user/marketwatch/${encodeURIComponent(id)}/quotes`),
    ),
  // Per-segment managed lists (Indian segments only — NSE_EQ, NSE_FUT,
  // NSE_OPT, BSE_EQ, BSE_FUT, BSE_OPT, MCX_FUT). User explicitly adds/
  // removes; the panel only shows what they've added. Forex / Crypto /
  // Indices / Stocks / Commodities use the unmanaged Infoway feed.
  segmentItems: (segmentName: string) =>
    unwrap<SegmentItem[]>(
      api.get(`/user/marketwatch/segment/${encodeURIComponent(segmentName)}/items`),
    ),
  addSegmentItem: (segmentName: string, token: string) =>
    unwrap(
      api.post(
        `/user/marketwatch/segment/${encodeURIComponent(segmentName)}/items`,
        { token },
      ),
    ),
  removeSegmentItem: (segmentName: string, token: string) =>
    unwrap(
      api.delete(
        `/user/marketwatch/segment/${encodeURIComponent(segmentName)}/items/${encodeURIComponent(token)}`,
      ),
    ),
};

export const SegmentSettingsAPI = {
  // Admin matrix row names currently flagged inactive. Used to hide
  // buckets whose underlying segments are turned off platform-wide.
  inactive: () => unwrap<string[]>(api.get("/user/segment-settings/inactive")),
};
