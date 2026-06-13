declare module "openai" {
  export type EmbeddingCreateParams = {
    model: string;
    input: string | string[];
  };

  export type Embedding = {
    embedding: number[];
  };

  export type CreateEmbeddingResponse = {
    data: Embedding[];
  };

  export default class OpenAI {
    constructor(options?: { apiKey?: string });
    embeddings: {
      create(params: EmbeddingCreateParams): Promise<CreateEmbeddingResponse>;
    };
  }
}

declare module "@anthropic-ai/sdk" {
  export default class Anthropic {
    constructor(options?: { apiKey?: string });
  }
}

declare module "@instructor-ai/instructor" {
  const Instructor: (options: { client: unknown; mode?: string }) => any;
  export default Instructor;
}

declare module "dotenv" {
  export function config(options?: unknown): unknown;
}

declare module "prisma/config" {
  export function defineConfig(config: unknown): unknown;
}

declare module "dotenv/config";
