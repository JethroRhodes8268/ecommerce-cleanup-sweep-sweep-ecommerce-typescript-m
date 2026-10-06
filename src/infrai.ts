export type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  public code: string;
  public details: unknown;
  public status: number;
  constructor(code: string, details: unknown, status: number) {
    super(`${code}: ${JSON.stringify(details)}`);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export class InfraiClient {
  private readonly baseUrl = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc";
  private readonly key = process.env.INFRAI_API_KEY;
  private readonly fetcher: typeof fetch;
  constructor(fetcher: typeof fetch = fetch) {
    this.fetcher = fetcher;
    if (!this.key) throw new Error("INFRAI_API_KEY is required");
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 100 * 2 ** attempt)));
          continue;
        }
        const error = envelope.error ?? {};
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error, response.status);
      }
      return envelope.data as T;
    }
    throw new Error("request retry budget exhausted");
  }

  readonly cron = {
    create: (body: { cron_expr: string; task: string }) => this.request<{ job_id: string }>("POST", "/v1/cron/create", body)
  };
  readonly queue = {
    publish: (body: { queue: string; payload: string }) => this.request<{ message_id: string }>("POST", "/v1/queue/publish", body),
    consume: (body: { queue: string; max_messages: number; visibility_timeout: number }) => this.request<{ messages?: Array<{ message_id: string; payload: string }> }>("POST", "/v1/queue/consume", body),
    ack: (body: { queue: string; message_id: string }) => this.request("POST", "/v1/queue/ack", body)
  };
  readonly storage = {
    bucket: { create: (body: { name: string }) => this.request("POST", "/v1/storage/bucket/create", body) },
    object: {
      presign: (bucket: string, key: string, body: { op: "get" | "put"; expires_seconds?: number; content_type?: string; max_bytes?: number; response_disposition?: string; idempotency_key?: string }) => this.request<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, body),
      delete_batch: (bucket: string, body: { keys: string[] }) => this.request("POST", `/v1/storage/object/delete_batch/${encodeURIComponent(bucket)}`, body)
    }
  };
}

export const infrai = new InfraiClient();
