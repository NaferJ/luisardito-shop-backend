const mockFakeT = {
  LOCK: { UPDATE: "UPDATE" },
  rollback: jest.fn(),
  commit: jest.fn(),
};

jest.mock("../../src/models", () => ({
  Promocion: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  PromocionProducto: {
    destroy: jest.fn(),
    bulkCreate: jest.fn(),
  },
  UsoPromocion: {
    findOne: jest.fn(),
  },
  Producto: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn(async (cb) => (cb ? cb(mockFakeT) : mockFakeT)),
    fn: jest.fn(),
    col: jest.fn(),
  },
  Op: {
    in: Symbol("in"),
    ne: Symbol("ne"),
    lte: Symbol("lte"),
    gte: Symbol("gte"),
  },
}));

jest.mock("../../src/services/promocion.service", () => ({
  obtenerEstadisticasPromocion: jest.fn(),
  validarCodigoPromocion: jest.fn(),
  obtenerPromocionesActivas: jest.fn(),
  actualizarEstadosPromociones: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { Promocion, PromocionProducto, Producto } = require("../../src/models");
const promocionService = require("../../src/services/promocion.service");
const controller = require("../../src/controllers/promociones.controller");
const AppError = require("../../src/utils/AppError");

function createRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status: jest.fn(function (c) {
      this.statusCode = c;
      return this;
    }),
    json: jest.fn(function (b) {
      this.body = b;
      return this;
    }),
    setHeader: jest.fn(function (k, v) {
      this.headers[k] = v;
    }),
    send: jest.fn(function (b) {
      this.body = b;
    }),
  };
  return res;
}

function makePromocionInstance(overrides = {}) {
  return {
    id: 1,
    codigo: "PROMO1",
    nombre: "Test Promo",
    titulo: "Test Title",
    descripcion: "Test desc",
    tipo: "producto",
    tipo_descuento: "porcentaje",
    valor_descuento: 10,
    descuento_maximo: null,
    fecha_inicio: new Date("2025-01-01"),
    fecha_fin: new Date("2025-12-31"),
    cantidad_usos_maximos: null,
    usos_por_usuario: 1,
    minimo_puntos: 0,
    requiere_codigo: false,
    prioridad: 0,
    estado: "activo",
    aplica_acumulacion: false,
    metadata_visual: {},
    reglas_aplicacion: {},
    update: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    addProductos: jest.fn().mockResolvedValue(undefined),
    toJSON() {
      return { ...this };
    },
    ...overrides,
  };
}

describe("promociones.controller error-handling migration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFakeT.rollback.mockResolvedValue(undefined);
    mockFakeT.commit.mockResolvedValue(undefined);
  });

  // ---------- crear ----------
  describe("crear", () => {
    const validBody = {
      nombre: "Promo",
      titulo: "Title",
      tipo_descuento: "porcentaje",
      valor_descuento: 10,
      fecha_inicio: "2025-01-01",
      fecha_fin: "2025-12-31",
    };

    test("missing required fields -> next(AppError) 400", async () => {
      const req = { body: { nombre: "Only name" }, user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await controller.crear(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe(
        "Faltan campos requeridos: nombre, titulo, tipo_descuento, valor_descuento, fecha_inicio, fecha_fin"
      );
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("invalid date range -> next(AppError) 400", async () => {
      const req = {
        body: { ...validBody, fecha_fin: "2024-01-01" },
        user: { id: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.crear(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe(
        "La fecha de fin debe ser posterior a la fecha de inicio"
      );
    });

    test("porcentaje > 100 -> next(AppError) 400", async () => {
      const req = {
        body: { ...validBody, valor_descuento: 150 },
        user: { id: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.crear(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe(
        "El descuento por porcentaje no puede ser mayor a 100%"
      );
    });

    test("negative discount -> next(AppError) 400", async () => {
      const req = {
        body: { ...validBody, valor_descuento: -5 },
        user: { id: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.crear(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("El valor del descuento no puede ser negativo");
    });

    test("duplicate code -> next(AppError) 400", async () => {
      Promocion.findOne.mockResolvedValue(makePromocionInstance());
      const req = {
        body: { ...validBody, codigo: "PROMO1" },
        user: { id: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.crear(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Promotion code already exists");
    });

    test("success -> 201 with created promotion", async () => {
      const promo = makePromocionInstance({ id: 5 });
      Promocion.create.mockResolvedValue(promo);
      Promocion.findByPk.mockResolvedValue(promo);

      const req = { body: validBody, user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await controller.crear(req, res, next);

      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual(promo);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- actualizar ----------
  describe("actualizar", () => {
    test("promotion not found -> next(AppError) 404", async () => {
      Promocion.findByPk.mockResolvedValue(null);

      const req = {
        params: { id: "999" },
        body: {},
        user: { id: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.actualizar(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Promotion not found");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("invalid date range -> next(AppError) 400", async () => {
      const promo = makePromocionInstance({
        fecha_inicio: new Date("2025-01-01"),
        fecha_fin: new Date("2025-12-31"),
      });
      Promocion.findByPk.mockResolvedValue(promo);

      const req = {
        params: { id: "1" },
        body: { fecha_fin: "2024-01-01" },
        user: { id: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.actualizar(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe(
        "La fecha de fin debe ser posterior a la fecha de inicio"
      );
    });

    test("duplicate code -> next(AppError) 400", async () => {
      const promo = makePromocionInstance({ codigo: "OLD" });
      Promocion.findByPk.mockResolvedValue(promo);
      Promocion.findOne.mockResolvedValue(makePromocionInstance({ id: 2 }));

      const req = {
        params: { id: "1" },
        body: { codigo: "NEW" },
        user: { id: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.actualizar(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Promotion code already exists");
    });

    test("success -> 200 with updated promotion", async () => {
      const promo = makePromocionInstance();
      Promocion.findByPk.mockResolvedValue(promo);

      const req = {
        params: { id: "1" },
        body: { nombre: "Updated" },
        user: { id: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.actualizar(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(promo);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- eliminar ----------
  describe("eliminar", () => {
    test("not found -> next(AppError) 404", async () => {
      Promocion.findByPk.mockResolvedValue(null);

      const req = { params: { id: "999" } };
      const res = createRes();
      const next = jest.fn();

      await controller.eliminar(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Promotion not found");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("success -> 200 with mensaje", async () => {
      const promo = makePromocionInstance();
      Promocion.findByPk.mockResolvedValue(promo);

      const req = { params: { id: "1" } };
      const res = createRes();
      const next = jest.fn();

      await controller.eliminar(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        mensaje: "Promotion deleted successfully",
      });
      expect(promo.update).toHaveBeenCalledWith({ estado: "inactivo" });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- eliminarPermanente ----------
  describe("eliminarPermanente", () => {
    test("not found -> next(AppError) 404", async () => {
      Promocion.findByPk.mockResolvedValue(null);

      const req = { params: { id: "999" } };
      const res = createRes();
      const next = jest.fn();

      await controller.eliminarPermanente(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Promotion not found");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("success -> 200 with mensaje", async () => {
      const promo = makePromocionInstance();
      Promocion.findByPk.mockResolvedValue(promo);

      const req = { params: { id: "1" } };
      const res = createRes();
      const next = jest.fn();

      await controller.eliminarPermanente(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        mensaje: "Promotion permanently deleted",
      });
      expect(promo.destroy).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- asignarProductos ----------
  describe("asignarProductos", () => {
    test("producto_ids non-array -> next(AppError) 400", async () => {
      const req = {
        params: { promocionId: "1" },
        body: { producto_ids: "not-an-array" },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.asignarProductos(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("producto_ids must be an array");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("promotion not found -> next(AppError) 404", async () => {
      Promocion.findByPk.mockResolvedValue(null);

      const req = {
        params: { promocionId: "999" },
        body: { producto_ids: [1, 2] },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.asignarProductos(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Promotion not found");
    });

    test("success -> 200 with assignment count", async () => {
      const promo = makePromocionInstance();
      Promocion.findByPk.mockResolvedValue(promo);
      PromocionProducto.destroy.mockResolvedValue(0);
      PromocionProducto.bulkCreate.mockResolvedValue([]);

      const req = {
        params: { promocionId: "1" },
        body: { producto_ids: [1, 2, 3] },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.asignarProductos(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: "Products assigned successfully",
        promocion_id: "1",
        productos_asignados: 3,
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- validarCodigo ----------
  describe("validarCodigo", () => {
    test("missing codigo -> next(AppError) 400 'Code is required'", async () => {
      const req = { body: {}, user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await controller.validarCodigo(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Code is required");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("invalid code -> 400 { valido: false, mensaje } (business validation, NOT AppError)", async () => {
      promocionService.validarCodigoPromocion.mockResolvedValue({
        valido: false,
        mensaje: "Invalid or expired promotion code",
      });

      const req = { body: { codigo: "BADCODE" }, user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await controller.validarCodigo(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        valido: false,
        mensaje: "Invalid or expired promotion code",
      });
    });

    test("valid code -> 200 { valido: true, promocion }", async () => {
      const promo = makePromocionInstance({
        id: 5,
        titulo: "Summer",
        descripcion: "Desc",
        tipo_descuento: "porcentaje",
        valor_descuento: 20,
        metadata_visual: { badge: "test" },
      });
      promocionService.validarCodigoPromocion.mockResolvedValue({
        valido: true,
        promocion: promo,
      });

      const req = { body: { codigo: "GOOD" }, user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await controller.validarCodigo(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        valido: true,
        promocion: {
          id: 5,
          titulo: "Summer",
          descripcion: "Desc",
          tipo_descuento: "porcentaje",
          valor_descuento: 20,
          metadata_visual: { badge: "test" },
        },
      });
    });
  });

  // ---------- obtener ----------
  describe("obtener", () => {
    test("not found -> next(AppError) 404", async () => {
      Promocion.findByPk.mockResolvedValue(null);

      const req = { params: { id: "999" } };
      const res = createRes();
      const next = jest.fn();

      await controller.obtener(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Promotion not found");
    });

    test("success -> 200 with promotion", async () => {
      const promo = makePromocionInstance();
      Promocion.findByPk.mockResolvedValue(promo);

      const req = { params: { id: "1" } };
      const res = createRes();
      const next = jest.fn();

      await controller.obtener(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(promo);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- desasignarProducto ----------
  describe("desasignarProducto", () => {
    test("relation not found -> next(AppError) 404", async () => {
      PromocionProducto.destroy.mockResolvedValue(0);

      const req = {
        params: { promocionId: "1", productoId: "99" },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.desasignarProducto(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Relation not found");
    });

    test("success -> 200 with unassign message", async () => {
      PromocionProducto.destroy.mockResolvedValue(1);

      const req = {
        params: { promocionId: "1", productoId: "5" },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.desasignarProducto(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: "Product unassigned successfully",
        promocion_id: "1",
        producto_id: "5",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- obtenerPromocionesProducto ----------
  describe("obtenerPromocionesProducto", () => {
    test("product not found -> next(AppError) 404", async () => {
      Producto.findByPk.mockResolvedValue(null);

      const req = { params: { productoId: "999" } };
      const res = createRes();
      const next = jest.fn();

      await controller.obtenerPromocionesProducto(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Product not found");
    });

    test("success -> 200 with promotions list", async () => {
      Producto.findByPk.mockResolvedValue({ id: 1 });
      const promos = [makePromocionInstance()];
      Promocion.findAll.mockResolvedValue(promos);

      const req = { params: { productoId: "1" } };
      const res = createRes();
      const next = jest.fn();

      await controller.obtenerPromocionesProducto(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(promos);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- obtenerPromocionesActivas ----------
  describe("obtenerPromocionesActivas", () => {
    test("success -> 200 with public promotions", async () => {
      const promo = makePromocionInstance();
      promo.productos = [
        { id: 1, nombre: "P1", precio: 100, imagen_url: "url", slug: "p1" },
      ];
      promocionService.obtenerPromocionesActivas.mockResolvedValue([promo]);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.obtenerPromocionesActivas(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        id: 1,
        titulo: "Test Title",
        productos: [{ id: 1, nombre: "P1" }],
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- actualizarEstados ----------
  describe("actualizarEstados", () => {
    test("success -> 200 with mensaje", async () => {
      promocionService.actualizarEstadosPromociones.mockResolvedValue(
        undefined
      );

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.actualizarEstados(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        mensaje: "Promotion states updated successfully",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- obtenerEstadisticas ----------
  describe("obtenerEstadisticas", () => {
    test("success -> 200 with stats", async () => {
      const stats = { total_usos: 10 };
      promocionService.obtenerEstadisticasPromocion.mockResolvedValue(stats);

      const req = { params: { id: "1" } };
      const res = createRes();
      const next = jest.fn();

      await controller.obtenerEstadisticas(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(stats);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- listar ----------
  describe("listar", () => {
    test("success -> 200 with promotions list", async () => {
      const promos = [makePromocionInstance()];
      Promocion.findAll.mockResolvedValue(promos);

      const req = { query: {} };
      const res = createRes();
      const next = jest.fn();

      await controller.listar(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(promos);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
