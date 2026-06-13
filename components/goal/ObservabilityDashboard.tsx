"use client";

import { useEffect, useMemo, useState } from "react";

type Props = { goalId: string };
type EvalResponse = { ok: boolean; weekly_rates?: number[]; recommendation?: string; error?: string };
type MetricsResponse = EvalResponse & { streak?: number; required_pace?: number; actual_pace?: number; trend?: number[] };

function gaugeLabel(recommendation?: string) {
  if (recommendation === "rebuild") return "rebuild";
  if (recommendation === "revise_actions") return "adjust";
  return "fine-tune";
}

export default function ObservabilityDashboard({ goalId }: Props) {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/goals/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goalId }) });
        const data = (await response.json()) as MetricsResponse;
        if (!response.ok || data.ok === false) throw new Error(data.error ?? "Could not load observability metrics");
        if (active) setMetrics(data);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unknown observability error");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [goalId]);

  const trend = useMemo(() => metrics?.trend ?? metrics?.weekly_rates ?? [0.2, 0.45, 0.38, 0.7, 0.62, 0.85], [metrics]);
  const points = trend.map((value, index) => `${(index / Math.max(trend.length - 1, 1)) * 300},${90 - value * 80}`).join(" ");
  const gap = (metrics?.required_pace ?? 1) - (metrics?.actual_pace ?? metrics?.weekly_rates?.at(-1) ?? 0);
  const label = gaugeLabel(metrics?.recommendation);

  return (
    <section className="bg-[#f2f2f7] p-4 font-sans text-slate-950 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5"><p className="text-sm font-semibold uppercase tracking-wide text-[#e8912e]">Observability</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h2></div>
        {loading && <div className="rounded-[2rem] bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-black/5">Loading dashboard…</div>}
        {error && <div className="rounded-3xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-100">{error}</div>}
        {!loading && !error && metrics && <>
          <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5"><p className="text-sm font-semibold text-slate-500">Streak</p><p className="mt-2 text-4xl font-semibold">{metrics.streak ?? 0}</p></div><div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5"><p className="text-sm font-semibold text-slate-500">Pace comparison</p><p className="mt-2 text-2xl font-semibold">{(metrics.actual_pace ?? 0).toFixed(1)} / {(metrics.required_pace ?? 1).toFixed(1)}</p></div><div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5"><p className="text-sm font-semibold text-slate-500">Gap gauge</p><p className="mt-2 text-2xl font-semibold capitalize text-[#9b5a15]">{label}</p><p className="mt-1 text-sm text-slate-500">Gap: {gap.toFixed(1)}</p></div></div>
          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5"><h3 className="font-semibold">Trend</h3><svg viewBox="0 0 300 100" className="mt-4 h-40 w-full overflow-visible"><polyline points={points} fill="none" stroke="#e8912e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /><line x1="0" x2="300" y1="90" y2="90" stroke="#e5e7eb" strokeWidth="2" /></svg></div>
          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5"><h3 className="font-semibold">Weekly rate bars</h3><div className="mt-4 flex h-32 items-end gap-3">{(metrics.weekly_rates ?? []).map((rate, index) => <div key={index} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-2xl bg-[#e8912e]" style={{ height: `${Math.max(rate * 100, 4)}%` }} /><span className="text-xs font-semibold text-slate-500">W{index + 1}</span></div>)}</div></div>
        </>}
      </div>
    </section>
  );
}
