import { z } from "zod";
import { ModelInput, ModelInterface, toMessages } from "./interface";

export const ANTHROPIC_MODELS = ["claude-haiku-4-5", "claude-sonnet-4-6"] as const;
export type AnthropicModelName = (typeof ANTHROPIC_MODELS)[number];

export type AnthropicModelOptions = {
  model?: AnthropicModelName;
  apiKey?: string;
};

function assertSupportedModel(model: string): asserts model is AnthropicModelName {
  if (!ANTHROPIC_MODELS.includes(model as AnthropicModelName)) {
    throw new Error(`Unsupported Anthropic model: ${model}`);
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

export class AnthropicModel implements ModelInterface {
  readonly model: AnthropicModelName;
  private readonly apiKey?: string;

  constructor(options: AnthropicModelOptions = {}) {
    const model = options.model ?? "claude-haiku-4-5";
    assertSupportedModel(model);
    this.model = model;
    this.apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  }

  async call<TSchema extends z.ZodTypeAny>(
    input: ModelInput,
    outputSchema: TSchema,
    maxTokens: number,
    temperature: number,
  ): Promise<z.infer<TSchema>> {
    const [{ default: Anthropic }, { default: Instructor }] = await Promise.all([
      import("@anthropic-ai/sdk"),
      import("@instructor-ai/instructor"),
    ]);

    const anthropic = new Anthropic({ apiKey: this.apiKey });
    const client = Instructor({ client: anthropic, mode: "TOOLS" });
    const response = await client.messages.create({
      model: this.model,
      messages: toMessages(input).filter((message) => message.role !== "system"),
      system: toMessages(input).find((message) => message.role === "system")?.content,
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
