/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import axios from "axios";
import config from "../../config";
import logger from "./logger";

/**
 * Validates a Kick access token using the introspection endpoint
 * @param {string} accessToken - Access token to validate
 * @returns {Promise<Object>} - Token information
 */
async function validateKickToken(accessToken: any) {
  try {
    const introspectUrl = `${config.kick.apiBaseUrl}/public/v1/token/introspect`;
    logger.info("[Kick API] Validating token via introspection...");

    const response: any = await axios.post(
      introspectUrl,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 10000,
      }
    );

    logger.info("[Kick API] Token validation successful:", {
      active: response.data?.data?.active,
      scopes: response.data?.data?.scope,
      expiresIn:
        response.data?.data?.expires_in ||
        "Not available (Kick does not provide it)",
    });

    if (!response.data?.data?.active) {
      throw new Error("Token inactive or expired");
    }

    return response.data.data;
  } catch (error: any) {
    logger.error("[Kick API] Error validating token:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw error;
  }
}

/**
 * Gets Kick user data using different methods
 * @param {string} userIdOrToken - User ID or access token
 * @returns {Promise<Object>} - Kick user data
 */
async function getKickUserData(userIdOrToken: any) {
  try {
    logger.info("[Kick API] Fetching user data. Type:", typeof userIdOrToken);
    logger.info(
      "[Kick API] Received token/ID (first 10 chars):",
      typeof userIdOrToken === "string"
        ? `${userIdOrToken.substring(0, 10)}... (length: ${userIdOrToken.length})`
        : "Not a string"
    );

    // If it is a token (long string), get authenticated user data
    if (typeof userIdOrToken === "string" && userIdOrToken.length > 20) {
      logger.info("[Kick API] Access token detected. Validating...");

      // First, validate the token
      const tokenInfo = await validateKickToken(userIdOrToken);

      // If we get here, the token is valid
      logger.info("[Kick API] Valid token. Fetching user data...");
      logger.info("[Kick API] Available scopes:", tokenInfo.scope);

      const userApiBase = config.kick.apiBaseUrl.replace(/\/$/, "");
      const userUrl = `${userApiBase}/public/v1/users`;

      logger.info("[Kick API] Users API URL:", userUrl);

      try {
        const response: any = await axios.get(userUrl, {
          headers: {
            Authorization: `Bearer ${userIdOrToken}`,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "application/json",
          },
          timeout: 10000,
        });

        logger.info("[Kick API] Users API response:", {
          status: response.status,
          statusText: response.statusText,
          data: response.data
            ? `Received ${response.data.data?.length || 0} users`
            : "No data",
        });

        // DEBUG: View full response structure
        logger.info(
          "[Kick API] DEBUG - Full response.data structure:",
          JSON.stringify(response.data, null, 2)
        );

        const userData = response.data?.data?.[0]; // Take the first user from the array
        if (!userData) {
          logger.error(
            "[Kick API] ERROR - No userData found in response.data.data[0]"
          );
          logger.error("[Kick API] ERROR - response.data:", response.data);
          throw new Error("No user data found in the response");
        }

        // Normalize the data structure (the API returns user_id and name)
        const normalizedData = {
          id: userData.user_id || userData.id,
          username: userData.name || userData.username,
          email: userData.email,
          profile_picture: userData.profile_picture,
          // Keep original fields for compatibility
          user_id: userData.user_id,
          name: userData.name,
        };

        logger.info("[Kick API] User data fetched:", {
          id: normalizedData.id,
          username: normalizedData.username,
          email: normalizedData.email,
        });

        return normalizedData;
      } catch (error: any) {
        logger.error("[Kick API] Error in token request:", {
          message: error.message,
          response: {
            status: error.response?.status,
            data: error.response?.data,
            headers: error.response?.headers,
          },
        });
        throw error;
      }
    }

    // If it is a user ID, use public endpoint (if it exists)
    logger.info("[Kick API] Trying to fetch data by user ID:", userIdOrToken);

    const userIdStr = String(userIdOrToken);
    if (!/^\d+$/.test(userIdStr)) {
      throw new Error("Invalid Kick user ID");
    }

    try {
      const publicUserUrl = `https://kick.com/api/v1/users/${encodeURIComponent(userIdStr)}`;
      const response: any = await axios.get(publicUserUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
        timeout: 10000,
      });

      logger.info("[Kick API] Data fetched by ID:", response.data?.name);
      return response.data;
    } catch (publicApiError: any) {
      logger.warn("[Kick API] Public endpoint not available:", {
        message: publicApiError.message,
        status: publicApiError.response?.status,
        data: publicApiError.response?.data,
      });
      throw new Error("Could not fetch Kick user data", {
        cause: publicApiError,
      });
    }
  } catch (error: any) {
    logger.error("[Kick API] Error fetching data:", {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
    });
    throw error;
  }
}

/**
 * Extracts the avatar URL from Kick user data
 * @param {Object} kickUserData - Kick user data
 * @returns {string|null} - Avatar URL or null if not present
 */
function extractAvatarUrl(kickUserData: any) {
  // Different possible avatar locations in the Kick response
  return (
    kickUserData?.profile_picture ||
    kickUserData?.avatar_url ||
    kickUserData?.user?.profile_picture ||
    kickUserData?.user?.avatar_url ||
    null
  );
}

export { getKickUserData, extractAvatarUrl };
