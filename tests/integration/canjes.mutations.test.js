const mockFakeT = {
  LOCK: { UPDATE: "UPDATE" },
  rollback: jest.fn(),
  commit: jest.fn(),
};

jest.mock("../../src/models", () => ({
  Canje: {
    sequelize: {
      transaction: jest.fn(async (cb) => (cb ? cb(mockFakeT) : mockFakeT)),
    },
    create: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  Producto: {
    findByPk: jest.fn(),
  },
  Usuario: {
    findByPk: jest.fn(),
  },
  HistorialPunto: {
    create: jest.fn(),
  },
  KickUserTracking: { findOne: jest.fn() },
  DiscordUserLink: { findOne: jest.fn() },
  Op: { iLike: Symbol("iLike") },
}));

jest.mock("../../src/services/vip.service", () => ({
  grantVipFromCanje: jest.fn(),
}));

jest.mock("../../src/services/kickBot.service", () => ({
  sendMessage: jest.fn(),
  KickBotService: { sendMessage: jest.fn() },
}));

jest.mock("../../src/services/promocion.service", () => ({
  calcularMejorDescuento: jest.fn(),
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

const {
  Canje,
  Producto,
  Usuario,
  HistorialPunto,
} = require("../../src/models");
const KickBotService = require("../../src/services/kickBot.service");
const promocionService = require("../../src/services/promocion.service");
const NotificacionService = require("../../src/services/notificacion.service");
const controller = require("../../src/controllers/canjes.controller");
const AppError = require("../../src/utils/AppError");

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

function makeChainedProducto(overrides = {}) {
  return {
    id: 1,
    nombre: "Test Product",
    precio: 100,
    stock: 5,
    estado: "publicado",
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeChainedUsuario(overrides = {}) {
  return {
    id: 10,
    nickname: "testuser",
    puntos: 500,
    is_vip: false,
    vip_expires_at: null,
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeCanjeInstance(overrides = {}) {
  return {
    id: 99,
    estado: "pendiente",
    usuario_id: 10,
    precio_al_canje: 100,
    toJSON() {
      return {
        id: this.id,
        estado: this.estado,
        usuario_id: this.usuario_id,
        precio_al_canje: this.precio_al_canje,
      };
    },
    update: jest.fn(async function (values) {
      Object.assign(this, values);
    }),
    ...overrides,
  };
}

function makeCanjeInstanceWithAssociations(overrides = {}) {
  const productoStock = overrides.productoStock ?? 5;
  const { productoStock: _ps, ...canjeOverrides } = overrides;
  const producto = makeChainedProducto({ stock: productoStock });
  const usuario = makeChainedUsuario();
  return makeCanjeInstance({
    estado: canjeOverrides.estado ?? "pendiente",
    precio_al_canje: canjeOverrides.precio_al_canje ?? 100,
    Usuario: usuario,
    Producto: producto,
    ...canjeOverrides,
  });
}

describe("canjes.controller mutations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFakeT.rollback.mockReset();
    mockFakeT.commit.mockReset();
    mockFakeT.rollback.mockResolvedValue(undefined);
    mockFakeT.commit.mockResolvedValue(undefined);
  });

  // ---------- crear ----------
  describe("crear", () => {
    const baseReq = {
      body: { producto_id: 1 },
      user: { id: 10 },
    };

    test("product missing -> next(AppError) 404 Product not available", async () => {
      Producto.findByPk.mockResolvedValue(null);
      const req = { ...baseReq };
      const res = createRes();
      const next = jest.fn();

      await controller.crear(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Product not available");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("product not publicado -> next(AppError) 404 Product not available", async () => {
      Producto.findByPk.mockResolvedValue(
        makeChainedProducto({ estado: "borrador" })
      );
      const req = { ...baseReq };
      const res = createRes();
      const next = jest.fn();

      await controller.crear(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Product not available");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("stock <= 0 -> next(AppError) 400 No stock available", async () => {
      Producto.findByPk.mockResolvedValue(makeChainedProducto({ stock: 0 }));
      const req = { ...baseReq };
      const res = createRes();
      const next = jest.fn();

      await controller.crear(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("No stock available for this product");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("user missing -> next(AppError) 404 User not found", async () => {
      Producto.findByPk.mockResolvedValue(makeChainedProducto());
      Usuario.findByPk.mockResolvedValue(null);
      const req = { ...baseReq };
      const res = createRes();
      const next = jest.fn();

      await controller.crear(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("User not found");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("points < precioFinal -> next(AppError) 400 Insufficient points", async () => {
      Producto.findByPk.mockResolvedValue(makeChainedProducto());
      Usuario.findByPk.mockResolvedValue(makeChainedUsuario({ puntos: 50 }));
      promocionService.calcularMejorDescuento.mockResolvedValue({
        tieneDescuento: false,
        precioOriginal: 100,
        precioFinal: 100,
        descuento: 0,
        promocion: null,
      });
      const req = { ...baseReq };
      const res = createRes();
      const next = jest.fn();

      await controller.crear(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Insufficient points");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("success with promocion=null -> 201, body has price fields, KickBot called", async () => {
      Producto.findByPk.mockResolvedValue(makeChainedProducto());
      Usuario.findByPk.mockResolvedValue(makeChainedUsuario());
      promocionService.calcularMejorDescuento.mockResolvedValue({
        tieneDescuento: false,
        precioOriginal: 100,
        precioFinal: 100,
        descuento: 0,
        promocion: null,
      });
      Canje.create.mockResolvedValue(makeCanjeInstance());
      HistorialPunto.create.mockResolvedValue(undefined);
      NotificacionService.crearNotificacionCanjeCreado.mockResolvedValue(
        undefined
      );
      KickBotService.sendMessage.mockResolvedValue(undefined);

      const req = { ...baseReq };
      const res = createRes();
      const next = jest.fn();

      await controller.crear(req, res, next);

      expect(res.statusCode).toBe(201);
      expect(res.body).toMatchObject({
        precio_original: 100,
        precio_pagado: 100,
        descuento_aplicado: 0,
        promocion: null,
      });
      expect(KickBotService.sendMessage).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });

    test("success with promotion -> 201, body includes promocion object", async () => {
      const promo = {
        id: 5,
        codigo: "PROMO5",
        titulo: "Summer Sale",
        descripcion: "desc",
        tipo_descuento: "porcentaje",
        valor_descuento: 20,
        fecha_fin: null,
        metadata_visual: null,
      };
      Producto.findByPk.mockResolvedValue(makeChainedProducto());
      Usuario.findByPk.mockResolvedValue(makeChainedUsuario());
      promocionService.calcularMejorDescuento.mockResolvedValue({
        tieneDescuento: true,
        precioOriginal: 100,
        precioFinal: 80,
        descuento: 20,
        porcentajeDescuento: "20",
        promocion: promo,
      });
      promocionService.aplicarPromocion.mockResolvedValue(undefined);
      Canje.create.mockResolvedValue(makeCanjeInstance());
      HistorialPunto.create.mockResolvedValue(undefined);
      NotificacionService.crearNotificacionCanjeCreado.mockResolvedValue(
        undefined
      );
      KickBotService.sendMessage.mockResolvedValue(undefined);

      const req = { ...baseReq };
      const res = createRes();
      const next = jest.fn();

      await controller.crear(req, res, next);

      expect(res.statusCode).toBe(201);
      expect(res.body).toMatchObject({
        precio_original: 100,
        precio_pagado: 80,
        descuento_aplicado: 20,
        promocion: {
          id: 5,
          titulo: "Summer Sale",
          tipo: "porcentaje",
          valor: 20,
        },
      });
      expect(KickBotService.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  // ---------- actualizarEstado ----------
  describe("actualizarEstado", () => {
    const baseReq = {
      params: { id: "99" },
      body: { estado: "entregado" },
    };

    test("invalid estado -> next(AppError) 400, message starts with 'Invalid state. Allowed:'", async () => {
      const req = {
        ...baseReq,
        body: { estado: "bogus" },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.actualizarEstado(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toMatch(/^Invalid state\. Allowed:/);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("canje missing -> next(AppError) 404 Not found", async () => {
      Canje.findByPk.mockResolvedValue(null);
      const req = { ...baseReq };
      const res = createRes();
      const next = jest.fn();

      await controller.actualizarEstado(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Not found");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("success estado entregado, non-VIP product -> 200, vip_info null", async () => {
      const canje = makeCanjeInstanceWithAssociations({
        estado: "pendiente",
      });
      Canje.findByPk.mockResolvedValue(canje);
      NotificacionService.crearNotificacionCanjeEntregado.mockResolvedValue(
        undefined
      );

      const req = { ...baseReq };
      const res = createRes();
      const next = jest.fn();

      await controller.actualizarEstado(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: "State updated",
        id: 99,
        estado: "entregado",
        vip_info: null,
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- devolverCanje ----------
  describe("devolverCanje", () => {
    const baseReq = {
      params: { id: "99" },
      body: { motivo: "Wrong item" },
      user: { id: 1, nickname: "admin" },
    };

    test("empty motivo -> next(AppError) 400 Return reason is required", async () => {
      const req = {
        ...baseReq,
        body: { motivo: "" },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.devolverCanje(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Return reason is required");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("whitespace motivo -> next(AppError) 400 Return reason is required", async () => {
      const req = {
        ...baseReq,
        body: { motivo: "   " },
      };
      const res = createRes();
      const next = jest.fn();

      await controller.devolverCanje(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Return reason is required");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("canje missing -> next(AppError) 404 Canje not found", async () => {
      Canje.findByPk.mockResolvedValue(null);
      const req = { ...baseReq };
      const res = createRes();
      const next = jest.fn();

      await controller.devolverCanje(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Canje not found");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("estado devuelto -> next(AppError) 400 Canje is already returned", async () => {
      const canje = makeCanjeInstanceWithAssociations({
        estado: "devuelto",
      });
      Canje.findByPk.mockResolvedValue(canje);
      const req = { ...baseReq };
      const res = createRes();
      const next = jest.fn();

      await controller.devolverCanje(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Canje is already returned");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("estado cancelado -> next(AppError) 400 Only pending or delivered", async () => {
      const canje = makeCanjeInstanceWithAssociations({
        estado: "cancelado",
      });
      Canje.findByPk.mockResolvedValue(canje);
      const req = { ...baseReq };
      const res = createRes();
      const next = jest.fn();

      await controller.devolverCanje(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe(
        "Only pending or delivered canjes can be returned"
      );
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("success estado entregado -> 200, stockNuevo = stock + 1", async () => {
      const originalStock = 5;
      const canje = makeCanjeInstanceWithAssociations({
        estado: "entregado",
        precio_al_canje: 100,
        productoStock: originalStock,
      });
      Canje.findByPk.mockResolvedValue(canje);
      HistorialPunto.create.mockResolvedValue(undefined);
      NotificacionService.crearNotificacionCanjeDevuelto.mockResolvedValue(
        undefined
      );

      const req = { ...baseReq };
      const res = createRes();
      const next = jest.fn();

      await controller.devolverCanje(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Canje returned successfully");
      expect(res.body.producto.stockNuevo).toBe(originalStock + 1);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
