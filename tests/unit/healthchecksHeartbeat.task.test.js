jest.mock("node-cron", () => ({
  schedule: jest.fn(),
}));

jest.mock("../../config", () => ({
  monitoring: {
    healthchecks: {
      heartbeatUrl: "https://hc-ping.com/heartbeat-check-uuid",
    },
  },
}));

jest.mock("../../src/models/database", () => ({
  sequelize: {
    authenticate: jest.fn(),
  },
}));

jest.mock("../../src/services/healthchecks.service", () => ({
  pingHealthcheck: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const cron = require("node-cron");
const config = require("../../config");
const { sequelize } = require("../../src/models/database");
const { pingHealthcheck } = require("../../src/services/healthchecks.service");
const heartbeatTask = require("../../src/services/healthchecksHeartbeat.task");

const HEARTBEAT_URL = "https://hc-ping.com/heartbeat-check-uuid";

describe("healthchecksHeartbeat.task", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.monitoring.healthchecks.heartbeatUrl = HEARTBEAT_URL;
    sequelize.authenticate.mockResolvedValue(undefined);
    heartbeatTask.stop();
    heartbeatTask.scheduledTask = null;
    heartbeatTask.isRunning = false;
  });

  test("start schedules the heartbeat every 5 minutes", () => {
    const scheduledTask = { stop: jest.fn() };
    cron.schedule.mockReturnValue(scheduledTask);

    heartbeatTask.start();

    expect(cron.schedule).toHaveBeenCalledWith(
      "*/5 * * * *",
      expect.any(Function)
    );
    expect(heartbeatTask.scheduledTask).toBe(scheduledTask);
  });

  test("start is a no-op when the heartbeat URL is unset", () => {
    config.monitoring.healthchecks.heartbeatUrl = undefined;

    heartbeatTask.start();

    expect(cron.schedule).not.toHaveBeenCalled();
    expect(heartbeatTask.scheduledTask).toBeNull();
  });

  test("run pings the heartbeat URL after a successful database check", async () => {
    await heartbeatTask.run();

    expect(sequelize.authenticate).toHaveBeenCalledTimes(1);
    expect(pingHealthcheck).toHaveBeenCalledWith(HEARTBEAT_URL, false);
  });

  test("run pings the failure endpoint when the database check fails", async () => {
    sequelize.authenticate.mockRejectedValue(new Error("database down"));

    await heartbeatTask.run();

    expect(sequelize.authenticate).toHaveBeenCalledTimes(1);
    expect(pingHealthcheck).toHaveBeenCalledWith(HEARTBEAT_URL, true);
  });
});
