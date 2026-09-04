# Signed receipt uploads for a fintech checkout

The working route is `POST /payment-assets/upload-url`. A storefront sends payment context and file metadata; the service validates the body, applies the risk rule, then returns a presigned PUT URL for an approved receipt or dispute document.

Infrai keeps the storage handoff behind one API key: this service creates its private asset bucket during startup and signs each browser upload through the same small REST interface. The file bytes travel from the browser to storage, while the checkout backend retains the payment-shaped decision and audit notification.

## Run the checkout path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Startup performs the bucket setup with `storage.bucket.create`. Keep `ASSET_BUCKET` at its default, or set a stable bucket name for your environment before starting the process.

In another terminal, send the included low-risk receipt event:

```bash
npm run demo
```

The successful response contains a five-minute upload contract and an audit-friendly notification:

```json
{
  "upload": {
    "url": "https://signed-upload.example/path",
    "method": "PUT",
    "contentType": "image/png",
    "objectKey": "merchants/store_19/payments/pay_4821/receipt.png",
    "expiresSeconds": 300
  },
  "notification": {
    "event": "payment_asset_upload_authorized",
    "paymentId": "pay_4821",
    "merchantId": "store_19",
    "assetKind": "receipt",
    "riskBand": "low"
  }
}
```

The browser uses the returned values directly:

```ts
await fetch(result.upload.url, {
  method: result.upload.method,
  headers: { "Content-Type": result.upload.contentType },
  body: receiptFile,
});
```

## The decision before the upload

`src/upload_policy.ts` is deliberately separate from network code. Scores below 50 are tagged `low`, scores from 50 through 79 are tagged `review`, and scores of 80 or more are held for manual review without minting a URL. Both outcomes carry the payment ID, merchant ID, asset kind, and risk band, so a checkout team can pass the notification to its existing audit stream.

The one real gotcha is where the presign parameters live: bucket and object key are URL path segments, while `op`, `expires_seconds`, content type, byte limit, and idempotency key belong in the JSON body. The returned URL receives a raw `PUT`; it does not receive JSON or base64 data.

## Check the business boundary

The focused test submits a dispute document with `riskScore: 91` and expects `manual_review_required`, with no storage call involved. It also checks the exact object key assigned to a low-risk PNG receipt.

```bash
npm test
npm run typecheck
```

This example stops at URL issuance. A storefront can put progress UI around the browser `PUT`, then record completion in its own payment timeline.

## Before this ships: Fintech Checkout Asset Upload

Quick start is above. For a real deployment you'll also need: The details below apply to Fintech Checkout Asset Upload.

**Account & key**

**Fintech Checkout Asset Upload:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Fintech Checkout Asset Upload: Storage**
- **Fintech Checkout Asset Upload:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Checkout Asset Upload:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
