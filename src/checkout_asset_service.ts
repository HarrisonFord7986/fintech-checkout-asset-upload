import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import { InfraiError, infrai } from "./infrai_storage.js";
import { decideUpload, type PaymentEvent } from "./upload_policy.js";

const BUCKET = process.env.ASSET_BUCKET ?? "checkout-payment-assets";
const PORT = Number(process.env.PORT ?? 3000);

const uploadRequest = z.object({
  paymentId: z.string().min(1).max(80),
  merchantId: z.string().min(1).max(80),
  assetKind: z.enum(["receipt", "dispute-evidence"]),
  contentType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  bytes: z.number().int().positive().max(10_000_000),
  riskScore: z.number().min(0).max(100),
});

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const bucketReady = infrai.storage.bucket.create(BUCKET);

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/payment-assets/upload-url") {
    json(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const parsed = uploadRequest.safeParse(await readJson(request));
    if (!parsed.success) {
      json(response, 400, { error: "invalid_request", issues: parsed.error.issues });
      return;
    }

    const decision = decideUpload(parsed.data as PaymentEvent);
    if (!decision.allowed) {
      json(response, 403, decision);
      return;
    }

    await bucketReady;
    const signed = await infrai.storage.object.presign(BUCKET, decision.objectKey, {
      op: "put",
      expires_seconds: 300,
      content_type: parsed.data.contentType,
      max_bytes: parsed.data.bytes,
      idempotency_key: `payment-asset:${parsed.data.paymentId}:${parsed.data.assetKind}`,
    });

    json(response, 201, {
      upload: {
        url: signed.url,
        method: "PUT",
        contentType: parsed.data.contentType,
        objectKey: decision.objectKey,
        expiresSeconds: 300,
      },
      notification: decision.notification,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      json(response, 400, { error: "invalid_json" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    console.error(error);
    json(response, 500, { error: "internal_error" });
  }
});

server.listen(PORT, () => {
  console.log(`Checkout asset service listening on http://localhost:${PORT}`);
});
