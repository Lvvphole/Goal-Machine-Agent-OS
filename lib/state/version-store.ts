import { createServiceClient } from "@/lib/db/supabase";
import {
  GoalMachineConfig,
  ConfigVersion,
  ConfigVersionSchema,
  VersionDiff,
} from "@/lib/schemas";

export type VersionRecord = ConfigVersion & { id: string; goal_id: string };

export class ConfigVersionStore {
  private readonly db = createServiceClient();

  async create(
    config: GoalMachineConfig,
    trigger: string,
    parentId?: string,
  ): Promise<VersionRecord> {
    const { data: latest } = await this.db
      .from("config_versions")
      .select("version_number")
      .eq("goal_id", config.goal_id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const versionNumber = (latest?.version_number ?? 0) + 1;

    let diffs: VersionDiff[] = [];
    if (parentId) {
      const parent = await this.get(parentId);
      diffs = await this.diff(parent.id, parentId);
    }

    const { data, error } = await this.db
      .from("config_versions")
      .insert({
        goal_id: config.goal_id,
        version_number: versionNumber,
        config,
        diff: diffs,
        trigger,
        parent_id: parentId ?? null,
        created_at: new Date().toISOString(),
        rationale: trigger,
      })
      .select()
      .single();

    if (error) throw new Error(`create version failed: ${error.message}`);
    return this.parseRow(data);
  }

  async get(versionId: string): Promise<VersionRecord> {
    const { data, error } = await this.db
      .from("config_versions")
      .select("*")
      .eq("id", versionId)
      .single();

    if (error) throw new Error(`Version ${versionId} not found: ${error.message}`);
    return this.parseRow(data);
  }

  async diff(versionId1: string, versionId2: string): Promise<VersionDiff[]> {
    const [v1, v2] = await Promise.all([this.get(versionId1), this.get(versionId2)]);
    return this.computeDiff(v1.config, v2.config);
  }

  async rollback(targetVersionId: string): Promise<VersionRecord> {
    const target = await this.get(targetVersionId);
    return this.create(
      target.config,
      `rollback to version ${target.version_number}`,
      targetVersionId,
    );
  }

  async history(goalId: string): Promise<VersionRecord[]> {
    const { data, error } = await this.db
      .from("config_versions")
      .select("*")
      .eq("goal_id", goalId)
      .order("version_number", { ascending: true });

    if (error) throw new Error(`history failed: ${error.message}`);
    return (data ?? []).map((row) => this.parseRow(row));
  }

  private computeDiff(
    c1: GoalMachineConfig,
    c2: GoalMachineConfig,
  ): VersionDiff[] {
    const now = new Date().toISOString();

    const flatten = (
      obj: Record<string, unknown>,
      prefix = "",
    ): Record<string, unknown> =>
      Object.entries(obj).reduce(
        (acc, [key, val]) => {
          const path = prefix ? `${prefix}.${key}` : key;
          if (val !== null && typeof val === "object" && !Array.isArray(val)) {
            Object.assign(acc, flatten(val as Record<string, unknown>, path));
          } else {
            acc[path] = val;
          }
          return acc;
        },
        {} as Record<string, unknown>,
      );

    const flat1 = flatten(c1 as unknown as Record<string, unknown>);
    const flat2 = flatten(c2 as unknown as Record<string, unknown>);
    const keys = new Set([...Object.keys(flat1), ...Object.keys(flat2)]);

    const diffs: VersionDiff[] = [];
    for (const field of keys) {
      if (JSON.stringify(flat1[field]) !== JSON.stringify(flat2[field])) {
        diffs.push({
          field,
          old_value: flat1[field],
          new_value: flat2[field],
          changed_at: now,
        });
      }
    }
    return diffs;
  }

  private parseRow(row: Record<string, unknown>): VersionRecord {
    const parsed = ConfigVersionSchema.parse(row);
    return {
      ...parsed,
      id: row.id as string,
      goal_id: row.goal_id as string,
    };
  }
}
