jest.mock("../../src/models", () => ({
  Canje: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  Producto: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  Usuario: {},
  HistorialPunto: {},
  KickUserTracking: { findOne: jest.fn() },
  DiscordUserLink: { findOne: jest.fn() },
  Promocion: {},
  PromocionProducto: {},
  sequelize: {
    literal: jest.fn(() => ({})),
  },
  Op: { iLike: Symbol("iLike"), in: Symbol("in") },
}));

jest.mock("../../src/services/vip.service", () => ({
  grantVipFromCanje: jest.fn(),
}));

jest.mock("../../src/services/kickBot.service", () => ({
  sendMessage: jest.fn(),
}));

jest.mock("../../src/services/promocion.service", () => ({
  calcularMejorDescuento: jest.fn(),
  obtenerPromocionesActivasProducto: jest.fn(),
  aplicarPromocion: jest.fn(),
}));

jest.mock("../../src/services/notificacion.service", () => ({
  crearNotificacionCanjeCreado: jest.fn(),
  crearNotificacionCanjeEntregado: jest.fn(),
  crearNotificacionCanjeCancelado: jest.fn(),
  crearNotificacionCanjeDevuelto: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { Producto } = require("../../src/models");
const AppError = require("../../src/utils/AppError");
const productosCtrl = require("../../src/controllers/productos.controller");
const usuariosCtrl = require("../../src/controllers/usuarios.controller");
const canjesCtrl = require("../../src/controllers/canjes.controller");

function createRes() {
  const res = {
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
  return res;
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

describe("error-paths characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("productos.obtener - product not found", () => {
    test("Producto.findByPk null -> next(AppError) 404 'Not found'", async () => {
      Producto.findByPk.mockResolvedValue(null);

      const req = { params: { id: "999" }, query: {} };
      const res = createRes();
      const next = jest.fn();

      await productosCtrl.obtener(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "Not found");
    });
  });

  describe("productos.obtenerPorSlug - product not found", () => {
    test("Producto.findOne null -> next(AppError) 404 'Product not found'", async () => {
      Producto.findOne.mockResolvedValue(null);

      const req = { params: { slug: "nonexistent" }, query: {} };
      const res = createRes();
      const next = jest.fn();

      await productosCtrl.obtenerPorSlug(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "Product not found");
    });
  });

  describe("usuarios.me - user not authenticated", () => {
    test("req.user undefined -> next(AppError) 401 'User not authenticated'", async () => {
      const req = { user: undefined };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.me(req, res, next);

      expectNextCalledWithAppError(next, res, 401, "User not authenticated");
    });
  });

  describe("canjes.listarPorUsuario - invalid usuarioId", () => {
    test("usuarioId 'abc' (NaN) -> next(AppError) 400 'Invalid usuarioId'", async () => {
      const req = { params: { usuarioId: "abc" }, query: {} };
      const res = createRes();
      const next = jest.fn();

      await canjesCtrl.listarPorUsuario(req, res, next);

      expectNextCalledWithAppError(next, res, 400, "Invalid usuarioId");
    });
  });

  describe("errorHandler middleware - AppError serialization", () => {
    test("AppError(404, 'Not found') -> 404 { error: 'Not found' }", async () => {
      const express = require("express");
      const supertest = require("supertest");
      const asyncHandler = require("../../src/utils/asyncHandler");
      const {
        errorHandler,
      } = require("../../src/middleware/errorHandler.middleware");

      const app = express();
      app.get(
        "/throw",
        asyncHandler(async () => {
          throw new AppError("Not found", 404);
        })
      );
      app.use(errorHandler);

      const response = await supertest(app).get("/throw");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Not found");
    });
  });
});
