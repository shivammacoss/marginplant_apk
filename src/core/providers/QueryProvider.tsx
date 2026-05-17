import { ReactNode } from "react";
import { focusManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { queryClient } from "@core/config/queryClient";

interface Props {
  children: ReactNode;
}

// On-device persister — every successful query response is written to
// AsyncStorage so the NEXT app launch can paint the UI from disk in
// <50 ms instead of waiting on a HTTP round-trip. Favourites + segment
// lists + wallet quotes all benefit. Max age 24 h keeps the cache fresh
// but lets us trim it across cold starts.
const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "rq-cache.v1",
  throttleTime: 1_000,
});

// Hook React Query's focusManager into RN AppState so refetches fire the
// moment the app comes back to foreground — bringing prices up to date
// after the user backgrounds the app for a minute.
AppState.addEventListener("change", (status) => {
  focusManager.setFocused(status === "active");
});

export function QueryProvider({ children }: Props) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000, // 24 h
        buster: "v1",
        // Don't persist mutations or queries that are quickly stale on
        // their own — ticker payloads come over WS, no point caching to
        // disk. Same for one-shot endpoints like `/me`.
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => {
            const key0 = q.queryKey[0];
            if (key0 === "ticker" || key0 === "ticker-batch") return false;
            if (key0 === "marketdata-snapshot") return false;
            return q.state.status === "success";
          },
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
