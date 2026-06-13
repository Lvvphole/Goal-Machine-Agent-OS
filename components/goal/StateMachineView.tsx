"use client";

import { useEffect, useState } from "react";
import type { GoalState, StateTransition } from "@/lib/schemas/state";

const states: GoalState[] = ["setup", "active", "correcting", "breaker", "stalled", "rebuilding", "escalated", "completed", "abandoned"];

type Props = { goalId: string };
type ApiResponse = { ok: boolean; state?: GoalState; current_state?: GoalState; transition_history?: StateTransition[]; history?: StateTransition[]; error?: string };

export default function StateMachineView({ goalId }: Props) {
  const [currentState, setCurrentState] = useState<GoalState | null>(null);
  const [history, setHistory] = useState<StateTransition[]>([]);
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
        if (!response.ok || data.ok === false) throw new Error(data.error ?? "Could not load state machine");
        if (!active) return;
        setCurrentState(data.current_state ?? data.state ?? null);
        setHistory(data.transition_history ?? data.history ?? []);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unknown state error");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [goalId]);

  return (
    <section className="bg-[#f2f2f7] p-4 font-sans text-slate-950 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5"><p className="text-sm font-semibold uppercase tracking-wide text-[#e8912e]">State</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Machine view</h2></div>
        {loading && <div className="rounded-[2rem] bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-black/5">Loading state machine…</div>}
        {error && <div className="rounded-3xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-100">{error}</div>}
        {!loading && !error && currentState && (
          <>
            <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{states.map((state) => <div key={state} className={`rounded-3xl p-4 text-center text-sm font-semibold capitalize transition ${state === currentState ? "bg-[#e8912e] text-white shadow-sm" : "bg-[#f2f2f7] text-slate-500"}`}>{state}</div>)}</div></div>
            <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5"><h3 className="font-semibold">Transition history</h3><div className="mt-4 space-y-3">{history.length === 0 ? <p className="text-sm text-slate-500">No transitions recorded yet.</p> : history.map((transition, index) => <div key={`${transition.timestamp}-${index}`} className="rounded-3xl bg-[#f2f2f7] p-4"><div className="flex flex-wrap items-center gap-2 text-sm font-semibold"><span className="capitalize">{transition.from}</span><span className="text-[#e8912e]">→</span><span className="capitalize">{transition.to}</span></div><p className="mt-1 text-xs text-slate-500">{new Date(transition.timestamp).toLocaleString()}</p><p className="mt-2 text-sm text-slate-600">{transition.reason}</p></div>)}</div></div>
          </>
        )}
      </div>
    </section>
  );
}
