import { api } from "@core/api/client";
import { unwrap } from "@core/api/errors";
import type {
  ModifyOrderInput,
  Order,
  PlaceOrderInput,
} from "@features/trade/types/order.types";

export interface OrdersQuery {
  status?: string;
  limit?: number;
  skip?: number;
}

export const OrdersAPI = {
  list: (q: OrdersQuery = {}) =>
    unwrap<Order[]>(api.get("/user/orders", { params: q })),
  get: (id: string) => unwrap<Order>(api.get(`/user/orders/${id}`)),
  place: (body: PlaceOrderInput) =>
    unwrap<Order>(api.post("/user/orders", body)),
  modify: (id: string, body: ModifyOrderInput) =>
    unwrap<Order>(api.put(`/user/orders/${id}`, body)),
  cancel: (id: string) => unwrap<Order>(api.delete(`/user/orders/${id}`)),
};
