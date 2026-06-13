"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ActionItem } from "@/lib/schemas/config-output";

type Props = { goalId: string };
type TodayResponse = { ok: boolean; actions?: ActionItem[]; no_response_count?: number; previous_approaches?: string[]; error?: string };
type ActionState = Record<string, { didIt: boolean; doneRight: boolean }>;

export default function DailyExecutionLoop({ goalId }: Props) {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [checks, setChecks] = useState<ActionState>({});
  const [noResponseCount, setNoResponseCount] = useState(0);
  const [retryApproaches, setRetryApproaches] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [outputValue, setOutputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/goals/${goalId}/execution/today`, { cache: "no-store" });
        const data = (await response.json()) as TodayResponse;
        if (!response.ok || data.ok === false) throw new Error(data.error ?? "Could not load today's actions");
        const nextActions = data.actions ?? [];
        if (!active) return;
        setActions(nextActions);
        setChecks(Object.fromEntries(nextActions.map((action) => [action.id, { didIt: false, doneRight: false }])));
        setNoResponseCount(data.no_response_count ?? 0);
        setRetryApproaches(data.previous_approaches ?? []);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unknown execution error");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [goalId]);

  const completed = useMemo(() => Object.values(checks).filter((check) => check.didIt && check.doneRight).length, [checks]);
  const circuitBreaker = noResponseCount >= 5;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const response = await fetch("/api/goals/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalId,
          dailyLogs: [{
            date: new Date().toISOString(),
            actions_completed: completed,
            actions_total: Math.max(actions.length, 1),
            output_value: outputValue === "" ? undefined : Number(outputValue),
            notes,
          }],
          gapDimension: "daily_execution",
          gapMagnitude: Math.max(actions.length - completed, 0),
        }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string; phase?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not save daily state");
      setSaved(data.phase ? `Saved. Correction phase: ${data.phase}.` : "Daily state saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown save error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-[#f2f2f7] p-4 font-sans text-slate-950 sm:p-6">
      <form onSubmit={save} className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#e8912e]">Today</p>
          <div className="mt-1 flex items-end justify-between gap-3"><h2 className="text-2xl font-semibold tracking-tight">Execution loop</h2><span className="text-sm font-semibold text-slate-500">No-response: {noResponseCount}</span></div>
          {circuitBreaker && <div className="mt-4 rounded-3xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100">Circuit breaker active: five missed responses require escalation before more automation.</div>}
        </div>
        {loading && <div className="rounded-[2rem] bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-black/5">Loading today's actions…</div>}
        {error && <div className="rounded-3xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-100">{error}</div>}
        {!loading && !error && actions.map((action) => (
          <div key={action.id} className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{action.action}</h3><p className="mt-1 text-sm text-slate-500">{action.frequency} · trigger: {action.trigger} · {action.duration_minutes} min</p></div><span className="rounded-full bg-[#e8912e]/10 px-3 py-1 text-xs font-bold text-[#9b5a15]">P{action.priority}</span></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl bg-[#f2f2f7] p-3 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-[#e8912e]" checked={checks[action.id]?.didIt ?? false} onChange={(event) => setChecks((current) => ({ ...current, [action.id]: { ...(current[action.id] ?? { didIt: false, doneRight: false }), didIt: event.target.checked } }))} />did it</label>
              <label className="flex items-center gap-3 rounded-2xl bg-[#f2f2f7] p-3 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-[#e8912e]" checked={checks[action.id]?.doneRight ?? false} onChange={(event) => setChecks((current) => ({ ...current, [action.id]: { ...(current[action.id] ?? { didIt: false, doneRight: false }), doneRight: event.target.checked } }))} />done right</label>
            </div>
          </div>
        ))}
        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h3 className="font-semibold">Graduated retry</h3>
          <div className="mt-3 space-y-2">{retryApproaches.length ? retryApproaches.map((approach) => <p key={approach} className="rounded-2xl bg-[#f2f2f7] p-3 text-sm text-slate-600">{approach}</p>) : <p className="text-sm text-slate-500">No retry sequence has been suggested yet.</p>}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={outputValue} onChange={(event) => setOutputValue(event.target.value)} type="number" placeholder="Output value" className="rounded-2xl border-0 bg-[#f2f2f7] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#e8912e]" /><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" className="rounded-2xl border-0 bg-[#f2f2f7] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#e8912e]" /></div>
        </div>
        {saved && <div className="rounded-3xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">{saved}</div>}
        <button disabled={saving || loading} className="w-full rounded-full bg-[#e8912e] px-5 py-4 font-semibold text-white disabled:bg-slate-300">{saving ? "Saving…" : "Save state"}</button>
      </form>
    </section>
  );
}
