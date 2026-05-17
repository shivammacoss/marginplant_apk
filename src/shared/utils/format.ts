import { toDecimal, type DecimalInput } from "./decimal";

const inrFmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// `compact: true` used to emit Intl's "1.5L" / "2K" abbreviation. Per
// user feedback that hid the exact figure on KPI tiles, so every
// caller — including ones that pass `compact: true` for legacy
// compatibility — now gets the full Indian-grouped value. Kept the
// option in the signature so old call sites keep compiling.
export function formatINR(v: DecimalInput, _opts?: { compact?: boolean }): string {
  const n = Number(toDecimal(v).toFixed(2));
  return `₹${inrFmt.format(n)}`;
}

export function formatNumber(v: DecimalInput, dp = 2): string {
  return toDecimal(v).toFixed(dp);
}

export function formatPercent(v: DecimalInput, dp = 2): string {
  return `${toDecimal(v).toFixed(dp)}%`;
}

export function formatSigned(v: DecimalInput, dp = 2): string {
  const d = toDecimal(v);
  const sign = d.isPositive() && !d.isZero() ? "+" : "";
  return `${sign}${d.toFixed(dp)}`;
}

export function formatLots(qty: number, lotSize: number): string {
  if (lotSize <= 1) return `${qty}`;
  const lots = qty / lotSize;
  return Number.isInteger(lots) ? `${lots} lot${lots === 1 ? "" : "s"}` : `${qty}`;
}

export function truncate(s: string, max = 20): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
