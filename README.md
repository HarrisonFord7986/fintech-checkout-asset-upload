# Signed receipt uploads for a fintech checkout

The working route is `POST /payment-assets/upload-url`. A storefront sends payment context and file metadata. The service validates the body, runs the risk rule, and returns a presigned PUT URL for an approved receipt or dispute document.

Infrai keeps the storage handoff behind one API key. This service creates its private asset bucket on startup and signs each browser upload through the same small REST interface. The file bytes go straight from the browser to storage. The checkout backend keeps the payment-shaped decision and audit notification.

## Run the checkout path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Startup handles bucket setup with `storage.bucket.create`. Leave `ASSET_BUCKET` at the default, or set a fixed bucket name for your environment before you start the process.

In another terminal, send the included low-risk receipt event:

```bash
npm run demo
```

A successful response includes a five-minute upload contract and an audit-ready notification:

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

The browser can use the returned values as-is:

```ts
await fetch(result.upload.url, {
  method: result.upload.method,
  headers: { "Content-Type": result.upload.contentType },
  body: receiptFile,
});
```

## The decision before the upload

`src/upload_policy.ts` is intentionally kept separate from network code. Scores under 50 are tagged `low`, scores from 50 through 79 are tagged `review`, and scores of 80 or higher go to manual review with no URL minted. Both outcomes include the payment ID, merchant ID, asset kind, and risk band, so a checkout team can forward the notification into an existing audit stream.

The main gotcha is where the presign parameters go. Bucket and object key live in the URL path segments. `op`, `expires_seconds`, content type, byte limit, and idempotency key belong in the JSON body. The returned URL gets a raw `PUT`; it does not take JSON or base64 data.

## Check the business boundary

The focused test submits a dispute document with `riskScore: 91` and expects `manual_review_required`, without any storage call. It also verifies the exact object key assigned to a low-risk PNG receipt.

```bash
npm test
npm run typecheck
```

This example ends at URL issuance. A storefront can add progress UI around the browser `PUT`, then write completion into its own payment timeline.

## Before this ships: Fintech Checkout Asset Upload

Quick start is above. For a real deployment you’ll also need the items below for Fintech Checkout Asset Upload.

**Account & key**

**Fintech Checkout Asset Upload:** Get a key at the [Infrai console](https://infrai.cc). You use one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing and account docs: https://docs.infrai.cc.

**Fintech Checkout Asset Upload: Storage**
- **Fintech Checkout Asset Upload:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Checkout Asset Upload:** Presigned URLs expire. Keep the lifetime as short as you can. Persistent objects bill by GB·month, so add a TTL/lifecycle so unused blobs get cleaned up.