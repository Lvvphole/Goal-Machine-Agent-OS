"use client";

import { useEffect, useMemo, useState } from "react";
import type { GoalClassification } from "@/lib/schemas/classification";

type Props = { goalId: string };
type Gate = { label: string; passed: boolean };
type ApiResponse = { ok: boolean; classification?: GoalClassification; error?: string } & Partial<GoalClassification>;

export default function ValidationGate({ goalId }: Props) {
  const [classification, setClassification] = useState<GoalClassification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/goals/${goalId}/classification`, { cache: "no-store" });
        const data = (await response.json()) as ApiResponse;
        if (!response.ok || data.ok === false) throw new Error(data.error ?? "Could not load validation gates");
        const next = data.classification ?? (data as GoalClassification);
        if (active) setClassification(next);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unknown validation error");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [goalId]);

  const gates = useMemo<Gate[]>(() => {
    if (!classification) return [];
    return [
      { label: "Controllable daily action", passed: classification.controllable_daily_action },
      { label: "No other-person dependency", passed: !classification.involves_other_person },
      { label: "Positive timeframe", passed: classification.timeframe_days > 0 },
      { label: "Risk flags reviewed", passed: classification.risk_flags.length === 0 },
    ];
  }, [classification]);

  return (
    <section className="bg-[#f2f2f7] p-4 font-sans text-slate-950 sm:p-6">
      <div className="mx-auto max-w-2xl rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#e8912e]">Validation</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Goal gates</h2>
        {loading && <div className="mt-5 animate-pulse rounded-3xl bg-[#f2f2f7] p-6 text-sm text-slate-500">Loading classification…</div>}
        {error && <div className="mt-5 rounded-3xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-100">{error}</div>}
        {!loading && !error && classification && (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {gates.map((gate) => (
                <div key={gate.label} className="flex items-center gap-3 rounded-3xl bg-[#f2f2f7] p-4">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${gate.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{gate.passed ? "✓" : "×"}</span>
                  <span className="text-sm font-semibold">{gate.label}</span>
                </div>
              ))}
            </div>
            <div className="rounded-3xl bg-[#e8912e]/10 p-4">
              <div className="flex items-end justify-between gap-3">
                <span className="text-sm font-semibold text-[#9b5a15]">Base-rate success</span>
                <span className="text-3xl font-semibold text-[#9b5a15]">{Math.round(classification.base_rate_success * 100)}%</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{classification.base_rate_source}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
