import axios from "axios";
import logger from "../utils/logger";

const HEALTHCHECK_TIMEOUT_MS = 5000;

function safeErrorDetails(error: unknown): string {
  if (!error || typeof error !== "object") return "";

  const err = error as {
    code?: unknown;
    response?: { status?: unknown };
  };
  const details: string[] = [];

  if (typeof err.code === "string") details.push(`code=${err.code}`);
  if (typeof err.response?.status === "number") {
    details.push(`status=${err.response.status}`);
  }

  return details.length > 0 ? ` (${details.join(", ")})` : "";
}

/**
 * Pings a healthchecks.io URL without exposing the URL in logs.
 * The ping URL itself acts as a secret, so only safe error metadata is logged.
 */
async function pingHealthcheck(
  url: string | undefined,
  failed = false
): Promise<void> {
  if (!url) return;

  const target = failed ? `${url}/fail` : url;

  try {
    await axios.get(target, { timeout: HEALTHCHECK_TIMEOUT_MS });
  } catch (error) {
    try {
      logger.warn(`[Healthchecks] Ping failed${safeErrorDetails(error)}`);
    } catch {
      // Monitoring logging is also best-effort.
    }
  }
}

export { pingHealthcheck, HEALTHCHECK_TIMEOUT_MS };
