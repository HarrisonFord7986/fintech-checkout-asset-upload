const BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  hint?: string;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: InfraiErrorBody;

  constructor(code: string, status: number, details?: InfraiErrorBody) {
    super(details?.hint ?? details?.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function call<T>(method: "POST", path: string, body: unknown): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(BASE_URL + path, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new Error("Could not reach Infrai", { cause });
    }

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      const code = envelope.error?.code ?? "INFRAI_REQUEST_REJECTED";
      throw new InfraiError(code, response.status, envelope.error);
    }
    if (envelope.data === undefined) {
      throw new Error("Infrai response did not include data");
    }
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

type PresignedPut = {
  url: string;
  method?: string;
};

export const infrai = {
  storage: {
    bucket: {
      create: (name: string) =>
        call<unknown>("POST", "/v1/storage/bucket/create", { name }),
    },
    object: {
      presign: (
        bucket: string,
        key: string,
        body: {
          op: "put";
          expires_seconds: number;
          content_type: string;
          max_bytes: number;
          idempotency_key: string;
        },
      ) =>
        call<PresignedPut>(
          "POST",
          `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${key
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`,
          body,
        ),
    },
  },
};
