"use client";

import { useEffect, useState } from "react";
import type { ConfigVersion } from "@/lib/schemas/version";

type Props = { goalId: string };
type VersionRow = ConfigVersion & { id?: string; trigger?: string };
type ApiResponse = { ok: boolean; versions?: VersionRow[]; error?: string };

export default function VersionHistory({ goalId }: Props) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollingBack, setRollingBack] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/goals/${goalId}/versions`, { cache: "no-store" });
        const data = (await response.json()) as ApiResponse;
        if (!response.ok || data.ok === false) throw new Error(data.error ?? "Could not load version history");
        if (active) setVersions(data.versions ?? []);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unknown version error");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [goalId]);

  async function rollback(version: VersionRow) {
    setRollingBack(version.version_number);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/versions/rollback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goalId, targetVersion: version.id ?? version.version_number }) });
      const data = (await response.json()) as { ok: boolean; error?: string; version?: VersionRow };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Rollback failed");
      setMessage(`Rolled back to version ${version.version_number}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown rollback error");
    } finally {
      setRollingBack(null);
    }
  }

  return (
    <section className="bg-[#f2f2f7] p-4 font-sans text-slate-950 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5"><p className="text-sm font-semibold uppercase tracking-wide text-[#e8912e]">Config</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Version history</h2></div>
        {loading && <div className="rounded-[2rem] bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-black/5">Loading versions…</div>}
        {error && <div className="rounded-3xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-100">{error}</div>}
        {message && <div className="rounded-3xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">{message}</div>}
        {!loading && !error && versions.length === 0 && <div className="rounded-[2rem] bg-white p-5 text-sm text-slate-500 shadow-sm ring-1 ring-black/5">No versions found.</div>}
        {versions.map((version) => (
          <div key={version.id ?? version.version_number} className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[#9b5a15]">Version {version.version_number}</p><h3 className="mt-1 font-semibold">{version.trigger ?? version.rationale}</h3><p className="mt-1 text-sm text-slate-500">{new Date(version.created_at).toLocaleString()}</p></div><button onClick={() => rollback(version)} disabled={rollingBack === version.version_number} className="rounded-full bg-[#e8912e] px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">{rollingBack === version.version_number ? "Rolling…" : "Rollback"}</button></div>
            <div className="mt-4 rounded-3xl bg-[#f2f2f7] p-4 text-sm text-slate-600">{version.diffs.length ? version.diffs.map((diff) => diff.field).join(", ") : "Initial configuration"}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
