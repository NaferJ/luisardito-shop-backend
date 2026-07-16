import type { Response, CookieOptions } from "express";

/**
 * Utilities for cross-domain cookie handling
 */

/**
 * Gets cookie options configured for cross-domain
 * @param env - Environment
 * @returns Cookie options
 */
function getCookieOptions(
  env: string | undefined = process.env.NODE_ENV
): CookieOptions {
  const isProduction = env === "production";

  return {
    httpOnly: false, // Allow frontend JavaScript access
    secure: isProduction, // HTTPS in production, HTTP in development
    sameSite: "lax", // Allow cross-site for subdomains
    domain: isProduction ? ".luisardito.com" : undefined, // Shared domain in production
    path: "/", // Available site-wide
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days by default
  };
}

/**
 * Gets specific options for the refresh token (longer lasting)
 * @param env - Environment
 * @returns Cookie options
 */
function getRefreshCookieOptions(
  env: string | undefined = process.env.NODE_ENV
): CookieOptions {
  return {
    ...getCookieOptions(env),
    maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days for refresh token
  };
}

/**
 * Gets options for clearing cookies
 * @param env - Environment
 * @returns Options for clearCookie
 */
function getClearCookieOptions(
  env: string | undefined = process.env.NODE_ENV
): Pick<CookieOptions, "domain" | "path" | "sameSite"> {
  const isProduction = env === "production";

  return {
    domain: isProduction ? ".luisardito.com" : undefined,
    path: "/",
    sameSite: "lax",
  };
}

/**
 * Sets authentication cookies on the response
 * @param res - Express response object
 * @param accessToken - Access token
 * @param refreshToken - Refresh token
 * @param env - Environment
 */
function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  env: string | undefined = process.env.NODE_ENV
): void {
  const cookieOptions = getCookieOptions(env);
  const refreshOptions = getRefreshCookieOptions(env);

  res.cookie("auth_token", accessToken, cookieOptions);
  res.cookie("refresh_token", refreshToken, refreshOptions);
}

/**
 * Clears authentication cookies
 * @param res - Express response object
 * @param env - Environment
 */
function clearAuthCookies(
  res: Response,
  env: string | undefined = process.env.NODE_ENV
): void {
  const clearOptions = getClearCookieOptions(env);

  res.clearCookie("auth_token", clearOptions);
  res.clearCookie("refresh_token", clearOptions);
}

export {
  getCookieOptions,
  getRefreshCookieOptions,
  getClearCookieOptions,
  setAuthCookies,
  clearAuthCookies,
};
