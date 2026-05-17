export const SEGMENTS = ["EQ", "F&O", "MCX", "FX", "CRYPTO"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const ORDER_TYPES = ["MARKET", "LIMIT", "SL", "SL-M"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const PRODUCT_TYPES = ["MIS", "NRML", "CNC"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const SIDES = ["BUY", "SELL"] as const;
export type Side = (typeof SIDES)[number];
