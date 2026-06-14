/**
 * Extract a meaningful, human-readable message from any thrown value.
 * Handles: Error instances, plain objects with .message or .error,
 * ZodError-shaped objects with .issues, AggregateError chains, and primitives.
 * Never returns the useless "[object Object]" fingerprint.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    const errs = (error as AggregateError).errors;
    if (Array.isArray(errs) && errs.length > 0) {
      const inner = errs.map((e) => describeError(e)).join("; ");
      return `${error.message}: [${inner}]`;
    }
    return error.message;
  }
  if (typeof error === "string") return error;
  if (typeof error === "number" || typeof error === "boolean") return String(error);
  if (error == null) return "Unknown error (null/undefined thrown)";
  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message.length > 0) return obj.message;
    if (typeof obj.error === "string" && obj.error.length > 0) return obj.error;
    if (Array.isArray(obj.issues)) {
      return obj.issues
        .map((i) => {
          const issue = i as { path?: unknown[]; message?: string };
          const p = Array.isArray(issue.path) ? issue.path.join(".") : "";
          return p ? `${p}: ${issue.message ?? "invalid"}` : issue.message ?? "invalid";
        })
        .join("; ");
    }
    try {
      const json = JSON.stringify(error);
      return json.length > 1000 ? `${json.slice(0, 1000)}...` : json;
    } catch {
      return "Unserializable error object";
    }
  }
  return "Unknown error";
}

/** Wrap any thrown value as a proper Error instance with a meaningful message. */
export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(describeError(value));
}
