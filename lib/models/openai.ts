import { z } from "zod";
import { ModelInput, ModelInterface, toMessages } from "./interface";

export const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o"] as const;
export type OpenAIModelName = (typeof OPENAI_MODELS)[number];

export type OpenAIModelOptions = {
  model?: OpenAIModelName;
  apiKey?: string;
};

function assertSupportedModel(model: string): asserts model is OpenAIModelName {
  if (!OPENAI_MODELS.includes(model as OpenAIModelName)) {
    throw new Error(`Unsupported OpenAI model: ${model}`);
  }
}

function unwrapInstructorResponse<TSchema extends z.ZodTypeAny>(
  response: unknown,
  schema: TSchema,
): z.infer<TSchema> {
  const candidate =
    response && typeof response === "object" && "data" in response
      ? (response as { data: unknown }).data
      : response;
  return schema.parse(candidate);
}

export class OpenAIModel implements ModelInterface {
  readonly model: OpenAIModelName;
  private readonly apiKey?: string;

  constructor(options: OpenAIModelOptions = {}) {
    const model = options.model ?? "gpt-4o-mini";
    assertSupportedModel(model);
    this.model = model;
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  }

  async call<TSchema extends z.ZodTypeAny>(
    input: ModelInput,
    outputSchema: TSchema,
    maxTokens: number,
    temperature: number,
  ): Promise<z.infer<TSchema>> {
    const [{ default: OpenAI }, { default: Instructor }] = await Promise.all([
      import("openai"),
      import("@instructor-ai/instructor"),
    ]);

    const openai = new OpenAI({ apiKey: this.apiKey });
    const client = Instructor({ client: openai, mode: "TOOLS" });
    const response = await client.chat.completions.create({
      model: this.model,
      messages: toMessages(input),
      max_tokens: maxTokens,
      temperature: 0.0,
      response_model: {
        schema: outputSchema,
        name: "GoalMachineOutput",
      },
    });

    return unwrapInstructorResponse(response, outputSchema);
  }
}
