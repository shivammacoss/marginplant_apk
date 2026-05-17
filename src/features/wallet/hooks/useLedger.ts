import { useQuery } from "@tanstack/react-query";
import { LedgerAPI, type LedgerQuery } from "@features/wallet/api/ledger.api";

export function useLedger(q: LedgerQuery = {}) {
  return useQuery({
    queryKey: ["ledger", q],
    queryFn: () => LedgerAPI.fetch(q),
    staleTime: 30_000,
  });
}
