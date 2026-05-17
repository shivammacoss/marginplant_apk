import { useEffect, useRef, useState } from "react";

export type FlashDirection = "up" | "down" | null;

/**
 * Returns the most recent price-tick direction so the consumer can flash
 * the row background green (up) or red (down) for a short window. The
 * direction resets to `null` after `holdMs` (default 350 ms) so each
 * tick gets its own visible pulse — back-to-back ticks in the same
 * direction re-arm the flash so a fast-moving instrument visibly throbs.
 *
 * Cheap: stores only the previous price in a ref, a single state slot
 * for direction, and one timer per row. Doesn't subscribe to anything —
 * the caller still owns the LTP source (WS store, REST, …).
 */
export function usePriceFlash(
  value: number | null | undefined,
  holdMs = 350,
): FlashDirection {
  const prev = useRef<number | null>(null);
  const [dir, setDir] = useState<FlashDirection>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value == null || !Number.isFinite(value)) return;
    const last = prev.current;
    prev.current = value;
    // First tick — establish the anchor without flashing (otherwise every
    // row would flash green on first render).
    if (last == null) return;
    if (value === last) return;
    const next: FlashDirection = value > last ? "up" : "down";
    setDir(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDir(null), holdMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, holdMs]);

  return dir;
}
