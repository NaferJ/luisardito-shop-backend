jest.mock("axios");

jest.mock("../../config", () => ({
  kick: {
    apiBaseUrl: "https://api.kick.com",
  },
}));

jest.mock("../../src/models", () => ({
  KickEventSubscription: {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const axios = require("axios");
const { KickEventSubscription } = require("../../src/models");
const kickSubscriptionCtrl = require("../../src/controllers/kickSubscription.controller");
const AppError = require("../../src/utils/AppError");

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status: jest.fn(function (c) {
      this.statusCode = c;
      return this;
    }),
    json: jest.fn(function (b) {
      this.body = b;
      return this;
    }),
  };
}

function expectNextCalledWithAppError(next, res, statusCode, message) {
  expect(next).toHaveBeenCalledTimes(1);
  const err = next.mock.calls[0][0];
  expect(err).toBeInstanceOf(AppError);
  expect(err.statusCode).toBe(statusCode);
  expect(err.message).toBe(message);
  expect(res.status).not.toHaveBeenCalled();
  expect(res.json).not.toHaveBeenCalled();
}

describe("kickSubscription.controller migration characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------- getSubscriptions ----------
  describe("getSubscriptions", () => {
    test("success -> 200 { kick_subscriptions, local_subscriptions, message }", async () => {
      const kickData = [
        { subscription_id: "sub1" },
        { subscription_id: "sub2" },
      ];
      const localSubs = [
        { subscription_id: "sub1", status: "active" },
        { subscription_id: "sub3", status: "active" },
      ];
      axios.get.mockResolvedValue({
        data: { data: kickData, message: "OK" },
      });
      KickEventSubscription.findAll.mockResolvedValue(localSubs);

      const req = { headers: { authorization: "Bearer token" } };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.getSubscriptions(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        kick_subscriptions: kickData,
        local_subscriptions: localSubs,
        message: "OK",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("success with empty kick data -> kick_subscriptions defaults to []", async () => {
      axios.get.mockResolvedValue({
        data: { message: "No subscriptions" },
      });
      KickEventSubscription.findAll.mockResolvedValue([]);

      const req = { headers: { authorization: "Bearer token" } };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.getSubscriptions(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        kick_subscriptions: [],
        local_subscriptions: [],
        message: "No subscriptions",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("missing authorization -> next(AppError) 401 'Authorization token required'", async () => {
      const req = { headers: {} };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.getSubscriptions(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        401,
        "Authorization token required"
      );
    });

    test("upstream error.response -> next(AppError) with upstream status", async () => {
      const upstreamError = Object.assign(new Error("Unauthorized"), {
        response: { status: 403, data: { message: "Forbidden" } },
      });
      axios.get.mockRejectedValue(upstreamError);

      const req = { headers: { authorization: "Bearer token" } };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.getSubscriptions(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        403,
        "Error fetching Kick subscriptions"
      );
    });

    test("generic error (no response) -> next(AppError) 500 'Internal server error'", async () => {
      axios.get.mockRejectedValue(new Error("Network down"));

      const req = { headers: { authorization: "Bearer token" } };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.getSubscriptions(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Internal server error");
    });
  });

  // ---------- createSubscriptions ----------
  describe("createSubscriptions", () => {
    const validBody = {
      broadcaster_user_id: "12345",
      events: ["chat.message.sent"],
    };

    test("success -> 200 { kick_response, local_subscriptions, message }", async () => {
      const kickResponse = {
        data: [
          { subscription_id: "sub1", name: "chat.message.sent", version: "1" },
        ],
        message: "Created",
      };
      axios.post.mockResolvedValue({ data: kickResponse });
      const localSub = {
        subscription_id: "sub1",
        broadcaster_user_id: "12345",
        event_type: "chat.message.sent",
        event_version: "1",
        method: "webhook",
        status: "active",
      };
      KickEventSubscription.create.mockResolvedValue(localSub);

      const req = {
        headers: { authorization: "Bearer token" },
        body: validBody,
      };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.createSubscriptions(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        kick_response: kickResponse,
        local_subscriptions: [localSub],
        message: "Subscriptions created successfully",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("success with dbError in local create -> still 200, skips failed sub", async () => {
      const kickResponse = {
        data: [
          { subscription_id: "sub1", name: "chat.message.sent", version: "1" },
          { subscription_id: "sub2", name: "follow.sent", version: "1" },
        ],
      };
      axios.post.mockResolvedValue({ data: kickResponse });
      KickEventSubscription.create
        .mockRejectedValueOnce(new Error("DB constraint"))
        .mockResolvedValueOnce({
          subscription_id: "sub2",
          broadcaster_user_id: "12345",
          event_type: "follow.sent",
          event_version: "1",
          method: "webhook",
          status: "active",
        });

      const req = {
        headers: { authorization: "Bearer token" },
        body: validBody,
      };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.createSubscriptions(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.local_subscriptions).toHaveLength(1);
      expect(res.body.local_subscriptions[0].subscription_id).toBe("sub2");
      expect(res.body.message).toBe("Subscriptions created successfully");
      expect(next).not.toHaveBeenCalled();
    });

    test("missing authorization -> next(AppError) 401 'Authorization token required'", async () => {
      const req = { headers: {}, body: validBody };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.createSubscriptions(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        401,
        "Authorization token required"
      );
    });

    test("missing broadcaster_user_id -> next(AppError) 400", async () => {
      const req = {
        headers: { authorization: "Bearer token" },
        body: { events: ["chat.message.sent"] },
      };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.createSubscriptions(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        400,
        "broadcaster_user_id and events (array) are required"
      );
    });

    test("events not array -> next(AppError) 400", async () => {
      const req = {
        headers: { authorization: "Bearer token" },
        body: { broadcaster_user_id: "123", events: "not-array" },
      };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.createSubscriptions(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        400,
        "broadcaster_user_id and events (array) are required"
      );
    });

    test("upstream error.response -> next(AppError) with upstream status", async () => {
      const upstreamError = Object.assign(new Error("Bad request"), {
        response: { status: 422, data: { message: "Validation failed" } },
      });
      axios.post.mockRejectedValue(upstreamError);

      const req = {
        headers: { authorization: "Bearer token" },
        body: validBody,
      };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.createSubscriptions(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        422,
        "Error creating subscriptions in Kick"
      );
    });

    test("generic error (no response) -> next(AppError) 500 'Internal server error'", async () => {
      axios.post.mockRejectedValue(new Error("Network down"));

      const req = {
        headers: { authorization: "Bearer token" },
        body: validBody,
      };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.createSubscriptions(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Internal server error");
    });
  });

  // ---------- deleteSubscriptions ----------
  describe("deleteSubscriptions", () => {
    test("success -> 204 { message, data }", async () => {
      axios.delete.mockResolvedValue({ data: { result: "deleted" } });
      KickEventSubscription.update.mockResolvedValue([1]);

      const req = {
        headers: { authorization: "Bearer token" },
        query: { id: "sub1" },
      };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.deleteSubscriptions(req, res, next);

      expect(res.statusCode).toBe(204);
      expect(res.body).toEqual({
        message: "Subscriptions deleted successfully",
        data: { result: "deleted" },
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("success with array of ids -> 204", async () => {
      axios.delete.mockResolvedValue({ data: null });
      KickEventSubscription.update.mockResolvedValue([2]);

      const req = {
        headers: { authorization: "Bearer token" },
        query: { id: ["sub1", "sub2"] },
      };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.deleteSubscriptions(req, res, next);

      expect(res.statusCode).toBe(204);
      expect(res.body).toEqual({
        message: "Subscriptions deleted successfully",
        data: null,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("missing authorization -> next(AppError) 401 'Authorization token required'", async () => {
      const req = { headers: {}, query: { id: "sub1" } };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.deleteSubscriptions(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        401,
        "Authorization token required"
      );
    });

    test("missing id -> next(AppError) 400 'Subscription ID(s) required'", async () => {
      const req = { headers: { authorization: "Bearer token" }, query: {} };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.deleteSubscriptions(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        400,
        "Subscription ID(s) required"
      );
    });

    test("upstream error.response -> next(AppError) with upstream status", async () => {
      const upstreamError = Object.assign(new Error("Not found"), {
        response: { status: 404, data: { message: "Subscription not found" } },
      });
      axios.delete.mockRejectedValue(upstreamError);

      const req = {
        headers: { authorization: "Bearer token" },
        query: { id: "sub1" },
      };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.deleteSubscriptions(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        404,
        "Error deleting Kick subscriptions"
      );
    });

    test("generic error (no response) -> next(AppError) 500 'Internal server error'", async () => {
      axios.delete.mockRejectedValue(new Error("Network down"));

      const req = {
        headers: { authorization: "Bearer token" },
        query: { id: "sub1" },
      };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.deleteSubscriptions(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Internal server error");
    });
  });

  // ---------- getLocalSubscriptions ----------
  describe("getLocalSubscriptions", () => {
    test("success -> 200 { subscriptions, total }", async () => {
      const subs = [
        { subscription_id: "sub1", status: "active" },
        { subscription_id: "sub2", status: "inactive" },
      ];
      KickEventSubscription.findAll.mockResolvedValue(subs);

      const req = { query: {} };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.getLocalSubscriptions(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        subscriptions: subs,
        total: 2,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("success with filters -> passes where clause", async () => {
      const subs = [{ subscription_id: "sub1", status: "active" }];
      KickEventSubscription.findAll.mockResolvedValue(subs);

      const req = { query: { status: "active", event_type: "chat.message" } };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.getLocalSubscriptions(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        subscriptions: subs,
        total: 1,
      });
      expect(KickEventSubscription.findAll).toHaveBeenCalledWith({
        where: { status: "active", event_type: "chat.message" },
        order: [["created_at", "DESC"]],
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 'Internal server error'", async () => {
      KickEventSubscription.findAll.mockRejectedValue(new Error("DB down"));

      const req = { query: {} };
      const res = createRes();
      const next = jest.fn();

      await kickSubscriptionCtrl.getLocalSubscriptions(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Internal server error");
    });
  });
});
