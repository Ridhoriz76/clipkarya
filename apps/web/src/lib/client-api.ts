"use client";

export class ClientApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public body?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) throw new ClientApiError(String(body.error ?? "Permintaan gagal."), res.status, body.code as string | undefined, body);
  return body as T;
}
