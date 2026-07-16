import type { Request, Response } from "express";
import axios from "axios";
import config from "../../config";
import { KickEventSubscription } from "../models";
import logger from "../utils/logger";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/AppError";

/**
 * Gets all Kick event subscriptions
 */
const getSubscriptions = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { authorization } = req.headers;

    if (!authorization) {
      throw new AppError("Authorization token required", 401);
    }

    const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: authorization,
      },
      timeout: 10000,
    });

    // Also fetch locally stored subscriptions
    const localSubscriptions = await KickEventSubscription.findAll({
      where: { status: "active" },
      order: [["created_at", "DESC"]],
    });

    return res.json({
      kick_subscriptions: response.data.data || [],
      local_subscriptions: localSubscriptions,
      message: response.data.message,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error(
      "[Kick Subscription] Error fetching subscriptions:",
      error instanceof Error ? error.message : String(error)
    );

    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as { response: { status: number } };
      throw new AppError(
        "Error fetching Kick subscriptions",
        axiosError.response.status
      );
    }

    throw new AppError("Internal server error", 500);
  }
});

/**
 * Subscription methods allowed by the Kick API
 */
const ALLOWED_METHODS = new Set(["webhook", "websocket"]);

/**
 * Validates the request body for createSubscriptions.
 * Returns an AppError if validation fails, otherwise null.
 */
function validateCreateSubscriptionsBody(body: {
  broadcaster_user_id?: unknown;
  events?: unknown;
  method?: string;
}): AppError | null {
  if (
    !body.broadcaster_user_id ||
    !body.events ||
    !Array.isArray(body.events)
  ) {
    return new AppError(
      "broadcaster_user_id and events (array) are required",
      400
    );
  }
  return null;
}

/**
 * Stores successful subscriptions in the local database.
 * Skips entries that have no subscription_id or an error.
 */
async function storeSubscriptionsLocally(
  subscriptionsData: Array<{
    subscription_id?: string;
    name?: string;
    version?: string | number;
    error?: unknown;
  }>,
  broadcaster_user_id: string | number,
  sanitizedMethod: string
): Promise<KickEventSubscription[]> {
  const createdSubscriptions: KickEventSubscription[] = [];

  for (const sub of subscriptionsData) {
    if (!sub.subscription_id || sub.error) continue;
    try {
      const localSub = await KickEventSubscription.create({
        subscription_id: sub.subscription_id,
        broadcaster_user_id: Number(broadcaster_user_id),
        event_type: sub.name,
        event_version: Number(sub.version),
        method: sanitizedMethod,
        status: "active",
      });
      createdSubscriptions.push(localSub);
    } catch (dbError) {
      logger.error(
        "[Kick Subscription] Error saving subscription locally:",
        dbError instanceof Error ? dbError.message : String(dbError)
      );
    }
  }

  return createdSubscriptions;
}

/**
 * Creates new Kick event subscriptions
 */
const createSubscriptions = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { authorization } = req.headers;
      const { broadcaster_user_id, events, method = "webhook" } = req.body;

      if (!authorization) {
        throw new AppError("Authorization token required", 401);
      }

      const validationError = validateCreateSubscriptionsBody(req.body);
      if (validationError) throw validationError;

      // Validate that method is an allowed value (prevent SSRF / injection)
      const sanitizedMethod = ALLOWED_METHODS.has(method) ? method : "webhook";

      const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

      const payload = {
        broadcaster_user_id,
        events,
        method: sanitizedMethod,
      };

      const response = await axios.post(apiUrl, payload, {
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      });

      // Store successful subscriptions in the local database
      const subscriptionsData = response.data.data || [];
      const createdSubscriptions = await storeSubscriptionsLocally(
        subscriptionsData,
        broadcaster_user_id,
        sanitizedMethod
      );

      return res.status(200).json({
        kick_response: response.data,
        local_subscriptions: createdSubscriptions,
        message: "Subscriptions created successfully",
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(
        "[Kick Subscription] Error creating subscriptions:",
        error instanceof Error ? error.message : String(error)
      );

      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as { response: { status: number } };
        throw new AppError(
          "Error creating subscriptions in Kick",
          axiosError.response.status
        );
      }

      throw new AppError("Internal server error", 500);
    }
  }
);

/**
 * Deletes Kick event subscriptions
 */
const deleteSubscriptions = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { authorization } = req.headers;
      const { id } = req.query; // Can be an array or a string

      if (!authorization) {
        throw new AppError("Authorization token required", 401);
      }

      if (!id) {
        throw new AppError("Subscription ID(s) required", 400);
      }

      const ids = (Array.isArray(id) ? id : [id]) as string[];
      const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

      // Build query string with multiple IDs
      const queryParams = ids
        .map((subId) => `id=${encodeURIComponent(subId as string)}`)
        .join("&");

      const response = await axios.delete(`${apiUrl}?${queryParams}`, {
        headers: {
          Authorization: authorization,
        },
        timeout: 10000,
      });

      // Delete or mark local subscriptions as inactive
      await KickEventSubscription.update(
        { status: "inactive" },
        { where: { subscription_id: ids } }
      );

      return res.status(204).json({
        message: "Subscriptions deleted successfully",
        data: response.data,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(
        "[Kick Subscription] Error deleting subscriptions:",
        error instanceof Error ? error.message : String(error)
      );

      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as { response: { status: number } };
        throw new AppError(
          "Error deleting Kick subscriptions",
          axiosError.response.status
        );
      }

      throw new AppError("Internal server error", 500);
    }
  }
);

/**
 * Gets all locally stored subscriptions
 */
const getLocalSubscriptions = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { status, event_type } = req.query;

      const whereClause: { status?: string; event_type?: string } = {};
      if (status) whereClause.status = status as string;
      if (event_type) whereClause.event_type = event_type as string;

      const subscriptions = await KickEventSubscription.findAll({
        where: whereClause,
        order: [["created_at", "DESC"]],
      });

      return res.json({
        subscriptions,
        total: subscriptions.length,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(
        "[Kick Subscription] Error fetching local subscriptions:",
        error instanceof Error ? error.message : String(error)
      );
      throw new AppError("Internal server error", 500);
    }
  }
);

export {
  getSubscriptions,
  createSubscriptions,
  deleteSubscriptions,
  getLocalSubscriptions,
};

export default {
  getSubscriptions,
  createSubscriptions,
  deleteSubscriptions,
  getLocalSubscriptions,
};
