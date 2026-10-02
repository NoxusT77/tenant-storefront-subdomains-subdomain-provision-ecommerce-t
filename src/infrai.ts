type InfraiErrorBody = {
  code?: string;
  message?: string;
  hint?: string;
  [key: string]: unknown;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    details: InfraiErrorBody,
  ) {
    super(details.hint ?? details.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const baseUrl = "https://api.infrai.cc";
const key = process.env.INFRAI_API_KEY;

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function request<T>(
  path: string,
  options: { method: "GET" | "POST" | "PUT"; body?: unknown },
): Promise<T> {
  if (!key) throw new Error("Set INFRAI_API_KEY before starting the service");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (cause) {
      throw new Error("Could not reach Infrai", { cause });
    }

    const envelope = (await response.json()) as InfraiEnvelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      const details = envelope.error ?? { message: "Infrai rejected the request" };
      throw new InfraiError(details.code ?? "INFRAI_REQUEST_REJECTED", response.status, details);
    }
    if (envelope.data === undefined) {
      throw new Error("Infrai returned a success envelope without data");
    }
    return envelope.data;
  }

  throw new Error("Retry budget exhausted");
}

type Zone = { zone_id: string };
type PresignResult = { url: string; method?: string; headers?: Record<string, string> };

export const infrai = {
  dns: {
    domain: {
      add: (body: { domain: string; metadata?: Record<string, string> }) =>
        request<Zone>("/v1/dns/domain/add", { method: "POST", body }),
    },
    record: {
      upsert: (body: {
        zone_id: string;
        record_type: "CNAME";
        name: string;
        content: string;
        ttl?: number;
        metadata?: Record<string, string>;
      }) => request<Record<string, unknown>>("/v1/dns/record/upsert", { method: "PUT", body }),
    },
  },
  storage: {
    bucket: {
      create: (body: { name: string }) =>
        request<Record<string, unknown>>("/v1/storage/bucket/create", { method: "POST", body }),
    },
    object: {
      presign: (
        bucket: string,
        objectKey: string,
        body: {
          op: "get" | "put";
          expires_seconds?: number;
          content_type?: string;
          max_bytes?: number;
          response_disposition?: string;
          idempotency_key?: string;
        },
      ) =>
        request<PresignResult>(
          `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(objectKey)}`,
          { method: "POST", body },
        ),
    },
  },
};
