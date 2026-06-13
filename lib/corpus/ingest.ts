import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import OpenAI from "openai";
import { CorpusChunk, CorpusMetadata, CorpusStore, ResearchChunk } from "./store";

export type CorpusIngesterOptions = {
  openai?: OpenAI;
  store?: CorpusStore;
  chunkTokens?: number;
  overlapTokens?: number;
};

const EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_CHUNK_TOKENS = 500;
const DEFAULT_OVERLAP_TOKENS = 50;

function decodePdfString(value: string): string {
  return value
    .replace(/\\([nrtbf()\\])/g, (_match, escaped: string) => {
      const replacements: Record<string, string> = {
        n: "\n",
        r: "\r",
        t: "\t",
        b: "\b",
        f: "\f",
        "(": "(",
        ")": ")",
        "\\": "\\",
      };
      return replacements[escaped] ?? escaped;
    })
    .replace(/\\([0-7]{1,3})/g, (_match, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)));
}

function extractTextOperators(source: string): string[] {
  const text: string[] = [];
  const stringOperatorPattern = /\((?:\\.|[^\\()])*\)\s*Tj/g;
  const arrayOperatorPattern = /\[((?:.|\n|\r)*?)\]\s*TJ/g;

  for (const match of source.matchAll(stringOperatorPattern)) {
    text.push(decodePdfString(match[0].replace(/\)\s*Tj$/, "").slice(1)));
  }

  for (const match of source.matchAll(arrayOperatorPattern)) {
    const arrayContent = match[1];
    const strings = arrayContent.match(/\((?:\\.|[^\\()])*\)/g) ?? [];
    text.push(strings.map((value) => decodePdfString(value.slice(1, -1))).join(""));
  }

  return text;
}

function inflatePdfStreams(buffer: Buffer): string[] {
  const binary = buffer.toString("binary");
  const streams: string[] = [];
  const streamPattern = /<<(?:.|\n|\r)*?\/FlateDecode(?:.|\n|\r)*?>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;

  for (const match of binary.matchAll(streamPattern)) {
    const streamBuffer = Buffer.from(match[1], "binary");
    try {
      streams.push(inflateSync(streamBuffer).toString("utf8"));
    } catch {
      // Ignore streams that are not plain zlib payloads; other streams may still contain extractable text.
    }
  }

  return streams;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

async function extractPdfText(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const candidates = [buffer.toString("latin1"), ...inflatePdfStreams(buffer)];
  const text = normalizeText(candidates.flatMap(extractTextOperators).join("\n"));

  if (!text) {
    throw new Error(`No extractable text found in PDF: ${filePath}`);
  }

  return text;
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function chunkText(text: string, chunkTokens: number, overlapTokens: number): CorpusChunk[] {
  const tokens = tokenize(text);
  const chunks: CorpusChunk[] = [];
  const step = Math.max(1, chunkTokens - overlapTokens);

  for (let start = 0; start < tokens.length; start += step) {
    const chunkTokensSlice = tokens.slice(start, start + chunkTokens);

    if (chunkTokensSlice.length === 0) {
      break;
    }

    chunks.push({
      content: chunkTokensSlice.join(" "),
      chunk_index: chunks.length,
      token_count: chunkTokensSlice.length,
    });

    if (start + chunkTokens >= tokens.length) {
      break;
    }
  }

  return chunks;
}

export class CorpusIngester {
  private readonly openai: OpenAI;
  private readonly store: CorpusStore;
  private readonly chunkTokens: number;
  private readonly overlapTokens: number;

  constructor(options: CorpusIngesterOptions = {}) {
    this.openai = options.openai ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.store = options.store ?? new CorpusStore({ openai: this.openai });
    this.chunkTokens = options.chunkTokens ?? DEFAULT_CHUNK_TOKENS;
    this.overlapTokens = options.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  }

  async ingestPDF(filePath: string, metadata: CorpusMetadata): Promise<ResearchChunk[]> {
    const text = await extractPdfText(filePath);
    const chunks = chunkText(text, this.chunkTokens, this.overlapTokens);

    if (chunks.length === 0) {
      return [];
    }

    const embeddingResponse = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: chunks.map((chunk) => chunk.content),
    });
    const embeddings = embeddingResponse.data.map((item) => item.embedding);

    return this.store.add(chunks, embeddings, metadata);
  }
}
