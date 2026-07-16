/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import { DataTypes } from "sequelize";
import { sequelize } from "./database";
import Rol from "./rol.model";
import Permiso from "./permiso.model";

const RolPermiso = sequelize.define(
  "RolPermiso",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    rol_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Rol, key: "id" },
    },
    permiso_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Permiso, key: "id" },
    },
  },
  {
    tableName: "rol_permisos",
    timestamps: false,
    uniqueKeys: {
      rol_perm_unique: {
        fields: ["rol_id", "permiso_id"],
      },
    },
  } as any
);

// Relaciones
Rol.belongsToMany(Permiso, {
  through: RolPermiso,
  foreignKey: "rol_id",
  otherKey: "permiso_id",
});
Permiso.belongsToMany(Rol, {
  through: RolPermiso,
  foreignKey: "permiso_id",
  otherKey: "rol_id",
});

export = RolPermiso;
