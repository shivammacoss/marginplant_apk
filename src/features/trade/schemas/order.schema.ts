import { z } from "zod";
import { ORDER_TYPES, PRODUCT_TYPES, SIDES } from "@shared/utils/constants";

const decimalString = z
  .string()
  .regex(/^\d+(\.\d+)?$/u, "Invalid price");

export const placeOrderSchema = z
  .object({
    symbol: z.string().min(1),
    side: z.enum(SIDES),
    order_type: z.enum(ORDER_TYPES),
    product: z.enum(PRODUCT_TYPES),
    qty: z.number().int().positive("Quantity must be > 0"),
    price: decimalString.optional(),
    trigger_price: decimalString.optional(),
  })
  .refine(
    (v) => v.order_type === "MARKET" || !!v.price,
    { message: "Price required", path: ["price"] },
  )
  .refine(
    (v) => !["SL", "SL-M"].includes(v.order_type) || !!v.trigger_price,
    { message: "Trigger required", path: ["trigger_price"] },
  );

export type PlaceOrderValues = z.infer<typeof placeOrderSchema>;
