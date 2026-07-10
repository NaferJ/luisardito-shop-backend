jest.mock("sequelize", () => ({
  Op: {
    like: Symbol("like"),
    or: Symbol("or"),
    ne: Symbol("ne"),
  },
}));

jest.mock("../../src/models", () => ({
  KickBotCommand: {
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { KickBotCommand } = require("../../src/models");
const AppError = require("../../src/utils/AppError");
const controller = require("../../src/controllers/kickBotCommands.controller");

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

describe("kickBotCommands.controller migration characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------- getAllCommands ----------
  describe("getAllCommands", () => {
    test("success -> 200 { ok:true, data, pagination }", async () => {
      const rows = [{ id: 1, command: "test" }];
      KickBotCommand.findAndCountAll.mockResolvedValue({ count: 1, rows });

      const req = { query: { page: "1", limit: "20" } };
      const res = createRes();
      const next = jest.fn();

      await controller.getAllCommands(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        ok: true,
        data: rows,
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 'Error fetching commands'", async () => {
      KickBotCommand.findAndCountAll.mockRejectedValue(new Error("DB down"));

      const req = { query: {} };
      const res = createRes();
      const next = jest.fn();

      await controller.getAllCommands(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Error fetching commands");
    });
  });

  // ---------- getPublicCommands ----------
  describe("getPublicCommands", () => {
    test("success -> 200 { ok:true, data, pagination }", async () => {
      const rows = [{ id: 1, command: "test" }];
      KickBotCommand.findAndCountAll.mockResolvedValue({ count: 1, rows });

      const req = { query: { page: "1", limit: "20" } };
      const res = createRes();
      const next = jest.fn();

      await controller.getPublicCommands(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        ok: true,
        data: rows,
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 'Error fetching commands'", async () => {
      KickBotCommand.findAndCountAll.mockRejectedValue(new Error("DB down"));

      const req = { query: {} };
      const res = createRes();
      const next = jest.fn();

      await controller.getPublicCommands(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Error fetching commands");
    });
  });

  // ---------- getCommandById ----------
  describe("getCommandById", () => {
    test("success -> 200 { ok:true, data }", async () => {
      const command = { id: 1, command: "test" };
      KickBotCommand.findByPk.mockResolvedValue(command);

      const req = { params: { id: "1" } };
      const res = createRes();
      const next = jest.fn();

      await controller.getCommandById(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ ok: true, data: command });
      expect(next).not.toHaveBeenCalled();
    });

    test("not found -> next(AppError) 404 'Command not found'", async () => {
      KickBotCommand.findByPk.mockResolvedValue(null);

      const req = { params: { id: "999" } };
      const res = createRes();
      const next = jest.fn();

      await controller.getCommandById(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "Command not found");
    });

    test("error -> next(AppError) 500 'Error fetching command'", async () => {
      KickBotCommand.findByPk.mockRejectedValue(new Error("DB down"));

      const req = { params: { id: "1" } };
      const res = createRes();
      const next = jest.fn();

      await controller.getCommandById(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Error fetching command");
    });
  });

  // ---------- createCommand ----------
  describe("createCommand", () => {
    const validBody = {
      command: "testcmd",
      response_message: "Hello {username}",
    };

    test("success -> 201 { ok:true, message, data }", async () => {
      const newCommand = { id: 1, command: "testcmd" };
      KickBotCommand.findOne.mockResolvedValue(null);
      KickBotCommand.create.mockResolvedValue(newCommand);

      const req = { body: validBody };
      const res = createRes();
      const next = jest.fn();

      await controller.createCommand(req, res, next);

      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({
        ok: true,
        message: "Command created successfully",
        data: newCommand,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("missing command -> next(AppError) 400", async () => {
      const req = { body: { response_message: "Hello" } };
      const res = createRes();
      const next = jest.fn();

      await controller.createCommand(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        400,
        'The fields "command" and "response_message" are required'
      );
    });

    test("missing response_message -> next(AppError) 400", async () => {
      const req = { body: { command: "testcmd" } };
      const res = createRes();
      const next = jest.fn();

      await controller.createCommand(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        400,
        'The fields "command" and "response_message" are required'
      );
    });

    test("duplicate command -> next(AppError) 409", async () => {
      KickBotCommand.findOne.mockResolvedValue({ id: 1, command: "testcmd" });

      const req = { body: validBody };
      const res = createRes();
      const next = jest.fn();

      await controller.createCommand(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        409,
        'The command "!testcmd" already exists'
      );
    });

    test("alias already exists -> next(AppError) 409", async () => {
      KickBotCommand.findOne.mockResolvedValue(null);
      KickBotCommand.findAll.mockResolvedValue([{ command: "existingalias" }]);

      const req = {
        body: { ...validBody, aliases: ["existingalias"] },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.createCommand(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        409,
        "One of the aliases already exists as a command: existingalias"
      );
    });

    test("error -> next(AppError) 500 'Error creating command'", async () => {
      KickBotCommand.findOne.mockResolvedValue(null);
      KickBotCommand.create.mockRejectedValue(new Error("DB down"));

      const req = { body: validBody };
      const res = createRes();
      const next = jest.fn();

      await controller.createCommand(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Error creating command");
    });
  });

  // ---------- updateCommand ----------
  describe("updateCommand", () => {
    test("success -> 200 { ok:true, message, data }", async () => {
      const existingCommand = {
        id: 1,
        command: "oldcmd",
        save: jest.fn().mockResolvedValue(undefined),
      };
      KickBotCommand.findByPk.mockResolvedValue(existingCommand);

      const req = {
        params: { id: "1" },
        body: { response_message: "Updated" },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.updateCommand(req, res, next);

      expect(existingCommand.save).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        ok: true,
        message: "Command updated successfully",
        data: existingCommand,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("not found -> next(AppError) 404 'Command not found'", async () => {
      KickBotCommand.findByPk.mockResolvedValue(null);

      const req = { params: { id: "999" }, body: {} };
      const res = createRes();
      const next = jest.fn();

      await controller.updateCommand(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "Command not found");
    });

    test("duplicate on rename -> next(AppError) 409", async () => {
      KickBotCommand.findByPk.mockResolvedValue({ id: 1, command: "oldcmd" });
      KickBotCommand.findOne.mockResolvedValue({ id: 2, command: "taken" });

      const req = {
        params: { id: "1" },
        body: { command: "taken" },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.updateCommand(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        409,
        'The command "!taken" already exists'
      );
    });

    test("error -> next(AppError) 500 'Error updating command'", async () => {
      KickBotCommand.findByPk.mockResolvedValue({
        id: 1,
        command: "oldcmd",
        save: jest.fn().mockRejectedValue(new Error("DB down")),
      });

      const req = { params: { id: "1" }, body: {} };
      const res = createRes();
      const next = jest.fn();

      await controller.updateCommand(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Error updating command");
    });
  });

  // ---------- deleteCommand ----------
  describe("deleteCommand", () => {
    test("success -> 200 { ok:true, message }", async () => {
      const command = {
        id: 1,
        command: "testcmd",
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      KickBotCommand.findByPk.mockResolvedValue(command);

      const req = { params: { id: "1" } };
      const res = createRes();
      const next = jest.fn();

      await controller.deleteCommand(req, res, next);

      expect(command.destroy).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        ok: true,
        message: "Command deleted successfully",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("not found -> next(AppError) 404 'Command not found'", async () => {
      KickBotCommand.findByPk.mockResolvedValue(null);

      const req = { params: { id: "999" } };
      const res = createRes();
      const next = jest.fn();

      await controller.deleteCommand(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "Command not found");
    });

    test("error -> next(AppError) 500 'Error deleting command'", async () => {
      KickBotCommand.findByPk.mockRejectedValue(new Error("DB down"));

      const req = { params: { id: "1" } };
      const res = createRes();
      const next = jest.fn();

      await controller.deleteCommand(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Error deleting command");
    });
  });

  // ---------- toggleCommandStatus ----------
  describe("toggleCommandStatus", () => {
    test("success -> 200 { ok:true, message, data }", async () => {
      const command = {
        id: 1,
        command: "testcmd",
        enabled: true,
        save: jest.fn().mockResolvedValue(undefined),
      };
      KickBotCommand.findByPk.mockResolvedValue(command);

      const req = { params: { id: "1" } };
      const res = createRes();
      const next = jest.fn();

      await controller.toggleCommandStatus(req, res, next);

      expect(command.enabled).toBe(false);
      expect(command.save).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        ok: true,
        message: "Command disabled successfully",
        data: command,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("not found -> next(AppError) 404 'Command not found'", async () => {
      KickBotCommand.findByPk.mockResolvedValue(null);

      const req = { params: { id: "999" } };
      const res = createRes();
      const next = jest.fn();

      await controller.toggleCommandStatus(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "Command not found");
    });

    test("error -> next(AppError) 500 'Error toggling command status'", async () => {
      KickBotCommand.findByPk.mockRejectedValue(new Error("DB down"));

      const req = { params: { id: "1" } };
      const res = createRes();
      const next = jest.fn();

      await controller.toggleCommandStatus(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        500,
        "Error toggling command status"
      );
    });
  });

  // ---------- getCommandsStats ----------
  describe("getCommandsStats", () => {
    test("success -> 200 { ok:true, data } with correct shape", async () => {
      KickBotCommand.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(7) // enabled
        .mockResolvedValueOnce(3) // disabled
        .mockResolvedValueOnce(6) // simple
        .mockResolvedValueOnce(4); // dynamic
      const mostUsed = [
        { id: 1, command: "a", usage_count: 50, last_used_at: "2025-01-01" },
      ];
      const recentlyUsed = [
        { id: 2, command: "b", usage_count: 10, last_used_at: "2025-01-02" },
      ];
      KickBotCommand.findAll
        .mockResolvedValueOnce(mostUsed)
        .mockResolvedValueOnce(recentlyUsed);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.getCommandsStats(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        ok: true,
        data: {
          summary: {
            total: 10,
            enabled: 7,
            disabled: 3,
            simple: 6,
            dynamic: 4,
          },
          mostUsed,
          recentlyUsed,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 'Error fetching stats'", async () => {
      KickBotCommand.count.mockRejectedValue(new Error("DB down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.getCommandsStats(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Error fetching stats");
    });
  });

  // ---------- duplicateCommand ----------
  describe("duplicateCommand", () => {
    test("success -> 201 { ok:true, message, data }", async () => {
      const originalCommand = {
        id: 1,
        command: "testcmd",
        response_message: "Hello",
        description: "A test",
        command_type: "simple",
        dynamic_handler: null,
        requires_permission: false,
        permission_level: "viewer",
        cooldown_seconds: 0,
      };
      KickBotCommand.findByPk.mockResolvedValue(originalCommand);
      KickBotCommand.findOne.mockResolvedValue(null); // no _copy exists
      const duplicated = { id: 2, command: "testcmd_copy" };
      KickBotCommand.create.mockResolvedValue(duplicated);

      const req = { params: { id: "1" } };
      const res = createRes();
      const next = jest.fn();

      await controller.duplicateCommand(req, res, next);

      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({
        ok: true,
        message: "Command duplicated successfully",
        data: duplicated,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("not found -> next(AppError) 404 'Command not found'", async () => {
      KickBotCommand.findByPk.mockResolvedValue(null);

      const req = { params: { id: "999" } };
      const res = createRes();
      const next = jest.fn();

      await controller.duplicateCommand(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "Command not found");
    });

    test("error -> next(AppError) 500 'Error duplicating command'", async () => {
      KickBotCommand.findByPk.mockRejectedValue(new Error("DB down"));

      const req = { params: { id: "1" } };
      const res = createRes();
      const next = jest.fn();

      await controller.duplicateCommand(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Error duplicating command");
    });
  });

  // ---------- testCommand ----------
  describe("testCommand", () => {
    test("success -> 200 { ok:true, data } with variables_used", async () => {
      const req = {
        body: {
          response_message: "Hello {username}, you have {points} points",
          test_username: "Alice",
          test_args: "arg1 arg2",
        },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.testCommand(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        ok: true,
        data: {
          original: "Hello {username}, you have {points} points",
          processed: "Hello Alice, you have 1000 points",
          variables_used: {
            username: "Alice",
            channel: "luisardito",
            args: "arg1 arg2",
            target_user: "Alice",
            points: "1000",
          },
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("missing response_message -> next(AppError) 400", async () => {
      const req = { body: {} };
      const res = createRes();
      const next = jest.fn();

      await controller.testCommand(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        400,
        'The field "response_message" is required'
      );
    });
  });
});
