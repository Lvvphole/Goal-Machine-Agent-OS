"use client";

import { useEffect, useState } from "react";
import type { StoredEvidenceRecord } from "@/lib/state/evidence";

type Props = { goalId: string };
type EvidenceRow = StoredEvidenceRecord & { supported_actions?: string[] };
type ApiResponse = { ok: boolean; records?: EvidenceRow[]; error?: string };

export default function EvidenceLedger({ goalId }: Props) {
  const [records, setRecords] = useState<EvidenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/goals/${goalId}/evidence`, { cache: "no-store" });
        const data = (await response.json()) as ApiResponse;
        if (!response.ok || data.ok === false) throw new Error(data.error ?? "Could not load evidence ledger");
        if (active) setRecords(data.records ?? []);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unknown evidence error");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [goalId]);

  return (
    <section className="bg-[#f2f2f7] p-4 font-sans text-slate-950 sm:p-6">
      <div className="mx-auto max-w-5xl rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#e8912e]">Evidence</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Ledger</h2>
        {loading && <div className="mt-5 rounded-3xl bg-[#f2f2f7] p-6 text-sm text-slate-500">Loading evidence records…</div>}
        {error && <div className="mt-5 rounded-3xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-100">{error}</div>}
        {!loading && !error && (
          <div className="mt-5 overflow-hidden rounded-3xl ring-1 ring-slate-100">
            <div className="hidden grid-cols-4 gap-4 bg-[#f2f2f7] p-4 text-xs font-bold uppercase tracking-wide text-slate-500 sm:grid"><span>Citation</span><span>Study type</span><span>Quality score</span><span>Supported actions</span></div>
            {records.length === 0 ? <p className="p-5 text-sm text-slate-500">No evidence records found.</p> : records.map((record) => (
              <div key={record.id} className="grid gap-3 border-t border-slate-100 p-4 text-sm sm:grid-cols-4 sm:gap-4">
                <div><span className="text-xs font-bold uppercase text-slate-400 sm:hidden">Citation</span><p className="font-semibold">{record.title}</p><p className="mt-1 text-slate-500">{record.source}</p></div>
                <div><span className="text-xs font-bold uppercase text-slate-400 sm:hidden">Study type</span><p className="capitalize">{record.source_type.replaceAll("_", " ")}</p></div>
                <div><span className="text-xs font-bold uppercase text-slate-400 sm:hidden">Quality</span><p>{Math.round(record.quality_score * 100)}%</p></div>
                <div><span className="text-xs font-bold uppercase text-slate-400 sm:hidden">Actions</span><p>{record.supported_actions?.join(", ") ?? record.action_id}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
