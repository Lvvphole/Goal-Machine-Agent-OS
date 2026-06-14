import { describe, expect, it } from "vitest";
import {
  gate1Input,
  gate2BaseRate,
  gate3Evidence,
  gate4Output,
  GateError,
} from "@/lib/harness/gates";

const futureDate = () => new Date(Date.now() + 30 * 86_400_000).toISOString();
const pastDate = () => new Date(Date.now() - 30 * 86_400_000).toISOString();

const validInput = {
  goal: "Walk 8000 steps daily",
  deadline: futureDate(),
  current_value: 3200,
  target_value: 8000,
  metric: "daily steps",
  context: "desk job",
  why: "energy",
  other_active_goals: [],
};

describe("gate1Input", () => {
  it("accepts a valid goal input", () => {
    expect(gate1Input(validInput)).toEqual(validInput);
  });

  it("rejects an input with a past deadline", () => {
    expect(() => gate1Input({ ...validInput, deadline: pastDate() })).toThrow(GateError);
  });

  it("rejects when current_value equals target_value", () => {
    expect(() => gate1Input({ ...validInput, current_value: 8000 })).toThrow(GateError);
  });

  it("rejects a malformed input (missing required field)", () => {
    const { goal, ...withoutGoal } = validInput;
    expect(() => gate1Input(withoutGoal)).toThrow(GateError);
  });
});

const validClassification = {
  domain: "health" as const,
  goal_type: "habit" as const,
  metric_unit: "steps",
  target_delta: 4800,
  timeframe_days: 90,
  base_rate_success: 0.45,
  base_rate_source: "James Clear, Atomic Habits",
  involves_other_person: false,
  controllable_daily_action: true,
  risk_flags: [],
  recommended_corpus_tags: ["fitness", "habits"],
};

describe("gate2BaseRate", () => {
  it("accepts a healthy classification", () => {
    expect(gate2BaseRate(validClassification)).toEqual(validClassification);
  });

  it("rejects when base_rate_success is below 0.05", () => {
    expect(() => gate2BaseRate({ ...validClassification, base_rate_success: 0.02 })).toThrow(GateError);
  });

  it("rejects an empty base_rate_source", () => {
    expect(() => gate2BaseRate({ ...validClassification, base_rate_source: "   " })).toThrow(GateError);
  });
});

const validEvidence = {
  evidence: {
    total_sources: 3,
    retrieval_date: new Date().toISOString(),
    records: [
      { source: "study A", title: "t1", summary: "s1", relevance_score: 0.8 },
      { source: "study B", title: "t2", summary: "s2", relevance_score: 0.6 },
      { source: "study C", title: "t3", summary: "s3", relevance_score: 0.5 },
    ],
  },
  recommended_actions: [
    { action: "walk daily", rationale: "evidence-backed", frequency: "daily", effort_level: "low" as const, evidence_strength: "strong" as const },
  ],
  failure_modes: [
    { mode: "weather", probability: 0.2, mitigation: "treadmill" },
  ],
  synthesis: "Walking improves daily step count via evidence X, Y, Z.",
};

const sparseEvidence = {
  ...validEvidence,
  evidence: {
    total_sources: 3,
    retrieval_date: new Date().toISOString(),
    records: [
      { source: "a", title: "t", summary: "s", relevance_score: 0.2 },
      { source: "b", title: "t", summary: "s", relevance_score: 0.3 },
      { source: "c", title: "t", summary: "s", relevance_score: 0.4 },
    ],
  },
};

describe("gate3Evidence", () => {
  it("accepts a research bundle with enough relevant sources", () => {
    expect(gate3Evidence(validEvidence)).toEqual(validEvidence);
  });

  it("rejects when fewer than 2 sources meet the relevance threshold", () => {
    expect(() => gate3Evidence(sparseEvidence)).toThrow(GateError);
  });

  it("rejects empty recommended_actions", () => {
    expect(() => gate3Evidence({ ...validEvidence, recommended_actions: [] })).toThrow(GateError);
  });
});

const validConfig = {
  goal_id: "11111111-1111-1111-1111-111111111111",
  created_at: futureDate(),
  actions: [
    { id: "22222222-2222-2222-2222-222222222222", action: "walk", frequency: "daily", trigger: "morning", duration_minutes: 15, priority: 1 },
  ],
  backup_plans: [
    { condition: "rain", alternative_action: "treadmill", notes: "" },
  ],
  friction_score: { score: 3, factors: [], recommendations: [] },
  environment_design: { additions: [], removals: [], cues: [] },
  display_metric: { label: "steps", unit: "steps", current: 3200, target: 8000, direction: "up" as const },
  check_in_cadence_days: 7,
  escalation_threshold_days: 14,
};

describe("gate4Output", () => {
  it("accepts a valid generated config", () => {
    expect(gate4Output(validConfig)).toEqual(validConfig);
  });

  it("rejects a config with zero actions", () => {
    expect(() => gate4Output({ ...validConfig, actions: [] })).toThrow(GateError);
  });

  it("rejects when check-in cadence exceeds escalation threshold", () => {
    expect(() => gate4Output({ ...validConfig, check_in_cadence_days: 21, escalation_threshold_days: 14 })).toThrow(GateError);
  });
});
