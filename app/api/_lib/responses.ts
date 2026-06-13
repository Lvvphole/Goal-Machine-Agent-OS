import { NextResponse } from "next/server";
import { z } from "zod";

export function jsonError(error: unknown, status = 500) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", issues: error.issues },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    },
    { status },
  );
}
