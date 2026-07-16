import axios, { type AxiosResponse } from "axios";
import config from "../../config";
import logger from "./logger";

interface KickTokenInfo {
  active: boolean;
  scope?: string;
  expires_in?: number;
  [key: string]: unknown;
}

interface KickIntrospectResponse {
  data: KickTokenInfo;
}

interface KickUserApiResponse {
  data: Array<{
    user_id?: number;
    id?: number;
    name?: string;
    username?: string;
    email?: string;
    profile_picture?: string;
  }>;
}

interface NormalizedKickUser {
  id: number | undefined;
  username: string | undefined;
  email: string | undefined;
  profile_picture: string | undefined;
  user_id: number | undefined;
  name: string | undefined;
}

interface AxiosErrorLike {
  response?: { status?: number; data?: unknown; headers?: unknown };
  message?: string;
  stack?: string;
}

/**
 * Validates a Kick access token using the introspection endpoint
 * @param accessToken - Access token to validate
 * @returns Token information
 */
async function validateKickToken(accessToken: string): Promise<KickTokenInfo> {
  try {
    const introspectUrl = `${config.kick.apiBaseUrl}/public/v1/token/introspect`;
    logger.info("[Kick API] Validating token via introspection...");

    const response: AxiosResponse<KickIntrospectResponse> = await axios.post(
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
  } catch (error) {
    const err = error as AxiosErrorLike;
    logger.error("[Kick API] Error validating token:", {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    throw error;
  }
}

/**
 * Gets Kick user data using different methods
 * @param userIdOrToken - User ID or access token
 * @returns Kick user data
 */
async function getKickUserData(
  userIdOrToken: string | number
): Promise<NormalizedKickUser | Record<string, unknown>> {
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
        const response: AxiosResponse<KickUserApiResponse> = await axios.get(
          userUrl,
          {
            headers: {
              Authorization: `Bearer ${userIdOrToken}`,
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              Accept: "application/json",
            },
            timeout: 10000,
          }
        );

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
        const normalizedData: NormalizedKickUser = {
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
      } catch (error) {
        const err = error as AxiosErrorLike;
        logger.error("[Kick API] Error in token request:", {
          message: err.message,
          response: {
            status: err.response?.status,
            data: err.response?.data,
            headers: err.response?.headers,
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
      const response = await axios.get(publicUserUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
        timeout: 10000,
      });

      logger.info("[Kick API] Data fetched by ID:", response.data?.name);
      return response.data as Record<string, unknown>;
    } catch (publicApiError) {
      const err = publicApiError as AxiosErrorLike;
      logger.warn("[Kick API] Public endpoint not available:", {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });
      throw new Error("Could not fetch Kick user data", {
        cause: publicApiError,
      });
    }
  } catch (error) {
    const err = error as AxiosErrorLike;
    logger.error("[Kick API] Error fetching data:", {
      message: err.message,
      stack: err.stack,
      response: err.response?.data,
    });
    throw error;
  }
}

/**
 * Extracts the avatar URL from Kick user data
 * @param kickUserData - Kick user data
 * @returns Avatar URL or null if not present
 */
function extractAvatarUrl(
  kickUserData: Record<string, unknown>
): string | null {
  const user = kickUserData?.user as Record<string, unknown> | undefined;
  return (
    (kickUserData?.profile_picture as string) ||
    (kickUserData?.avatar_url as string) ||
    (user?.profile_picture as string) ||
    (user?.avatar_url as string) ||
    null
  );
}

export { getKickUserData, extractAvatarUrl };
