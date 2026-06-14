import { describe, expect, it } from "vitest";

// Mirror of the weeklyRates + hasFlatline + hasBrokenLink helpers in
// app/api/goals/evaluate/route.ts. Lift them inline to test without touching DB.
type Row = { date: string; actions_completed: number | null; actions_total: number | null; output_value: number | null };

function weeklyRates(events: Row[]) {
  return [0, 1, 2].map((w) => {
    const slice = events.slice(w * 7, w * 7 + 7);
    const completed = slice.reduce((s, e) => s + (e.actions_completed ?? 0), 0);
    const total = slice.reduce((s, e) => s + (e.actions_total ?? 0), 0);
    return total === 0 ? 0 : completed / total;
  });
}

function hasFlatline(rates: number[]) {
  return rates.length === 3 && Math.max(...rates) - Math.min(...rates) <= 0.03;
}

function hasBrokenLink(events: Row[]) {
  const total = events.reduce((s, e) => s + (e.actions_total ?? 0), 0);
  const completed = events.reduce((s, e) => s + (e.actions_completed ?? 0), 0);
  const rate = total === 0 ? 0 : completed / total;
  const outs = events.map((e) => e.output_value).filter((v): v is number => typeof v === "number");
  const delta = outs.length >= 2 ? outs[outs.length - 1] - outs[0] : 0;
  return rate >= 0.8 && Math.abs(delta) < 0.01;
}

const row = (c: number, t: number, o: number | null = null): Row => ({ date: "2026-01-01", actions_completed: c, actions_total: t, output_value: o });

describe("weeklyRates", () => {
  it("returns 3 weekly rates from 21 days", () => {
    const events = Array.from({ length: 21 }, () => row(2, 4));
    expect(weeklyRates(events)).toEqual([0.5, 0.5, 0.5]);
  });

  it("returns 0 for an empty week", () => {
    expect(weeklyRates([])).toEqual([0, 0, 0]);
  });
});

describe("hasFlatline", () => {
  it("detects 3 weekly rates within 0.03 of each other", () => {
    expect(hasFlatline([0.50, 0.51, 0.52])).toBe(true);
  });

  it("does not flag a clear upward trend", () => {
    expect(hasFlatline([0.20, 0.50, 0.85])).toBe(false);
  });
});

describe("hasBrokenLink", () => {
  it("flags >=80% completion with zero output delta", () => {
    const events = Array.from({ length: 10 }, (_, i) => row(4, 5, i === 0 ? 100 : 100));
    expect(hasBrokenLink(events)).toBe(true);
  });

  it("does not flag improving output", () => {
    const events = Array.from({ length: 10 }, (_, i) => row(4, 5, 100 + i));
    expect(hasBrokenLink(events)).toBe(false);
  });
});
