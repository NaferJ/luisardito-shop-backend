/**
 * Centralized logging system with environment variable control
 * Debug logs can be disabled in production without affecting critical errors
 */

const isDevelopment = process.env.NODE_ENV !== "production";
const isDebugEnabled = process.env.DEBUG_LOGS === "true";

// Determine if debug logs should be shown
const shouldLog = isDevelopment || isDebugEnabled;

interface AxiosErrorLike {
  isAxiosError: true;
  message?: string;
  code?: string;
  config?: { method?: string; url?: string };
  response?: { status?: number };
}

const sanitize = (arg: unknown): unknown => {
  if (!arg || typeof arg !== "object" || !("isAxiosError" in arg)) {
    return arg;
  }
  const err = arg as AxiosErrorLike;
  return {
    message: err.message,
    code: err.code,
    method: err.config?.method,
    url: err.config?.url,
    status: err.response?.status,
  };
};

/**
 * Main logger with different levels
 */
const logger = {
  /**
   * Info logs - can be disabled in production
   */
  info: (...args: unknown[]) => {
    if (shouldLog) {
      console.log(...args.map(sanitize));
    }
  },

  /**
   * Warning logs - can be disabled in production
   */
  warn: (...args: unknown[]) => {
    if (shouldLog) {
      console.warn(...args.map(sanitize));
    }
  },

  /**
   * Error logs - ALWAYS logged (critical)
   */
  error: (...args: unknown[]) => {
    console.error(...args.map(sanitize));
  },

  /**
   * Debug logs - only in development or when DEBUG_LOGS=true
   */
  debug: (...args: unknown[]) => {
    if (shouldLog) {
      console.log("[DEBUG]", ...args.map(sanitize));
    }
  },
};

export = logger;
