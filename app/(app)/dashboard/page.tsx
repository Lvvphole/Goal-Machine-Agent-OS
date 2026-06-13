import Link from "next/link";
import { createServiceClient } from "@/lib/db/supabase";

type GoalRow = {
  id: string;
  goal: string | null;
  metric: string | null;
  target_value: number | null;
  current_value: number | null;
  deadline: string | null;
  current_state: string | null;
  confidence: number | null;
  updated_at: string | null;
};

export const dynamic = "force-dynamic";

async function fetchGoals(): Promise<GoalRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("goals")
    .select(
      "id, goal, metric, target_value, current_value, deadline, current_state, confidence, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("dashboard fetchGoals failed:", error.message);
    return [];
  }
  return (data as GoalRow[]) ?? [];
}

function stateBadge(state: string | null): string {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1";
  switch (state) {
    case "active":
      return `${base} bg-green-50 text-green-700 ring-green-600/20`;
    case "completed":
      return `${base} bg-blue-50 text-blue-700 ring-blue-600/20`;
    case "correcting":
    case "rebuilding":
      return `${base} bg-amber-50 text-amber-700 ring-amber-600/20`;
    case "escalated":
    case "stalled":
    case "breaker":
      return `${base} bg-orange-50 text-orange-700 ring-orange-600/20`;
    case "abandoned":
      return `${base} bg-red-50 text-red-700 ring-red-600/20`;
    default:
      return `${base} bg-slate-100 text-slate-600 ring-slate-500/20`;
  }
}

export default async function DashboardPage() {
  const goals = await fetchGoals();

  return (
    <section className="min-h-screen bg-[#f2f2f7] px-4 py-6 font-sans text-slate-950 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#e8912e]">
                Goal Machine
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {goals.length} {goals.length === 1 ? "goal" : "goals"} tracked.
              </p>
            </div>
            <Link
              href="/goal/new"
              className="self-start rounded-full bg-[#e8912e] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#b76617]"
            >
              New goal
            </Link>
          </div>
        </div>

        {goals.length === 0 ? (
          <div className="rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
            <p className="text-sm text-slate-500">No goals yet.</p>
            <Link
              href="/goal/new"
              className="mt-4 inline-block rounded-full bg-[#e8912e]/10 px-5 py-2 text-sm font-semibold text-[#b76617] transition hover:bg-[#e8912e]/20"
            >
              Create your first goal
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {goals.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/goal/${g.id}`}
                  className="block rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5 transition hover:ring-[#e8912e]/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-semibold">
                        {g.goal ?? "(unnamed goal)"}
                      </h2>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {g.metric
                          ? `${g.current_value ?? 0} / ${g.target_value ?? 0} ${g.metric}`
                          : "no metric"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={stateBadge(g.current_state)}>
                        {g.current_state ?? "unknown"}
                      </span>
                      {typeof g.confidence === "number" && (
                        <span className="text-xs text-slate-500">
                          conf {(g.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  {g.deadline && (
                    <p className="mt-2 text-xs text-slate-400">
                      due {new Date(g.deadline).toLocaleDateString()}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
