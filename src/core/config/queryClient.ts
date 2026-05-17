import { QueryClient } from "@tanstack/react-query";

// Tuned for snappy navigation:
//   - staleTime 60s keeps Wallet / Profile / Orders cache "fresh" across screen
//     pushes so the UI paints instantly with cached data instead of showing a
//     spinner every time the user pops back into a screen.
//   - refetchOnMount "always" was too aggressive; "false" means data renders
//     instantly from cache and only refetches when stale (or when the user
//     pulls to refresh / a mutation invalidates).
//   - retry 1 fails faster on network errors so the user sees the error toast
//     within ~3 s instead of ~10 s of retry backoff.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
