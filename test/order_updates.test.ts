import assert from "node:assert/strict";
import test from "node:test";
import { applyOrderEvent } from "../src/order_updates.js";

test("a paid order can ship and exposes a ready receipt plus customer update", () => {
  const checkout = applyOrderEvent(undefined, {
    type: "checkout_started",
    orderId: "ord_1042",
    customerEmail: "reader@example.com",
  });
  const paid = applyOrderEvent(checkout, { type: "payment_captured", orderId: "ord_1042" });
  const shipped = applyOrderEvent(paid, {
    type: "fulfillment_shipped",
    orderId: "ord_1042",
    trackingCode: "TRACK-77",
  });

  assert.equal(paid.receipt, "ready");
  assert.equal(shipped.stage, "fulfilled");
  assert.equal(shipped.customerUpdate, "Order shipped with tracking TRACK-77");
});

test("fulfillment is rejected before payment", () => {
  const checkout = applyOrderEvent(undefined, {
    type: "checkout_started",
    orderId: "ord_1043",
    customerEmail: "maker@example.com",
  });

  assert.throws(
    () => applyOrderEvent(checkout, { type: "fulfillment_shipped", orderId: "ord_1043", trackingCode: "EARLY-1" }),
    /captured payment/,
  );
});
