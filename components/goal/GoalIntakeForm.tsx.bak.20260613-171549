"use client";

import { FormEvent, useMemo, useState } from "react";
import type { GoalInput } from "@/lib/schemas/goal-input";

type CreateResponse = {
  ok: boolean;
  config?: { goal_id: string };
  escalation?: unknown;
  error?: string;
  issues?: Array<{ path: Array<string | number>; message: string }>;
};

const emptyForm: GoalInput = {
  goal: "",
  deadline: "",
  current_value: 0,
  target_value: 0,
  metric: "",
  context: "",
  why: "",
  other_active_goals: [],
};

const exampleForm: GoalInput = {
  goal: "Walk 8,000 steps per day consistently",
  deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  current_value: 3200,
  target_value: 8000,
  metric: "daily steps",
  context: "Desk job, short commute, prefers morning routines, has a smartwatch.",
  why: "Improve energy, cardiovascular health, and mood without adding a gym habit yet.",
  other_active_goals: ["Sleep by 10:30pm", "Cook dinner at home four nights per week"],
};

const gates = [
  "Goal is specific and measurable",
  "Deadline is explicit",
  "Daily action is controllable",
  "No severe conflict with other active goals",
];

export default function GoalIntakeForm() {
  const [form, setForm] = useState<GoalInput>(emptyForm);
  const [otherGoals, setOtherGoals] = useState("");
  const [gateChecks, setGateChecks] = useState<boolean[]>([false, false, false, false]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => gateChecks.every(Boolean) && !loading,
    [gateChecks, loading],
  );

  function update<K extends keyof GoalInput>(key: K, value: GoalInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function loadExample() {
    setForm(exampleForm);
    setOtherGoals(exampleForm.other_active_goals.join("\n"));
    setGateChecks([true, true, true, true]);
    setError(null);
    setSuccess(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload: GoalInput = {
      ...form,
      deadline: new Date(form.deadline).toISOString(),
      other_active_goals: otherGoals
        .split("\n")
        .map((goal) => goal.trim())
        .filter(Boolean),
    };

    try {
      const response = await fetch("/api/goals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as CreateResponse;

      if (!response.ok || !data.ok) {
        const issueText = data.issues?.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
        throw new Error(data.error ?? issueText ?? "Goal creation needs escalation or could not complete.");
      }

      setSuccess(data.config?.goal_id ? `Goal created: ${data.config.goal_id}` : "Goal created successfully.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown creation error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-screen bg-[#f2f2f7] px-4 py-6 font-sans text-slate-950 sm:px-6">
      <form onSubmit={submit} className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#e8912e]">Goal Machine</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Create a goal</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">Match the GoalInput schema and pass the validation gates before launch.</p>
            </div>
            <button type="button" onClick={loadExample} className="rounded-full bg-[#e8912e]/10 px-4 py-2 text-sm font-semibold text-[#b76617] transition hover:bg-[#e8912e]/20">
              Load example
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:col-span-2">
            <span className="text-sm font-semibold">Goal</span>
            <input value={form.goal} onChange={(event) => update("goal", event.target.value)} className="mt-2 w-full rounded-2xl border-0 bg-[#f2f2f7] px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[#e8912e]" placeholder="What do you want to achieve?" required />
          </label>
          <label className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <span className="text-sm font-semibold">Deadline</span>
            <input type="datetime-local" value={form.deadline ? form.deadline.slice(0, 16) : ""} onChange={(event) => update("deadline", event.target.value)} className="mt-2 w-full rounded-2xl border-0 bg-[#f2f2f7] px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[#e8912e]" required />
          </label>
          <label className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <span className="text-sm font-semibold">Metric</span>
            <input value={form.metric} onChange={(event) => update("metric", event.target.value)} className="mt-2 w-full rounded-2xl border-0 bg-[#f2f2f7] px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[#e8912e]" placeholder="daily steps, dollars saved..." required />
          </label>
          <label className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <span className="text-sm font-semibold">Current value</span>
            <input type="number" value={form.current_value} onChange={(event) => update("current_value", Number(event.target.value))} className="mt-2 w-full rounded-2xl border-0 bg-[#f2f2f7] px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[#e8912e]" required />
          </label>
          <label className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <span className="text-sm font-semibold">Target value</span>
            <input type="number" value={form.target_value} onChange={(event) => update("target_value", Number(event.target.value))} className="mt-2 w-full rounded-2xl border-0 bg-[#f2f2f7] px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[#e8912e]" required />
          </label>
          <label className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:col-span-2">
            <span className="text-sm font-semibold">Context</span>
            <textarea value={form.context} onChange={(event) => update("context", event.target.value)} className="mt-2 min-h-24 w-full rounded-2xl border-0 bg-[#f2f2f7] px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[#e8912e]" required />
          </label>
          <label className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:col-span-2">
            <span className="text-sm font-semibold">Why</span>
            <textarea value={form.why} onChange={(event) => update("why", event.target.value)} className="mt-2 min-h-24 w-full rounded-2xl border-0 bg-[#f2f2f7] px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[#e8912e]" required />
          </label>
          <label className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:col-span-2">
            <span className="text-sm font-semibold">Other active goals</span>
            <textarea value={otherGoals} onChange={(event) => setOtherGoals(event.target.value)} className="mt-2 min-h-20 w-full rounded-2xl border-0 bg-[#f2f2f7] px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[#e8912e]" placeholder="One per line" />
          </label>
        </div>

        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-lg font-semibold">Validation gates</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {gates.map((gate, index) => (
              <label key={gate} className="flex items-center gap-3 rounded-2xl bg-[#f2f2f7] p-3 text-sm font-medium">
                <input type="checkbox" checked={gateChecks[index]} onChange={(event) => setGateChecks((current) => current.map((value, itemIndex) => (itemIndex === index ? event.target.checked : value)))} className="h-5 w-5 rounded border-slate-300 accent-[#e8912e]" />
                {gate}
              </label>
            ))}
          </div>
        </div>

        {error && <div className="rounded-3xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-100">{error}</div>}
        {success && <div className="rounded-3xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">{success}</div>}

        <button disabled={!canSubmit} className="rounded-full bg-[#e8912e] px-5 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-[#d47f22] disabled:cursor-not-allowed disabled:bg-slate-300">
          {loading ? "Creating goal…" : "Create goal"}
        </button>
      </form>
    </section>
  );
}
