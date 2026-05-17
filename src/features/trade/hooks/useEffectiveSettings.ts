import { useQuery } from "@tanstack/react-query";
import { api } from "@core/api/client";
import { unwrap } from "@core/api/errors";

/**
 * Server-resolved trading settings for one (instrument, side, product) tuple.
 * Mirrors the response from `GET /user/segment-settings/effective`. Only the
 * fields the APK trade UI actually reads are typed here — the backend returns
 * many more (commission tiers, risk caps, etc.) which we leave as
 * `Record<string, unknown>` to avoid coupling the APK to every admin knob.
 */
export interface EffectiveSettings {
  segment_type: string;
  lot_size: number;
  allow?: boolean;
  // Lot limits — admin-configured per segment/template/user. The default lot
  // shown in the trade sheet comes from `order_lot` (admin's "default order
  // lot"), falling back to `min_lot` if that's null.
  min_lot?: number | null;
  max_lot?: number | null;
  order_lot?: number | null;
  intraday_lot_limit?: number | null;
  holding_lot_limit?: number | null;
  max_each_lot?: number | null;
  // Margin / leverage
  margin_percentage?: number | null;
  leverage?: number | null;
  margin_calc_mode?: string | null;
  fixed_margin_per_lot?: number | null;
}

export function useEffectiveSettings(
  token: string | null | undefined,
  action: "BUY" | "SELL" = "BUY",
  productType: "MIS" | "NRML" | "CNC" = "MIS",
) {
  return useQuery<EffectiveSettings>({
    queryKey: ["segment-settings", "effective", token, action, productType],
    queryFn: () =>
      unwrap<EffectiveSettings>(
        api.get("/user/segment-settings/effective", {
          params: { token, action, product_type: productType },
        }),
      ),
    enabled: !!token,
    // Admin can edit these in real time, but the values are stable per-user
    // for minutes at a time — 30s is the same TTL the backend uses for the
    // Redis-cached resolver, so any longer here just wastes a roundtrip.
    staleTime: 30_000,
    retry: 1,
  });
}

/**
 * Resolve the "default lot to show in the lot input" from admin settings.
 *
 * Resolution order: `min_lot → order_lot → 1`. We deliberately prefer
 * `min_lot` over `order_lot` because the admin's "minimum lot" is the
 * smallest size a user is *allowed* to trade in that segment — for
 * fractional segments (forex, crypto, MCX commodity) admins typically set
 * `minLots = 0.01`, and the user expects the form to land on that minimum,
 * not on a higher template-default `orderLots` value. (Previously the
 * priority was reversed and the form opened at "1" for crypto/forex even
 * after the admin set min = 0.01.)
 *
 * Returns a string because the input is string-backed (avoids React
 * controlled-input flicker from Number → string conversions on every
 * keystroke).
 */
export function pickDefaultLot(settings: EffectiveSettings | undefined): string {
  if (!settings) return "1";
  const minLot = Number(settings.min_lot ?? 0);
  const orderLot = Number(settings.order_lot ?? 0);
  const candidate = (minLot > 0 ? minLot : 0) || (orderLot > 0 ? orderLot : 0) || 1;
  // Strip trailing zeros for nicer display (1.00 → "1", 0.10 → "0.1").
  return String(Number(candidate.toFixed(4)));
}

export function pickMinLot(settings: EffectiveSettings | undefined): number {
  if (!settings) return 0.01;
  const v = Number(settings.min_lot ?? 0);
  return v > 0 ? v : 0.01;
}
