import { z } from "zod";
import { ModelRouter } from "@/lib/harness/model-router";
import { createServiceClient } from "@/lib/db/supabase";
import { CorrectionResponseSchema, GoalMachineConfig } from "@/lib/schemas";
import { ConfigVersionStore, VersionRecord } from "@/lib/state/version-store";

type ExecutionEventRow = {
  date: string;
  actions_completed: number | null;
  actions_total: number | null;
  output_value: number | null;
};

type CorrectionResponse = z.infer<typeof CorrectionResponseSchema>;

export type WeeklyAggregate = {
  startDate: string | null;
  endDate: string | null;
  completionRate: number;
  outputDelta: number;
  eventCount: number;
};

export type VersionPerformanceComparison = {
  currentVersion: number | null;
  comparisonVersion: number | null;
  currentCompletionRate: number | null;
  comparisonCompletionRate: number | null;
  delta: number | null;
};

export type CompoundingLog = {
  templatesCreated: number;
  rulesUpdated: string[];
  effortTrend: "up" | "down" | "flat" | "unknown";
};

export type WeeklyLoopResult = {
  goalId: string;
  currentWeek: WeeklyAggregate;
  previousWeeks: WeeklyAggregate[];
  weeklyCompletionRate: number;
  flatline: boolean;
  lToGBroken: boolean;
  versionComparison: VersionPerformanceComparison;
  compoundingLog: CompoundingLog;
  rebuildRecommendation: CorrectionResponse | null;
};

export class WeeklyLoop {
  private readonly db = createServiceClient();

  constructor(
    private readonly versionStore = new ConfigVersionStore(),
    private readonly router = new ModelRouter(),
  ) {}

  async run(goalId: string): Promise<WeeklyLoopResult> {
    const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.db
      .from("execution_events")
      .select("date, actions_completed, actions_total, output_value")
      .eq("goal_id", goalId)
      .gte("date", since)
      .order("date", { ascending: false });

    if (error) throw new Error(`execution event lookup failed for ${goalId}: ${error.message}`);

    const events = ((data ?? []) as ExecutionEventRow[]).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const weeks = this.weeklyAggregates(events);
    const currentWeek = weeks.at(-1) ?? this.emptyAggregate();
    const previousWeeks = weeks.slice(0, -1);
    const allRates = weeks.map((week) => week.completionRate);
    const flatline = this.hasFlatline(allRates.slice(-3));
    const lToGBroken = this.hasBrokenLink(currentWeek);

    const versions = await this.versionStore.history(goalId);
    const versionComparison = await this.compareVersionPerformance(goalId, versions);
    const compoundingLog = this.compoundingLog(versions, allRates);
    const latestVersion = versions.at(-1) ?? null;

    const rebuildRecommendation = flatline && latestVersion
      ? await this.router.call(
        "generator",
        this.rebuildPrompt(goalId, latestVersion.config, {
          currentWeek,
          previousWeeks,
          versionComparison,
          compoundingLog,
        }),
        CorrectionResponseSchema,
        2500,
        0.0,
      )
      : null;

    return {
      goalId,
      currentWeek,
      previousWeeks,
      weeklyCompletionRate: currentWeek.completionRate,
      flatline,
      lToGBroken,
      versionComparison,
      compoundingLog,
      rebuildRecommendation,
    };
  }

  private weeklyAggregates(events: ExecutionEventRow[]): WeeklyAggregate[] {
    const recent = events.slice(-21);
    const chunks: ExecutionEventRow[][] = [];
    for (let start = 0; start < recent.length; start += 7) {
      chunks.push(recent.slice(start, start + 7));
    }
    return chunks.map((chunk) => this.aggregate(chunk));
  }

  private aggregate(events: ExecutionEventRow[]): WeeklyAggregate {
    if (events.length === 0) return this.emptyAggregate();

    const completed = events.reduce((sum, event) => sum + (event.actions_completed ?? 0), 0);
    const total = events.reduce((sum, event) => sum + (event.actions_total ?? 0), 0);
    const outputs = events
      .map((event) => event.output_value)
      .filter((value): value is number => typeof value === "number");
    const outputDelta = outputs.length >= 2 ? outputs[outputs.length - 1] - outputs[0] : 0;

    return {
      startDate: events[0]?.date ?? null,
      endDate: events.at(-1)?.date ?? null,
      completionRate: total === 0 ? 0 : completed / total,
      outputDelta,
      eventCount: events.length,
    };
  }

  private emptyAggregate(): WeeklyAggregate {
    return {
      startDate: null,
      endDate: null,
      completionRate: 0,
      outputDelta: 0,
      eventCount: 0,
    };
  }

  private hasFlatline(rates: number[]): boolean {
    return rates.length === 3 && Math.max(...rates) - Math.min(...rates) <= 0.03;
  }

  private hasBrokenLink(week: WeeklyAggregate): boolean {
    return week.completionRate > 0.8 && Math.abs(week.outputDelta) < 0.01;
  }

  private async compareVersionPerformance(
    goalId: string,
    versions: VersionRecord[],
  ): Promise<VersionPerformanceComparison> {
    const currentVersion = versions.at(-1) ?? null;
    const comparisonVersion = versions.at(-3) ?? null;

    if (!currentVersion || !comparisonVersion) {
      return {
        currentVersion: currentVersion?.version_number ?? null,
        comparisonVersion: comparisonVersion?.version_number ?? null,
        currentCompletionRate: null,
        comparisonCompletionRate: null,
        delta: null,
      };
    }

    const currentCompletionRate = await this.completionRateForWindow(
      goalId,
      currentVersion.created_at,
      new Date().toISOString(),
    );
    const comparisonEnd = versions[versions.indexOf(comparisonVersion) + 1]?.created_at ?? currentVersion.created_at;
    const comparisonCompletionRate = await this.completionRateForWindow(
      goalId,
      comparisonVersion.created_at,
      comparisonEnd,
    );

    return {
      currentVersion: currentVersion.version_number,
      comparisonVersion: comparisonVersion.version_number,
      currentCompletionRate,
      comparisonCompletionRate,
      delta: currentCompletionRate - comparisonCompletionRate,
    };
  }

  private async completionRateForWindow(goalId: string, start: string, end: string): Promise<number> {
    const { data, error } = await this.db
      .from("execution_events")
      .select("actions_completed, actions_total")
      .eq("goal_id", goalId)
      .gte("date", start)
      .lt("date", end);

    if (error) throw new Error(`version performance lookup failed for ${goalId}: ${error.message}`);

    const events = (data ?? []) as Array<Pick<ExecutionEventRow, "actions_completed" | "actions_total">>;
    const completed = events.reduce((sum, event) => sum + (event.actions_completed ?? 0), 0);
    const total = events.reduce((sum, event) => sum + (event.actions_total ?? 0), 0);
    return total === 0 ? 0 : completed / total;
  }

  private compoundingLog(versions: VersionRecord[], rates: number[]): CompoundingLog {
    const currentVersion = versions.at(-1);
    const previousVersion = versions.at(-2);
    const latestConfig: GoalMachineConfig | null = currentVersion?.config ?? null;
    const previousActionIds = new Set(previousVersion?.config.actions.map((action) => action.id) ?? []);
    const templatesCreated = latestConfig?.actions.filter((action) => !previousActionIds.has(action.id)).length ?? 0;
    const rulesUpdated = currentVersion?.diffs.map((diff) => diff.field) ?? [];

    return {
      templatesCreated,
      rulesUpdated,
      effortTrend: this.effortTrend(rates),
    };
  }

  private effortTrend(rates: number[]): CompoundingLog["effortTrend"] {
    if (rates.length < 2) return "unknown";
    const delta = rates.at(-1)! - rates[0]!;
    if (Math.abs(delta) <= 0.03) return "flat";
    return delta > 0 ? "up" : "down";
  }

  private rebuildPrompt(
    goalId: string,
    currentConfig: GoalMachineConfig,
    context: {
      currentWeek: WeeklyAggregate;
      previousWeeks: WeeklyAggregate[];
      versionComparison: VersionPerformanceComparison;
      compoundingLog: CompoundingLog;
    },
  ) {
    return [
      {
        role: "system" as const,
        content: [
          "You are Model C/generator for Goal Machine weekly evaluation.",
          "Return a CorrectionResponse only.",
          "Recommend a rebuild only because the last three weekly completion rates have flatlined within three percentage points.",
        ].join(" "),
      },
      {
        role: "user" as const,
        content: JSON.stringify({ goal_id: goalId, current_config: currentConfig, weekly_context: context }),
      },
    ];
  }
}
