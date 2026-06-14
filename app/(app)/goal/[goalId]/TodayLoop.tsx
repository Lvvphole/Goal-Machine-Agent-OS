"use client";

import { useMemo, useState } from "react";

type Action = {
  id: string;
  action: string;
  frequency?: string;
  trigger?: string;
  duration_minutes?: number;
  priority?: number;
};

type ActionState = { did_it: boolean; done_right: boolean };
type ActionStates = Record<string, ActionState>;

type Props = {
  goalId: string;
  actions: Action[];
  initialStates: ActionStates;
  initialNotes: { improvement: string; best_action: string; output_value: number | null };
};

export default function TodayLoop({ goalId, actions, initialStates, initialNotes }: Props) {
  const [states, setStates] = useState<ActionStates>(initialStates);
  const [improvement, setImprovement] = useState(initialNotes.improvement);
  const [bestAction, setBestAction] = useState(initialNotes.best_action);
  const [outputValue, setOutputValue] = useState<string>(
    initialNotes.output_value == null ? "" : String(initialNotes.output_value),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...actions].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)),
    [actions],
  );

  const completed = Object.values(states).filter((s) => s.did_it).length;
  const total = actions.length;

  function setAction(id: string, partial: Partial<ActionState>) {
    setStates((current) => {
      const prev = current[id] ?? { did_it: false, done_right: false };
      const next = { ...prev, ...partial };
      if (!next.did_it) next.done_right = false;
      return { ...current, [id]: next };
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/goals/${goalId}/execution/today`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_states: states,
          improvement: improvement || null,
          best_action: bestAction || null,
          output_value: outputValue === "" ? null : Number(outputValue),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Save failed");
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown save error");
    } finally {
      setSaving(false);
    }
  }

  if (actions.length === 0) {
    return (
      <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
        <p className="text-sm text-slate-500">No actions in the latest config.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#e8912e]">Today</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Daily actions</h2>
        </div>
        <span className="text-2xl font-semibold tabular-nums">
          {completed}<span className="text-slate-400"> / {total}</span>
        </span>
      </div>

      <ul className="mt-5 space-y-3">
        {sorted.map((action) => {
          const state = states[action.id] ?? { did_it: false, done_right: false };
          const subtitle = [
            action.frequency,
            action.trigger,
            action.duration_minutes ? `${action.duration_minutes}m` : null,
          ].filter(Boolean).join(" \u00B7 ");
          return (
            <li key={action.id} className="rounded-2xl bg-[#f2f2f7] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{action.action}</p>
                  {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
                </div>
                <span className="shrink-0 text-xs text-slate-400">#{action.priority ?? "\u2014"}</span>
              </div>
              <div className="mt-3 flex gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={state.did_it}
                    onChange={(e) => setAction(action.id, { did_it: e.target.checked })}
                    className="h-5 w-5 rounded border-slate-300 accent-[#e8912e]"
                  />
                  Did it
                </label>
                <label className={`inline-flex items-center gap-2 ${state.did_it ? "" : "opacity-40"}`}>
                  <input
                    type="checkbox"
                    checked={state.done_right}
                    disabled={!state.did_it}
                    onChange={(e) => setAction(action.id, { done_right: e.target.checked })}
                    className="h-5 w-5 rounded border-slate-300 accent-emerald-500"
                  />
                  Done right
                </label>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Output value (today\u2019s metric reading)</span>
          <input
            type="number"
            value={outputValue}
            onChange={(e) => { setOutputValue(e.target.value); setSaved(false); }}
            className="mt-1 w-full rounded-2xl border-0 bg-[#f2f2f7] px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[#e8912e]"
            placeholder="e.g. 8420"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Best action today</span>
          <input
            value={bestAction}
            onChange={(e) => { setBestAction(e.target.value); setSaved(false); }}
            className="mt-1 w-full rounded-2xl border-0 bg-[#f2f2f7] px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[#e8912e]"
            placeholder="Which action moved the needle?"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">System improvement</span>
          <textarea
            value={improvement}
            onChange={(e) => { setImprovement(e.target.value); setSaved(false); }}
            className="mt-1 min-h-20 w-full rounded-2xl border-0 bg-[#f2f2f7] px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[#e8912e]"
            placeholder="What did you learn? What will you change tomorrow?"
          />
        </label>
      </div>

      {error && (
        <div className="mt-4 rounded-3xl bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-100">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className={`mt-5 w-full rounded-full px-5 py-4 text-base font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-300 ${saved ? "bg-emerald-500 hover:bg-emerald-600" : "bg-[#e8912e] hover:bg-[#d47f22]"}`}
      >
        {saving ? "Saving\u2026" : saved ? "Saved" : "Save today"}
      </button>
    </div>
  );
}
