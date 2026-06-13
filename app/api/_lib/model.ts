import { z } from "zod";
import { createServiceClient } from "@/lib/db/supabase";
import { ModelInput } from "@/lib/models/interface";
import { ModelRouter } from "@/lib/harness/model-router";


export async function callModelC<TSchema extends z.ZodTypeAny>(
  goalId: string | null,
  stage: string,
  input: ModelInput,
  schema: TSchema,
  maxTokens: number,
): Promise<z.infer<TSchema>> {
  const startedAt = Date.now();
  const router = new ModelRouter();
  try {
    return await router.call("generator", input, schema, maxTokens, 0.0);
  } finally {
    const durationMs = Date.now() - startedAt;
    const db = createServiceClient();
    await db.from("agent_runs").insert({
      goal_id: goalId,
      model_used: "generator",
      prompt_tokens: null,
      completion_tokens: null,
      cost_usd: null,
      duration_ms: durationMs,
      stage,
    });
  }
}
