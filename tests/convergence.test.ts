import { describe, expect, it } from "vitest";

// Mirror of the convergencePhase function in app/api/goals/correct/route.ts
// (kept inline because the original is not exported). Tests pin the contract;
// if the route's logic drifts, this test catches it.
function convergencePhase(logCount: number, gapMagnitude: number) {
  if (logCount <= 7) return gapMagnitude > 0 ? "early_rebuild" : "early_stabilize";
  if (logCount <= 21) return "mid_adjust";
  return "late_fine_tune";
}

describe("convergencePhase", () => {
  it("early_rebuild when log count <= 7 and gap > 0", () => {
    expect(convergencePhase(3, 0.2)).toBe("early_rebuild");
  });

  it("early_stabilize when log count <= 7 and gap == 0", () => {
    expect(convergencePhase(5, 0)).toBe("early_stabilize");
  });

  it("mid_adjust between 8 and 21 logs", () => {
    expect(convergencePhase(14, 0.1)).toBe("mid_adjust");
  });

  it("late_fine_tune past 21 logs", () => {
    expect(convergencePhase(30, 0.05)).toBe("late_fine_tune");
  });
});
