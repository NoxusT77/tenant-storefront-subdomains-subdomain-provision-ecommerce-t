import { z } from "zod";

export const orderEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("checkout_started"), orderId: z.string().min(1), customerEmail: z.string().email() }),
  z.object({ type: z.literal("payment_captured"), orderId: z.string().min(1) }),
  z.object({ type: z.literal("fulfillment_shipped"), orderId: z.string().min(1), trackingCode: z.string().min(1) }),
]);

export type OrderEvent = z.infer<typeof orderEventSchema>;
export type OrderState = {
  orderId: string;
  customerEmail: string;
  stage: "checkout" | "paid" | "fulfilled";
  receipt: "pending" | "ready";
  customerUpdate: string;
  trackingCode?: string;
};

export function applyOrderEvent(current: OrderState | undefined, event: OrderEvent): OrderState {
  if (event.type === "checkout_started") {
    if (current) throw new Error("Checkout already exists");
    return {
      orderId: event.orderId,
      customerEmail: event.customerEmail,
      stage: "checkout",
      receipt: "pending",
      customerUpdate: "Checkout started",
    };
  }

  if (!current || current.orderId !== event.orderId) throw new Error("Start checkout first");

  if (event.type === "payment_captured") {
    if (current.stage !== "checkout") throw new Error("Payment requires an open checkout");
    return { ...current, stage: "paid", receipt: "ready", customerUpdate: "Payment received; receipt ready" };
  }

  if (current.stage !== "paid") throw new Error("Shipping requires captured payment");
  return {
    ...current,
    stage: "fulfilled",
    trackingCode: event.trackingCode,
    customerUpdate: `Order shipped with tracking ${event.trackingCode}`,
  };
}
