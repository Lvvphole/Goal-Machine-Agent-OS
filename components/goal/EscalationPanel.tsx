"use client";

import { useEffect, useState } from "react";
import type { Escalation } from "@/lib/schemas/escalation";

type Props = { goalId: string };
type EscalationRow = Escalation & { partial_output?: string; suggested_resolution?: string };
type ApiResponse = { ok: boolean; escalation?: EscalationRow | null; error?: string };

export default function EscalationPanel({ goalId }: Props) {
  const [escalation, setEscalation] = useState<EscalationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/goals/${goalId}/escalations/current`, { cache: "no-store" });
        const data = (await response.json()) as ApiResponse;
        if (!response.ok || data.ok === false) throw new Error(data.error ?? "Could not load escalation status");
        if (active) setEscalation(data.escalation ?? null);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unknown escalation error");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [goalId]);

  async function resolve() {
    if (!escalation) return;
    setResolving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/goals/${goalId}/escalations/${escalation.id}/resolve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolution: escalation.suggested_resolution ?? "Resolved from UI" }) });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not resolve escalation");
      setEscalation({ ...escalation, resolved: true, resolved_at: new Date().toISOString() });
      setMessage("Escalation resolved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown resolve error");
    } finally {
      setResolving(false);
    }
  }

  return (
    <section className="bg-[#f2f2f7] p-4 font-sans text-slate-950 sm:p-6">
      <div className="mx-auto max-w-2xl rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#e8912e]">Escalation</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Current status</h2>
        {loading && <div className="mt-5 rounded-3xl bg-[#f2f2f7] p-6 text-sm text-slate-500">Loading escalation…</div>}
        {error && <div className="mt-5 rounded-3xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-100">{error}</div>}
        {message && <div className="mt-5 rounded-3xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">{message}</div>}
        {!loading && !error && !escalation && <div className="mt-5 rounded-3xl bg-[#f2f2f7] p-4 text-sm text-slate-500">No active escalation.</div>}
        {!loading && !error && escalation && (
          <div className="mt-5 space-y-4">
            <div className="rounded-3xl bg-[#f2f2f7] p-4"><p className="text-xs font-bold uppercase text-slate-400">Status</p><p className="mt-1 text-lg font-semibold">{escalation.resolved ? "Resolved" : "Open"}</p></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-3xl bg-white p-4 ring-1 ring-black/5"><p className="text-xs font-bold uppercase text-slate-400">Trigger</p><p className="mt-1 font-semibold">{escalation.trigger}</p></div><div className="rounded-3xl bg-white p-4 ring-1 ring-black/5"><p className="text-xs font-bold uppercase text-slate-400">Date</p><p className="mt-1 text-sm text-slate-600">{new Date(escalation.triggered_at).toLocaleString()}</p></div></div>
            <div className="rounded-3xl bg-[#f2f2f7] p-4"><p className="text-xs font-bold uppercase text-slate-400">Partial output</p><p className="mt-1 text-sm text-slate-600">{escalation.partial_output ?? escalation.description}</p></div>
            <div className="rounded-3xl bg-[#e8912e]/10 p-4"><p className="text-xs font-bold uppercase text-[#9b5a15]">Suggested resolution</p><p className="mt-1 text-sm text-slate-700">{escalation.suggested_resolution ?? "Review the trigger, inspect partial output, then resume or rebuild the goal plan."}</p></div>
            <button onClick={resolve} disabled={resolving || escalation.resolved} className="w-full rounded-full bg-[#e8912e] px-5 py-3 font-semibold text-white disabled:bg-slate-300">{resolving ? "Resolving…" : "Resolve"}</button>
          </div>
        )}
      </div>
    </section>
  );
}
