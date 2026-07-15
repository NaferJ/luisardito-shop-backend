const asyncHandler = require("../../utils/asyncHandler");

/**
 * Endpoint to check cookie status (debugging)
 */
exports.cookieStatus = asyncHandler(async (req, res) => {
  const cookies = req.headers.cookie;
  const authToken = req.cookies?.auth_token;
  const refreshToken = req.cookies?.refresh_token;

  return res.json({
    hasCookies: !!cookies,
    authToken: authToken ? "present" : "absent",
    refreshToken: refreshToken ? "present" : "absent",
    environment: process.env.NODE_ENV,
    domain:
      process.env.NODE_ENV === "production" ? ".luisardito.com" : "localhost",
    userAgent: req.headers["user-agent"],
    origin: req.headers.origin,
    allCookies: req.cookies,
  });
});
