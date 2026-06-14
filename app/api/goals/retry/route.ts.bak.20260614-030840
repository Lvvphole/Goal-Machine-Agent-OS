import { NextResponse } from "next/server";
import { z } from "zod";
import { callModelC } from "../../_lib/model";
import { jsonError } from "../../_lib/responses";

const RetryRequestSchema = z.object({
  goalId: z.string().uuid(),
  failedAction: z.string().min(1),
  consecutiveFailures: z.number().int().nonnegative(),
  previousApproaches: z.array(z.string()),
});

const RetryApproachSchema = z.object({
  approach: z.string().min(1),
  rationale: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1),
});

const RetryResponseSchema = z.object({
  approaches: z.array(RetryApproachSchema).length(3),
});

export async function POST(request: Request) {
  try {
    const input = RetryRequestSchema.parse(await request.json());
    const result = await callModelC(
      input.goalId,
      "graduated_retry",
      [
        {
          role: "system",
          content: [
            "You are Model C for Goal Machine graduated retry.",
            "Return exactly three different retry approaches with evidence.",
            "Use different retry vectors rather than rephrasing the same approach.",
          ].join(" "),
        },
        { role: "user", content: JSON.stringify(input) },
      ],
      RetryResponseSchema,
      1600,
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}
