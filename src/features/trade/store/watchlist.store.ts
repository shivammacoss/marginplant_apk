import { create } from "zustand";
import { mmkv } from "@core/storage/mmkv";
import { STORAGE_KEYS } from "@core/storage/keys";

const SEED_KEY = "nb.watchlist.seeded";

// Default favourites seeded on first launch. Only real backend-resolved tokens
// are kept here — the indices/equity tokens are Zerodha's official IDs that
// resolve as soon as the backend's Zerodha session is up, and the Infoway
// forex/crypto tokens flow the moment Infoway is configured. MCX gold futures
// rotate every month and can't be hard-coded reliably, so users discover them
// via the Market tab → MCX/Metal chip instead of getting a mock 1000-base
// quote on first launch.
export const DEFAULT_FAVOURITES: string[] = [
  "256265",        // NIFTY 50           — Zerodha NSE index
  "260105",        // NIFTY BANK         — Zerodha NSE index
  "265",           // SENSEX             — Zerodha BSE index
  "738561",        // RELIANCE INDUSTRIES — Zerodha NSE stock
  "2953217",       // TCS                — Zerodha NSE stock
  "FX_EURUSD",     // EUR / USD          — Infoway forex
  "CRYPTO_BTCUSD", // BTC / USD          — Infoway crypto
];

interface WatchlistState {
  symbols: string[];
  add: (symbol: string) => void;
  remove: (symbol: string) => void;
  reorder: (next: string[]) => void;
  set: (next: string[]) => void;
  hydrate: () => void;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  symbols: [],

  add: (symbol) => {
    if (get().symbols.includes(symbol)) return;
    const next = [...get().symbols, symbol];
    mmkv.setJSON(STORAGE_KEYS.watchlist, next);
    set({ symbols: next });
  },

  remove: (symbol) => {
    const next = get().symbols.filter((s) => s !== symbol);
    mmkv.setJSON(STORAGE_KEYS.watchlist, next);
    set({ symbols: next });
  },

  reorder: (next) => {
    mmkv.setJSON(STORAGE_KEYS.watchlist, next);
    set({ symbols: next });
  },

  set: (next) => {
    mmkv.setJSON(STORAGE_KEYS.watchlist, next);
    set({ symbols: next });
  },

  hydrate: () => {
    const cached = mmkv.getJSON<string[]>(STORAGE_KEYS.watchlist);
    const seeded = mmkv.getBoolean(SEED_KEY);
    if (cached === null && !seeded) {
      mmkv.setJSON(STORAGE_KEYS.watchlist, DEFAULT_FAVOURITES);
      mmkv.setBoolean(SEED_KEY, true);
      set({ symbols: DEFAULT_FAVOURITES });
      return;
    }
    set({ symbols: cached ?? [] });
  },
}));
