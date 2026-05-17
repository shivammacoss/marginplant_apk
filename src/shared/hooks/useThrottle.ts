import { useCallback, useRef } from "react";

export function useThrottle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms = 100,
): (...args: Args) => void {
  const last = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  return useCallback(
    (...args: Args) => {
      const now = Date.now();
      const wait = ms - (now - last.current);
      if (wait <= 0) {
        last.current = now;
        fnRef.current(...args);
        return;
      }
      if (pending.current) return;
      pending.current = setTimeout(() => {
        last.current = Date.now();
        pending.current = null;
        fnRef.current(...args);
      }, wait);
    },
    [ms],
  );
}
