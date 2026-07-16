/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass
import NotificacionService from "../services/notificacion.service";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/AppError";

const listar = asyncHandler(async (req: any, res: any) => {
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
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message, 500);
  }
});

const obtenerDetalle = asyncHandler(async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const notificacion: any = await NotificacionService.obtenerDetalle(
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
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message, 404);
  }
});

const marcarComoLeida = asyncHandler(async (req: any, res: any) => {
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
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message, 404);
  }
});

const marcarTodasComoLeidas = asyncHandler(async (req: any, res: any) => {
  try {
    const usuarioId = req.user.id;

    const resultado =
      await NotificacionService.marcarTodasComoLeidas(usuarioId);

    res.json({
      mensaje: "All notifications marked as read",
      ...resultado,
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message, 500);
  }
});

const eliminar = asyncHandler(async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const resultado = await NotificacionService.eliminar(id, usuarioId);

    res.json(resultado);
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message, 404);
  }
});

const contarNoLeidas = asyncHandler(async (req: any, res: any) => {
  try {
    const usuarioId = req.user.id;

    const resultado = await NotificacionService.contarNoLeidas(usuarioId);

    res.json(resultado);
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message, 500);
  }
});

export = {
  listar,
  obtenerDetalle,
  marcarComoLeida,
  marcarTodasComoLeidas,
  eliminar,
  contarNoLeidas,
};
