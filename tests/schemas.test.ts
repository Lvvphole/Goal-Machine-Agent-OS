import { describe, expect, it } from "vitest";
import {
  GoalInputSchema,
  GoalMachineConfigSchema,
  ConfigVersionSchema,
} from "@/lib/schemas";

describe("GoalInputSchema", () => {
  it("requires every field", () => {
    const result = GoalInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("validates a complete input", () => {
    const result = GoalInputSchema.safeParse({
      goal: "x",
      deadline: new Date(Date.now() + 86_400_000).toISOString(),
      current_value: 0,
      target_value: 10,
      metric: "y",
      context: "z",
      why: "w",
      other_active_goals: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects malformed deadline", () => {
    const result = GoalInputSchema.safeParse({
      goal: "x",
      deadline: "not-a-date",
      current_value: 0,
      target_value: 10,
      metric: "y",
      context: "z",
      why: "w",
      other_active_goals: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("ConfigVersionSchema", () => {
  it("requires diffs as an array (not optional, not null)", () => {
    const result = ConfigVersionSchema.safeParse({
      version_number: 1,
      config: {},
      created_at: new Date().toISOString(),
      rationale: "x",
      // diffs is missing
    });
    expect(result.success).toBe(false);
  });
});
