import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN });

export type DecimalInput = string | number | Decimal;

export function toDecimal(v: DecimalInput | null | undefined): Decimal {
  if (v == null) return new Decimal(0);
  if (v instanceof Decimal) return v;
  return new Decimal(typeof v === "number" ? v.toString() : v);
}

export function quantizeMoney(v: DecimalInput, dp = 2): string {
  return toDecimal(v).toFixed(dp);
}

export function add(a: DecimalInput, b: DecimalInput): Decimal {
  return toDecimal(a).plus(toDecimal(b));
}

export function sub(a: DecimalInput, b: DecimalInput): Decimal {
  return toDecimal(a).minus(toDecimal(b));
}

export function mul(a: DecimalInput, b: DecimalInput): Decimal {
  return toDecimal(a).times(toDecimal(b));
}

export function div(a: DecimalInput, b: DecimalInput): Decimal {
  return toDecimal(a).dividedBy(toDecimal(b));
}

export function pnl(side: "BUY" | "SELL", entry: DecimalInput, ltp: DecimalInput, qty: DecimalInput): Decimal {
  const diff = side === "BUY" ? sub(ltp, entry) : sub(entry, ltp);
  return mul(diff, qty);
}

export { Decimal };
