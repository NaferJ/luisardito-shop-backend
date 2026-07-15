const mockRedisGet = jest.fn();

jest.mock("../../src/config/redis.config", () => ({
  getRedisClient: () => ({
    get: mockRedisGet,
  }),
}));

jest.mock("../../config", () => ({
  kick: {
    broadcasterId: "12345",
  },
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const logger = require("../../src/utils/logger");
const broadcasterInfoService = require("../../src/services/broadcasterInfo.service");

const FIXED_NOW = new Date("2025-01-15T12:00:00.000Z");

const setRedisData = (data) => {
  mockRedisGet.mockImplementation(async (key) => data[key] ?? null);
};

describe("BroadcasterInfoService - characterization", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
    mockRedisGet.mockReset();
    logger.info.mockClear();
    logger.error.mockClear();
    logger.warn.mockClear();
    logger.debug.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("getBroadcasterInfo", () => {
    test("offline (is_live null) with no stream info -> full offline object", async () => {
      setRedisData({
        "stream:is_live": null,
        "stream:current_info": null,
        "stream:last_status_update": null,
        "stream:last_metadata_update": null,
      });

      const result = await broadcasterInfoService.getBroadcasterInfo();

      expect(result.username).toBe("Luisardito");
      expect(result.user_id).toBe("12345");
      expect(result.profile_picture).toBe("/logo2.jpg");
      expect(result.channel_url).toBe("https://kick.com/luisardito");
      expect(result.is_verified).toBe(true);

      expect(result.stream.is_live).toBe(false);
      expect(result.stream.status).toBe("offline");
      expect(result.stream.title).toBeNull();
      expect(result.stream.category).toBeNull();
      expect(result.stream.category_id).toBeNull();
      expect(result.stream.language).toBe("es");
      expect(result.stream.has_mature_content).toBe(false);
      expect(result.stream.started_at).toBeNull();
      expect(result.stream.uptime_minutes).toBeNull();
      expect(result.stream.last_live_ago).toBeNull();

      expect(result.metadata.last_status_update).toBeNull();
      expect(result.metadata.last_metadata_update).toBeNull();
      expect(result.metadata.data_updated_at).toBe(FIXED_NOW.toISOString());

      expect(logger.info).toHaveBeenCalledWith(
        "[BroadcasterInfo] Info retrieved: Luisardito - OFFLINE"
      );
    });

    test("online with valid stream info -> uptime computed, fields mapped", async () => {
      const startedAt = "2025-01-15T11:00:00.000Z"; // 60 min before FIXED_NOW
      setRedisData({
        "stream:is_live": "true",
        "stream:current_info": JSON.stringify({
          title: "Test Stream",
          category: "Just Chatting",
          category_id: "cat-1",
          language: "en",
          has_mature_content: true,
          started_at: startedAt,
        }),
        "stream:last_status_update": "2025-01-15T11:00:00.000Z",
        "stream:last_metadata_update": "2025-01-15T11:05:00.000Z",
      });

      const result = await broadcasterInfoService.getBroadcasterInfo();

      expect(result.stream.is_live).toBe(true);
      expect(result.stream.status).toBe("online");
      expect(result.stream.title).toBe("Test Stream");
      expect(result.stream.category).toBe("Just Chatting");
      expect(result.stream.category_id).toBe("cat-1");
      expect(result.stream.language).toBe("en");
      expect(result.stream.has_mature_content).toBe(true);
      expect(result.stream.started_at).toBe(startedAt);
      expect(result.stream.uptime_minutes).toBe(60);
      expect(result.stream.last_live_ago).toBeNull();

      expect(result.metadata.last_status_update).toBe(
        "2025-01-15T11:00:00.000Z"
      );
      expect(result.metadata.last_metadata_update).toBe(
        "2025-01-15T11:05:00.000Z"
      );

      expect(logger.info).toHaveBeenCalledWith(
        "[BroadcasterInfo] Info retrieved: Luisardito - ONLINE"
      );
    });

    test("invalid stream:current_info JSON -> streamInfo null, logger.error called, no throw", async () => {
      setRedisData({
        "stream:is_live": "true",
        "stream:current_info": "not valid json{{{",
        "stream:last_status_update": null,
        "stream:last_metadata_update": null,
      });

      const result = await broadcasterInfoService.getBroadcasterInfo();

      expect(result.stream.is_live).toBe(true);
      expect(result.stream.status).toBe("online");
      expect(result.stream.title).toBeNull();
      expect(result.stream.category).toBeNull();
      expect(result.stream.category_id).toBeNull();
      expect(result.stream.language).toBe("es");
      expect(result.stream.has_mature_content).toBe(false);
      expect(result.stream.started_at).toBeNull();
      expect(result.stream.uptime_minutes).toBeNull();

      expect(logger.error).toHaveBeenCalledWith(
        "[BroadcasterInfo] Error parsing stream info:",
        expect.any(String)
      );
    });

    describe("lastLiveAgo formatting (offline)", () => {
      const makeOfflineWithLastStatus = (minutesOffset) => {
        const lastStatusUpdate = new Date(
          FIXED_NOW.getTime() + minutesOffset * 60 * 1000
        ).toISOString();
        setRedisData({
          "stream:is_live": "false",
          "stream:current_info": null,
          "stream:last_status_update": lastStatusUpdate,
          "stream:last_metadata_update": null,
        });
      };

      test.each([
        ["1 minute ago (singular boundary)", -1, "1 minute ago"],
        ["2 minutes ago (plural)", -2, "2 minutes ago"],
        ["59 minutes ago (upper minutes boundary)", -59, "59 minutes ago"],
      ])("%s", async (_label, minutesOffset, expected) => {
        makeOfflineWithLastStatus(minutesOffset);
        const result = await broadcasterInfoService.getBroadcasterInfo();
        expect(result.stream.last_live_ago).toBe(expected);
      });

      test.each([
        ["1 hour ago (singular boundary, 60 min)", -60, "1 hour ago"],
        ["2 hours ago (plural, 120 min)", -120, "2 hours ago"],
        [
          "23 hours ago (upper hours boundary, 1439 min)",
          -1439,
          "23 hours ago",
        ],
      ])("%s", async (_label, minutesOffset, expected) => {
        makeOfflineWithLastStatus(minutesOffset);
        const result = await broadcasterInfoService.getBroadcasterInfo();
        expect(result.stream.last_live_ago).toBe(expected);
      });

      test.each([
        ["1 day ago (singular boundary, 1440 min)", -1440, "1 day ago"],
        ["2 days ago (plural, 2880 min)", -2880, "2 days ago"],
      ])("%s", async (_label, minutesOffset, expected) => {
        makeOfflineWithLastStatus(minutesOffset);
        const result = await broadcasterInfoService.getBroadcasterInfo();
        expect(result.stream.last_live_ago).toBe(expected);
      });
    });

    test("redis.get throws -> catch fallback object", async () => {
      mockRedisGet.mockRejectedValue(new Error("Redis connection lost"));

      const result = await broadcasterInfoService.getBroadcasterInfo();

      expect(result.username).toBe("Luisardito");
      expect(result.user_id).toBe("12345");
      expect(result.profile_picture).toBe("/logo2.jpg");
      expect(result.channel_url).toBe("https://kick.com/luisardito");
      expect(result.is_verified).toBe(true);

      expect(result.stream.is_live).toBe(false);
      expect(result.stream.status).toBe("unknown");
      expect(result.stream.title).toBeNull();
      expect(result.stream.category).toBeNull();
      expect(result.stream.category_id).toBeNull();
      expect(result.stream.language).toBe("es");
      expect(result.stream.has_mature_content).toBe(false);
      expect(result.stream.started_at).toBeNull();
      expect(result.stream.uptime_minutes).toBeNull();
      expect(result.stream.last_live_ago).toBeNull();

      expect(result.metadata.last_status_update).toBeNull();
      expect(result.metadata.last_metadata_update).toBeNull();
      expect(result.metadata.error).toBe("Error getting server data");

      expect(logger.error).toHaveBeenCalledWith(
        "[BroadcasterInfo] Error getting broadcaster info:",
        "Redis connection lost"
      );
    });
  });

  describe("getStreamStatus", () => {
    test("live", async () => {
      setRedisData({ "stream:is_live": "true" });

      const result = await broadcasterInfoService.getStreamStatus();

      expect(result.is_live).toBe(true);
      expect(result.status).toBe("online");
      expect(result.checked_at).toBe(FIXED_NOW.toISOString());
    });

    test("offline", async () => {
      setRedisData({ "stream:is_live": "false" });

      const result = await broadcasterInfoService.getStreamStatus();

      expect(result.is_live).toBe(false);
      expect(result.status).toBe("offline");
      expect(result.checked_at).toBe(FIXED_NOW.toISOString());
    });

    test("redis throws -> status unknown + error", async () => {
      mockRedisGet.mockRejectedValue(new Error("Redis down"));

      const result = await broadcasterInfoService.getStreamStatus();

      expect(result.is_live).toBe(false);
      expect(result.status).toBe("unknown");
      expect(result.error).toBe("Redis down");
      expect(result.checked_at).toBe(FIXED_NOW.toISOString());

      expect(logger.error).toHaveBeenCalledWith(
        "[BroadcasterInfo] Error getting stream status:",
        "Redis down"
      );
    });
  });
});
