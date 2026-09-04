import assert from "node:assert/strict";
import test from "node:test";
import { decideUpload } from "../src/upload_policy.js";

test("holds a high-risk dispute document before signing an upload", () => {
  const decision = decideUpload({
    paymentId: "pay_risky_7",
    merchantId: "store_19",
    assetKind: "dispute-evidence",
    contentType: "application/pdf",
    bytes: 600_000,
    riskScore: 91,
  });

  assert.deepEqual(decision, {
    allowed: false,
    reason: "manual_review_required",
    notification: {
      event: "payment_asset_upload_held",
      paymentId: "pay_risky_7",
      merchantId: "store_19",
      assetKind: "dispute-evidence",
      riskBand: "high",
    },
  });
});

test("authorizes a low-risk receipt with an auditable object key", () => {
  const decision = decideUpload({
    paymentId: "pay_4821",
    merchantId: "store_19",
    assetKind: "receipt",
    contentType: "image/png",
    bytes: 245_760,
    riskScore: 18,
  });

  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.equal(
      decision.objectKey,
      "merchants/store_19/payments/pay_4821/receipt.png",
    );
    assert.equal(decision.notification.riskBand, "low");
  }
});
