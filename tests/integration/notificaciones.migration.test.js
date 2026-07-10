jest.mock("../../src/services/notificacion.service", () => ({
  listar: jest.fn(),
  obtenerDetalle: jest.fn(),
  marcarComoLeida: jest.fn(),
  marcarTodasComoLeidas: jest.fn(),
  eliminar: jest.fn(),
  contarNoLeidas: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const NotificacionService = require("../../src/services/notificacion.service");
const notificacionesCtrl = require("../../src/controllers/notificaciones.controller");
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

describe("notificaciones.controller migration characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------- listar ----------
  describe("listar", () => {
    test("success -> 200 with service result { total, page, limit, pages, notificaciones }", async () => {
      const serviceResult = {
        total: 5,
        page: 1,
        limit: 20,
        pages: 1,
        notificaciones: [{ id: 1 }, { id: 2 }],
      };
      NotificacionService.listar.mockResolvedValue(serviceResult);
      const req = {
        user: { id: 1 },
        query: { page: 1, limit: 20 },
      };
      const res = createRes();
      const next = jest.fn();

      await notificacionesCtrl.listar(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(serviceResult);
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 with error.message", async () => {
      NotificacionService.listar.mockRejectedValue(new Error("DB down"));
      const req = {
        user: { id: 1 },
        query: {},
      };
      const res = createRes();
      const next = jest.fn();

      await notificacionesCtrl.listar(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("DB down");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ---------- obtenerDetalle ----------
  describe("obtenerDetalle", () => {
    test("success with no_leida -> auto-marks as leida, sets fecha_lectura, returns notificacion", async () => {
      const notificacion = {
        id: 10,
        estado: "no_leida",
        fecha_lectura: null,
      };
      NotificacionService.obtenerDetalle.mockResolvedValue(notificacion);
      NotificacionService.marcarComoLeida.mockResolvedValue(notificacion);
      const req = {
        params: { id: "10" },
        user: { id: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await notificacionesCtrl.obtenerDetalle(req, res, next);

      expect(NotificacionService.marcarComoLeida).toHaveBeenCalledWith("10", 1);
      expect(notificacion.estado).toBe("leida");
      expect(notificacion.fecha_lectura).toBeInstanceOf(Date);
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(notificacion);
      expect(next).not.toHaveBeenCalled();
    });

    test("success with already leida -> does NOT call marcarComoLeida", async () => {
      const notificacion = {
        id: 10,
        estado: "leida",
        fecha_lectura: new Date("2024-01-01"),
      };
      NotificacionService.obtenerDetalle.mockResolvedValue(notificacion);
      const req = {
        params: { id: "10" },
        user: { id: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await notificacionesCtrl.obtenerDetalle(req, res, next);

      expect(NotificacionService.marcarComoLeida).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(notificacion);
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 404 with error.message", async () => {
      NotificacionService.obtenerDetalle.mockRejectedValue(
        new Error("Notification not found")
      );
      const req = {
        params: { id: "999" },
        user: { id: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await notificacionesCtrl.obtenerDetalle(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Notification not found");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ---------- marcarComoLeida ----------
  describe("marcarComoLeida", () => {
    test("success -> 200 { mensaje, notificacion }", async () => {
      const notificacion = { id: 10, estado: "leida" };
      NotificacionService.marcarComoLeida.mockResolvedValue(notificacion);
      const req = {
        params: { id: "10" },
        user: { id: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await notificacionesCtrl.marcarComoLeida(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        mensaje: "Notification marked as read",
        notificacion,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 404 with error.message", async () => {
      NotificacionService.marcarComoLeida.mockRejectedValue(
        new Error("Notification not found")
      );
      const req = {
        params: { id: "999" },
        user: { id: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await notificacionesCtrl.marcarComoLeida(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Notification not found");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ---------- marcarTodasComoLeidas ----------
  describe("marcarTodasComoLeidas", () => {
    test("success -> 200 { mensaje, ...resultado }", async () => {
      const serviceResult = { cantidad_actualizadas: 3 };
      NotificacionService.marcarTodasComoLeidas.mockResolvedValue(
        serviceResult
      );
      const req = { user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await notificacionesCtrl.marcarTodasComoLeidas(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        mensaje: "All notifications marked as read",
        cantidad_actualizadas: 3,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 with error.message", async () => {
      NotificacionService.marcarTodasComoLeidas.mockRejectedValue(
        new Error("DB connection lost")
      );
      const req = { user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await notificacionesCtrl.marcarTodasComoLeidas(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("DB connection lost");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ---------- eliminar ----------
  describe("eliminar", () => {
    test("success -> 200 with service result { id, mensaje }", async () => {
      const serviceResult = { id: 10, mensaje: "Notification deleted" };
      NotificacionService.eliminar.mockResolvedValue(serviceResult);
      const req = {
        params: { id: "10" },
        user: { id: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await notificacionesCtrl.eliminar(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(serviceResult);
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 404 with error.message", async () => {
      NotificacionService.eliminar.mockRejectedValue(
        new Error("Notification not found")
      );
      const req = {
        params: { id: "999" },
        user: { id: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await notificacionesCtrl.eliminar(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Notification not found");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ---------- contarNoLeidas ----------
  describe("contarNoLeidas", () => {
    test("success -> 200 with service result { cantidad }", async () => {
      const serviceResult = { cantidad: 7 };
      NotificacionService.contarNoLeidas.mockResolvedValue(serviceResult);
      const req = { user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await notificacionesCtrl.contarNoLeidas(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ cantidad: 7 });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 (NOT 404) with error.message", async () => {
      NotificacionService.contarNoLeidas.mockRejectedValue(
        new Error("DB connection lost")
      );
      const req = { user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await notificacionesCtrl.contarNoLeidas(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("DB connection lost");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
