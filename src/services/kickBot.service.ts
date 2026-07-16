import axios, { type AxiosResponse, type AxiosRequestConfig } from "axios";
import config from "../../config";
import KickBotToken from "../models/kickBotToken.model";
import { promises as fs } from "node:fs";
import path from "node:path";
import logger from "../utils/logger";
import toErrorMessage from "../utils/toErrorMessage";

interface TokenFileData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt?: number;
  username?: string;
}

interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface SendMessageResult {
  ok: boolean;
  error?: string;
  status?: number;
  data?: {
    messageId?: string;
    isSent: boolean;
    raw: unknown;
  };
  headers?: unknown;
}

interface RefreshTokenError extends Error {
  code?: string;
  originalError?: unknown;
}

/**
 * Service to send messages to Kick chat using the BOT
 * Requires a bot user access token (KICK_BOT_ACCESS_TOKEN)
 */
class KickBotService {
  apiBase: string;
  botUsername: string;
  tokensFile: string;
  _refreshInFlight: Map<string, Promise<KickBotToken | string>>;

  constructor() {
    this.apiBase = String(config.kick.apiBaseUrl || "").replace(/\/$/, "");
    this.botUsername = config.kickBot?.username || "Bot";
    this.tokensFile = path.join(__dirname, "../../tokens/tokens.json");

    // In-flight refresh promises keyed by token identity (single-flight guard)
    this._refreshInFlight = new Map();

    // Start background auto-refresh
    this.startAutoRefresh();
  }

  /**
   * Renews an access token using the refresh token.
   * Concurrent calls for the same token share a single in-flight network
   * request (single-flight) to avoid race conditions caused by Kick's
   * rotating refresh tokens.
   * @param tokenRecord - KickBotToken model instance
   * @returns Updated token
   */
  refreshToken(tokenRecord: KickBotToken): Promise<KickBotToken> {
    const key = String(tokenRecord.id ?? tokenRecord.kick_username);

    if (this._refreshInFlight.has(key)) {
      return this._refreshInFlight.get(key) as Promise<KickBotToken>;
    }

    const promise = this._performRefresh(tokenRecord).finally(() => {
      this._refreshInFlight.delete(key);
    });

    this._refreshInFlight.set(key, promise);
    return promise;
  }

  /**
   * Internal refresh implementation. Callers should use refreshToken()
   * which adds the single-flight guard.
   * @param tokenRecord - KickBotToken model instance
   * @returns Updated token
   */
  async _performRefresh(tokenRecord: KickBotToken): Promise<KickBotToken> {
    try {
      logger.info(
        `[KickBot] Attempting to renew token for ${tokenRecord.kick_username}`
      );

      const response: AxiosResponse<TokenRefreshResponse> = await axios.post(
        "https://id.kick.com/oauth/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: tokenRecord.refresh_token as string,
          client_id: config.kickBot.clientId,
          client_secret: config.kickBot.clientSecret,
          // Do not include scope when refreshing - the refresh token already has the scopes
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

      // Update the database record
      await tokenRecord.update({
        access_token,
        refresh_token: refresh_token || tokenRecord.refresh_token,
        token_expires_at: tokenExpiresAt,
        updated_at: new Date(),
      });

      // Also update tokens.json to keep it in sync
      try {
        const tokensForFile: TokenFileData = {
          accessToken: access_token,
          refreshToken: refresh_token || (tokenRecord.refresh_token as string),
          expiresAt: Date.now() + expires_in * 1000,
          refreshExpiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // ~1 year
          username: tokenRecord.kick_username,
        };
        await this.writeTokensToFile(tokensForFile);
        logger.info(
          `[KickBot] tokens.json updated for ${tokenRecord.kick_username}`
        );
      } catch (fileError: unknown) {
        logger.warn(
          `[KickBot] Could not update tokens.json (non-critical):`,
          toErrorMessage(fileError)
        );
      }

      logger.info(
        `[KickBot] Token renewed successfully for ${tokenRecord.kick_username}`
      );
      return tokenRecord;
    } catch (error: unknown) {
      const axiosErr = error as {
        response?: { data?: unknown; status?: number };
      };
      const errorData = axiosErr?.response?.data;
      const errorStatus = axiosErr?.response?.status;

      logger.error("[KickBot] Error renewing token:", {
        status: errorStatus,
        data: errorData,
        message: toErrorMessage(error),
      });

      // If the error is authentication-related or invalid refresh token
      if (errorStatus === 400 || errorStatus === 401) {
        logger.info(
          `[KickBot] Invalid or expired refresh token for ${tokenRecord.kick_username}`
        );
        await tokenRecord.update({
          is_active: false,
          updated_at: new Date(),
        });

        // Create a more descriptive error
        const refreshTokenError = new Error(
          errorStatus === 400
            ? "Expired or invalid refresh token"
            : "Unauthorized refresh token"
        ) as RefreshTokenError;
        refreshTokenError.code = "REFRESH_TOKEN_EXPIRED";
        refreshTokenError.originalError = error;

        // ALERT: Refresh token expired - requires manual re-authorization
        logger.error(
          `[CRITICAL ALERT] Refresh token expired for ${tokenRecord.kick_username}!`
        );
        logger.error(
          `Re-authorization required at: https://id.kick.com/oauth/authorize?client_id=${config.kickBot.clientId}&redirect_uri=${encodeURIComponent(config.kickBot.redirectUri)}&response_type=code&scope=user:read%20chat:write%20channel:read%20channel:write`
        );
        logger.error(`Once authorized, save the new code to the DB.`);

        throw refreshTokenError;
      }

      throw error;
    }
  }

  /**
   * Renews a specific token (used by maintenance)
   * @param tokenRecord - KickBotToken model instance
   * @returns True if renewed successfully
   */
  async renewAccessToken(tokenRecord: KickBotToken): Promise<boolean> {
    try {
      logger.info(
        `[KickBot] Renewing token for ${tokenRecord.kick_username}...`
      );
      await this.refreshToken(tokenRecord);
      return true;
    } catch (error: unknown) {
      logger.error(
        `[KickBot] Error renewing token for ${tokenRecord.kick_username}:`,
        toErrorMessage(error)
      );
      return false;
    }
  }

  /**
   * Resolves the access token, renewing it if necessary
   * PRIORITY: DB first, file as fallback
   * @returns Access token
   */
  async resolveAccessToken(): Promise<string | null> {
    logger.info("[KickBot] Resolving access token...");

    // Always use DB/file, never trust in-memory token
    // (the in-memory token may have expired)

    // PRIORITY 1: Try the database first (more reliable)
    try {
      const token = await this._resolveFromDb();
      if (token !== undefined) {
        return token;
      }
    } catch (dbError: unknown) {
      logger.warn(
        "[KickBot] Error querying DB, trying file:",
        toErrorMessage(dbError)
      );
    }

    // PRIORITY 2: Fallback to tokens.json if the DB has no tokens
    try {
      const token = await this._resolveFromFile();
      if (token !== undefined) {
        return token;
      }
    } catch (fileError: unknown) {
      logger.warn(
        "[KickBot] tokens.json file not available or invalid:",
        toErrorMessage(fileError)
      );
    }

    // If we get here, no tokens are available
    logger.error("[KickBot] No tokens available (neither DB nor file)");
    logger.error(
      "[KickBot] Re-authentication required at: https://luisardito.shop/api/auth/kick-bot"
    );
    return null;
  }

  /**
   * Resolves an access token from the database (PRIORITY 1).
   * Returns the token string if found, or undefined if no valid token is available.
   */
  async _resolveFromDb(): Promise<string | undefined> {
    const where = this.botUsername
      ? {
          kick_username: this.botUsername,
          is_active: true,
        }
      : {
          is_active: true,
        };

    const records = await KickBotToken.findAll({
      where,
      order: [["updated_at", "DESC"]],
    });

    if (records && records.length > 0) {
      logger.info(`[KickBot] Found ${records.length} active tokens in DB`);

      // Try each token until a valid one is found
      for (const record of records) {
        const token = await this._tryTokenFromRecord(record);
        if (token !== undefined) {
          return token;
        }
      }
    }
    return undefined;
  }

  /**
   * Attempts to obtain a usable access token from a single DB record.
   * Renews the token if it is expired or about to expire.
   * Returns the token string if usable, or undefined to continue with the next record.
   */
  async _tryTokenFromRecord(record: KickBotToken): Promise<string | undefined> {
    // Check if the token is about to expire (in less than 45 minutes) or already expired
    const now = new Date();
    const expiresAt = new Date(record.token_expires_at);
    const expiresIn = expiresAt.getTime() - now.getTime();
    const fortyFiveMinutes = 45 * 60 * 1000;

    if (expiresIn < fortyFiveMinutes) {
      const isExpired = expiresIn < 0;
      const minutesUntilExpiry = Math.round(expiresIn / 1000 / 60);

      if (isExpired) {
        logger.info(
          `[KickBot] Token expired ${Math.abs(minutesUntilExpiry)} minutes ago, renewing...`
        );
      } else {
        logger.info(
          `[KickBot] Token expires in ${minutesUntilExpiry} minutes, proactively renewing...`
        );
      }

      try {
        const updatedRecord = await this.refreshToken(record);
        logger.info(
          `[KickBot] Token renewed from DB for ${record.kick_username}`
        );
        return updatedRecord.access_token;
      } catch (error: unknown) {
        logger.error(
          `[KickBot] Renewal failed for ${record.kick_username}:`,
          toErrorMessage(error)
        );
        // Continue with the next token
        return undefined;
      }
    } else {
      // Valid token, use it
      logger.info(
        `[KickBot] Valid token from DB for ${record.kick_username} (expires in ${Math.round(expiresIn / 1000 / 60)} min)`
      );
      return record.access_token;
    }
  }

  /**
   * Resolves an access token from tokens.json (PRIORITY 2 fallback).
   * Returns the token string if found, or undefined if no valid token is available.
   */
  async _resolveFromFile(): Promise<string | undefined> {
    const tokens = await this.readTokensFromFile();
    if (tokens?.accessToken) {
      // Check if the token is about to expire (in less than 45 minutes)
      if (tokens.expiresAt > Date.now() + 45 * 60 * 1000) {
        logger.info("[KickBot] Valid token from file (fallback)");
        return tokens.accessToken;
      } else {
        logger.info("[KickBot] File token about to expire, renewing...");
        return await this.refreshAccessToken();
      }
    }
    return undefined;
  }

  /**
   * Sends a message to the chat as the bot
   * @param message - The message to send (max 500 characters)
   * @returns Operation result
   */
  async sendMessage(message: string): Promise<SendMessageResult> {
    const token = await this.resolveAccessToken();
    if (!token) {
      logger.error("[KickBot] No access token available (config nor DB)");
      return { ok: false, error: "missing_access_token" };
    }

    if (!message || !String(message).trim()) {
      return { ok: false, error: "empty_message" };
    }

    const url = `${this.apiBase}/public/v1/chat`;
    const broadcasterId = Number.parseInt(
      config.kick.broadcasterId || "2771761",
      10
    ); // Luisardito channel ID
    const payload = {
      type: "user", // Use 'user' instead of 'bot' for better compatibility
      content: String(message).trim().substring(0, 500), // Ensure it does not exceed the limit
      broadcaster_user_id: broadcasterId, // Required when type is 'user'
    };

    logger.info("[KickBot] Send details:", {
      url,
      payload,
      tokenPreview: token
        ? `${token.substring(0, 10)}...${token.slice(-5)}`
        : "NO TOKEN",
      botUsername: this.botUsername,
      broadcasterId,
      timestamp: new Date().toISOString(),
    });

    try {
      logger.info(`[KickBot] Sending message: "${payload.content}"`);
      const axiosConfig: AxiosRequestConfig = {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "LuisarditoShop/1.0",
        },
        timeout: 10000,
        validateStatus: (status: number) => status < 500, // Do not throw for 4xx codes
      };
      const response = await axios.post(url, payload, axiosConfig);

      logger.info("[KickBot] API response:", {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers,
      });

      if (response.status >= 400) {
        logger.error("[KickBot] Error in API response:", {
          status: response.status,
          data: response.data,
          headers: response.headers,
        });
      }

      const responseData = response.data as {
        data?: { message_id?: string; is_sent?: boolean };
      };
      return {
        ok: response.status < 400,
        status: response.status,
        data: {
          messageId: responseData?.data?.message_id,
          isSent: responseData?.data?.is_sent === true,
          raw: response.data,
        },
        headers: response.headers,
      };
    } catch (error: unknown) {
      const axiosErr = error as {
        response?: { data?: unknown; status?: number };
      };
      const errorData = axiosErr?.response?.data || toErrorMessage(error);
      logger.error(
        "[KickBot] Error sending message:",
        toErrorMessage(errorData)
      );
      return {
        ok: false,
        error: toErrorMessage(errorData),
        status: axiosErr?.response?.status,
      };
    }
  }

  /**
   * Generates authorization URL to get new tokens
   * @returns Authorization URL
   */
  generateAuthUrl(): string {
    const scopes = "user:read chat:write channel:read channel:write";
    const url = `https://id.kick.com/oauth/authorize?client_id=${config.kickBot.clientId}&redirect_uri=${encodeURIComponent(config.kickBot.redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}`;
    return url;
  }

  /**
   * Exchanges authorization code for tokens (for manual re-authorization)
   * @param code - Authorization code
   * @param username - Bot username
   * @returns Obtained tokens
   */
  async exchangeCodeForTokens(
    code: string,
    username: string
  ): Promise<KickBotToken> {
    try {
      logger.info(`[KickBot] Exchanging code for tokens for ${username}...`);

      const response: AxiosResponse<TokenRefreshResponse> = await axios.post(
        "https://id.kick.com/oauth/token",
        {
          grant_type: "authorization_code",
          code: code,
          client_id: config.kickBot.clientId,
          client_secret: config.kickBot.clientSecret,
          redirect_uri: config.kickBot.redirectUri,
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

      // Save to tokens.json for auto-refresh
      const tokensForFile: TokenFileData = {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: Date.now() + expires_in * 1000,
        refreshExpiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // ~1 year
        username: username,
      };
      await this.writeTokensToFile(tokensForFile);

      // Also save to DB as backup
      let tokenRecord = await KickBotToken.findOne({
        where: { kick_username: username },
      });
      if (tokenRecord) {
        await tokenRecord.update({
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt,
          is_active: true,
          updated_at: new Date(),
        });
      } else {
        tokenRecord = await KickBotToken.create({
          kick_username: username,
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt,
          is_active: true,
        });
      }

      logger.info(`[KickBot] New tokens saved for ${username}`);
      return tokenRecord;
    } catch (error: unknown) {
      logger.error("[KickBot] Error exchanging code:", toErrorMessage(error));
      throw error;
    }
  }

  /**
   * Starts the background token auto-refresh process
   * Renewal every 10 minutes, no initial delay
   */
  startAutoRefresh() {
    logger.info(
      "[KickBot] Starting automatic token renewal system every 10 minutes"
    );

    // First immediate execution (after 2 minutes to allow the system to load)
    setTimeout(
      async () => {
        logger.info("[KickBot] First token check...");
        try {
          await this.performAutoRefresh();
        } catch (error: unknown) {
          logger.error(
            "[KickBot] Error on first check:",
            toErrorMessage(error)
          );
        }
      },
      2 * 60 * 1000
    ); // 2 minutes initial

    // Then every 10 minutes
    setInterval(
      async () => {
        try {
          await this.performAutoRefresh();
        } catch (error: unknown) {
          logger.error(
            "[KickBot] Error in automatic refresh:",
            toErrorMessage(error)
          );
        }
      },
      10 * 60 * 1000
    ); // Every 10 minutes
  }

  /**
   * Executes the auto-refresh process
   */
  async performAutoRefresh() {
    logger.info("[KickBot] Checking if tokens need renewal...");

    try {
      const where = this.botUsername
        ? {
            kick_username: this.botUsername,
            is_active: true,
          }
        : {
            is_active: true,
          };

      const records = await KickBotToken.findAll({
        where,
        order: [["updated_at", "DESC"]],
      });

      if (!records || records.length === 0) {
        logger.warn("[KickBot] No active tokens in DB to auto-renew");
        return;
      }

      for (const record of records) {
        await this._autoRefreshRecord(record);
      }
    } catch (error: unknown) {
      logger.error(
        "[KickBot] Error in performAutoRefresh:",
        toErrorMessage(error)
      );
    }
  }

  /**
   * Checks a single token record and renews it if it is about to expire
   * or already expired. Logs the result and alerts when the refresh token
   * itself has expired (requires manual re-authorization).
   * @param record - KickBotToken model instance
   */
  async _autoRefreshRecord(record: KickBotToken): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(record.token_expires_at);
    const expiresIn = expiresAt.getTime() - now.getTime();
    const fortyFiveMinutes = 45 * 60 * 1000;

    if (expiresIn >= fortyFiveMinutes) {
      const minutesLeft = Math.round(expiresIn / 1000 / 60);
      logger.info(
        `[KickBot] Token for ${record.kick_username} still valid (${minutesLeft} min remaining)`
      );
      return;
    }

    const minutesLeft = Math.round(expiresIn / 1000 / 60);
    logger.info(
      `[KickBot] Token for ${record.kick_username} expires in ${minutesLeft} min, renewing...`
    );

    try {
      await this.refreshToken(record);
      logger.info(
        `[KickBot] Token auto-renewed successfully for ${record.kick_username}`
      );
    } catch (error: unknown) {
      logger.error(
        `[KickBot] Error auto-renewing token for ${record.kick_username}:`,
        toErrorMessage(error)
      );

      // If the refresh token expired, alert
      const refreshErr = error as RefreshTokenError;
      if (refreshErr.code === "REFRESH_TOKEN_EXPIRED") {
        logger.error(
          `[KickBot] ALERT: Refresh token expired for ${record.kick_username}. Re-authentication required.`
        );
        logger.error(
          `[KickBot] Re-authenticate at: https://luisardito.shop/api/auth/kick-bot`
        );
      }
    }
  }

  /**
   * Reads tokens from the tokens.json file
   * @returns Tokens or null if it does not exist
   */
  async readTokensFromFile(): Promise<TokenFileData | null> {
    try {
      const data = await fs.readFile(this.tokensFile, "utf8");
      return JSON.parse(data) as TokenFileData;
    } catch (error: unknown) {
      const nodeErr = error as { code?: string };
      if (nodeErr.code === "ENOENT") {
        logger.info("[KickBot] tokens.json file does not exist yet");
        return null;
      }
      throw error;
    }
  }

  /**
   * Writes tokens to the tokens.json file
   * @param tokens - Tokens to save
   */
  async writeTokensToFile(tokens: TokenFileData) {
    const fullPath = path.resolve(this.tokensFile);
    logger.info("[KickBot] Attempting to save tokens to:", fullPath);
    await fs.writeFile(this.tokensFile, JSON.stringify(tokens, null, 2));
    logger.info("[KickBot] Tokens saved successfully to:", fullPath);
  }

  /**
   * Renews the access token using the refresh token from the file.
   * Concurrent calls share a single in-flight network request
   * (single-flight) to avoid rotating the file refresh token twice.
   * @returns New access token
   */
  refreshAccessToken(): Promise<string> {
    const key = "__file__";

    if (this._refreshInFlight.has(key)) {
      return this._refreshInFlight.get(key) as Promise<string>;
    }

    const promise = this._performFileRefresh().finally(() => {
      this._refreshInFlight.delete(key);
    });

    this._refreshInFlight.set(key, promise);
    return promise;
  }

  /**
   * Internal file-based refresh implementation. Callers should use
   * refreshAccessToken() which adds the single-flight guard.
   * @returns New access token
   */
  async _performFileRefresh(): Promise<string> {
    try {
      const tokens = await this.readTokensFromFile();
      if (!tokens?.refreshToken) {
        throw new Error("No refresh token available in tokens.json");
      }

      logger.info("[KickBot] Renewing access token...");

      const response: AxiosResponse<TokenRefreshResponse> = await axios.post(
        "https://id.kick.com/oauth/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: tokens.refreshToken,
          client_id: config.kickBot.clientId,
          client_secret: config.kickBot.clientSecret,
          // Do not include scope when refreshing
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;

      // Validate we have the refresh token (Kick rotates refresh tokens)
      if (!refresh_token) {
        throw new Error(
          "Kick did not return refresh_token in the response. The previous refresh token is no longer valid."
        );
      }

      // Update tokens (Kick rotates the refresh token)
      const updatedTokens: TokenFileData = {
        accessToken: access_token,
        refreshToken: refresh_token, // Always use the new one
        expiresAt: Date.now() + expires_in * 1000,
        refreshExpiresAt:
          tokens.refreshExpiresAt || Date.now() + 365 * 24 * 60 * 60 * 1000, // ~1 year
      };

      await this.writeTokensToFile(updatedTokens);
      logger.info("[KickBot] Access token renewed successfully");

      return updatedTokens.accessToken;
    } catch (error: unknown) {
      logger.error(
        "[KickBot] Error renewing access token:",
        toErrorMessage(error)
      );
      throw error;
    }
  }
}

// Export both the class and a singleton instance
const instance = new KickBotService();
(
  instance as KickBotService & { KickBotService: typeof KickBotService }
).KickBotService = KickBotService;
export = instance;
