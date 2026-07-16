/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import axios from "axios";
import config from "../../config";
import { KickEventSubscription } from "../models";
import logger from "../utils/logger";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/AppError";

/**
 * Gets all Kick event subscriptions
 */
const getSubscriptions = asyncHandler(async (req: any, res: any) => {
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
    const localSubscriptions: any = await KickEventSubscription.findAll({
      where: { status: "active" },
      order: [["created_at", "DESC"]],
    });

    return res.json({
      kick_subscriptions: response.data.data || [],
      local_subscriptions: localSubscriptions,
      message: response.data.message,
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error(
      "[Kick Subscription] Error fetching subscriptions:",
      error.message
    );

    if (error.response) {
      throw new AppError(
        "Error fetching Kick subscriptions",
        error.response.status
      );
    }

    throw new AppError("Internal server error", 500);
  }
});

/**
 * Creates new Kick event subscriptions
 */
const createSubscriptions = asyncHandler(async (req: any, res: any) => {
  // Subscription methods allowed by the Kick API
  const ALLOWED_METHODS = ["webhook", "websocket"];

  try {
    const { authorization } = req.headers;
    const { broadcaster_user_id, events, method = "webhook" } = req.body;

    if (!authorization) {
      throw new AppError("Authorization token required", 401);
    }

    if (!broadcaster_user_id || !events || !Array.isArray(events)) {
      throw new AppError(
        "broadcaster_user_id and events (array) are required",
        400
      );
    }

    // Validate that method is an allowed value (prevent SSRF / injection)
    const sanitizedMethod = ALLOWED_METHODS.includes(method)
      ? method
      : "webhook";

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
    const createdSubscriptions = [];

    for (const sub of subscriptionsData) {
      if (sub.subscription_id && !sub.error) {
        try {
          const localSub: any = await KickEventSubscription.create({
            subscription_id: sub.subscription_id,
            broadcaster_user_id,
            event_type: sub.name,
            event_version: sub.version,
            method: sanitizedMethod,
            status: "active",
          });
          createdSubscriptions.push(localSub);
        } catch (dbError: any) {
          logger.error(
            "[Kick Subscription] Error saving subscription locally:",
            dbError.message
          );
        }
      }
    }

    return res.status(200).json({
      kick_response: response.data,
      local_subscriptions: createdSubscriptions,
      message: "Subscriptions created successfully",
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error(
      "[Kick Subscription] Error creating subscriptions:",
      error.message
    );

    if (error.response) {
      throw new AppError(
        "Error creating subscriptions in Kick",
        error.response.status
      );
    }

    throw new AppError("Internal server error", 500);
  }
});

/**
 * Deletes Kick event subscriptions
 */
const deleteSubscriptions = asyncHandler(async (req: any, res: any) => {
  try {
    const { authorization } = req.headers;
    const { id } = req.query; // Can be an array or a string

    if (!authorization) {
      throw new AppError("Authorization token required", 401);
    }

    if (!id) {
      throw new AppError("Subscription ID(s) required", 400);
    }

    const ids = Array.isArray(id) ? id : [id];
    const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

    // Build query string with multiple IDs
    const queryParams = ids
      .map((subId: any) => `id=${encodeURIComponent(subId)}`)
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
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error(
      "[Kick Subscription] Error deleting subscriptions:",
      error.message
    );

    if (error.response) {
      throw new AppError(
        "Error deleting Kick subscriptions",
        error.response.status
      );
    }

    throw new AppError("Internal server error", 500);
  }
});

/**
 * Gets all locally stored subscriptions
 */
const getLocalSubscriptions = asyncHandler(async (req: any, res: any) => {
  try {
    const { status, event_type } = req.query;

    const whereClause: any = {};
    if (status) whereClause.status = status;
    if (event_type) whereClause.event_type = event_type;

    const subscriptions: any = await KickEventSubscription.findAll({
      where: whereClause,
      order: [["created_at", "DESC"]],
    });

    return res.json({
      subscriptions,
      total: subscriptions.length,
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error(
      "[Kick Subscription] Error fetching local subscriptions:",
      error.message
    );
    throw new AppError("Internal server error", 500);
  }
});

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
