export type PaymentEvent = {
  paymentId: string;
  merchantId: string;
  assetKind: "receipt" | "dispute-evidence";
  contentType: "image/jpeg" | "image/png" | "application/pdf";
  bytes: number;
  riskScore: number;
};

export type UploadDecision =
  | {
      allowed: true;
      objectKey: string;
      notification: {
        event: "payment_asset_upload_authorized";
        paymentId: string;
        merchantId: string;
        assetKind: PaymentEvent["assetKind"];
        riskBand: "low" | "review";
      };
    }
  | {
      allowed: false;
      reason: "manual_review_required";
      notification: {
        event: "payment_asset_upload_held";
        paymentId: string;
        merchantId: string;
        assetKind: PaymentEvent["assetKind"];
        riskBand: "high";
      };
    };

export function decideUpload(event: PaymentEvent): UploadDecision {
  if (event.riskScore >= 80) {
    return {
      allowed: false,
      reason: "manual_review_required",
      notification: {
        event: "payment_asset_upload_held",
        paymentId: event.paymentId,
        merchantId: event.merchantId,
        assetKind: event.assetKind,
        riskBand: "high",
      },
    };
  }

  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "application/pdf": "pdf",
  }[event.contentType];

  return {
    allowed: true,
    objectKey: `merchants/${event.merchantId}/payments/${event.paymentId}/${event.assetKind}.${extension}`,
    notification: {
      event: "payment_asset_upload_authorized",
      paymentId: event.paymentId,
      merchantId: event.merchantId,
      assetKind: event.assetKind,
      riskBand: event.riskScore >= 50 ? "review" : "low",
    },
  };
}
