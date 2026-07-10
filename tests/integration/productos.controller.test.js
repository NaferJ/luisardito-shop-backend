jest.mock("../../src/models", () => ({
  Producto: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  Promocion: {
    findAll: jest.fn(),
  },
  PromocionProducto: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  sequelize: {
    literal: jest.fn(() => ({})),
  },
  Op: { in: Symbol("in") },
}));

jest.mock("../../src/services/promocion.service", () => ({
  calcularMejorDescuento: jest.fn(),
  obtenerPromocionesActivasProducto: jest.fn(),
  aplicarPromocion: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { Producto, Promocion, PromocionProducto } = require("../../src/models");
const logger = require("../../src/utils/logger");
const AppError = require("../../src/utils/AppError");
const controller = require("../../src/controllers/productos.controller");

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

function expectNextCalledWithError(next, res) {
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  expect(res.status).not.toHaveBeenCalled();
  expect(res.json).not.toHaveBeenCalled();
}

describe("productos.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("crear", () => {
    test("happy path - 201 with created product", async () => {
      const created = { id: 1, nombre: "Test", precio: 100 };
      Producto.create.mockResolvedValue(created);

      const req = { body: { nombre: "Test", precio: 100 } };
      const res = createRes();

      await controller.crear(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body).toBe(created);
    });

    test("create failure -> next(AppError) 400 with err.message", async () => {
      Producto.create.mockRejectedValue(new Error("Validation failed"));

      const req = { body: { invalid: true } };
      const res = createRes();
      const next = jest.fn();

      await controller.crear(req, res, next);

      expectNextCalledWithAppError(next, res, 400, "Validation failed");
    });
  });

  describe("editar", () => {
    test("happy path - 200 with updated product", async () => {
      const producto = {
        id: 1,
        nombre: "Old",
        update: jest.fn().mockResolvedValue(undefined),
      };
      Producto.findByPk.mockResolvedValue(producto);

      const req = { params: { id: "1" }, body: { nombre: "New" } };
      const res = createRes();

      await controller.editar(req, res);

      expect(producto.update).toHaveBeenCalledWith({ nombre: "New" });
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(producto);
    });

    test("not found -> next(AppError) 404 'Not found'", async () => {
      Producto.findByPk.mockResolvedValue(null);

      const req = { params: { id: "999" }, body: {} };
      const res = createRes();
      const next = jest.fn();

      await controller.editar(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "Not found");
    });

    test("update failure -> next(AppError) 400 with err.message", async () => {
      const producto = {
        id: 1,
        update: jest.fn().mockRejectedValue(new Error("DB error")),
      };
      Producto.findByPk.mockResolvedValue(producto);

      const req = { params: { id: "1" }, body: { nombre: "New" } };
      const res = createRes();
      const next = jest.fn();

      await controller.editar(req, res, next);

      expectNextCalledWithAppError(next, res, 400, "DB error");
    });
  });

  describe("eliminar", () => {
    test("happy path - 200 with deletion message", async () => {
      const producto = {
        id: 1,
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      Producto.findByPk.mockResolvedValue(producto);

      const req = { params: { id: "1" } };
      const res = createRes();

      await controller.eliminar(req, res);

      expect(producto.destroy).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: "Product deleted" });
    });

    test("not found -> next(AppError) 404 'Not found'", async () => {
      Producto.findByPk.mockResolvedValue(null);

      const req = { params: { id: "999" } };
      const res = createRes();
      const next = jest.fn();

      await controller.eliminar(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "Not found");
    });
  });

  describe("actualizarPromociones", () => {
    test("happy path - 200 with success body", async () => {
      Producto.findByPk.mockResolvedValue({ id: 1 });
      Promocion.findAll.mockResolvedValue([]);
      PromocionProducto.findOne.mockResolvedValue(null);

      const req = {
        params: { id: "1" },
        body: { promocion_ids: [10, 20] },
      };
      const res = createRes();

      await controller.actualizarPromociones(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: "Promotions updated successfully",
        producto_id: "1",
        promociones_asignadas: [10, 20],
      });
    });

    test("promocion_ids not array -> next(AppError) 400", async () => {
      const req = {
        params: { id: "1" },
        body: { promocion_ids: "not-an-array" },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.actualizarPromociones(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        400,
        "promocion_ids must be an array"
      );
    });

    test("product not found -> next(AppError) 404 'Product not found'", async () => {
      Producto.findByPk.mockResolvedValue(null);

      const req = {
        params: { id: "999" },
        body: { promocion_ids: [] },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.actualizarPromociones(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "Product not found");
    });

    test("generic failure -> next(AppError) 500 'Error updating promotions'", async () => {
      Producto.findByPk.mockResolvedValue({ id: 1 });
      Promocion.findAll.mockRejectedValue(new Error("DB connection lost"));

      const req = {
        params: { id: "1" },
        body: { promocion_ids: [] },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.actualizarPromociones(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Error updating promotions");
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe("debugListar", () => {
    test("happy path - 200 with { total, productos } shape", async () => {
      const productos = [
        {
          id: 1,
          nombre: "A",
          estado: "publicado",
          precio: 50,
          stock: 10,
          get: jest.fn((key) => (key === "canjes_count" ? 5 : undefined)),
          creado: "2024-01-01",
          actualizado: "2024-01-02",
        },
      ];
      Producto.findAll.mockResolvedValue(productos);

      const req = {};
      const res = createRes();

      await controller.debugListar(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.productos).toHaveLength(1);
      expect(res.body.productos[0]).toEqual({
        id: 1,
        nombre: "A",
        estado: "publicado",
        precio: 50,
        stock: 10,
        canjes_count: 5,
        creado: "2024-01-01",
        actualizado: "2024-01-02",
      });
    });

    test("findAll failure -> next(Error) propagated (500)", async () => {
      Producto.findAll.mockRejectedValue(new Error("boom"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.debugListar(req, res, next);

      expectNextCalledWithError(next, res);
    });
  });
});
