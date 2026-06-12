import { z } from "zod";
import { ModelInput, ModelInterface, ModelMessage, toMessages } from "@/lib/models/interface";

const MAX_RETRIES = 2;

function formatError(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  if (error instanceof Error) return error.message;
  return String(error);
}

function withFeedback(input: ModelInput, error: unknown, attempt: number): ModelMessage[] {
  return [
    ...toMessages(input),
    {
      role: "user",
      content: [
        `The previous structured output failed validation on attempt ${attempt}.`,
        `Validation error: ${formatError(error)}`,
        "Regenerate the full response so it exactly satisfies the requested schema. Return only valid structured data.",
      ].join("\n"),
    },
  ];
}

export async function retryWithFeedback<TSchema extends z.ZodTypeAny>(
  model: ModelInterface,
  input: ModelInput,
  schema: TSchema,
  error: unknown,
  attempt: number,
  maxTokens = 2000,
  temperature = 0.0,
): Promise<z.infer<TSchema>> {
  if (attempt > MAX_RETRIES) {
    throw error instanceof Error ? error : new Error(String(error));
  }

  const nextInput = withFeedback(input, error, attempt);
  try {
    return await model.call(nextInput, schema, maxTokens, temperature);
  } catch (nextError) {
    return retryWithFeedback(
      model,
      nextInput,
      schema,
      nextError,
      attempt + 1,
      maxTokens,
      temperature,
    );
  }
}
