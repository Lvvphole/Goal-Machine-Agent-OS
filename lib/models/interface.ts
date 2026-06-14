import { z } from "zod";

export type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ModelInput = string | ModelMessage[];

export type ModelUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type ModelCallResult<T> = {
  data: T;
  usage: ModelUsage;
};

export interface ModelInterface {
  call<TSchema extends z.ZodTypeAny>(
    input: ModelInput,
    outputSchema: TSchema,
    maxTokens: number,
    temperature: number,
  ): Promise<ModelCallResult<z.infer<TSchema>>>;
}

export function toMessages(input: ModelInput): ModelMessage[] {
  return typeof input === "string" ? [{ role: "user", content: input }] : input;
}

export const EMPTY_USAGE: ModelUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
