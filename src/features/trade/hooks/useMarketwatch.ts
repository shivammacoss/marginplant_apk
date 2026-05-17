import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MarketwatchAPI,
  type Marketwatch,
  type SegmentItem,
} from "@features/trade/api/marketwatch.api";
import { ApiError } from "@core/api/errors";
import { useUiStore } from "@shared/store/ui.store";

const KEY = ["marketwatch"] as const;
const SEGMENT_KEY = (name: string) => ["segment-items", name] as const;

export function useMarketwatchList() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => MarketwatchAPI.list(),
    staleTime: 60_000,
    // Keep the cached list painted while refetching — favourites should
    // never blink to a loading skeleton when the user pops back into
    // Market. The persister hydrates this from AsyncStorage on cold start.
    placeholderData: (prev) => prev,
  });
}

export function useCreateMarketwatch() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (name: string) => MarketwatchAPI.create(name),
    onSuccess: () => {
      pushToast({ kind: "success", message: "Watchlist created" });
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: ApiError) =>
      pushToast({ kind: "error", message: e.message ?? "Couldn't create list" }),
  });
}

export function useRenameMarketwatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      MarketwatchAPI.rename(id, name),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteMarketwatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => MarketwatchAPI.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

// Optimistic add — patches the `marketwatch` cache so favTokens reflects
// the new entry before the HTTP round-trip lands. Star fills immediately.
export function useAddMarketwatchItem() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: ({ id, token }: { id: string; token: string }) =>
      MarketwatchAPI.addItem(id, token),
    onMutate: async ({ id, token }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const snapshot = qc.getQueryData<Marketwatch[]>(KEY);
      qc.setQueryData<Marketwatch[]>(KEY, (prev) => {
        if (!prev) return prev;
        return prev.map((w) =>
          w.id === id
            ? {
                ...w,
                // Seed BOTH fields so favTokens picks up the entry no
                // matter which key the read path checks (some screens
                // read `token`, segment-mirrored rows read
                // `instrument_token`).
                items: [...(w.items ?? []), { token, instrument_token: token }],
              }
            : w,
        );
      });
      return { snapshot };
    },
    onError: (e: ApiError, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(KEY, ctx.snapshot);
      pushToast({ kind: "error", message: e.message ?? "Couldn't star" });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoveMarketwatchItem() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: ({ id, token }: { id: string; token: string }) =>
      MarketwatchAPI.removeItem(id, token),
    onMutate: async ({ id, token }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const snapshot = qc.getQueryData<Marketwatch[]>(KEY);
      qc.setQueryData<Marketwatch[]>(KEY, (prev) => {
        if (!prev) return prev;
        return prev.map((w) =>
          w.id === id
            ? {
                ...w,
                // Filter by EITHER key so the remove path mirrors the
                // dual-field add path above.
                items: (w.items ?? []).filter((it) => {
                  const t = it.token ?? it.instrument_token;
                  return String(t) !== String(token);
                }),
              }
            : w,
        );
      });
      return { snapshot };
    },
    onError: (e: ApiError, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(KEY, ctx.snapshot);
      pushToast({ kind: "error", message: e.message ?? "Couldn't unstar" });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAddSegmentItem() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: ({ segment, token }: { segment: string; token: string }) =>
      MarketwatchAPI.addSegmentItem(segment, token),
    // Optimistically patch the curated list so the "+" disappears
    // immediately and the row swaps to the "x" affordance once the user
    // clears the search box.
    onMutate: async ({ segment, token }) => {
      const key = SEGMENT_KEY(segment);
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData<SegmentItem[]>(key);
      qc.setQueryData<SegmentItem[]>(key, (prev) => {
        const list = prev ?? [];
        if (list.some((it) => String(it.instrument_token) === String(token))) {
          return list;
        }
        return [
          ...list,
          { instrument_token: token, symbol: token } as SegmentItem,
        ];
      });
      pushToast({ kind: "success", message: "Added", ttlMs: 1200 });
      return { snapshot };
    },
    onError: (e: ApiError, vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(SEGMENT_KEY(vars.segment), ctx.snapshot);
      pushToast({ kind: "error", message: e.message ?? "Couldn't add" });
    },
    onSettled: (_d, _e, vars) =>
      void qc.invalidateQueries({ queryKey: SEGMENT_KEY(vars.segment) }),
  });
}

export function useRemoveSegmentItem() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  return useMutation({
    mutationFn: ({ segment, token }: { segment: string; token: string }) =>
      MarketwatchAPI.removeSegmentItem(segment, token),
    onMutate: async ({ segment, token }) => {
      const key = SEGMENT_KEY(segment);
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData<SegmentItem[]>(key);
      qc.setQueryData<SegmentItem[]>(key, (prev) =>
        prev
          ? prev.filter(
              (it) => String(it.instrument_token) !== String(token),
            )
          : prev,
      );
      return { snapshot };
    },
    onError: (e: ApiError, vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(SEGMENT_KEY(vars.segment), ctx.snapshot);
      pushToast({ kind: "error", message: e.message ?? "Couldn't remove" });
    },
    onSettled: (_d, _e, vars) =>
      void qc.invalidateQueries({ queryKey: SEGMENT_KEY(vars.segment) }),
  });
}
