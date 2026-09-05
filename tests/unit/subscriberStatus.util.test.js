jest.mock("../../src/models", () => ({
  KickUserTracking: { findOne: jest.fn() },
}));

const {
  resolveSubscriberStatus,
} = require("../../src/utils/subscriberStatus.util");
const { KickUserTracking } = require("../../src/models");

const FIXED_NOW = new Date("2025-01-15T12:00:00.000Z");

const INACTIVE = {
  is_subscriber: false,
  is_active: false,
  expires_soon: false,
  expires_at: null,
  subscription_duration_months: null,
};

describe("resolveSubscriberStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: FIXED_NOW });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("returns inactive shape when userIdExt is null", async () => {
    const result = await resolveSubscriberStatus(null);
    expect(result).toEqual(INACTIVE);
    expect(KickUserTracking.findOne).not.toHaveBeenCalled();
  });

  test("returns inactive shape when no tracking row exists", async () => {
    KickUserTracking.findOne.mockResolvedValue(null);
    const result = await resolveSubscriberStatus("123");
    expect(result).toEqual(INACTIVE);
  });

  test("returns inactive shape when is_subscribed is false", async () => {
    KickUserTracking.findOne.mockResolvedValue({
      is_subscribed: false,
      subscription_expires_at: null,
      subscription_duration_months: 3,
    });
    const result = await resolveSubscriberStatus("123");
    expect(result).toEqual(INACTIVE);
  });

  test("returns active subscriber with accumulated duration when subscription has no expiry", async () => {
    KickUserTracking.findOne.mockResolvedValue({
      is_subscribed: true,
      subscription_expires_at: null,
      subscription_duration_months: 6,
    });
    const result = await resolveSubscriberStatus("123");
    expect(result).toEqual({
      is_subscriber: true,
      is_active: true,
      expires_soon: false,
      expires_at: null,
      subscription_duration_months: 6,
    });
  });

  test("returns active subscriber with accumulated duration when expiry is in the future", async () => {
    const futureExpiry = new Date("2025-02-15T12:00:00.000Z");
    KickUserTracking.findOne.mockResolvedValue({
      is_subscribed: true,
      subscription_expires_at: futureExpiry,
      subscription_duration_months: 1,
    });
    const result = await resolveSubscriberStatus("123");
    expect(result).toEqual({
      is_subscriber: true,
      is_active: true,
      expires_soon: false,
      expires_at: futureExpiry,
      subscription_duration_months: 1,
    });
  });

  test("flags expires_soon when expiry is within 7 days", async () => {
    const soonExpiry = new Date("2025-01-20T12:00:00.000Z"); // 5 days after FIXED_NOW
    KickUserTracking.findOne.mockResolvedValue({
      is_subscribed: true,
      subscription_expires_at: soonExpiry,
      subscription_duration_months: 12,
    });
    const result = await resolveSubscriberStatus("123");
    expect(result.is_subscriber).toBe(true);
    expect(result.is_active).toBe(true);
    expect(result.expires_soon).toBe(true);
    expect(result.expires_at).toEqual(soonExpiry);
    expect(result.subscription_duration_months).toBe(12);
  });

  test("returns inactive shape when subscription has expired", async () => {
    const pastExpiry = new Date("2025-01-10T12:00:00.000Z"); // 5 days before FIXED_NOW
    KickUserTracking.findOne.mockResolvedValue({
      is_subscribed: true,
      subscription_expires_at: pastExpiry,
      subscription_duration_months: 3,
    });
    const result = await resolveSubscriberStatus("123");
    expect(result).toEqual(INACTIVE);
  });

  test("returns null duration when column is null but subscription is active", async () => {
    KickUserTracking.findOne.mockResolvedValue({
      is_subscribed: true,
      subscription_expires_at: null,
      subscription_duration_months: null,
    });
    const result = await resolveSubscriberStatus("123");
    expect(result.is_subscriber).toBe(true);
    expect(result.is_active).toBe(true);
    expect(result.subscription_duration_months).toBeNull();
  });
});
