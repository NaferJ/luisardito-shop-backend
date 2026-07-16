jest.mock("../../src/models", () => ({
  Usuario: {
    findAll: jest.fn(),
    count: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn(),
  },
  Canje: {
    findByPk: jest.fn(),
  },
  Producto: {},
  BotrixMigrationConfig: {
    getConfig: jest.fn(),
    setConfig: jest.fn(),
  },
  KickBotToken: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn(),
  },
  KickUserTracking: {
    findOne: jest.fn(),
  },
  DiscordUserLink: {
    findOne: jest.fn(),
  },
  sequelize: {
    fn: jest.fn((...args) => ({ fn: args })),
    col: jest.fn((name) => ({ col: name })),
    literal: jest.fn((s) => ({ val: s })),
  },
}));

jest.mock("sequelize", () => ({
  Op: { gt: Symbol("gt"), lt: Symbol("lt"), or: Symbol("or") },
}));

jest.mock("../../src/services/botrixMigration.service", () => ({
  migrateBotrixPoints: jest.fn(),
}));

const mockRefreshToken = jest.fn();
const mockSendMessage = jest.fn();
jest.mock("../../src/services/kickBot.service", () =>
  jest.fn().mockImplementation(() => ({
    refreshToken: mockRefreshToken,
    sendMessage: mockSendMessage,
  }))
);

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const {
  Usuario,
  Canje,
  BotrixMigrationConfig,
  KickBotToken,
  KickUserTracking,
  DiscordUserLink,
} = require("../../src/models");
const BotrixMigrationService = require("../../src/services/botrixMigration.service");
const KickBotService = require("../../src/services/kickBot.service");
const kickAdminCtrl = require("../../src/controllers/kickAdmin.controller");

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

describe("kickAdmin.controller migration characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------- 1. getConfig ----------
  describe("getConfig", () => {
    test("success -> 200 with { success, migration, watchtime_migration, vip }", async () => {
      BotrixMigrationConfig.getConfig.mockResolvedValue({
        migration_enabled: true,
        watchtime_migration_enabled: false,
        vip_points_enabled: true,
        vip_chat_points: 10,
        vip_follow_points: 5,
        vip_sub_points: 50,
      });
      Usuario.findAll
        .mockResolvedValueOnce([
          { migrated_users: 5, total_points_migrated: 1000 },
        ])
        .mockResolvedValueOnce([
          { migrated_users: 3, total_minutes_migrated: 600 },
        ]);
      Usuario.count.mockResolvedValueOnce(4).mockResolvedValueOnce(2);

      const req = {};
      const res = createRes();

      await kickAdminCtrl.getConfig(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        migration: {
          enabled: true,
          stats: { migrated_users: 5, total_points_migrated: 1000 },
        },
        watchtime_migration: {
          enabled: false,
          stats: { migrated_users: 3, total_minutes_migrated: 600 },
        },
        vip: {
          points_enabled: true,
          chat_points: 10,
          follow_points: 5,
          sub_points: 50,
          stats: { active_vips: 4, expired_vips: 2 },
        },
      });
      expect(BotrixMigrationConfig.getConfig).toHaveBeenCalledTimes(1);
      expect(Usuario.findAll).toHaveBeenCalledTimes(2);
      expect(Usuario.count).toHaveBeenCalledTimes(2);
    });

    test("error -> 500 with { success: false, error: error.message }", async () => {
      BotrixMigrationConfig.getConfig.mockRejectedValue(new Error("DB down"));
      const req = {};
      const res = createRes();

      await kickAdminCtrl.getConfig(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ success: false, error: "DB down" });
    });
  });

  // ---------- 2. updateMigrationConfig ----------
  describe("updateMigrationConfig", () => {
    test("boolean true -> 200 with enabled message", async () => {
      BotrixMigrationConfig.setConfig.mockResolvedValue();
      const req = { body: { migration_enabled: true }, headers: {} };
      const res = createRes();

      await kickAdminCtrl.updateMigrationConfig(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Botrix migration enabled",
        config: { migration_enabled: true },
      });
      expect(BotrixMigrationConfig.setConfig).toHaveBeenCalledWith(
        "migration_enabled",
        true
      );
    });

    test('string "true" -> 200 with enabled message', async () => {
      BotrixMigrationConfig.setConfig.mockResolvedValue();
      const req = { body: { migration_enabled: "true" }, headers: {} };
      const res = createRes();

      await kickAdminCtrl.updateMigrationConfig(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Botrix migration enabled",
        config: { migration_enabled: true },
      });
    });

    test('invalid string -> 400 "must be a boolean or true/false"', async () => {
      const req = { body: { migration_enabled: "yes" }, headers: {} };
      const res = createRes();

      await kickAdminCtrl.updateMigrationConfig(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'migration_enabled must be a boolean or "true"/"false"',
      });
      expect(BotrixMigrationConfig.setConfig).not.toHaveBeenCalled();
    });

    test("non-boolean/non-string (number) -> 400 'must be a boolean'", async () => {
      const req = { body: { migration_enabled: 1 }, headers: {} };
      const res = createRes();

      await kickAdminCtrl.updateMigrationConfig(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: "migration_enabled must be a boolean",
      });
    });

    test("error -> 500 with error.message", async () => {
      BotrixMigrationConfig.setConfig.mockRejectedValue(
        new Error("Config save failed")
      );
      const req = { body: { migration_enabled: true }, headers: {} };
      const res = createRes();

      await kickAdminCtrl.updateMigrationConfig(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ success: false, error: "Config save failed" });
    });
  });

  // ---------- 3. updateVipConfig ----------
  describe("updateVipConfig", () => {
    test("valid update -> 200 with updated config", async () => {
      BotrixMigrationConfig.setConfig.mockResolvedValue();
      const req = {
        body: { vip_points_enabled: true, vip_chat_points: 10 },
        headers: {},
      };
      const res = createRes();

      await kickAdminCtrl.updateVipConfig(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "VIP configuration updated",
        config: { vip_points_enabled: true, vip_chat_points: 10 },
      });
      expect(BotrixMigrationConfig.setConfig).toHaveBeenCalledWith(
        "vip_points_enabled",
        true
      );
      expect(BotrixMigrationConfig.setConfig).toHaveBeenCalledWith(
        "vip_chat_points",
        10
      );
    });

    test("invalid number (negative) -> 400 'must be a non-negative number'", async () => {
      const req = { body: { vip_chat_points: -5 }, headers: {} };
      const res = createRes();

      await kickAdminCtrl.updateVipConfig(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: "vip_chat_points must be a non-negative number",
      });
    });

    test("empty update -> 400 'No valid data provided to update'", async () => {
      const req = { body: {}, headers: {} };
      const res = createRes();

      await kickAdminCtrl.updateVipConfig(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: "No valid data provided to update",
      });
    });

    test("error -> 500 with error.message", async () => {
      BotrixMigrationConfig.setConfig.mockRejectedValue(
        new Error("DB write failed")
      );
      const req = { body: { vip_sub_points: 50 }, headers: {} };
      const res = createRes();

      await kickAdminCtrl.updateVipConfig(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ success: false, error: "DB write failed" });
    });
  });

  // ---------- 4. updateWatchtimeMigrationConfig ----------
  describe("updateWatchtimeMigrationConfig", () => {
    test("boolean true -> 200 with enabled message", async () => {
      BotrixMigrationConfig.setConfig.mockResolvedValue();
      const req = { body: { watchtime_migration_enabled: true } };
      const res = createRes();

      await kickAdminCtrl.updateWatchtimeMigrationConfig(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Watchtime migration enabled",
        config: { watchtime_migration_enabled: true },
      });
      expect(BotrixMigrationConfig.setConfig).toHaveBeenCalledWith(
        "watchtime_migration_enabled",
        true
      );
    });

    test('invalid string -> 400 "must be a boolean or true/false"', async () => {
      const req = { body: { watchtime_migration_enabled: "maybe" } };
      const res = createRes();

      await kickAdminCtrl.updateWatchtimeMigrationConfig(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error:
          'watchtime_migration_enabled must be a boolean or "true"/"false"',
      });
    });

    test("non-boolean/non-string (number) -> 400 'must be a boolean'", async () => {
      const req = { body: { watchtime_migration_enabled: 1 } };
      const res = createRes();

      await kickAdminCtrl.updateWatchtimeMigrationConfig(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: "watchtime_migration_enabled must be a boolean",
      });
    });

    test("error -> 500 with error.message", async () => {
      BotrixMigrationConfig.setConfig.mockRejectedValue(
        new Error("Config error")
      );
      const req = { body: { watchtime_migration_enabled: false } };
      const res = createRes();

      await kickAdminCtrl.updateWatchtimeMigrationConfig(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ success: false, error: "Config error" });
    });
  });

  // ---------- 5. grantVipFromCanje ----------
  describe("grantVipFromCanje", () => {
    test("canje not found -> 404", async () => {
      Canje.findByPk.mockResolvedValue(null);
      const req = { params: { canjeId: "999" }, body: {} };
      const res = createRes();

      await kickAdminCtrl.grantVipFromCanje(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ success: false, error: "Canje not found" });
    });

    test('estado != entregado -> 400 "must be in entregado state"', async () => {
      Canje.findByPk.mockResolvedValue({
        estado: "pendiente",
        Producto: { nombre: "VIP" },
        Usuario: { id: 1, update: jest.fn() },
      });
      const req = { params: { canjeId: "1" }, body: {} };
      const res = createRes();

      await kickAdminCtrl.grantVipFromCanje(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'The canje must be in "entregado" state to grant VIP',
      });
    });

    test("product not VIP -> 400 'does not grant VIP'", async () => {
      Canje.findByPk.mockResolvedValue({
        estado: "entregado",
        Producto: { nombre: "Puntos 100" },
        Usuario: { id: 1, update: jest.fn() },
      });
      const req = { params: { canjeId: "1" }, body: {} };
      const res = createRes();

      await kickAdminCtrl.grantVipFromCanje(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: "This product does not grant VIP",
      });
    });

    test("success -> 200 with user_id and duration", async () => {
      const usuarioUpdate = jest.fn().mockResolvedValue();
      Canje.findByPk.mockResolvedValue({
        estado: "entregado",
        Producto: { nombre: "VIP 30 dias" },
        Usuario: { id: 5, update: usuarioUpdate },
      });
      const req = { params: { canjeId: "1" }, body: { duration_days: 30 } };
      const res = createRes();

      await kickAdminCtrl.grantVipFromCanje(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "VIP granted successfully",
        user_id: 5,
        duration: "30 days",
      });
      expect(usuarioUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_vip: true,
          vip_granted_by_canje_id: "1",
        })
      );
    });

    test("success with no duration_days -> 200 Permanent", async () => {
      const usuarioUpdate = jest.fn().mockResolvedValue();
      Canje.findByPk.mockResolvedValue({
        estado: "entregado",
        Producto: { nombre: "VIP permanente" },
        Usuario: { id: 5, update: usuarioUpdate },
      });
      const req = { params: { canjeId: "1" }, body: {} };
      const res = createRes();

      await kickAdminCtrl.grantVipFromCanje(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.duration).toBe("Permanent");
      expect(usuarioUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ vip_expires_at: null })
      );
    });
  });

  // ---------- 6. grantVipManually ----------
  describe("grantVipManually", () => {
    test("user not found -> 404", async () => {
      Usuario.findByPk.mockResolvedValue(null);
      const req = { params: { usuarioId: "999" }, body: {} };
      const res = createRes();

      await kickAdminCtrl.grantVipManually(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ success: false, error: "User not found" });
    });

    test("already VIP (permanent) -> 400 'already has active VIP'", async () => {
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "user",
        is_vip: true,
        vip_expires_at: null,
        update: jest.fn(),
      });
      const req = { params: { usuarioId: "1" }, body: {} };
      const res = createRes();

      await kickAdminCtrl.grantVipManually(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: "User already has active VIP",
      });
    });

    test("success -> 200 with user info", async () => {
      const usuarioUpdate = jest.fn().mockResolvedValue();
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "user",
        is_vip: false,
        vip_expires_at: null,
        update: usuarioUpdate,
      });
      const req = { params: { usuarioId: "1" }, body: { duration_days: 30 } };
      const res = createRes();

      await kickAdminCtrl.grantVipManually(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "VIP granted successfully",
        user: {
          id: 1,
          nickname: "user",
          vip_granted_at: expect.any(Date),
          vip_expires_at: expect.any(Date),
          duration: "30 days",
        },
      });
      expect(usuarioUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_vip: true,
          vip_granted_by_canje_id: null,
        })
      );
    });
  });

  // ---------- 7. removeVip ----------
  describe("removeVip", () => {
    test("user not found -> 404", async () => {
      Usuario.findByPk.mockResolvedValue(null);
      const req = { params: { usuarioId: "999" }, body: {} };
      const res = createRes();

      await kickAdminCtrl.removeVip(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ success: false, error: "User not found" });
    });

    test("not VIP -> 400 'does not have VIP'", async () => {
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "user",
        is_vip: false,
        update: jest.fn(),
      });
      const req = { params: { usuarioId: "1" }, body: {} };
      const res = createRes();

      await kickAdminCtrl.removeVip(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: "User does not have VIP",
      });
    });

    test("success -> 200 with user info and reason", async () => {
      const usuarioUpdate = jest.fn().mockResolvedValue();
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "user",
        is_vip: true,
        update: usuarioUpdate,
      });
      const req = { params: { usuarioId: "1" }, body: { reason: "test" } };
      const res = createRes();

      await kickAdminCtrl.removeVip(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "VIP removed successfully",
        user: {
          id: 1,
          nickname: "user",
          vip_removed_at: expect.any(Date),
          reason: "test",
        },
      });
      expect(usuarioUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_vip: false,
          vip_granted_at: null,
          vip_expires_at: null,
        })
      );
    });
  });

  // ---------- 8. cleanupExpiredVips ----------
  describe("cleanupExpiredVips", () => {
    test("none found -> 200 { cleaned: 0 }", async () => {
      Usuario.findAll.mockResolvedValue([]);
      const req = {};
      const res = createRes();

      await kickAdminCtrl.cleanupExpiredVips(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "No expired VIPs to clean up",
        cleaned: 0,
      });
      expect(Usuario.update).not.toHaveBeenCalled();
    });

    test("some found -> 200 with users list and cleaned count", async () => {
      const expiredAt1 = new Date("2024-01-01");
      const expiredAt2 = new Date("2024-01-02");
      Usuario.findAll.mockResolvedValue([
        { id: 1, nickname: "user1", vip_expires_at: expiredAt1 },
        { id: 2, nickname: "user2", vip_expires_at: expiredAt2 },
      ]);
      Usuario.update.mockResolvedValue([2]);
      const req = {};
      const res = createRes();

      await kickAdminCtrl.cleanupExpiredVips(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "2 expired VIPs cleaned up successfully",
        cleaned: 2,
        users: [
          { id: 1, nickname: "user1", expired_at: expiredAt1 },
          { id: 2, nickname: "user2", expired_at: expiredAt2 },
        ],
      });
      expect(Usuario.update).toHaveBeenCalledTimes(1);
    });

    test("error -> 500 with error.message", async () => {
      Usuario.findAll.mockRejectedValue(new Error("DB error"));
      const req = {};
      const res = createRes();

      await kickAdminCtrl.cleanupExpiredVips(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ success: false, error: "DB error" });
    });
  });

  // ---------- 9. getUsersWithDetails ----------
  describe("getUsersWithDetails", () => {
    test("success with filter='all' -> 200 { success, users, total }", async () => {
      const userData = {
        id: 1,
        nickname: "testuser",
        puntos: 100,
        user_id_ext: null,
        discord_username: null,
        is_vip: false,
        vip_granted_at: null,
        vip_expires_at: null,
        vip_granted_by_canje_id: null,
        botrix_migrated: false,
        botrix_migrated_at: null,
        botrix_points_migrated: 0,
        kick_data: null,
        creado: new Date("2024-01-01"),
        actualizado: new Date("2024-01-02"),
        total_canjes: 5,
        canjes_pendientes: 1,
      };
      const user = { ...userData, toJSON: () => ({ ...userData }) };

      Usuario.count.mockResolvedValue(1);
      Usuario.findAll.mockResolvedValue([user]);
      DiscordUserLink.findOne.mockResolvedValue(null);

      const req = { query: { filter: "all" } };
      const res = createRes();

      await kickAdminCtrl.getUsersWithDetails(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.total).toBe(1);
      expect(res.body.users).toHaveLength(1);
      const enriched = res.body.users[0];
      expect(enriched.id).toBe(1);
      expect(enriched.nickname).toBe("testuser");
      expect(enriched.display_name).toBe("testuser");
      expect(enriched.discord_info).toBeNull();
      expect(enriched.vip_status).toEqual({
        is_active: false,
        is_permanent: false,
        expires_soon: null,
      });
      expect(enriched.migration_status).toEqual({
        can_migrate: true,
        points_migrated: 0,
      });
      expect(enriched.subscriber_status).toEqual({
        is_active: false,
        expires_soon: false,
      });
      expect(KickUserTracking.findOne).not.toHaveBeenCalled();
    });

    test("error -> 500 with error.message", async () => {
      Usuario.count.mockRejectedValue(new Error("DB error"));
      const req = { query: {} };
      const res = createRes();

      await kickAdminCtrl.getUsersWithDetails(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ success: false, error: "DB error" });
    });
  });

  // ---------- 10. manualBotrixMigration ----------
  describe("manualBotrixMigration", () => {
    test("missing params -> 400 'usuarioId and points are required'", async () => {
      const req = { params: {}, body: {} };
      const res = createRes();

      await kickAdminCtrl.manualBotrixMigration(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: "usuarioId and points are required",
      });
    });

    test("invalid numbers -> 400 'must be valid numbers'", async () => {
      const req = { params: { usuarioId: "abc" }, body: { points: "100" } };
      const res = createRes();

      await kickAdminCtrl.manualBotrixMigration(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: "usuarioId and points must be valid numbers",
      });
    });

    test("user not found -> 404", async () => {
      Usuario.findByPk.mockResolvedValue(null);
      const req = { params: { usuarioId: "999" }, body: { points: 100 } };
      const res = createRes();

      await kickAdminCtrl.manualBotrixMigration(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ success: false, error: "User not found" });
    });

    test("already migrated -> 400 with details", async () => {
      const migratedAt = new Date("2024-01-01");
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "user",
        botrix_migrated: true,
        botrix_migrated_at: migratedAt,
        botrix_points_migrated: 500,
      });
      const req = { params: { usuarioId: "1" }, body: { points: 100 } };
      const res = createRes();

      await kickAdminCtrl.manualBotrixMigration(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: "User already has migrated Botrix points",
        details: {
          migrated_at: migratedAt,
          points_migrated: 500,
        },
      });
    });

    test("success -> 200 with migration result", async () => {
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "user",
        botrix_migrated: false,
      });
      const migrationResult = { success: true, points: 100 };
      BotrixMigrationService.migrateBotrixPoints.mockResolvedValue(
        migrationResult
      );
      const req = { params: { usuarioId: "1" }, body: { points: 100 } };
      const res = createRes();

      await kickAdminCtrl.manualBotrixMigration(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Manual migration completed successfully",
        migration: migrationResult,
      });
      expect(BotrixMigrationService.migrateBotrixPoints).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, nickname: "user" }),
        100,
        "user"
      );
    });
  });

  // ---------- 11. getBotTokensStatus ----------
  describe("getBotTokensStatus", () => {
    test("success -> 200 with summary + tokens", async () => {
      const now = Date.now();
      const activeExpiry = new Date(now + 60 * 60 * 1000);
      const expiredExpiry = new Date(now - 60 * 60 * 1000);
      KickBotToken.findAll.mockResolvedValue([
        {
          id: 1,
          kick_username: "active_bot",
          kick_user_id: "100",
          is_active: true,
          token_expires_at: activeExpiry,
          refresh_token: "refresh1",
          created_at: new Date("2024-01-01"),
          updated_at: new Date("2024-01-02"),
        },
        {
          id: 2,
          kick_username: "expired_bot",
          kick_user_id: "200",
          is_active: true,
          token_expires_at: expiredExpiry,
          refresh_token: "refresh2",
          created_at: new Date("2024-01-01"),
          updated_at: new Date("2024-01-02"),
        },
        {
          id: 3,
          kick_username: "inactive_bot",
          kick_user_id: "300",
          is_active: false,
          token_expires_at: activeExpiry,
          refresh_token: null,
          created_at: new Date("2024-01-01"),
          updated_at: new Date("2024-01-02"),
        },
      ]);

      const req = {};
      const res = createRes();

      await kickAdminCtrl.getBotTokensStatus(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary).toEqual({
        total: 3,
        active: 1,
        expired: 1,
        expiring_soon: 0,
        inactive: 1,
      });
      expect(res.body.tokens).toHaveLength(3);
      expect(res.body.tokens[0].status).toBe("active");
      expect(res.body.tokens[0].id).toBe(1);
      expect(res.body.tokens[0].kick_username).toBe("active_bot");
      expect(res.body.tokens[0].has_refresh_token).toBe(true);
      expect(res.body.tokens[0].expires_in_minutes).toEqual(expect.any(Number));
      expect(res.body.tokens[1].status).toBe("expired");
      expect(res.body.tokens[2].status).toBe("inactive");
      expect(res.body.tokens[2].has_refresh_token).toBe(false);
    });

    test("error -> 500 with error.message", async () => {
      KickBotToken.findAll.mockRejectedValue(new Error("DB error"));
      const req = {};
      const res = createRes();

      await kickAdminCtrl.getBotTokensStatus(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ success: false, error: "DB error" });
    });
  });

  // ---------- 12. cleanupExpiredBotTokens ----------
  describe("cleanupExpiredBotTokens", () => {
    test("none found -> 200 { cleaned: 0 }", async () => {
      KickBotToken.findAll.mockResolvedValue([]);
      const req = {};
      const res = createRes();

      await kickAdminCtrl.cleanupExpiredBotTokens(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "No expired tokens to clean up",
        cleaned: 0,
      });
      expect(KickBotToken.update).not.toHaveBeenCalled();
    });

    test("some found -> 200 with tokens list", async () => {
      const expiredAt = new Date("2024-01-01");
      KickBotToken.findAll.mockResolvedValue([
        {
          id: 1,
          kick_username: "bot1",
          token_expires_at: expiredAt,
        },
        {
          id: 2,
          kick_username: "bot2",
          token_expires_at: expiredAt,
        },
      ]);
      KickBotToken.update.mockResolvedValue([2]);
      const req = {};
      const res = createRes();

      await kickAdminCtrl.cleanupExpiredBotTokens(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "2 expired tokens marked as inactive",
        cleaned: 2,
        tokens: [
          { id: 1, kick_username: "bot1", expired_at: expiredAt },
          { id: 2, kick_username: "bot2", expired_at: expiredAt },
        ],
      });
      expect(KickBotToken.update).toHaveBeenCalledWith(
        { is_active: false },
        expect.objectContaining({
          where: expect.objectContaining({ is_active: true }),
        })
      );
    });

    test("error -> 500 with error.message", async () => {
      KickBotToken.findAll.mockRejectedValue(new Error("DB error"));
      const req = {};
      const res = createRes();

      await kickAdminCtrl.cleanupExpiredBotTokens(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ success: false, error: "DB error" });
    });
  });

  // ---------- 13. refreshBotToken ----------
  describe("refreshBotToken", () => {
    test("token not found -> 404", async () => {
      KickBotToken.findByPk.mockResolvedValue(null);
      const req = { params: { tokenId: "999" } };
      const res = createRes();

      await kickAdminCtrl.refreshBotToken(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ success: false, error: "Token not found" });
    });

    test("refresh success -> 200 with token info", async () => {
      const newExpiry = new Date(Date.now() + 60 * 60 * 1000);
      KickBotToken.findByPk.mockResolvedValue({
        id: 1,
        kick_username: "bot1",
        token_expires_at: new Date(),
        is_active: true,
      });
      mockRefreshToken.mockResolvedValue({
        id: 1,
        kick_username: "bot1",
        token_expires_at: newExpiry,
        is_active: true,
      });
      const req = { params: { tokenId: "1" } };
      const res = createRes();

      await kickAdminCtrl.refreshBotToken(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Token refreshed successfully",
        token: {
          id: 1,
          kick_username: "bot1",
          expires_at: newExpiry,
          is_active: true,
        },
      });
      expect(KickBotService).toHaveBeenCalled();
      expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    });

    test("refresh error -> 400 with error details and code", async () => {
      KickBotToken.findByPk.mockResolvedValue({
        id: 1,
        kick_username: "bot1",
        token_expires_at: new Date(),
        is_active: true,
      });
      const refreshErr = new Error("Refresh failed");
      refreshErr.code = "TOKEN_EXPIRED";
      mockRefreshToken.mockRejectedValue(refreshErr);
      const req = { params: { tokenId: "1" } };
      const res = createRes();

      await kickAdminCtrl.refreshBotToken(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: "Could not refresh the token",
        details: "Refresh failed",
        code: "TOKEN_EXPIRED",
      });
    });

    test("refresh error without code -> 400 with default code REFRESH_FAILED", async () => {
      KickBotToken.findByPk.mockResolvedValue({
        id: 1,
        kick_username: "bot1",
        token_expires_at: new Date(),
        is_active: true,
      });
      mockRefreshToken.mockRejectedValue(new Error("Network error"));
      const req = { params: { tokenId: "1" } };
      const res = createRes();

      await kickAdminCtrl.refreshBotToken(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe("REFRESH_FAILED");
    });
  });

  // ---------- 14. deactivateBotToken ----------
  describe("deactivateBotToken", () => {
    test("token not found -> 404", async () => {
      KickBotToken.findByPk.mockResolvedValue(null);
      const req = { params: { tokenId: "999" }, body: {} };
      const res = createRes();

      await kickAdminCtrl.deactivateBotToken(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ success: false, error: "Token not found" });
    });

    test("success -> 200 with token info and reason", async () => {
      const tokenUpdate = jest.fn().mockResolvedValue();
      KickBotToken.findByPk.mockResolvedValue({
        id: 1,
        kick_username: "bot1",
        update: tokenUpdate,
      });
      const req = { params: { tokenId: "1" }, body: { reason: "test" } };
      const res = createRes();

      await kickAdminCtrl.deactivateBotToken(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Token deactivated successfully",
        token: {
          id: 1,
          kick_username: "bot1",
          reason: "test",
        },
      });
      expect(tokenUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false })
      );
    });

    test("error -> 500 with error.message", async () => {
      KickBotToken.findByPk.mockRejectedValue(new Error("DB error"));
      const req = { params: { tokenId: "1" }, body: {} };
      const res = createRes();

      await kickAdminCtrl.deactivateBotToken(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ success: false, error: "DB error" });
    });
  });

  // ---------- 15. testBotMessage ----------
  describe("testBotMessage", () => {
    test("success with result.ok=true -> 200 with success: true", async () => {
      mockSendMessage.mockResolvedValue({
        ok: true,
        status: 200,
        data: { message: "sent" },
        error: null,
      });
      const req = { body: { message: "hello" } };
      const res = createRes();

      await kickAdminCtrl.testBotMessage(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Message sent successfully",
        details: {
          status: 200,
          data: { message: "sent" },
          error: null,
        },
      });
      expect(KickBotService).toHaveBeenCalled();
      expect(mockSendMessage).toHaveBeenCalledWith("hello");
    });

    test("result.ok=false -> 200 with success: false in body", async () => {
      mockSendMessage.mockResolvedValue({
        ok: false,
        status: 403,
        data: null,
        error: "Forbidden",
      });
      const req = { body: { message: "hello" } };
      const res = createRes();

      await kickAdminCtrl.testBotMessage(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: false,
        message: "Error sending message",
        details: {
          status: 403,
          data: null,
          error: "Forbidden",
        },
      });
    });

    test("sendMessage rejects -> 500 with error.message", async () => {
      mockSendMessage.mockRejectedValue(new Error("Network error"));
      const req = { body: { message: "hello" } };
      const res = createRes();

      await kickAdminCtrl.testBotMessage(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ success: false, error: "Network error" });
    });
  });
});
