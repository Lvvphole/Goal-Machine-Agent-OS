"use client";

import { useEffect, useMemo, useState } from "react";
import type { ConfidenceScore } from "@/lib/schemas/confidence";

type Props = { goalId: string };
type ApiResponse = { ok: boolean; confidence?: ConfidenceScore | null; error?: string };

const thresholds = [
  { label: "auto-apply", min: 0.8, color: "bg-emerald-500" },
  { label: "suggest", min: 0.6, color: "bg-[#e8912e]" },
  { label: "escalate", min: 0.4, color: "bg-orange-500" },
  { label: "reject", min: 0, color: "bg-red-500" },
];

export default function ConfidencePanel({ goalId }: Props) {
  const [confidence, setConfidence] = useState<ConfidenceScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/state/${goalId}`, { cache: "no-store" });
        const data = (await response.json()) as ApiResponse;
        if (!response.ok || data.ok === false) throw new Error(data.error ?? "Could not load confidence");
        if (active) setConfidence(data.confidence ?? null);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unknown confidence error");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [goalId]);

  const activeThreshold = useMemo(() => thresholds.find((threshold) => (confidence?.overall ?? 0) >= threshold.min) ?? thresholds[3], [confidence]);
  const daysSinceData = confidence ? Math.max(0, Math.floor((Date.now() - new Date(confidence.computed_at).getTime()) / 86_400_000)) : 0;

  return (
    <section className="bg-[#f2f2f7] p-4 font-sans text-slate-950 sm:p-6">
      <div className="mx-auto max-w-2xl rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#e8912e]">Confidence</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Composite score</h2>
        {loading && <div className="mt-5 rounded-3xl bg-[#f2f2f7] p-6 text-sm text-slate-500">Loading confidence…</div>}
        {error && <div className="mt-5 rounded-3xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-100">{error}</div>}
        {!loading && !error && !confidence && <div className="mt-5 rounded-3xl bg-[#f2f2f7] p-4 text-sm text-slate-500">No confidence score is available yet.</div>}
        {!loading && !error && confidence && (
          <div className="mt-5 space-y-5">
            <div className="flex items-end justify-between rounded-3xl bg-[#e8912e]/10 p-5"><div><p className="text-sm font-semibold text-[#9b5a15]">Overall</p><p className="mt-1 text-sm capitalize text-slate-500">{confidence.label}</p></div><span className="text-5xl font-semibold text-[#9b5a15]">{Math.round(confidence.overall * 100)}</span></div>
            <div className="space-y-3">
              {Object.entries(confidence.components).slice(0, 4).map(([name, value]) => (
                <div key={name}><div className="mb-1 flex justify-between text-sm"><span className="font-medium capitalize">{name.replaceAll("_", " ")}</span><span className="text-slate-500">{Math.round(value * 100)}%</span></div><div className="h-3 rounded-full bg-[#f2f2f7]"><div className="h-3 rounded-full bg-[#e8912e]" style={{ width: `${value * 100}%` }} /></div></div>
              ))}
            </div>
            <div className="rounded-3xl bg-[#f2f2f7] p-4"><p className="text-sm font-semibold">Threshold: <span className="text-[#9b5a15]">{activeThreshold.label}</span></p><div className="mt-3 grid grid-cols-4 gap-2">{thresholds.map((threshold) => <div key={threshold.label} className={`h-2 rounded-full ${threshold.label === activeThreshold.label ? threshold.color : "bg-slate-300"}`} />)}</div></div>
            <div className="rounded-3xl bg-white p-4 ring-1 ring-black/5"><p className="text-sm font-semibold">Decay indicator</p><p className="mt-1 text-sm text-slate-500">{daysSinceData} days since last confidence data.</p></div>
          </div>
        )}
      </div>
    </section>
  );
}
