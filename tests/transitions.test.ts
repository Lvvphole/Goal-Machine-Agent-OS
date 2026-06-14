import { describe, expect, it } from "vitest";
import { TRANSITIONS } from "@/lib/schemas";
import { GoalStateMachine } from "@/lib/state/machine";

describe("TRANSITIONS matrix", () => {
  it("setup can only transition to active", () => {
    expect(TRANSITIONS.setup).toEqual(["active"]);
  });

  it("completed and abandoned are terminal", () => {
    expect(TRANSITIONS.completed).toEqual([]);
    expect(TRANSITIONS.abandoned).toEqual([]);
  });

  it("active can fan out to multiple downstream states", () => {
    expect(TRANSITIONS.active).toContain("correcting");
    expect(TRANSITIONS.active).toContain("stalled");
    expect(TRANSITIONS.active).toContain("escalated");
    expect(TRANSITIONS.active).toContain("completed");
    expect(TRANSITIONS.active).toContain("abandoned");
  });

  it("breaker can recover to active", () => {
    expect(TRANSITIONS.breaker).toContain("active");
  });
});

describe("GoalStateMachine.canTransition (exit-gate guardrail)", () => {
  const sm = new GoalStateMachine();

  it("setup -> active is valid", () => {
    expect(sm.canTransition("setup", "active")).toBe(true);
  });

  it("setup -> completed is INVALID (catches a deliberately-broken transition)", () => {
    expect(sm.canTransition("setup", "completed")).toBe(false);
  });

  it("active -> correcting is valid", () => {
    expect(sm.canTransition("active", "correcting")).toBe(true);
  });

  it("completed -> active is INVALID (terminal)", () => {
    expect(sm.canTransition("completed", "active")).toBe(false);
  });

  it("escalated -> abandoned is valid", () => {
    expect(sm.canTransition("escalated", "abandoned")).toBe(true);
  });
});
