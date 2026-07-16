/**
 * Centralized logging system with environment variable control
 * Debug logs can be disabled in production without affecting critical errors
 */

const isDevelopment = process.env.NODE_ENV !== "production";
const isDebugEnabled = process.env.DEBUG_LOGS === "true";

// Determine if debug logs should be shown
const shouldLog = isDevelopment || isDebugEnabled;

/**
 * Main logger with different levels
 */
const logger = {
  /**
   * Info logs - can be disabled in production
   */
  info: (...args: unknown[]) => {
    if (shouldLog) {
      console.log(...args);
    }
  },

  /**
   * Warning logs - can be disabled in production
   */
  warn: (...args: unknown[]) => {
    if (shouldLog) {
      console.warn(...args);
    }
  },

  /**
   * Error logs - ALWAYS logged (critical)
   */
  error: (...args: unknown[]) => {
    console.error(...args);
  },

  /**
   * Debug logs - only in development or when DEBUG_LOGS=true
   */
  debug: (...args: unknown[]) => {
    if (shouldLog) {
      console.log("[DEBUG]", ...args);
    }
  },
};

export = logger;
