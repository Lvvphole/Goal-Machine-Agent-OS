import { NextResponse } from "next/server";
import { z } from "zod";
import { ConfigVersionStore } from "@/lib/state/version-store";
import { jsonError } from "../../_lib/responses";

const RollbackRequestSchema = z.object({
  goalId: z.string().uuid(),
  targetVersion: z.union([z.number().int().positive(), z.string().uuid()]),
});

export async function POST(request: Request) {
  try {
    const input = RollbackRequestSchema.parse(await request.json());
    const versionStore = new ConfigVersionStore();
    const targetVersionId = typeof input.targetVersion === "number"
      ? (await versionStore.history(input.goalId)).find(
          (version) => version.version_number === input.targetVersion,
        )?.id
      : input.targetVersion;

    if (!targetVersionId) {
      return NextResponse.json({ ok: false, error: "Target version not found" }, { status: 404 });
    }

    const target = await versionStore.get(targetVersionId);
    if (target.goal_id !== input.goalId) {
      return NextResponse.json({ ok: false, error: "Target version does not belong to goal" }, { status: 400 });
    }

    const newVersion = await versionStore.rollback(targetVersionId);

    return NextResponse.json({ ok: true, version: newVersion });
  } catch (error) {
    return jsonError(error);
  }
}
