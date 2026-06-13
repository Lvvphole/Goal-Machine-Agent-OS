import { z } from "zod";
import { CorrectionResponseSchema } from "@/lib/schemas";

export type ConvergencePhase = "early" | "mid" | "late";
export type CorrectionType = "structural" | "tactical" | "precision";

export type CorrectionValidationResult = {
  ok: boolean;
  phase: ConvergencePhase;
  allowedTypes: CorrectionType[];
  rejectedTypes: CorrectionType[];
  reasons: string[];
  structuralChangeCount: number;
};

type CorrectionResponse = z.infer<typeof CorrectionResponseSchema>;

export class ConvergenceDetector {
  static detectPhase(gapPercentage: number): ConvergencePhase {
    if (gapPercentage > 60) return "early";
    if (gapPercentage >= 25) return "mid";
    return "late";
  }

  static allowedCorrectionType(phase: ConvergencePhase): CorrectionType[] {
    if (phase === "early") return ["structural", "tactical", "precision"];
    if (phase === "mid") return ["tactical", "precision"];
    return ["precision"];
  }

  static validateCorrectionSize(
    correction: CorrectionResponse,
    phase: ConvergencePhase,
  ): CorrectionValidationResult {
    const allowedTypes = this.allowedCorrectionType(phase);
    const structuralChangeCount = correction.new_actions.length;
    const rejectedTypes: CorrectionType[] = [];
    const reasons: string[] = [];

    if (!allowedTypes.includes("structural") && structuralChangeCount > 0) {
      rejectedTypes.push("structural");
      reasons.push(`${phase} phase does not allow structural corrections`);
    }

    if (structuralChangeCount > 1) {
      if (!rejectedTypes.includes("structural")) rejectedTypes.push("structural");
      reasons.push("Only one structural action change is allowed per correction cycle");
    }

    return {
      ok: reasons.length === 0,
      phase,
      allowedTypes,
      rejectedTypes,
      reasons,
      structuralChangeCount,
    };
  }
}
