/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

/**
 * Utilities for cross-domain cookie handling
 */

/**
 * Gets cookie options configured for cross-domain
 * @param {string} env - Environment
 * @returns {Object} Cookie options
 */
function getCookieOptions(env: any = process.env.NODE_ENV) {
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
 * @param {string} env - Environment
 * @returns {Object} Cookie options
 */
function getRefreshCookieOptions(env: any = process.env.NODE_ENV) {
  return {
    ...getCookieOptions(env),
    maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days for refresh token
  };
}

/**
 * Gets options for clearing cookies
 * @param {string} env - Environment
 * @returns {Object} Options for clearCookie
 */
function getClearCookieOptions(env: any = process.env.NODE_ENV) {
  const isProduction = env === "production";

  return {
    domain: isProduction ? ".luisardito.com" : undefined,
    path: "/",
    sameSite: "lax",
  };
}

/**
 * Sets authentication cookies on the response
 * @param {Object} res - Express response object
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 * @param {string} env - Environment
 */
function setAuthCookies(
  res: any,
  accessToken: any,
  refreshToken: any,
  env: any = process.env.NODE_ENV
) {
  const cookieOptions = getCookieOptions(env);
  const refreshOptions = getRefreshCookieOptions(env);

  res.cookie("auth_token", accessToken, cookieOptions);
  res.cookie("refresh_token", refreshToken, refreshOptions);
}

/**
 * Clears authentication cookies
 * @param {Object} res - Express response object
 * @param {string} env - Environment
 */
function clearAuthCookies(res: any, env: any = process.env.NODE_ENV) {
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
