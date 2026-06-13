import { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { createServiceClient, supabase as defaultSupabase } from "../db/supabase";

export type CorpusMetadata = {
  citation?: string;
  doi?: string;
  study_type?: string;
  tags?: string[];
  [key: string]: unknown;
};

export type CorpusChunk = {
  content: string;
  chunk_index?: number;
  token_count?: number;
};

export type ResearchChunk = CorpusChunk & CorpusMetadata & {
  id?: string | number;
  embedding?: number[] | string;
  similarity?: number;
  metadata?: CorpusMetadata;
};

export type CorpusStoreOptions = {
  client?: SupabaseClient;
  openai?: OpenAI;
  tableName?: string;
  matchFunctionName?: string;
};

const EMBEDDING_MODEL = "text-embedding-3-small";

function normalizeTags(tags: string[] = []): string[] {
  return tags.map((tag) => tag.trim()).filter(Boolean);
}

function parseEmbedding(embedding: number[] | string | undefined): number[] | undefined {
  if (Array.isArray(embedding)) {
    return embedding;
  }

  if (!embedding) {
    return undefined;
  }

  const trimmed = embedding.trim();
  const jsonCandidate = trimmed.startsWith("[") ? trimmed : `[${trimmed}]`;

  try {
    const parsed = JSON.parse(jsonCandidate) as unknown;
    return Array.isArray(parsed) && parsed.every((value) => typeof value === "number")
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedQuery(openai: OpenAI, tags: string[]): Promise<number[]> {
  const input = tags.length > 0 ? tags.join(" ") : "research corpus";
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });

  return response.data[0].embedding;
}

export class CorpusStore {
  private readonly client: SupabaseClient;
  private readonly openai: OpenAI;
  private readonly tableName: string;
  private readonly matchFunctionName: string;

  constructor(options: CorpusStoreOptions = {}) {
    this.client = options.client ?? defaultSupabase ?? createServiceClient();
    this.openai = options.openai ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.tableName = options.tableName ?? "research_chunks";
    this.matchFunctionName = options.matchFunctionName ?? "match_research_chunks";
  }

  async query(tags: string[], topK = 15): Promise<ResearchChunk[]> {
    const normalizedTags = normalizeTags(tags);
    const queryEmbedding = await embedQuery(this.openai, normalizedTags);

    const rpcResponse = await this.client.rpc(this.matchFunctionName, {
      query_embedding: queryEmbedding,
      filter_tags: normalizedTags,
      match_count: topK,
    });

    if (!rpcResponse.error && Array.isArray(rpcResponse.data)) {
      return rpcResponse.data as ResearchChunk[];
    }

    let request = this.client
      .from(this.tableName)
      .select("id, content, chunk_index, token_count, embedding, citation, doi, study_type, tags, metadata")
      .limit(topK * 4);

    if (normalizedTags.length > 0) {
      request = request.overlaps("tags", normalizedTags);
    }

    const { data, error } = await request;

    if (error) {
      throw error;
    }

    return (data as ResearchChunk[])
      .map((chunk) => {
        const embedding = parseEmbedding(chunk.embedding);
        return {
          ...chunk,
          similarity: embedding ? cosineSimilarity(queryEmbedding, embedding) : undefined,
        };
      })
      .sort((left, right) => (right.similarity ?? 0) - (left.similarity ?? 0))
      .slice(0, topK);
  }

  async add(chunks: CorpusChunk[], embeddings: number[][], metadata: CorpusMetadata): Promise<ResearchChunk[]> {
    if (chunks.length !== embeddings.length) {
      throw new Error("chunks and embeddings must have the same length");
    }

    const normalizedTags = normalizeTags(metadata.tags);
    const rows = chunks.map((chunk, index) => ({
      content: chunk.content,
      chunk_index: chunk.chunk_index ?? index,
      token_count: chunk.token_count,
      embedding: embeddings[index],
      citation: metadata.citation,
      doi: metadata.doi,
      study_type: metadata.study_type,
      tags: normalizedTags,
      metadata: {
        ...metadata,
        tags: normalizedTags,
      },
    }));

    const { data, error } = await this.client.from(this.tableName).insert(rows).select();

    if (error) {
      throw error;
    }

    return data as ResearchChunk[];
  }
}
