import type { RagChunk } from "@/types/analysis";

/**
 * Local sentence embeddings via Transformers.js (all-MiniLM-L6-v2, 384-dim).
 * No API key, fully local — the model is downloaded + cached on first use.
 *
 * The pipeline is a lazily-initialised singleton (stashed on globalThis so tsx
 * watch reloads don't re-download/re-instantiate it).
 */

export type EmbeddedChunk = RagChunk & { vector: number[] };

const MODEL = "Xenova/all-MiniLM-L6-v2";

type Extractor = (
  text: string | string[],
  opts: { pooling: "mean"; normalize: boolean }
) => Promise<{ data: Float32Array; dims: number[] }>;

const globalForEmb = globalThis as unknown as {
  embedder?: Promise<Extractor>;
};

async function getEmbedder(): Promise<Extractor> {
  if (!globalForEmb.embedder) {
    globalForEmb.embedder = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      return (await pipeline("feature-extraction", MODEL)) as unknown as Extractor;
    })();
  }
  return globalForEmb.embedder;
}

/** Embed an array of texts -> one normalized 384-dim vector each. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extractor = await getEmbedder();
  const vectors: number[][] = [];
  // Embed one at a time: simple, and the corpus per analysis is tiny.
  for (const text of texts) {
    const out = await extractor(text, { pooling: "mean", normalize: true });
    vectors.push(Array.from(out.data));
  }
  return vectors;
}

/** Attach vectors to chunks (used once per analysis, then cached in JSONB). */
export async function embedChunks(chunks: RagChunk[]): Promise<EmbeddedChunk[]> {
  const vectors = await embedTexts(chunks.map((c) => c.text));
  return chunks.map((c, i) => ({ ...c, vector: vectors[i] }));
}

/** Cosine similarity. Vectors from embedTexts are already L2-normalized. */
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/** Embed a query and return the top-k most similar chunks. */
export async function topKChunks(
  question: string,
  embedded: EmbeddedChunk[],
  k = 4
): Promise<RagChunk[]> {
  if (embedded.length === 0) return [];
  const [qVec] = await embedTexts([question]);
  return embedded
    .map((c) => ({ chunk: c, score: cosineSim(qVec, c.vector) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, k)
    .map(({ chunk }) => {
      // Strip the vector from what we return/cite.
      const { vector: _vector, ...rest } = chunk;
      return rest;
    });
}
