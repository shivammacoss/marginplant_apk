export interface ThrottledItem {
  symbol: string;
  ts: number;
}

type Flush<T extends ThrottledItem> = (batch: T[]) => void;

export function createBatcher<T extends ThrottledItem>(flush: Flush<T>, frameMs = 16) {
  const pending = new Map<string, T>();
  let scheduled = false;

  function tick(): void {
    scheduled = false;
    if (pending.size === 0) return;
    const batch = Array.from(pending.values());
    pending.clear();
    flush(batch);
  }

  return {
    push(item: T): void {
      const prev = pending.get(item.symbol);
      if (!prev || prev.ts < item.ts) pending.set(item.symbol, item);
      if (!scheduled) {
        scheduled = true;
        setTimeout(tick, frameMs);
      }
    },
    flushNow(): void {
      tick();
    },
    clear(): void {
      pending.clear();
      scheduled = false;
    },
  };
}
