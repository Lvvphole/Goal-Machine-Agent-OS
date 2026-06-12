import { createServiceClient } from "@/lib/db/supabase";
import { EvidenceRecord } from "@/lib/schemas";

export type SourceType = "meta_analysis" | "rct" | "cohort" | "expert_opinion";

export type StoredEvidenceRecord = EvidenceRecord & {
  id: string;
  action_id: string;
  source_type: SourceType;
  quality_score: number;
};

export type ConflictResult = {
  record1: StoredEvidenceRecord;
  record2: StoredEvidenceRecord;
  conflict_score: number;
  reason: string;
};

export type RegisterInput = EvidenceRecord & {
  action_id: string;
  source_type: SourceType;
};

const SOURCE_QUALITY: Record<SourceType, number> = {
  meta_analysis: 1.0,
  rct: 0.85,
  cohort: 0.70,
  expert_opinion: 0.25,
};

const CONFLICT_THRESHOLD = 0.40;

export class EvidenceRegistry {
  private readonly db = createServiceClient();

  async register(input: RegisterInput): Promise<StoredEvidenceRecord> {
    const quality_score = SOURCE_QUALITY[input.source_type];

    const { data, error } = await this.db
      .from("evidence_records")
      .insert({
        action_id: input.action_id,
        source_type: input.source_type,
        quality_score,
        source: input.source,
        title: input.title,
        summary: input.summary,
        relevance_score: input.relevance_score,
        url: input.url ?? null,
        published_date: input.published_date ?? null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`register evidence failed: ${error.message}`);

    return {
      id: data.id as string,
      action_id: data.action_id as string,
      source_type: data.source_type as SourceType,
      quality_score: data.quality_score as number,
      source: data.source as string,
      title: data.title as string,
      summary: data.summary as string,
      relevance_score: data.relevance_score as number,
      url: data.url as string | undefined,
      published_date: data.published_date as string | undefined,
    };
  }

  async getProvenance(actionId: string): Promise<StoredEvidenceRecord[]> {
    const { data, error } = await this.db
      .from("evidence_records")
      .select("*")
      .eq("action_id", actionId)
      .order("quality_score", { ascending: false });

    if (error) throw new Error(`getProvenance failed: ${error.message}`);

    return (data ?? []).map((row) => ({
      id: row.id as string,
      action_id: row.action_id as string,
      source_type: row.source_type as SourceType,
      quality_score: row.quality_score as number,
      source: row.source as string,
      title: row.title as string,
      summary: row.summary as string,
      relevance_score: row.relevance_score as number,
      url: row.url as string | undefined,
      published_date: row.published_date as string | undefined,
    }));
  }

  async detectConflicts(
    records: StoredEvidenceRecord[],
  ): Promise<ConflictResult[]> {
    const conflicts: ConflictResult[] = [];

    for (let i = 0; i < records.length; i++) {
      for (let j = i + 1; j < records.length; j++) {
        const r1 = records[i];
        const r2 = records[j];
        const delta = Math.abs(r1.relevance_score - r2.relevance_score);

        if (delta >= CONFLICT_THRESHOLD) {
          conflicts.push({
            record1: r1,
            record2: r2,
            conflict_score: delta,
            reason: `Relevance divergence of ${delta.toFixed(2)} between "${r1.title}" and "${r2.title}"`,
          });
        }
      }
    }

    return conflicts;
  }
}
