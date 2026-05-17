import { ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { TradeSheet, type TradeSheetRef } from "./TradeSheet";

interface OpenArgs {
  token: string;
  symbol?: string;
  name?: string;
}

interface Ctx {
  open: (args: OpenArgs) => void;
  close: () => void;
}

const TradeSheetCtx = createContext<Ctx | null>(null);

// The TradeSheet is mounted LAZILY — only when a Buy/Sell tap actually
// targets an instrument. Eager mount used to leave a Gorhom pan area
// listening to gestures at the bottom of every screen (login, profile,
// home…); an upward swipe from there would drag the empty sheet open and
// black out the app until the user dismissed it. That was the
// "niche se kuch open ho ke pura app patch ho jata hai" bug.
//
// Lazy mount means non-trade screens contain ZERO sheet markup, ZERO pan
// listeners. The first Buy/Sell tap pays a one-frame Gorhom init cost
// (~30 ms — invisible alongside the modal open animation), and the
// sheet unmounts again the moment the user closes it.
export function TradeSheetProvider({ children }: { children: ReactNode }) {
  const ref = useRef<TradeSheetRef>(null);
  // `mounted` drives whether the sheet exists in the tree at all.
  // `pendingArgs` is what we want it to open with — held outside React
  // state so the sheet can read it synchronously during its mount effect
  // (no extra render lag between mount and snap-to-index 0).
  const [mounted, setMounted] = useState(false);
  const pendingArgs = useRef<OpenArgs | null>(null);

  const handleClosed = useCallback(() => {
    setMounted(false);
    pendingArgs.current = null;
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      open: (args) => {
        pendingArgs.current = args;
        if (mounted) {
          // Sheet is already mounted (user opened another instrument
          // without closing the previous one) — just re-fire `open` on
          // the existing instance so it animates the new content in.
          ref.current?.open(args);
          return;
        }
        setMounted(true);
        // The fresh mount's useEffect (see TradeSheet.useEffect on
        // `initialArgs`) calls `open(args)` itself once it lays out, so
        // we don't need a manual ref.current.open here.
      },
      close: () => ref.current?.close(),
    }),
    [mounted],
  );

  return (
    <TradeSheetCtx.Provider value={value}>
      {children}
      {mounted ? (
        <TradeSheet
          ref={ref}
          initialArgs={pendingArgs.current}
          onClosed={handleClosed}
        />
      ) : null}
    </TradeSheetCtx.Provider>
  );
}

export function useTradeSheet(): Ctx {
  const ctx = useContext(TradeSheetCtx);
  if (!ctx) throw new Error("useTradeSheet must be used within TradeSheetProvider");
  return ctx;
}
