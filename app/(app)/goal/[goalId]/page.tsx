import Link from "next/link";
import { createServiceClient } from "@/lib/db/supabase";
import TodayLoop from "./TodayLoop";

type Action = {
  id: string;
  action: string;
  frequency?: string;
  trigger?: string;
  duration_minutes?: number;
  priority?: number;
};

type BackupPlan = {
  condition: string;
  alternative_action: string;
  notes?: string;
};

type EnvironmentDesign = {
  additions?: string[];
  removals?: string[];
  cues?: string[];
};

type DisplayMetric = {
  label: string;
  unit: string;
  current: number;
  target: number;
  direction: "up" | "down";
};

type Config = {
  goal_id?: string;
  actions?: Action[];
  backup_plans?: BackupPlan[];
  environment_design?: EnvironmentDesign;
  friction_score?: { score: number; factors?: string[]; recommendations?: string[] };
  display_metric?: DisplayMetric;
  check_in_cadence_days?: number;
};

type GoalRow = {
  id: string;
  goal: string | null;
  metric: string | null;
  target_value: number | null;
  current_value: number | null;
  deadline: string | null;
  current_state: string | null;
  confidence: number | null;
};

type ExecEvent = {
  id: string;
  date: string;
  actions_completed: number | null;
  actions_total: number | null;
  output_value: number | null;
  action_states: Record<string, { did_it: boolean; done_right: boolean }> | null;
};

export const dynamic = "force-dynamic";

async function fetchAll(goalId: string): Promise<{
  goal: GoalRow | null;
  config: Config | null;
  events: ExecEvent[];
}> {
  const db = createServiceClient();
  const [goalRes, configRes, eventsRes] = await Promise.all([
    db
      .from("goals")
      .select("id, goal, metric, target_value, current_value, deadline, current_state, confidence")
      .eq("id", goalId)
      .maybeSingle(),
    db
      .from("config_versions")
      .select("config")
      .eq("goal_id", goalId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("execution_events")
      .select("id, date, actions_completed, actions_total, output_value, action_states")
      .eq("goal_id", goalId)
      .order("date", { ascending: false })
      .limit(90),
  ]);

  return {
    goal: (goalRes.data as GoalRow | null) ?? null,
    config: ((configRes.data?.config ?? null) as Config | null),
    events: ((eventsRes.data ?? []) as ExecEvent[]),
  };
}

function daysRemaining(deadline: string | null): number | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function streak(events: ExecEvent[]): number {
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));
  let count = 0;
  for (const e of sorted) {
    if ((e.actions_completed ?? 0) > 0) count += 1;
    else break;
  }
  return count;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function GoalPage({ params }: { params: { goalId: string } }) {
  const { goalId } = params;
  const { goal, config, events } = await fetchAll(goalId);

  if (!goal) {
    return (
      <section className="min-h-screen bg-[#f2f2f7] p-6 font-sans">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-sm text-slate-500">Goal not found: {goalId}</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-full bg-[#e8912e]/10 px-5 py-2 text-sm font-semibold text-[#b76617] transition hover:bg-[#e8912e]/20"
          >
            Back to dashboard
          </Link>
        </div>
      </section>
    );
  }

  const today = todayKey();
  const todayLog = events.find((e) => e.date.startsWith(today)) ?? null;
  const dRem = daysRemaining(goal.deadline);
  const streakCount = streak(events);
  const actions = config?.actions ?? [];
  const backupPlans = config?.backup_plans ?? [];
  const env = config?.environment_design;
  const dispMetric = config?.display_metric;

  const initialStates =
    todayLog?.action_states ??
    Object.fromEntries(actions.map((a) => [a.id, { did_it: false, done_right: false }]));
  const initialNotes = {
    improvement: "",
    best_action: "",
    output_value: todayLog?.output_value ?? null,
  };

  // Last 30 days, oldest -> newest, for the bar chart.
  const last30 = [...events].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);

  return (
    <section className="min-h-screen bg-[#f2f2f7] px-4 py-6 font-sans text-slate-950 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {/* Header */}
        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#e8912e]">Goal Machine</p>
              <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                {goal.goal ?? "(unnamed goal)"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {goal.metric
                  ? `${goal.current_value ?? 0} / ${goal.target_value ?? 0} ${goal.metric}`
                  : "no metric"}
                {dRem != null ? ` \u00B7 ${dRem} days remaining` : ""}
              </p>
            </div>
            <Link
              href="/dashboard"
              className="shrink-0 rounded-full bg-[#f2f2f7] px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
            >
              Dashboard
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-[#f2f2f7] p-3 text-center">
              <p className="text-xs font-semibold text-slate-500">Streak</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{streakCount}</p>
            </div>
            <div className="rounded-2xl bg-[#f2f2f7] p-3 text-center">
              <p className="text-xs font-semibold text-slate-500">State</p>
              <p className="mt-1 text-sm font-semibold capitalize">{goal.current_state ?? "\u2014"}</p>
            </div>
            <div className="rounded-2xl bg-[#f2f2f7] p-3 text-center">
              <p className="text-xs font-semibold text-slate-500">Confidence</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {typeof goal.confidence === "number" ? `${Math.round(goal.confidence * 100)}%` : "\u2014"}
              </p>
            </div>
          </div>
          {dispMetric && (
            <div className="mt-4 rounded-2xl bg-[#e8912e]/10 p-4">
              <p className="text-xs font-semibold text-[#9b5a15]">{dispMetric.label}</p>
              <div className="mt-2 flex items-end justify-between">
                <p className="text-3xl font-semibold tabular-nums text-[#9b5a15]">
                  {dispMetric.current}{" "}
                  <span className="text-base text-[#9b5a15]/70">
                    / {dispMetric.target} {dispMetric.unit}
                  </span>
                </p>
                <p className="text-xs text-[#9b5a15]/80">trending {dispMetric.direction}</p>
              </div>
            </div>
          )}
        </div>

        {/* Today loop */}
        <TodayLoop
          goalId={goalId}
          actions={actions}
          initialStates={initialStates}
          initialNotes={initialNotes}
        />

        {/* Backup plans */}
        {backupPlans.length > 0 && (
          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#e8912e]">Backup plans</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">If / then</h2>
            <ul className="mt-4 space-y-3">
              {backupPlans.map((plan, i) => (
                <li key={i} className="rounded-2xl bg-[#f2f2f7] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">If</p>
                  <p className="text-sm font-semibold">{plan.condition}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Then</p>
                  <p className="text-sm">{plan.alternative_action}</p>
                  {plan.notes && <p className="mt-2 text-xs text-slate-500">{plan.notes}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Environment design */}
        {env && (Boolean(env.cues?.length) || Boolean(env.additions?.length) || Boolean(env.removals?.length)) && (
          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#e8912e]">Environment design</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {env.cues && env.cues.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500">Cues</p>
                  <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
                    {env.cues.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
              {env.additions && env.additions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500">Add</p>
                  <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
                    {env.additions.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
              {env.removals && env.removals.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500">Remove</p>
                  <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
                    {env.removals.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History */}
        {last30.length > 0 && (
          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#e8912e]">History</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Last {last30.length} days</h2>
            <div className="mt-4 flex h-32 items-end gap-1">
              {last30.map((e) => {
                const completed = e.actions_completed ?? 0;
                const total = e.actions_total ?? 0;
                const ratio = total > 0 ? completed / total : 0;
                const heightPct = Math.max(2, Math.round(ratio * 100));
                const color = ratio >= 1 ? "bg-emerald-500" : ratio > 0 ? "bg-[#e8912e]" : "bg-red-400";
                return (
                  <div
                    key={e.id}
                    className="flex flex-1 flex-col items-center justify-end"
                    title={`${e.date.slice(0, 10)}: ${completed}/${total}`}
                  >
                    <div className={`w-full rounded-t ${color}`} style={{ height: `${heightPct}%` }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
