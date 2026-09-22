import { createHash } from "node:crypto";
import { env } from "../config/env.js";

type EmbeddingInput = {
  input: string;
};

export class AiProviderUnavailableError extends Error {
  constructor(message = "AI provider is not configured") {
    super(message);
  }
}

export function aiReadiness() {
  const enabled = env.AI_ENABLED && env.AI_PROVIDER !== "DISABLED";
  const hasCredentials = env.AI_PROVIDER === "LOCAL_HASH" || Boolean(env.AI_API_KEY);
  return {
    enabled,
    provider: env.AI_PROVIDER,
    model: env.AI_EMBEDDING_MODEL,
    dimensions: env.AI_EMBEDDING_DIMENSIONS,
    ready: enabled && hasCredentials,
    missing: enabled && !hasCredentials ? ["AI_API_KEY"] : []
  };
}

function localHashEmbedding(input: string, dimensions: number) {
  const values: number[] = [];
  for (let index = 0; index < dimensions; index += 1) {
    const hash = createHash("sha256").update(`${index}:${input}`).digest();
    const uint = hash.readUInt32BE(0);
    values.push((uint / 0xffffffff) * 2 - 1);
  }

  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1;
  return values.map((value) => Number((value / magnitude).toFixed(8)));
}

async function openAiCompatibleEmbedding(input: EmbeddingInput) {
  if (!env.AI_API_KEY) {
    throw new AiProviderUnavailableError("AI_API_KEY is required for OPENAI_COMPATIBLE provider");
  }

  const response = await fetch(`${env.AI_BASE_URL.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.AI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: env.AI_EMBEDDING_MODEL,
      input: input.input,
      dimensions: env.AI_EMBEDDING_DIMENSIONS
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`AI embedding request failed with ${response.status}: ${text.slice(0, 500)}`);
  }

  const payload = await response.json() as { data?: Array<{ embedding?: number[] }> };
  const vector = payload.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("AI embedding response did not include an embedding vector");
  }

  return vector;
}

export async function createEmbedding(input: EmbeddingInput) {
  const readiness = aiReadiness();
  if (!readiness.ready) {
    throw new AiProviderUnavailableError();
  }

  if (env.AI_PROVIDER === "LOCAL_HASH") {
    return localHashEmbedding(input.input, env.AI_EMBEDDING_DIMENSIONS);
  }

  if (env.AI_PROVIDER === "OPENAI_COMPATIBLE") {
    return openAiCompatibleEmbedding(input);
  }

  throw new AiProviderUnavailableError();
}
