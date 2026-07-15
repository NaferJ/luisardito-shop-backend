jest.mock("sequelize", () => ({
  Op: { ne: "ne" },
}));

jest.mock("../../src/models", () => ({
  Usuario: {
    findOne: jest.fn(),
  },
}));

jest.mock("../../src/config/redis.config", () => ({
  getRedisClient: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const {
  syncUsernameIfNeeded,
  syncUserProfileIfNeeded,
} = require("../../src/utils/usernameSync.util");
const { Usuario } = require("../../src/models");
const { getRedisClient } = require("../../src/config/redis.config");
const { Op } = require("sequelize");

function createUsuario({ nickname = "OldUser", avatarUrl = null } = {}) {
  const kickData = { username: nickname };
  if (avatarUrl) {
    kickData.avatar_url = avatarUrl;
  }

  return {
    id: 1,
    nickname,
    kick_data: kickData,
    update: jest.fn().mockResolvedValue(undefined),
  };
}

describe("syncUsernameIfNeeded", () => {
  let redisClient;

  beforeEach(() => {
    jest.clearAllMocks();
    redisClient = { get: jest.fn(), set: jest.fn() };
    getRedisClient.mockReturnValue(redisClient);
  });

  test.each([
    ["missing usuario", null, "NewUser", "123"],
    ["missing kickUsername", createUsuario(), "", "123"],
    ["missing kickUserId", createUsuario(), "NewUser", ""],
  ])(
    "invalid parameters -> { updated: false, reason: 'Invalid parameters' } (%s)",
    async (_label, usuario, kickUsername, kickUserId) => {
      const result = await syncUsernameIfNeeded(
        usuario,
        kickUsername,
        kickUserId
      );

      expect(result).toEqual({ updated: false, reason: "Invalid parameters" });
      expect(Usuario.findOne).not.toHaveBeenCalled();
      expect(redisClient.get).not.toHaveBeenCalled();
      expect(redisClient.set).not.toHaveBeenCalled();
    }
  );

  test("name unchanged -> { updated: false, reason: 'Name unchanged' }", async () => {
    const usuario = createUsuario({ nickname: "SameUser" });

    const result = await syncUsernameIfNeeded(usuario, "SameUser", "123");

    expect(result).toEqual({ updated: false, reason: "Name unchanged" });
    expect(Usuario.findOne).not.toHaveBeenCalled();
    expect(redisClient.get).not.toHaveBeenCalled();
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  test("throttling active -> not updated", async () => {
    const usuario = createUsuario();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    redisClient.get.mockResolvedValue(twoHoursAgo);

    const result = await syncUsernameIfNeeded(usuario, "NewUser", "123");

    expect(result).toEqual({
      updated: false,
      reason: "Throttling: last sync 2.0h ago",
    });
    expect(redisClient.get).toHaveBeenCalledWith("username_sync:123");
    expect(Usuario.findOne).not.toHaveBeenCalled();
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  test("forceSync=true bypasses throttling", async () => {
    const usuario = createUsuario();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    redisClient.get.mockResolvedValue(twoHoursAgo);
    Usuario.findOne.mockResolvedValue(null);

    const result = await syncUsernameIfNeeded(usuario, "NewUser", "123", true);

    expect(result).toEqual({
      updated: true,
      reason: "Sync successful",
      oldNickname: "OldUser",
      newNickname: "NewUser",
    });
    expect(redisClient.get).not.toHaveBeenCalled();
    expect(redisClient.set).not.toHaveBeenCalled();
    expect(Usuario.findOne).toHaveBeenCalledWith({
      where: { nickname: "NewUser", id: { [Op.ne]: 1 } },
    });
    expect(usuario.update).toHaveBeenCalledWith({
      nickname: "NewUser",
      kick_data: {
        username: "NewUser",
        last_sync: expect.any(String),
      },
    });
  });

  test("Redis get throws -> continues without throttling", async () => {
    const usuario = createUsuario();
    redisClient.get.mockRejectedValue(new Error("Redis down"));
    Usuario.findOne.mockResolvedValue(null);

    const result = await syncUsernameIfNeeded(usuario, "NewUser", "123");

    expect(result).toEqual({
      updated: true,
      reason: "Sync successful",
      oldNickname: "OldUser",
      newNickname: "NewUser",
    });
    expect(redisClient.get).toHaveBeenCalledWith("username_sync:123");
    expect(Usuario.findOne).toHaveBeenCalledWith({
      where: { nickname: "NewUser", id: { [Op.ne]: 1 } },
    });
    expect(redisClient.set).toHaveBeenCalledWith(
      "username_sync:123",
      expect.any(String),
      "EX",
      86400
    );
  });

  test("collision -> not updated", async () => {
    const usuario = createUsuario();
    redisClient.get.mockResolvedValue(null);
    Usuario.findOne.mockResolvedValue({ id: 999, nickname: "NewUser" });

    const result = await syncUsernameIfNeeded(usuario, "NewUser", "123");

    expect(result).toEqual({
      updated: false,
      reason: "Collision: name already used by user ID 999",
    });
    expect(Usuario.findOne).toHaveBeenCalledWith({
      where: { nickname: "NewUser", id: { [Op.ne]: 1 } },
    });
    expect(usuario.update).not.toHaveBeenCalled();
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  test("happy path -> update, Redis set, correct return", async () => {
    const usuario = createUsuario();
    redisClient.get.mockResolvedValue(null);
    Usuario.findOne.mockResolvedValue(null);

    const result = await syncUsernameIfNeeded(usuario, "NewUser", "123");

    expect(result).toEqual({
      updated: true,
      reason: "Sync successful",
      oldNickname: "OldUser",
      newNickname: "NewUser",
    });
    expect(usuario.update).toHaveBeenCalledWith({
      nickname: "NewUser",
      kick_data: {
        username: "NewUser",
        last_sync: expect.any(String),
      },
    });
    expect(redisClient.set).toHaveBeenCalledWith(
      "username_sync:123",
      expect.any(String),
      "EX",
      86400
    );
  });

  test("usuario.update throws -> { updated: false, reason: 'DB error: ...' }", async () => {
    const usuario = createUsuario();
    usuario.update = jest.fn().mockRejectedValue(new Error("db fail"));
    redisClient.get.mockResolvedValue(null);
    Usuario.findOne.mockResolvedValue(null);

    const result = await syncUsernameIfNeeded(usuario, "NewUser", "123");

    expect(result).toEqual({ updated: false, reason: "DB error: db fail" });
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  test("outer catch -> { updated: false, reason: 'Error: ...' }", async () => {
    const usuario = createUsuario();
    redisClient.get.mockResolvedValue(null);
    Usuario.findOne.mockRejectedValue(new Error("findOne boom"));

    const result = await syncUsernameIfNeeded(usuario, "NewUser", "123");

    expect(result).toEqual({ updated: false, reason: "Error: findOne boom" });
    expect(usuario.update).not.toHaveBeenCalled();
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  test("Redis set throws -> still returns success", async () => {
    const usuario = createUsuario();
    redisClient.get.mockResolvedValue(null);
    redisClient.set.mockRejectedValue(new Error("Redis set down"));
    Usuario.findOne.mockResolvedValue(null);

    const result = await syncUsernameIfNeeded(usuario, "NewUser", "123");

    expect(result).toEqual({
      updated: true,
      reason: "Sync successful",
      oldNickname: "OldUser",
      newNickname: "NewUser",
    });
    expect(redisClient.set).toHaveBeenCalledWith(
      "username_sync:123",
      expect.any(String),
      "EX",
      86400
    );
  });
});

describe("syncUserProfileIfNeeded", () => {
  let redisClient;

  beforeEach(() => {
    jest.clearAllMocks();
    redisClient = { get: jest.fn(), set: jest.fn() };
    getRedisClient.mockReturnValue(redisClient);
  });

  test.each([
    ["missing usuario", null, "NewUser", "123", null],
    ["missing kickUsername", createUsuario(), "", "123", "http://x.png"],
    ["missing kickUserId", createUsuario(), "NewUser", "", "http://x.png"],
  ])(
    "invalid parameters -> { updated: false, reason: 'Invalid parameters', ... } (%s)",
    async (_label, usuario, kickUsername, kickUserId, kickProfilePicture) => {
      const result = await syncUserProfileIfNeeded(
        usuario,
        kickUsername,
        kickUserId,
        false,
        kickProfilePicture
      );

      expect(result).toEqual({
        updated: false,
        reason: "Invalid parameters",
      });
      expect(Usuario.findOne).not.toHaveBeenCalled();
      expect(redisClient.get).not.toHaveBeenCalled();
      expect(redisClient.set).not.toHaveBeenCalled();
    }
  );

  test("profile unchanged -> { updated: false, reason: 'Profile unchanged' }", async () => {
    const usuario = createUsuario({
      nickname: "SameUser",
      avatarUrl: "http://old.png",
    });

    const result = await syncUserProfileIfNeeded(
      usuario,
      "SameUser",
      "123",
      false,
      "http://old.png"
    );

    expect(result).toEqual({
      updated: false,
      reason: "Profile unchanged",
      usernameChanged: false,
      avatarChanged: false,
    });
    expect(Usuario.findOne).not.toHaveBeenCalled();
    expect(redisClient.get).not.toHaveBeenCalled();
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  test("throttling active -> not updated", async () => {
    const usuario = createUsuario({ avatarUrl: "http://old.png" });
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    redisClient.get.mockResolvedValue(twoHoursAgo);

    const result = await syncUserProfileIfNeeded(
      usuario,
      "OldUser",
      "123",
      false,
      "http://new.png"
    );

    expect(result).toEqual({
      updated: false,
      reason: "Throttling: last sync 2.0h ago",
      usernameChanged: false,
      avatarChanged: false,
    });
    expect(redisClient.get).toHaveBeenCalledWith("profile_sync:123");
    expect(Usuario.findOne).not.toHaveBeenCalled();
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  test("forceSync=true bypasses throttling", async () => {
    const usuario = createUsuario({ avatarUrl: "http://old.png" });
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    redisClient.get.mockResolvedValue(twoHoursAgo);
    Usuario.findOne.mockResolvedValue(null);

    const result = await syncUserProfileIfNeeded(
      usuario,
      "NewUser",
      "123",
      true,
      "http://new.png"
    );

    expect(result).toEqual({
      updated: true,
      reason: "Sync successful",
      usernameChanged: true,
      avatarChanged: true,
      oldNickname: "OldUser",
      newNickname: "NewUser",
      oldAvatarUrl: "http://old.png",
      newAvatarUrl: "http://new.png",
    });
    expect(redisClient.get).not.toHaveBeenCalled();
    expect(redisClient.set).not.toHaveBeenCalled();
    expect(Usuario.findOne).toHaveBeenCalledWith({
      where: { nickname: "NewUser", id: { [Op.ne]: 1 } },
    });
    expect(usuario.update).toHaveBeenCalledWith({
      nickname: "NewUser",
      kick_data: {
        username: "NewUser",
        avatar_url: "http://new.png",
        last_sync: expect.any(String),
      },
    });
  });

  test("Redis get throws -> continues without throttling", async () => {
    const usuario = createUsuario({ avatarUrl: "http://old.png" });
    redisClient.get.mockRejectedValue(new Error("Redis down"));

    const result = await syncUserProfileIfNeeded(
      usuario,
      "OldUser",
      "123",
      false,
      "http://new.png"
    );

    expect(result).toEqual({
      updated: true,
      reason: "Sync successful",
      usernameChanged: false,
      avatarChanged: true,
      oldNickname: null,
      newNickname: null,
      oldAvatarUrl: "http://old.png",
      newAvatarUrl: "http://new.png",
    });
    expect(redisClient.get).toHaveBeenCalledWith("profile_sync:123");
    expect(Usuario.findOne).not.toHaveBeenCalled();
    expect(usuario.update).toHaveBeenCalledWith({
      kick_data: {
        username: "OldUser",
        avatar_url: "http://new.png",
        last_sync: expect.any(String),
      },
    });
    expect(redisClient.set).toHaveBeenCalledWith(
      "profile_sync:123",
      expect.any(String),
      "EX",
      86400
    );
  });

  test("collision when username changed -> not updated", async () => {
    const usuario = createUsuario({ avatarUrl: "http://old.png" });
    redisClient.get.mockResolvedValue(null);
    Usuario.findOne.mockResolvedValue({ id: 999, nickname: "NewUser" });

    const result = await syncUserProfileIfNeeded(
      usuario,
      "NewUser",
      "123",
      false,
      "http://new.png"
    );

    expect(result).toEqual({
      updated: false,
      reason: "Collision: name already used by user ID 999",
      usernameChanged: false,
      avatarChanged: false,
    });
    expect(Usuario.findOne).toHaveBeenCalledWith({
      where: { nickname: "NewUser", id: { [Op.ne]: 1 } },
    });
    expect(usuario.update).not.toHaveBeenCalled();
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  test("avatar-only change -> update and correct return", async () => {
    const usuario = createUsuario({ avatarUrl: "http://old.png" });
    redisClient.get.mockResolvedValue(null);

    const result = await syncUserProfileIfNeeded(
      usuario,
      "OldUser",
      "123",
      false,
      "http://new.png"
    );

    expect(result).toEqual({
      updated: true,
      reason: "Sync successful",
      usernameChanged: false,
      avatarChanged: true,
      oldNickname: null,
      newNickname: null,
      oldAvatarUrl: "http://old.png",
      newAvatarUrl: "http://new.png",
    });
    expect(Usuario.findOne).not.toHaveBeenCalled();
    expect(usuario.update).toHaveBeenCalledWith({
      kick_data: {
        username: "OldUser",
        avatar_url: "http://new.png",
        last_sync: expect.any(String),
      },
    });
    expect(redisClient.set).toHaveBeenCalledWith(
      "profile_sync:123",
      expect.any(String),
      "EX",
      86400
    );
  });

  test("username+avatar change -> update and correct return", async () => {
    const usuario = createUsuario({ avatarUrl: "http://old.png" });
    redisClient.get.mockResolvedValue(null);
    Usuario.findOne.mockResolvedValue(null);

    const result = await syncUserProfileIfNeeded(
      usuario,
      "NewUser",
      "123",
      false,
      "http://new.png"
    );

    expect(result).toEqual({
      updated: true,
      reason: "Sync successful",
      usernameChanged: true,
      avatarChanged: true,
      oldNickname: "OldUser",
      newNickname: "NewUser",
      oldAvatarUrl: "http://old.png",
      newAvatarUrl: "http://new.png",
    });
    expect(Usuario.findOne).toHaveBeenCalledWith({
      where: { nickname: "NewUser", id: { [Op.ne]: 1 } },
    });
    expect(usuario.update).toHaveBeenCalledWith({
      nickname: "NewUser",
      kick_data: {
        username: "NewUser",
        avatar_url: "http://new.png",
        last_sync: expect.any(String),
      },
    });
    expect(redisClient.set).toHaveBeenCalledWith(
      "profile_sync:123",
      expect.any(String),
      "EX",
      86400
    );
  });

  test("usuario.update throws -> { updated: false, reason: 'DB error: ...' }", async () => {
    const usuario = createUsuario({ avatarUrl: "http://old.png" });
    usuario.update = jest.fn().mockRejectedValue(new Error("db fail"));
    redisClient.get.mockResolvedValue(null);

    const result = await syncUserProfileIfNeeded(
      usuario,
      "OldUser",
      "123",
      false,
      "http://new.png"
    );

    expect(result).toEqual({
      updated: false,
      reason: "DB error: db fail",
      usernameChanged: false,
      avatarChanged: false,
    });
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  test("outer catch -> { updated: false, reason: 'Error: ...' }", async () => {
    const usuario = createUsuario({ avatarUrl: "http://old.png" });
    redisClient.get.mockResolvedValue(null);
    Usuario.findOne.mockRejectedValue(new Error("findOne boom"));

    const result = await syncUserProfileIfNeeded(
      usuario,
      "NewUser",
      "123",
      false,
      "http://new.png"
    );

    expect(result).toEqual({
      updated: false,
      reason: "Error: findOne boom",
      usernameChanged: false,
      avatarChanged: false,
    });
    expect(usuario.update).not.toHaveBeenCalled();
    expect(redisClient.set).not.toHaveBeenCalled();
  });
});
