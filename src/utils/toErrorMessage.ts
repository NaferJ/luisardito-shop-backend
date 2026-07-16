/**
 * Safely converts an unknown error value to a string message.
 *
 * Handles Error instances, strings, and plain objects without producing
 * "[object Object]". Uses JSON.stringify for objects so the output is
 * readable, with a fallback for circular references.
 *
 * @param error - The caught value (typically from a catch clause)
 * @returns A human-readable string representation of the error
 */
function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error === undefined) return "undefined";
  if (error === null) return "null";
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export = toErrorMessage;
