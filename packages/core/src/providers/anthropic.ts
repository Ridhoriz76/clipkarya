import type { z } from "zod";
import { providerFetch, ProviderError } from "./http";
import { extractJson } from "./json";
import type { TextProvider } from "./types";

export type AnthropicConfig = { apiKey: string; model: string };

export function anthropicText(cfg: AnthropicConfig): TextProvider {
  return {
    id: "anthropic",
    isDemo: false,
    async generateJson<T>(opts: { system: string; prompt: string; schema: z.ZodType<T>; maxTokens?: number }) {
      const res = await providerFetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "x-api-key": cfg.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: cfg.model,
            max_tokens: opts.maxTokens ?? 4000,
            system: `${opts.system}\nRespond with a single JSON object only, no prose.`,
            messages: [{ role: "user", content: opts.prompt }],
          }),
        },
        { provider: "anthropic", timeoutMs: 120_000 },
      );
      const body = (await res.json()) as {
        content: { type: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const text = body.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
      const parsed = opts.schema.safeParse(extractJson(text));
      if (!parsed.success) throw new ProviderError("anthropic", `Invalid JSON shape: ${parsed.error.message.slice(0, 300)}`);
      return {
        data: parsed.data,
        usage: {
          provider: "anthropic",
          operation: "text",
          units: (body.usage?.input_tokens ?? 0) + (body.usage?.output_tokens ?? 0),
          unitType: "tokens",
          estimatedCostUsd: null,
          model: cfg.model,
        },
      };
    },
  };
}
