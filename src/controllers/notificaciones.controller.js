const NotificacionService = require("../services/notificacion.service");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

exports.listar = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, tipo = null, estado = null } = req.query;
    const usuarioId = req.user.id;

    const resultado = await NotificacionService.listar(
      usuarioId,
      Number.parseInt(page),
      Number.parseInt(limit),
      tipo,
      estado
    );

    res.json(resultado);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message, 500);
  }
});

exports.obtenerDetalle = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const notificacion = await NotificacionService.obtenerDetalle(
      id,
      usuarioId
    );

    // Mark as read automatically when viewing details
    if (notificacion.estado === "no_leida") {
      await NotificacionService.marcarComoLeida(id, usuarioId);
      notificacion.estado = "leida";
      notificacion.fecha_lectura = new Date();
    }

    res.json(notificacion);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message, 404);
  }
});

exports.marcarComoLeida = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const notificacion = await NotificacionService.marcarComoLeida(
      id,
      usuarioId
    );

    res.json({
      mensaje: "Notification marked as read",
      notificacion,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message, 404);
  }
});

exports.marcarTodasComoLeidas = asyncHandler(async (req, res) => {
  try {
    const usuarioId = req.user.id;

    const resultado =
      await NotificacionService.marcarTodasComoLeidas(usuarioId);

    res.json({
      mensaje: "All notifications marked as read",
      ...resultado,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message, 500);
  }
});

exports.eliminar = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const resultado = await NotificacionService.eliminar(id, usuarioId);

    res.json(resultado);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message, 404);
  }
});

exports.contarNoLeidas = asyncHandler(async (req, res) => {
  try {
    const usuarioId = req.user.id;

    const resultado = await NotificacionService.contarNoLeidas(usuarioId);

    res.json(resultado);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message, 500);
  }
});
