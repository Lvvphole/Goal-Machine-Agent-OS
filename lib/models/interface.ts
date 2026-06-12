import { z } from "zod";

export type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ModelInput = string | ModelMessage[];

export interface ModelInterface {
  call<TSchema extends z.ZodTypeAny>(
    input: ModelInput,
    outputSchema: TSchema,
    maxTokens: number,
    temperature: number,
  ): Promise<z.infer<TSchema>>;
}

export function toMessages(input: ModelInput): ModelMessage[] {
  return typeof input === "string" ? [{ role: "user", content: input }] : input;
}
