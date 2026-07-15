jest.mock("../../src/models", () => ({
  Usuario: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  KickBroadcasterToken: {
    findOrCreate: jest.fn(),
  },
  DiscordUserLink: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  sequelize: {
    where: jest.fn(),
    fn: jest.fn(),
    col: jest.fn(),
  },
  Op: { or: Symbol("or"), ne: Symbol("ne") },
}));

jest.mock("../../src/services/tokenService", () => ({
  generateAccessToken: jest.fn(),
  createRefreshToken: jest.fn(),
  validateRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
  revokeAllUserTokens: jest.fn(),
  rotateRefreshToken: jest.fn(),
}));

jest.mock("../../src/utils/cookies.util", () => ({
  setAuthCookies: jest.fn(),
  clearAuthCookies: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock("../../src/utils/kickApi", () => ({
  extractAvatarUrl: jest.fn(),
  getKickUserData: jest.fn(),
}));

jest.mock("../../src/services/kickAutoSubscribe.service", () => ({
  autoSubscribeToEvents: jest.fn(),
}));

jest.mock("../../src/services/kickBotToken.service", () => ({
  saveBotToken: jest.fn(),
}));

jest.mock("../../src/utils/pkce.util", () => ({
  generatePkce: jest.fn(),
}));

jest.mock("../../config", () => ({
  db: {},
  jwtSecret: "test-jwt-secret",
  kick: {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "http://localhost:3000/api/auth/kick-callback",
    broadcasterId: "broadcaster-123",
    apiBaseUrl: "https://api.kick.com",
    oauthAuthorize: "https://id.kick.com/oauth/authorize",
    oauthToken: "https://id.kick.com/oauth/token",
    oauthRevoke: "https://id.kick.com/oauth/revoke",
  },
  kickBot: {
    clientId: "test-bot-client-id",
    clientSecret: "test-bot-client-secret",
    redirectUri: "http://localhost:3000/api/auth/kick-bot/callback",
    accessToken: "test-bot-token",
    username: "testbot",
  },
  cloudinary: {},
  cookies: { domain: undefined, secure: false, sameSite: "lax" },
  frontendUrl: "http://localhost:5173",
  port: 3000,
  discord: {
    botToken: "test-bot-token",
    clientId: "test-discord-client-id",
    clientSecret: "test-discord-client-secret",
    guildId: "test-guild-id",
    oauthAuthorize: "https://discord.com/api/oauth2/authorize",
    oauthToken: "https://discord.com/api/oauth2/token",
    oauthRevoke: "https://discord.com/api/oauth2/token/revoke",
    apiBaseUrl: "https://discord.com/api",
    redirectUri: "http://localhost:3000/api/auth/discord/callback",
  },
}));

const {
  Usuario,
  DiscordUserLink,
  KickBroadcasterToken,
} = require("../../src/models");
const tokenService = require("../../src/services/tokenService");
const {
  setAuthCookies,
  clearAuthCookies,
} = require("../../src/utils/cookies.util");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const authCtrl = require("../../src/controllers/auth.controller");
const {
  autoSubscribeToEvents,
} = require("../../src/services/kickAutoSubscribe.service");
const { extractAvatarUrl } = require("../../src/utils/kickApi");
const config = require("../../config");
const AppError = require("../../src/utils/AppError");

function createRes() {
  return {
    statusCode: 200,
    body: null,
    redirectUrl: null,
    status: jest.fn(function (c) {
      this.statusCode = c;
      return this;
    }),
    json: jest.fn(function (b) {
      this.body = b;
      return this;
    }),
    redirect: jest.fn(function (url) {
      this.redirectUrl = url;
      return this;
    }),
  };
}

describe("auth.controller migration characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------- registerLocal ----------
  describe("registerLocal", () => {
    test("missing fields -> next(AppError) 400 All fields are required", async () => {
      const req = { body: { nickname: "x", email: "x@x.com" } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.registerLocal(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("All fields are required");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("non-developer email -> next(AppError) 403", async () => {
      const req = {
        body: { nickname: "x", email: "random@gmail.com", password: "123" },
      };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.registerLocal(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(403);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("duplicate user -> next(AppError) 409", async () => {
      Usuario.findOne.mockResolvedValue({ id: 1 });
      const req = {
        body: {
          nickname: "naferjml",
          email: "naferjml@gmail.com",
          password: "123",
        },
      };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.registerLocal(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(409);
      expect(err.message).toBe("Nickname or email already registered");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("success -> 201 { message, userId }", async () => {
      Usuario.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashedpw");
      Usuario.create.mockResolvedValue({ id: 42 });
      const req = {
        body: {
          nickname: "naferjml",
          email: "naferjml@gmail.com",
          password: "123",
        },
      };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.registerLocal(req, res, next);

      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({ message: "User created", userId: 42 });
      expect(next).not.toHaveBeenCalled();
    });

    test("generic DB error -> next(AppError) 400 with err.message", async () => {
      Usuario.findOne.mockRejectedValue(new Error("DB connection lost"));
      const req = {
        body: {
          nickname: "naferjml",
          email: "naferjml@gmail.com",
          password: "123",
        },
      };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.registerLocal(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("DB connection lost");
    });
  });

  // ---------- loginLocal ----------
  describe("loginLocal", () => {
    test("user not found -> next(AppError) 401 Invalid credentials", async () => {
      Usuario.findOne.mockResolvedValue(null);
      const req = { body: { nickname: "ghost", password: "123" } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.loginLocal(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe("Invalid credentials");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("wrong password -> next(AppError) 401 Invalid credentials", async () => {
      Usuario.findOne.mockResolvedValue({
        id: 1,
        nickname: "testuser",
        password_hash: "hashedpw",
        rol_id: 1,
        puntos: 500,
      });
      bcrypt.compare.mockResolvedValue(false);
      const req = { body: { nickname: "testuser", password: "wrong" } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.loginLocal(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe("Invalid credentials");
    });

    test("success -> 200 with tokens, user object, expiresIn", async () => {
      Usuario.findOne.mockResolvedValue({
        id: 1,
        nickname: "testuser",
        password_hash: "hashedpw",
        rol_id: 2,
        puntos: 1000,
      });
      bcrypt.compare.mockResolvedValue(true);
      tokenService.generateAccessToken.mockReturnValue("access-token-123");
      tokenService.createRefreshToken.mockResolvedValue({
        token: "refresh-abc",
      });
      DiscordUserLink.findOne.mockResolvedValue(null);
      const req = {
        body: { nickname: "testuser", password: "correct" },
        ip: "127.0.0.1",
        headers: { "user-agent": "jest" },
      };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.loginLocal(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        accessToken: "access-token-123",
        refreshToken: "refresh-abc",
        expiresIn: 3600,
        user: {
          id: 1,
          nickname: "testuser",
          display_name: "testuser",
          puntos: 1000,
          rol_id: 2,
          discord_info: null,
        },
      });
      expect(setAuthCookies).toHaveBeenCalledWith(
        res,
        "access-token-123",
        "refresh-abc"
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("generic error -> next(err) forwarded to errorHandler as 500", async () => {
      Usuario.findOne.mockRejectedValue(new Error("DB down"));
      const req = { body: { nickname: "testuser", password: "123" } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.loginLocal(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(Error);
      expect(err.statusCode).toBeUndefined();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ---------- refreshToken ----------
  describe("refreshToken", () => {
    test("missing refreshToken -> next(AppError) 400", async () => {
      const req = { body: {} };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.refreshToken(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("refreshToken required");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("invalid/expired token -> next(AppError) 401", async () => {
      tokenService.validateRefreshToken.mockResolvedValue(null);
      const req = { body: { refreshToken: "bad-token" } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.refreshToken(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe("Invalid or expired refresh token");
    });

    test("user not found -> next(AppError) 404", async () => {
      tokenService.validateRefreshToken.mockResolvedValue({
        usuario_id: 99,
      });
      Usuario.findByPk.mockResolvedValue(null);
      const req = { body: { refreshToken: "valid-token" } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.refreshToken(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("User not found");
    });

    test("success -> 200 with new tokens and user object", async () => {
      tokenService.validateRefreshToken.mockResolvedValue({
        usuario_id: 1,
      });
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "testuser",
        rol_id: 2,
        puntos: 1000,
        user_id_ext: "kick-123",
      });
      tokenService.rotateRefreshToken.mockResolvedValue({
        token: "new-refresh",
      });
      tokenService.generateAccessToken.mockReturnValue("new-access");
      DiscordUserLink.findOne.mockResolvedValue(null);
      const req = {
        body: { refreshToken: "valid-token" },
        ip: "127.0.0.1",
        headers: { "user-agent": "jest" },
      };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.refreshToken(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        accessToken: "new-access",
        refreshToken: "new-refresh",
        expiresIn: 3600,
        user: {
          id: 1,
          nickname: "testuser",
          display_name: "testuser",
          puntos: 1000,
          rol_id: 2,
          discord_info: null,
        },
      });
      expect(setAuthCookies).toHaveBeenCalledWith(
        res,
        "new-access",
        "new-refresh"
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("generic error -> next(err) forwarded to errorHandler as 500", async () => {
      tokenService.validateRefreshToken.mockRejectedValue(new Error("DB down"));
      const req = { body: { refreshToken: "some-token" } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.refreshToken(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(Error);
      expect(err.statusCode).toBeUndefined();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ---------- logout ----------
  describe("logout", () => {
    test("missing refreshToken -> next(AppError) 400", async () => {
      const req = { body: {} };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.logout(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("refreshToken required");
    });

    test("token not found -> next(AppError) 404", async () => {
      tokenService.revokeRefreshToken.mockResolvedValue(null);
      const req = { body: { refreshToken: "unknown" } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.logout(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Refresh token not found");
    });

    test("success -> 200 { message }", async () => {
      tokenService.revokeRefreshToken.mockResolvedValue(true);
      const req = { body: { refreshToken: "valid" } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.logout(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: "Session closed successfully" });
      expect(clearAuthCookies).toHaveBeenCalledWith(res);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- logoutAll ----------
  describe("logoutAll", () => {
    test("missing userId -> next(AppError) 400", async () => {
      const req = { body: {} };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.logoutAll(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("userId required");
    });

    test("success -> 200 { message, revokedCount }", async () => {
      tokenService.revokeAllUserTokens.mockResolvedValue(3);
      const req = { body: { userId: 1 } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.logoutAll(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: "3 session(s) closed successfully",
        revokedCount: 3,
      });
      expect(clearAuthCookies).toHaveBeenCalledWith(res);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- storeTokens ----------
  describe("storeTokens", () => {
    test("missing accessToken -> next(AppError) 400", async () => {
      const req = { body: {} };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.storeTokens(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("accessToken required");
    });

    test("axios error.response -> next(AppError) 400 with details", async () => {
      axios.get.mockRejectedValue({
        response: { status: 401, data: { error: "invalid token" } },
      });
      const req = { body: { accessToken: "bad-token" } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.storeTokens(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Error fetching Kick profile");
      expect(err.details).toEqual({ error: "invalid token" });
    });

    test("axios network error (no response) -> next(AppError) 500", async () => {
      axios.get.mockRejectedValue(new Error("network timeout"));
      const req = { body: { accessToken: "some-token" } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.storeTokens(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("Internal server error");
    });

    test("success -> 200 with token, usuario, isNewUser, kickProfile", async () => {
      axios.get.mockResolvedValue({
        data: {
          data: [
            {
              user_id: "kick-1",
              name: "kickuser",
              email: "kick@kick.user",
              profile_picture: "pic.jpg",
            },
          ],
        },
      });
      Usuario.findOne.mockResolvedValue(null);
      Usuario.create.mockResolvedValue({
        id: 5,
        nickname: "kickuser",
        rol_id: 1,
        puntos: 1000,
        user_id_ext: "kick-1",
        kick_data: { avatar_url: "pic.jpg", username: "kickuser" },
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
        update: jest.fn().mockResolvedValue(undefined),
      });
      jwt.sign.mockReturnValue("jwt-token-xyz");
      DiscordUserLink.findOne.mockResolvedValue(null);
      const req = { body: { accessToken: "valid-kick-token" } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.storeTokens(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.token).toBe("jwt-token-xyz");
      expect(res.body.usuario.id).toBe(5);
      expect(res.body.usuario.nickname).toBe("kickuser");
      expect(res.body.isNewUser).toBe(true);
      expect(res.body.kickProfile.username).toBe("kickuser");
      expect(setAuthCookies).toHaveBeenCalledWith(
        res,
        "jwt-token-xyz",
        "no-refresh-token-provided"
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- cookieStatus ----------
  describe("cookieStatus", () => {
    test("success -> 200 with cookie info", async () => {
      const req = {
        headers: {
          cookie: "auth_token=abc",
          "user-agent": "jest",
          origin: "http://localhost",
        },
        cookies: { auth_token: "abc", refresh_token: "def" },
      };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.cookieStatus(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.hasCookies).toBe(true);
      expect(res.body.authToken).toBe("present");
      expect(res.body.refreshToken).toBe("present");
      expect(res.body.allCookies).toEqual({
        auth_token: "abc",
        refresh_token: "def",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- linkDiscordManual ----------
  describe("linkDiscordManual", () => {
    test("no userId -> next(AppError) 401", async () => {
      const req = { body: { code: "some-code" } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.linkDiscordManual(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe("User not authenticated");
    });

    test("no code -> next(AppError) 400", async () => {
      const req = { user: { id: 1 }, body: {} };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.linkDiscordManual(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Code required");
    });

    test("with userId and code -> next(AppError) 501 not implemented", async () => {
      const req = { user: { id: 1 }, body: { code: "some-code" } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.linkDiscordManual(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(501);
      expect(err.message).toBe("Method not implemented");
    });
  });

  // ---------- unlinkDiscord ----------
  describe("unlinkDiscord", () => {
    test("no userId -> next(AppError) 401", async () => {
      const req = { user: {} };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.unlinkDiscord(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe("User not authenticated");
    });

    test("no discord link -> next(AppError) 404", async () => {
      DiscordUserLink.findOne.mockResolvedValue(null);
      const req = { user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.unlinkDiscord(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("No linked Discord account");
    });

    test("success -> 200 { message, user }", async () => {
      const discordLink = {
        tienda_user_id: 1,
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      DiscordUserLink.findOne
        .mockResolvedValueOnce(discordLink)
        .mockResolvedValue(null);
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "testuser",
        puntos: 500,
        rol_id: 2,
        discord_username: "old#1234",
        update: jest.fn().mockResolvedValue(undefined),
      });
      const req = { user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await authCtrl.unlinkDiscord(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Discord account unlinked successfully");
      expect(res.body.user.id).toBe(1);
      expect(res.body.user.discord_info).toBeNull();
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- callbackKick ----------
  describe("callbackKick", () => {
    const defaultKickUser = {
      user_id: "123",
      name: "testuser",
      email: "test@kick.com",
      profile_picture: "pic.jpg",
    };
    const defaultTokenData = {
      access_token: "kick-access-token",
      refresh_token: "kick-refresh-token",
      expires_in: 3600,
    };
    const defaultDecodedState = {
      cv: "test-code-verifier",
      ruri: "http://localhost:3000/api/auth/kick-callback",
    };

    function setupBaseMocks() {
      jwt.verify.mockReturnValue(defaultDecodedState);
      axios.post.mockResolvedValue({ data: defaultTokenData });
      axios.get.mockResolvedValue({
        data: { data: [defaultKickUser] },
      });
      extractAvatarUrl.mockReturnValue(null);
      DiscordUserLink.findOne.mockResolvedValue(null);
      tokenService.generateAccessToken.mockReturnValue("jwt-access");
      tokenService.createRefreshToken.mockResolvedValue({
        token: "jwt-refresh",
      });
    }

    function createCallbackReq(query = {}) {
      return {
        query: { code: "test-code", state: "test-state", ...query },
        ip: "127.0.0.1",
        headers: { "user-agent": "jest" },
        connection: { remoteAddress: "127.0.0.1" },
      };
    }

    beforeEach(() => {
      jest.clearAllMocks();
      config.kick.clientId = "test-client-id";
      config.kick.clientSecret = "test-client-secret";
      config.kick.broadcasterId = "broadcaster-123";
      setupBaseMocks();
    });

    test("missing code/state -> 400 'Missing code/state parameters'", async () => {
      const req = createCallbackReq({ code: undefined, state: undefined });
      const res = createRes();

      await authCtrl.callbackKick(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: "Missing code/state parameters" });
    });

    test("invalid/expired state (jwt.verify throws) -> 400 'Invalid or expired state'", async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error("jwt expired");
      });
      const req = createCallbackReq();
      const res = createRes();

      await authCtrl.callbackKick(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: "Invalid or expired state" });
    });

    test("missing code_verifier -> 400 'Invalid PKCE or redirect_uri'", async () => {
      jwt.verify.mockReturnValue({
        ruri: "http://localhost:3000/api/auth/kick-callback",
      });
      const req = createCallbackReq();
      const res = createRes();

      await authCtrl.callbackKick(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: "Invalid PKCE or redirect_uri" });
    });

    test("missing clientId/clientSecret -> 500 'Incomplete provider configuration'", async () => {
      config.kick.clientId = undefined;
      config.kick.clientSecret = undefined;
      const req = createCallbackReq();
      const res = createRes();

      await authCtrl.callbackKick(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "Incomplete provider configuration" });
    });

    test("new-user path -> Usuario.create called, redirect", async () => {
      Usuario.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      const mockUser = {
        id: 1,
        nickname: "testuser",
        rol_id: 1,
        puntos: 1000,
        user_id_ext: "123",
        kick_data: { avatar_url: null, username: "testuser" },
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
        update: jest.fn().mockResolvedValue(undefined),
      };
      Usuario.create.mockResolvedValue(mockUser);
      KickBroadcasterToken.findOrCreate.mockResolvedValue([
        { update: jest.fn().mockResolvedValue(undefined) },
        true,
      ]);

      const req = createCallbackReq();
      const res = createRes();

      await authCtrl.callbackKick(req, res);

      expect(Usuario.create).toHaveBeenCalledTimes(1);
      expect(res.redirect).toHaveBeenCalledTimes(1);
      expect(res.redirectUrl).toContain(
        "http://localhost:5173/auth/callback?data="
      );
    });

    test("collision-link path -> colision.update called", async () => {
      const mockCollision = {
        id: 10,
        nickname: "oldname",
        email: "old@email.com",
        rol_id: 2,
        puntos: 500,
        user_id_ext: null,
        kick_data: null,
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
        update: jest.fn().mockResolvedValue(undefined),
      };
      Usuario.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockCollision);
      KickBroadcasterToken.findOrCreate.mockResolvedValue([
        { update: jest.fn().mockResolvedValue(undefined) },
        true,
      ]);

      const req = createCallbackReq();
      const res = createRes();

      await authCtrl.callbackKick(req, res);

      expect(mockCollision.update).toHaveBeenCalledTimes(1);
      expect(mockCollision.update).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id_ext: "123",
          nickname: "testuser",
        })
      );
      expect(res.redirect).toHaveBeenCalledTimes(1);
    });

    test("already-linked with different-user collision -> 409", async () => {
      const mockExisting = {
        id: 5,
        nickname: "testuser",
        email: "test@kick.com",
        rol_id: 1,
        puntos: 1000,
        user_id_ext: "123",
        kick_data: { avatar_url: "old.jpg", username: "testuser" },
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
        update: jest.fn().mockResolvedValue(undefined),
      };
      const mockCollision = {
        id: 99,
        nickname: "testuser",
        email: "test@kick.com",
      };
      Usuario.findOne
        .mockResolvedValueOnce(mockExisting)
        .mockResolvedValueOnce(mockCollision);

      const req = createCallbackReq();
      const res = createRes();

      await authCtrl.callbackKick(req, res);

      expect(res.statusCode).toBe(409);
      expect(res.body).toEqual({
        error: "Email or nickname already in use by another user.",
      });
    });

    test("already-linked happy path -> usuario.update called", async () => {
      const mockExisting = {
        id: 5,
        nickname: "testuser",
        email: "test@kick.com",
        rol_id: 1,
        puntos: 1000,
        user_id_ext: "123",
        kick_data: { avatar_url: "old.jpg", username: "testuser" },
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
        update: jest.fn().mockResolvedValue(undefined),
      };
      Usuario.findOne
        .mockResolvedValueOnce(mockExisting)
        .mockResolvedValueOnce(null);
      KickBroadcasterToken.findOrCreate.mockResolvedValue([
        { update: jest.fn().mockResolvedValue(undefined) },
        true,
      ]);

      const req = createCallbackReq();
      const res = createRes();

      await authCtrl.callbackKick(req, res);

      expect(mockExisting.update).toHaveBeenCalledTimes(1);
      expect(mockExisting.update).toHaveBeenCalledWith(
        expect.objectContaining({
          nickname: "testuser",
          email: "test@kick.com",
        })
      );
      expect(res.redirect).toHaveBeenCalledTimes(1);
    });

    test("main-broadcaster branch -> autoSubscribeToEvents called, token auto_subscribed updated", async () => {
      const broadcasterUser = {
        ...defaultKickUser,
        user_id: "broadcaster-123",
        name: "broadcasteruser",
      };
      axios.get.mockResolvedValue({
        data: { data: [broadcasterUser] },
      });
      Usuario.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      const mockUser = {
        id: 1,
        nickname: "broadcasteruser",
        rol_id: 1,
        puntos: 1000,
        user_id_ext: "broadcaster-123",
        kick_data: { avatar_url: null, username: "broadcasteruser" },
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
        update: jest.fn().mockResolvedValue(undefined),
      };
      Usuario.create.mockResolvedValue(mockUser);
      const mockTokenUpdate = jest.fn().mockResolvedValue(undefined);
      KickBroadcasterToken.findOrCreate.mockResolvedValue([
        { update: mockTokenUpdate },
        true,
      ]);
      autoSubscribeToEvents.mockResolvedValue({
        success: true,
        totalSubscribed: 5,
        totalErrors: 0,
        error: null,
      });

      const req = createCallbackReq();
      const res = createRes();

      await authCtrl.callbackKick(req, res);

      expect(autoSubscribeToEvents).toHaveBeenCalledTimes(1);
      expect(autoSubscribeToEvents).toHaveBeenCalledWith(
        "kick-access-token",
        "broadcaster-123",
        "broadcaster-123"
      );
      expect(mockTokenUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ auto_subscribed: true })
      );
      expect(res.redirect).toHaveBeenCalledTimes(1);
    });
  });
});
