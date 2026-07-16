jest.mock("../../src/models", () => ({
  HistorialPunto: { findAll: jest.fn() },
}));

jest.mock("../../src/models/database", () => ({
  sequelize: { literal: jest.fn((s) => ({ val: s })) },
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { Op } = require("sequelize");
const { HistorialPunto } = require("../../src/models");
const { sequelize } = require("../../src/models/database");
const historialCtrl = require("../../src/controllers/historialPuntos.controller");
const AppError = require("../../src/utils/AppError");

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

describe("historialPuntos.controller migration characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------- listar ----------
  describe("listar", () => {
    test("regular user (rol_id <= 2) viewing another user's history -> next(AppError) 403", async () => {
      const req = {
        params: { usuarioId: "5" },
        query: {},
        user: { id: 1, rol_id: 2 },
      };
      const res = createRes();
      const next = jest.fn();

      await historialCtrl.listar(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(403);
      expect(err.message).toBe("No permission to view this history");
      expect(HistorialPunto.findAll).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("admin (rol_id >= 3) with include_all='true' -> findAll with simple where { usuario_id }, 200 with registros", async () => {
      const registros = [{ id: 1 }, { id: 2 }];
      HistorialPunto.findAll.mockResolvedValue(registros);
      const req = {
        params: { usuarioId: "5" },
        query: { include_all: "true" },
        user: { id: 1, rol_id: 3 },
      };
      const res = createRes();
      const next = jest.fn();

      await historialCtrl.listar(req, res, next);

      expect(HistorialPunto.findAll).toHaveBeenCalledTimes(1);
      const callArg = HistorialPunto.findAll.mock.calls[0][0];
      expect(callArg.where).toEqual({ usuario_id: "5" });
      expect(callArg.order).toEqual([["fecha", "DESC"]]);
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(registros);
      expect(next).not.toHaveBeenCalled();
    });

    test("admin without include_all -> findAll with where clause containing Op.or filter, 200 with registros", async () => {
      const registros = [{ id: 1 }];
      HistorialPunto.findAll.mockResolvedValue(registros);
      const req = {
        params: { usuarioId: "5" },
        query: {},
        user: { id: 1, rol_id: 3 },
      };
      const res = createRes();
      const next = jest.fn();

      await historialCtrl.listar(req, res, next);

      expect(HistorialPunto.findAll).toHaveBeenCalledTimes(1);
      const callArg = HistorialPunto.findAll.mock.calls[0][0];
      // where clause must contain the Op.or filter (not the simple where)
      expect(Object.getOwnPropertySymbols(callArg.where)).toContain(Op.or);
      expect(callArg.where.usuario_id).toBe("5");
      expect(callArg.order).toEqual([["fecha", "DESC"]]);
      // sequelize.literal is used inside the Op.or branch
      expect(sequelize.literal).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(registros);
      expect(next).not.toHaveBeenCalled();
    });

    test("regular user viewing own history -> findAll called, 200 with registros", async () => {
      const registros = [{ id: 1, usuario_id: "1" }];
      HistorialPunto.findAll.mockResolvedValue(registros);
      const req = {
        params: { usuarioId: "1" },
        query: {},
        user: { id: 1, rol_id: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await historialCtrl.listar(req, res, next);

      expect(HistorialPunto.findAll).toHaveBeenCalledTimes(1);
      const callArg = HistorialPunto.findAll.mock.calls[0][0];
      // Regular user without include_all -> filtered where clause with Op.or
      expect(Object.getOwnPropertySymbols(callArg.where)).toContain(Op.or);
      expect(callArg.where.usuario_id).toBe("1");
      expect(callArg.order).toEqual([["fecha", "DESC"]]);
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(registros);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- listarCompleto ----------
  describe("listarCompleto", () => {
    test("success -> findAll with { where: { usuario_id }, order: [['fecha','DESC']] }, 200 with registros", async () => {
      const registros = [{ id: 1 }, { id: 2 }, { id: 3 }];
      HistorialPunto.findAll.mockResolvedValue(registros);
      const req = {
        params: { usuarioId: "7" },
        user: { id: 1, rol_id: 3 },
      };
      const res = createRes();
      const next = jest.fn();

      await historialCtrl.listarCompleto(req, res, next);

      expect(HistorialPunto.findAll).toHaveBeenCalledTimes(1);
      expect(HistorialPunto.findAll).toHaveBeenCalledWith({
        where: { usuario_id: "7" },
        order: [["fecha", "DESC"]],
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(registros);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
