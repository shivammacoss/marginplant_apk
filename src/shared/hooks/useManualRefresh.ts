import { useCallback, useRef, useState } from "react";

/**
 * Drives a `<RefreshControl>` spinner ONLY when the user actively pulls
 * the list down. Binding `refreshing` directly to a React Query's
 * `isRefetching` / `isFetching` flag flashes the spinner on every
 * background `refetchInterval` poll — which the user perceives as the
 * page "bar bar refresh ho raha hai".
 *
 * Use this hook anywhere a list polls in the background:
 *
 *   const { refreshing, onRefresh } = useManualRefresh(async () => {
 *     await Promise.all([summary.refetch(), txns.refetch()]);
 *   });
 *   ...
 *   <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
 */
export function useManualRefresh(refetch: () => Promise<unknown>): {
  refreshing: boolean;
  onRefresh: () => Promise<void>;
} {
  const [refreshing, setRefreshing] = useState(false);
  // Latest refetch in a ref — so the returned `onRefresh` is stable
  // (always the same function identity across renders) but always calls
  // the latest closure.
  const latest = useRef(refetch);
  latest.current = refetch;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await latest.current();
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { refreshing, onRefresh };
}
