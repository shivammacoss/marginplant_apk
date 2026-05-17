import { api } from "@core/api/client";
import { unwrap } from "@core/api/errors";
import type { CreateAlertInput, PriceAlert } from "@features/alerts/types/alert.types";

export const AlertsAPI = {
  list: () => unwrap<PriceAlert[]>(api.get("/user/alerts")),
  create: (body: CreateAlertInput) => unwrap<PriceAlert>(api.post("/user/alerts", body)),
  remove: (id: string) => unwrap(api.delete(`/user/alerts/${encodeURIComponent(id)}`)),
};
