import { z } from "zod";
import { ModelInput, ModelInterface, ModelMessage, toMessages } from "@/lib/models/interface";
import { describeError, toError } from "./error";

const MAX_RETRIES = 2;

function withFeedback(input: ModelInput, error: unknown, attempt: number): ModelMessage[] {
  return [
    ...toMessages(input),
    {
      role: "user",
      content: [
        `The previous structured output failed validation on attempt ${attempt}.`,
        `Validation error: ${describeError(error)}`,
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
    throw toError(error);
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
