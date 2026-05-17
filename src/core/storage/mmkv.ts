import AsyncStorage from "@react-native-async-storage/async-storage";

const memory = new Map<string, string>();
let booted = false;
let bootPromise: Promise<void> | null = null;

async function boot(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const ours = allKeys.filter((k) => k.startsWith("nb."));
  if (ours.length > 0) {
    const pairs = await AsyncStorage.multiGet(ours);
    for (const [k, v] of pairs) if (v != null) memory.set(k, v);
  }
  booted = true;
}

export function bootstrapStorage(): Promise<void> {
  if (booted) return Promise.resolve();
  bootPromise ||= boot();
  return bootPromise;
}

function setBoth(k: string, v: string): void {
  memory.set(k, v);
  void AsyncStorage.setItem(k, v);
}

export const mmkv = {
  getString: (k: string): string | null => memory.get(k) ?? null,
  setString: (k: string, v: string): void => setBoth(k, v),
  getNumber: (k: string): number | null => {
    const v = memory.get(k);
    return v == null ? null : Number(v);
  },
  setNumber: (k: string, v: number): void => setBoth(k, v.toString()),
  getBoolean: (k: string): boolean | null => {
    const v = memory.get(k);
    if (v == null) return null;
    return v === "true" || v === "1";
  },
  setBoolean: (k: string, v: boolean): void => setBoth(k, v ? "true" : "false"),
  getJSON<T>(k: string): T | null {
    const raw = memory.get(k);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setJSON: (k: string, v: unknown): void => setBoth(k, JSON.stringify(v)),
  remove: (k: string): void => {
    memory.delete(k);
    void AsyncStorage.removeItem(k);
  },
  clearAll: (): void => {
    memory.clear();
    void AsyncStorage.clear();
  },
} as const;
