jest.mock("../../src/models", () => ({
  KickBotToken: {
    findAll: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("../../src/services/kickBot.service", () => ({
  renewAccessToken: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const botMaintenanceService = require("../../src/services/botMaintenance.service");
const { KickBotToken } = require("../../src/models");

describe("BotMaintenanceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("performMaintenance runs refreshExpiringTokens before cleanupExpiredTokens", async () => {
    const callOrder = [];
    jest
      .spyOn(botMaintenanceService, "refreshExpiringTokens")
      .mockImplementation(async () => {
        callOrder.push("refresh");
      });
    jest
      .spyOn(botMaintenanceService, "cleanupExpiredTokens")
      .mockImplementation(async () => {
        callOrder.push("cleanup");
      });
    jest
      .spyOn(botMaintenanceService, "simulateChatActivity")
      .mockImplementation(async () => {
        callOrder.push("simulate");
      });

    await botMaintenanceService.performMaintenance();

    expect(callOrder).toEqual(["refresh", "cleanup", "simulate"]);

    botMaintenanceService.refreshExpiringTokens.mockRestore();
    botMaintenanceService.cleanupExpiredTokens.mockRestore();
    botMaintenanceService.simulateChatActivity.mockRestore();
  });

  test("cleanupExpiredTokens does not deactivate tokens with an expired access token", async () => {
    KickBotToken.findAll.mockResolvedValue([
      {
        id: 1,
        is_active: true,
        token_expires_at: new Date(Date.now() - 60 * 1000),
      },
    ]);

    await botMaintenanceService.cleanupExpiredTokens();

    expect(KickBotToken.findAll).toHaveBeenCalled();
    expect(KickBotToken.update).not.toHaveBeenCalled();
  });
});
