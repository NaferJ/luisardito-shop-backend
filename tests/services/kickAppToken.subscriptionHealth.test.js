const axios = require("axios");

jest.mock("axios");

jest.mock("../../config", () => ({
  kick: {
    apiBaseUrl: "https://api.kick.com",
    oauthToken: "https://id.kick.com/oauth/token",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
  },
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../../src/models", () => ({
  KickEventSubscription: {
    update: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
  KickBroadcasterToken: {},
}));

const { KickEventSubscription } = require("../../src/models");
const {
  getAppAccessToken,
  ensureWebhookSubscriptions,
} = require("../../src/services/kickAppToken.service");
const {
  DEFAULT_EVENTS,
} = require("../../src/services/kickAutoSubscribe.service");

const SUBSCRIPTIONS_URL = "https://api.kick.com/public/v1/events/subscriptions";

function remoteSubs(events) {
  return events.map((e, i) => ({
    id: `sub-${i}`,
    event: e.name,
    version: e.version,
  }));
}

function mockKick({ remote, subscribeData = [] }) {
  axios.post.mockImplementation((url) => {
    if (url === "https://id.kick.com/oauth/token") {
      return Promise.resolve({ data: { access_token: "app-token" } });
    }
    if (url === SUBSCRIPTIONS_URL) {
      return Promise.resolve({ data: { data: subscribeData } });
    }
    return Promise.reject(new Error(`unexpected POST ${url}`));
  });
  axios.get.mockResolvedValue({ data: { data: remote } });
}

describe("getAppAccessToken", () => {
  beforeEach(() => jest.clearAllMocks());

  test("requests client credentials from the OAuth host as a form", async () => {
    axios.post.mockResolvedValue({ data: { access_token: "app-token" } });

    await expect(getAppAccessToken()).resolves.toBe("app-token");

    const [url, body] = axios.post.mock.calls[0];
    expect(url).toBe("https://id.kick.com/oauth/token");
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get("grant_type")).toBe("client_credentials");
  });
});

describe("ensureWebhookSubscriptions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    KickEventSubscription.update.mockResolvedValue([0]);
    KickEventSubscription.findOne.mockResolvedValue(null);
    KickEventSubscription.create.mockImplementation((v) => Promise.resolve(v));
  });

  test("does nothing on Kick when every event is subscribed", async () => {
    mockKick({ remote: remoteSubs(DEFAULT_EVENTS) });

    const result = await ensureWebhookSubscriptions("2771761");

    expect(result.missing).toEqual([]);
    expect(result.resubscribed).toBe(0);
    const subscribeCalls = axios.post.mock.calls.filter(
      ([url]) => url === SUBSCRIPTIONS_URL
    );
    expect(subscribeCalls).toHaveLength(0);
    expect(axios.get).toHaveBeenCalledWith(
      SUBSCRIPTIONS_URL,
      expect.objectContaining({
        params: { broadcaster_user_id: 2771761 },
        headers: { Authorization: "Bearer app-token" },
      })
    );
  });

  test("re-subscribes only the events Kick dropped", async () => {
    const present = DEFAULT_EVENTS.filter(
      (e) => !["chat.message.sent", "channel.followed"].includes(e.name)
    );
    mockKick({
      remote: remoteSubs(present),
      subscribeData: [
        { subscription_id: "new-1", name: "chat.message.sent", version: 1 },
        { subscription_id: "new-2", name: "channel.followed", version: 1 },
      ],
    });

    const result = await ensureWebhookSubscriptions("2771761");

    expect(result.missing).toEqual(["chat.message.sent", "channel.followed"]);
    expect(result.resubscribed).toBe(2);
    const [, payload] = axios.post.mock.calls.find(
      ([url]) => url === SUBSCRIPTIONS_URL
    );
    expect(payload.events).toEqual([
      { name: "chat.message.sent", version: 1 },
      { name: "channel.followed", version: 1 },
    ]);
    expect(payload.broadcaster_user_id).toBe(2771761);
  });

  test("marks local subscriptions Kick no longer has as inactive", async () => {
    mockKick({ remote: remoteSubs(DEFAULT_EVENTS) });

    await ensureWebhookSubscriptions("2771761");

    const [values, { where }] = KickEventSubscription.update.mock.calls[0];
    expect(values).toEqual({ status: "inactive" });
    expect(where.broadcaster_user_id).toBe(2771761);
    expect(where.status).toBe("active");
    const [notIn] = Object.getOwnPropertySymbols(where.subscription_id);
    expect(where.subscription_id[notIn]).toEqual(
      DEFAULT_EVENTS.map((_, i) => `sub-${i}`)
    );
  });

  test("marks every local subscription inactive when Kick has none", async () => {
    mockKick({ remote: [], subscribeData: [] });

    await ensureWebhookSubscriptions("2771761");

    const [, { where }] = KickEventSubscription.update.mock.calls[0];
    expect(where).toEqual({ broadcaster_user_id: 2771761, status: "active" });
  });

  test("fetches the App Access Token only once when re-subscribing", async () => {
    mockKick({ remote: [], subscribeData: [] });

    await ensureWebhookSubscriptions("2771761");

    const tokenCalls = axios.post.mock.calls.filter(
      ([url]) => url === "https://id.kick.com/oauth/token"
    );
    expect(tokenCalls).toHaveLength(1);
  });

  test("leaves local rows untouched when Kick's list response is malformed", async () => {
    mockKick({ remote: undefined });
    axios.get.mockResolvedValue({ data: { message: "unexpected" } });

    await expect(ensureWebhookSubscriptions("2771761")).rejects.toThrow(
      "Unexpected Kick subscription list response"
    );
    expect(KickEventSubscription.update).not.toHaveBeenCalled();
  });

  test("throws when no App Access Token can be obtained", async () => {
    axios.post.mockRejectedValue(new Error("network"));

    await expect(ensureWebhookSubscriptions("2771761")).rejects.toThrow(
      "Could not get App Access Token"
    );
    expect(axios.get).not.toHaveBeenCalled();
  });
});
