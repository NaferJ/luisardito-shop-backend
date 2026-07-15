jest.mock("sequelize", () => ({
  Op: {
    gt: Symbol("gt"),
    lt: Symbol("lt"),
    gte: Symbol("gte"),
    or: Symbol("or"),
  },
}));

jest.mock("../../src/models/usuario.model", () => ({
  findByPk: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
  sum: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../../src/models/leaderboardSnapshot.model", () => ({
  max: jest.fn(),
  findAll: jest.fn(),
  bulkCreate: jest.fn(),
  destroy: jest.fn(),
}));

jest.mock("../../src/models/kickUserTracking.model", () => ({
  findOne: jest.fn(),
}));

jest.mock("../../src/models/discordUserLink.model", () => ({
  findOne: jest.fn(),
}));

jest.mock("../../src/models/database", () => ({
  sequelize: {
    transaction: jest.fn(),
  },
}));

jest.mock("../../src/models", () => ({
  UserWatchtime: {},
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const leaderboardService = require("../../src/services/leaderboard.service");
const Usuario = require("../../src/models/usuario.model");
const LeaderboardSnapshot = require("../../src/models/leaderboardSnapshot.model");
const KickUserTracking = require("../../src/models/kickUserTracking.model");
const DiscordUserLink = require("../../src/models/discordUserLink.model");
const logger = require("../../src/utils/logger");

const FIXED_NOW = new Date("2025-01-15T12:00:00.000Z");
const SNAPSHOT_DATE = new Date("2025-01-10T12:00:00.000Z");
// nextReset = SNAPSHOT_DATE + 336h (14 days) = 2025-01-24T12:00:00.000Z
const NEXT_RESET = new Date("2025-01-24T12:00:00.000Z");

function rawUser(overrides = {}) {
  return {
    id: 1,
    nickname: "User1",
    puntos: 100,
    max_puntos: 150,
    is_vip: false,
    vip_expires_at: null,
    kick_data: { username: "User1" },
    user_id_ext: null,
    discord_username: null,
    "watchtime.total_watchtime_minutes": 500,
    "watchtime.message_count": 50,
    ...overrides,
  };
}

function pkUser(overrides = {}) {
  return {
    id: 999,
    nickname: "OutsideUser",
    puntos: 50,
    max_puntos: 80,
    is_vip: false,
    vip_expires_at: null,
    kick_data: { username: "OutsideUser" },
    user_id_ext: null,
    watchtime: { total_watchtime_minutes: 200, message_count: 10 },
    isVipActive: jest.fn().mockReturnValue(false),
    ...overrides,
  };
}

function setupDefaults({
  users = [],
  snapshotRecords = [],
  subscriberData = {},
  discordData = {},
  snapshotDate = SNAPSHOT_DATE,
  findByPkUser = null,
} = {}) {
  Usuario.findAll.mockResolvedValue(users);
  Usuario.findByPk.mockResolvedValue(findByPkUser);

  KickUserTracking.findOne.mockImplementation(async (opts) => {
    const kickId = opts.where.kick_user_id;
    return subscriberData[kickId] || null;
  });

  DiscordUserLink.findOne.mockImplementation(async (opts) => {
    const userId = opts.where.tienda_user_id;
    return discordData[userId] || null;
  });

  LeaderboardSnapshot.max.mockResolvedValue(snapshotDate);
  LeaderboardSnapshot.findAll.mockResolvedValue(snapshotRecords);
}

function threeUsers() {
  return [
    rawUser({ id: 1, nickname: "Alice", puntos: 100, user_id_ext: "k1" }),
    rawUser({ id: 2, nickname: "Bob", puntos: 80, user_id_ext: "k2" }),
    rawUser({ id: 3, nickname: "Carol", puntos: 60, user_id_ext: "k3" }),
  ];
}

describe("LeaderboardService - getLeaderboard characterization", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("no userId", () => {
    test("returns paginated data + meta, user_position: null", async () => {
      setupDefaults({
        users: threeUsers(),
        snapshotRecords: [
          { usuario_id: 1, position: 2, puntos: 90 },
          { usuario_id: 2, position: 1, puntos: 100 },
        ],
        subscriberData: {
          k1: { is_subscribed: false, subscription_expires_at: null },
          k2: { is_subscribed: false, subscription_expires_at: null },
          k3: { is_subscribed: false, subscription_expires_at: null },
        },
      });

      const result = await leaderboardService.getLeaderboard({
        limit: 2,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].usuario_id).toBe(1);
      expect(result.data[0].nickname).toBe("Alice");
      expect(result.data[0].position).toBe(1);
      expect(result.data[0].change_indicator).toBe("up");
      expect(result.data[0].position_change).toBe(1);
      expect(result.data[0].previous_position).toBe(2);
      expect(result.data[0].previous_points).toBe(90);
      expect(result.data[1].usuario_id).toBe(2);
      expect(result.data[1].position).toBe(2);
      expect(result.data[1].change_indicator).toBe("down");
      expect(result.data[1].position_change).toBe(1);
      expect(result.data[1].previous_position).toBe(1);
      expect(result.data[1].previous_points).toBe(100);

      expect(result.meta.total).toBe(3);
      expect(result.meta.limit).toBe(2);
      expect(result.meta.offset).toBe(0);
      expect(result.meta.last_update).toBeNull();
      expect(result.meta.next_reset_date).toEqual(NEXT_RESET);
      expect(result.meta.days_until_reset).toBe(9);
      expect(result.meta.hours_until_reset).toBe(216);
      expect(result.user_position).toBeNull();
    });
  });

  describe("userId in ranking", () => {
    test("user_position is the matching row from the ranking", async () => {
      setupDefaults({
        users: threeUsers(),
        snapshotRecords: [],
        subscriberData: {
          k1: { is_subscribed: false, subscription_expires_at: null },
          k2: { is_subscribed: false, subscription_expires_at: null },
          k3: { is_subscribed: false, subscription_expires_at: null },
        },
      });

      const result = await leaderboardService.getLeaderboard({ userId: 2 });

      expect(result.user_position).not.toBeNull();
      expect(result.user_position.usuario_id).toBe(2);
      expect(result.user_position.nickname).toBe("Bob");
      expect(result.user_position.position).toBe(2);
      expect(result.user_position.change_indicator).toBe("new");
      expect(result.user_position.position_change).toBe(0);
      expect(result.user_position.previous_position).toBeNull();
      expect(result.user_position.previous_points).toBeNull();
    });

    test("user_position found even if outside pagination range", async () => {
      setupDefaults({
        users: threeUsers(),
        snapshotRecords: [],
        subscriberData: {
          k1: { is_subscribed: false, subscription_expires_at: null },
          k2: { is_subscribed: false, subscription_expires_at: null },
          k3: { is_subscribed: false, subscription_expires_at: null },
        },
      });

      const result = await leaderboardService.getLeaderboard({
        userId: 3,
        limit: 2,
        offset: 0,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].usuario_id).toBe(1);
      expect(result.data[1].usuario_id).toBe(2);
      expect(result.user_position).not.toBeNull();
      expect(result.user_position.usuario_id).toBe(3);
      expect(result.user_position.position).toBe(3);
    });
  });

  describe("userId not in ranking, user exists", () => {
    test("user_position built via findByPk path with all expected fields", async () => {
      setupDefaults({
        users: threeUsers(),
        snapshotRecords: [],
        subscriberData: {
          k1: { is_subscribed: false, subscription_expires_at: null },
          k2: { is_subscribed: false, subscription_expires_at: null },
          k3: { is_subscribed: false, subscription_expires_at: null },
          k999: { is_subscribed: true, subscription_expires_at: null },
        },
        findByPkUser: pkUser({
          user_id_ext: "kick999",
        }),
      });

      // Override KickUserTracking for the findByPk path
      KickUserTracking.findOne.mockImplementation(async (opts) => {
        if (opts.where.kick_user_id === "kick999") {
          return { is_subscribed: true, subscription_expires_at: null };
        }
        return null;
      });

      const result = await leaderboardService.getLeaderboard({ userId: 999 });

      expect(result.user_position).not.toBeNull();
      expect(result.user_position.usuario_id).toBe(999);
      expect(result.user_position.nickname).toBe("OutsideUser");
      expect(result.user_position.display_name).toBe("OutsideUser");
      expect(result.user_position.puntos).toBe(50);
      expect(result.user_position.max_puntos).toBe(80);
      expect(result.user_position.watchtime_minutes).toBe(200);
      expect(result.user_position.message_count).toBe(10);
      expect(result.user_position.position).toBe(4);
      expect(result.user_position.position_change).toBe(0);
      expect(result.user_position.change_indicator).toBe("neutral");
      expect(result.user_position.is_vip).toBe(false);
      expect(result.user_position.is_subscriber).toBe(true);
      expect(result.user_position.kick_data).toEqual({
        username: "OutsideUser",
      });
      expect(result.user_position.discord_info).toBeNull();
    });

    test("with discord link -> discord_info and display_name populated", async () => {
      const linkedAt = new Date("2025-01-01T00:00:00.000Z");
      setupDefaults({
        users: threeUsers(),
        snapshotRecords: [],
        findByPkUser: pkUser({ user_id_ext: "kick999" }),
        discordData: {
          999: {
            discord_user_id: "discord123",
            discord_username: "DiscordUser",
            discord_discriminator: "1234",
            discord_avatar: "avatar_hash",
            createdAt: linkedAt,
          },
        },
      });

      KickUserTracking.findOne.mockResolvedValue(null);

      const result = await leaderboardService.getLeaderboard({ userId: 999 });

      expect(result.user_position).not.toBeNull();
      expect(result.user_position.display_name).toBe("DiscordUser#1234");
      expect(result.user_position.discord_info).toEqual({
        linked: true,
        id: "discord123",
        username: "DiscordUser",
        discriminator: "1234",
        avatar: "avatar_hash",
        linked_at: linkedAt,
        display_name: "DiscordUser#1234",
      });
    });

    test("discord discriminator '0' -> display_name without discriminator", async () => {
      const linkedAt = new Date("2025-01-01T00:00:00.000Z");
      setupDefaults({
        users: threeUsers(),
        snapshotRecords: [],
        findByPkUser: pkUser({ user_id_ext: "kick999" }),
        discordData: {
          999: {
            discord_user_id: "discord123",
            discord_username: "DiscordUser",
            discord_discriminator: "0",
            discord_avatar: null,
            createdAt: linkedAt,
          },
        },
      });

      KickUserTracking.findOne.mockResolvedValue(null);

      const result = await leaderboardService.getLeaderboard({ userId: 999 });

      expect(result.user_position.display_name).toBe("DiscordUser");
      expect(result.user_position.discord_info.display_name).toBe(
        "DiscordUser"
      );
    });
  });

  describe("userId not in ranking, user not found", () => {
    test("user_position stays null when findByPk returns null", async () => {
      setupDefaults({
        users: threeUsers(),
        snapshotRecords: [],
        findByPkUser: null,
      });

      const result = await leaderboardService.getLeaderboard({ userId: 999 });

      expect(result.user_position).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
    });
  });

  describe("subscriber status (findByPk path)", () => {
    function setupForSubscriber(subscriberRecord, userExt = "kick999") {
      setupDefaults({
        users: threeUsers(),
        snapshotRecords: [],
        findByPkUser: pkUser({ user_id_ext: userExt }),
      });
      KickUserTracking.findOne.mockResolvedValue(subscriberRecord);
    }

    test("active subscriber (no expiry) -> is_subscriber true", async () => {
      setupForSubscriber({
        is_subscribed: true,
        subscription_expires_at: null,
      });

      const result = await leaderboardService.getLeaderboard({ userId: 999 });

      expect(result.user_position.is_subscriber).toBe(true);
    });

    test("active subscriber (future expiry) -> is_subscriber true", async () => {
      setupForSubscriber({
        is_subscribed: true,
        subscription_expires_at: "2025-12-31T00:00:00.000Z",
      });

      const result = await leaderboardService.getLeaderboard({ userId: 999 });

      expect(result.user_position.is_subscriber).toBe(true);
    });

    test("expired subscriber -> is_subscriber false", async () => {
      setupForSubscriber({
        is_subscribed: true,
        subscription_expires_at: "2024-12-31T00:00:00.000Z",
      });

      const result = await leaderboardService.getLeaderboard({ userId: 999 });

      expect(result.user_position.is_subscriber).toBe(false);
    });

    test("no user_id_ext -> is_subscriber false", async () => {
      setupDefaults({
        users: threeUsers(),
        snapshotRecords: [],
        findByPkUser: pkUser({ user_id_ext: null }),
      });

      const result = await leaderboardService.getLeaderboard({ userId: 999 });

      expect(result.user_position.is_subscriber).toBe(false);
      // findOne should NOT have been called for the findByPk user (null user_id_ext)
      const calls = KickUserTracking.findOne.mock.calls;
      expect(calls.some((c) => c[0].where.kick_user_id === null)).toBe(false);
    });

    test("is_subscribed false -> is_subscriber false", async () => {
      setupForSubscriber({
        is_subscribed: false,
        subscription_expires_at: null,
      });

      const result = await leaderboardService.getLeaderboard({ userId: 999 });

      expect(result.user_position.is_subscriber).toBe(false);
    });

    test("no tracking record (findOne returns null) -> is_subscriber false", async () => {
      setupForSubscriber(null);

      const result = await leaderboardService.getLeaderboard({ userId: 999 });

      expect(result.user_position.is_subscriber).toBe(false);
    });
  });

  describe("subscriber status (ranking path)", () => {
    test("active subscriber in ranking -> is_subscriber true in data", async () => {
      setupDefaults({
        users: [
          rawUser({
            id: 1,
            nickname: "SubUser",
            puntos: 100,
            user_id_ext: "k1",
          }),
        ],
        snapshotRecords: [],
        subscriberData: {
          k1: { is_subscribed: true, subscription_expires_at: null },
        },
      });

      const result = await leaderboardService.getLeaderboard();

      expect(result.data[0].is_subscriber).toBe(true);
    });

    test("expired subscriber in ranking -> is_subscriber false in data", async () => {
      setupDefaults({
        users: [
          rawUser({
            id: 1,
            nickname: "SubUser",
            puntos: 100,
            user_id_ext: "k1",
          }),
        ],
        snapshotRecords: [],
        subscriberData: {
          k1: {
            is_subscribed: true,
            subscription_expires_at: "2024-12-31T00:00:00.000Z",
          },
        },
      });

      const result = await leaderboardService.getLeaderboard();

      expect(result.data[0].is_subscriber).toBe(false);
    });

    test("no user_id_ext in ranking -> is_subscriber false in data", async () => {
      setupDefaults({
        users: [
          rawUser({
            id: 1,
            nickname: "PlainUser",
            puntos: 100,
            user_id_ext: null,
          }),
        ],
        snapshotRecords: [],
      });

      const result = await leaderboardService.getLeaderboard();

      expect(result.data[0].is_subscriber).toBe(false);
    });
  });

  describe("pagination", () => {
    test("offset/limit slice correctly; meta.total = full length", async () => {
      const users = [
        rawUser({ id: 1, nickname: "A", puntos: 500 }),
        rawUser({ id: 2, nickname: "B", puntos: 400 }),
        rawUser({ id: 3, nickname: "C", puntos: 300 }),
        rawUser({ id: 4, nickname: "D", puntos: 200 }),
        rawUser({ id: 5, nickname: "E", puntos: 100 }),
      ];

      setupDefaults({ users, snapshotRecords: [] });

      const result = await leaderboardService.getLeaderboard({
        limit: 2,
        offset: 1,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].usuario_id).toBe(2);
      expect(result.data[0].position).toBe(2);
      expect(result.data[1].usuario_id).toBe(3);
      expect(result.data[1].position).toBe(3);
      expect(result.meta.total).toBe(5);
      expect(result.meta.limit).toBe(2);
      expect(result.meta.offset).toBe(1);
    });

    test("default limit=100 and offset=0", async () => {
      setupDefaults({ users: threeUsers(), snapshotRecords: [] });

      const result = await leaderboardService.getLeaderboard();

      expect(result.data).toHaveLength(3);
      expect(result.meta.limit).toBe(100);
      expect(result.meta.offset).toBe(0);
      expect(result.meta.total).toBe(3);
    });
  });

  describe("error path", () => {
    test("underlying call throws -> logs and rethrows", async () => {
      Usuario.findAll.mockRejectedValue(new Error("DB connection lost"));
      LeaderboardSnapshot.max.mockResolvedValue(SNAPSHOT_DATE);
      LeaderboardSnapshot.findAll.mockResolvedValue([]);

      await expect(leaderboardService.getLeaderboard()).rejects.toThrow(
        "DB connection lost"
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Error getting leaderboard:",
        expect.any(Error)
      );
    });
  });
});
