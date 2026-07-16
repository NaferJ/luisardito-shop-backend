import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

type NotificacionTipo =
  | "sub_regalada"
  | "puntos_ganados"
  | "canje_creado"
  | "canje_entregado"
  | "canje_cancelado"
  | "canje_devuelto"
  | "historial_evento"
  | "sistema";

type NotificacionEstado = "no_leida" | "leida";

class Notificacion extends Model<
  InferAttributes<Notificacion>,
  InferCreationAttributes<Notificacion>
> {
  declare id: CreationOptional<number>;
  declare usuario_id: number;
  declare titulo: string;
  declare descripcion: string;
  declare tipo: CreationOptional<NotificacionTipo>;
  declare estado: CreationOptional<NotificacionEstado>;
  declare datos_relacionados: Record<string, unknown> | null;
  declare enlace_detalle: string | null;
  declare fecha_lectura: Date | null;
  declare deleted_at: Date | null;
  declare fecha_creacion: CreationOptional<Date>;
  declare fecha_actualizacion: CreationOptional<Date>;
}

Notificacion.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    titulo: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Título de la notificación",
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Descripción detallada de la notificación",
    },
    tipo: {
      type: DataTypes.ENUM(
        "sub_regalada",
        "puntos_ganados",
        "canje_creado",
        "canje_entregado",
        "canje_cancelado",
        "canje_devuelto",
        "historial_evento",
        "sistema"
      ),
      allowNull: false,
      defaultValue: "sistema",
      comment: "Tipo de notificación",
    },
    estado: {
      type: DataTypes.ENUM("no_leida", "leida"),
      defaultValue: "no_leida",
      comment: "Estado de lectura de la notificación",
    },
    datos_relacionados: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Datos contextuales en JSON (producto, usuario, montos, etc.)",
    },
    enlace_detalle: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "URL relativa o ruta para navegar al detalle (ej: /canjes/5)",
    },
    fecha_lectura: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Fecha y hora cuando se marcó como leída",
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Fecha de eliminación para soft deletes",
    },
    fecha_creacion: {
      type: DataTypes.DATE,
    },
    fecha_actualizacion: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "notificaciones",
    timestamps: true,
    createdAt: "fecha_creacion",
    updatedAt: "fecha_actualizacion",
    paranoid: false, // Soft deletes handled manually via deleted_at
  }
);

export = Notificacion;
