import { UserFacingError } from "../jobs";

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
  }

  /** Convert to a message that is safe to show to end users. */
  toUserFacing(): UserFacingError {
    if (this.status === 401 || this.status === 403)
      return new UserFacingError(`Kredensial penyedia ${this.provider} tidak valid. Hubungi admin.`, "provider_auth");
    if (this.status === 429) return new UserFacingError(`Penyedia ${this.provider} sedang sibuk (rate limit). Coba lagi nanti.`, "provider_rate_limit", true);
    if (this.status === 400 || this.status === 422)
      return new UserFacingError(`Permintaan ditolak oleh penyedia ${this.provider}. Periksa input Anda.`, "provider_rejected");
    return new UserFacingError(`Penyedia ${this.provider} gagal memproses permintaan.`, "provider_failed", this.retryable);
  }
}

export type FetchOptions = {
  provider: string;
  timeoutMs?: number;
  retries?: number;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch with timeout and bounded exponential backoff on 408/429/5xx and network errors.
 * Bodies must be re-creatable (string/Buffer/FormData), which all adapters use.
 */
export async function providerFetch(url: string, init: RequestInit, opts: FetchOptions): Promise<Response> {
  const retries = opts.retries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const f = opts.fetchImpl ?? fetch;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await f(url, { ...init, signal: ctrl.signal });
      if (res.ok) return res;
      const retryable = res.status === 408 || res.status === 429 || res.status >= 500;
      const body = await res.text().catch(() => "");
      lastErr = new ProviderError(opts.provider, `HTTP ${res.status}: ${body.slice(0, 500)}`, res.status, retryable);
      if (!retryable || attempt === retries) throw lastErr;
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 20_000) : 1000 * 2 ** attempt);
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const aborted = (err as Error)?.name === "AbortError";
      lastErr = new ProviderError(opts.provider, aborted ? `timeout after ${timeoutMs}ms` : String((err as Error)?.message ?? err), undefined, true);
      if (attempt === retries) throw lastErr;
      await sleep(1000 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
