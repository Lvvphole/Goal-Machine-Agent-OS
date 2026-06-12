import { z } from "zod";
import { AnthropicModel, AnthropicModelName } from "@/lib/models/anthropic";
import { ModelInput, ModelInterface } from "@/lib/models/interface";
import { OpenAIModel, OpenAIModelName } from "@/lib/models/openai";

export type ModelRole = "classifier" | "retriever" | "generator";
export type ModelProvider = "anthropic" | "openai";

type RoleSettings = {
  provider: ModelProvider;
  model: AnthropicModelName | OpenAIModelName;
  fallbackProvider: ModelProvider;
  fallbackModel: AnthropicModelName | OpenAIModelName;
};

const ROLE_DEFAULTS: Record<ModelRole, RoleSettings> = {
  classifier: {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    fallbackProvider: "openai",
    fallbackModel: "gpt-4o-mini",
  },
  retriever: {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    fallbackProvider: "openai",
    fallbackModel: "gpt-4o",
  },
  generator: {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    fallbackProvider: "openai",
    fallbackModel: "gpt-4o",
  },
};

export class Settings {
  getModelSettings(role: ModelRole): RoleSettings {
    const defaults = ROLE_DEFAULTS[role];
    const prefix = `GOAL_MACHINE_${role.toUpperCase()}`;

    return {
      provider: this.providerFromEnv(process.env[`${prefix}_PROVIDER`], defaults.provider),
      model: process.env[`${prefix}_MODEL`] ?? defaults.model,
      fallbackProvider: this.providerFromEnv(
        process.env[`${prefix}_FALLBACK_PROVIDER`],
        defaults.fallbackProvider,
      ),
      fallbackModel: process.env[`${prefix}_FALLBACK_MODEL`] ?? defaults.fallbackModel,
    } as RoleSettings;
  }

  private providerFromEnv(value: string | undefined, fallback: ModelProvider): ModelProvider {
    return value === "openai" || value === "anthropic" ? value : fallback;
  }
}

export class ModelRouter {
  constructor(private readonly settings = new Settings()) {}

  route(role: ModelRole): ModelInterface {
    const config = this.settings.getModelSettings(role);
    return this.createModel(config.provider, config.model);
  }

  fallback(role: ModelRole): ModelInterface {
    const config = this.settings.getModelSettings(role);
    return this.createModel(config.fallbackProvider, config.fallbackModel);
  }

  async call<TSchema extends z.ZodTypeAny>(
    role: ModelRole,
    input: ModelInput,
    schema: TSchema,
    maxTokens: number,
    temperature = 0.0,
  ): Promise<z.infer<TSchema>> {
    try {
      return await this.route(role).call(input, schema, maxTokens, temperature);
    } catch (primaryError) {
      try {
        return await this.fallback(role).call(input, schema, maxTokens, temperature);
      } catch (fallbackError) {
        throw new AggregateError([primaryError, fallbackError], `${role} model and fallback both failed`);
      }
    }
  }

  private createModel(provider: ModelProvider, model: string): ModelInterface {
    if (provider === "openai") {
      return new OpenAIModel({ model: model as OpenAIModelName });
    }
    return new AnthropicModel({ model: model as AnthropicModelName });
  }
}
