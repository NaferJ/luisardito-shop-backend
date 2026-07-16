// Import sequelize from the separate file
import { sequelize } from "./database";

// Import all models
import Usuario from "./usuario.model";
import Rol from "./rol.model";
import Permiso from "./permiso.model";
import Producto from "./producto.model";
import Canje from "./canje.model";
import RolPermiso from "./rolPermiso.model";
import HistorialPunto from "./historialPunto.model";
import KickEventSubscription from "./kickEventSubscription.model";
import KickWebhookEvent from "./kickWebhookEvent.model";
import KickPointsConfig from "./kickPointsConfig.model";
import KickChatCooldown from "./kickChatCooldown.model";
import KickUserTracking from "./kickUserTracking.model";
import KickBroadcasterToken from "./kickBroadcasterToken.model";
import KickBotToken from "./kickBotToken.model";
import KickBotCommand from "./kickBotCommand.model";
import RefreshToken from "./refreshToken.model";
import BotrixMigrationConfig from "./botrixMigrationConfig.model";
import LeaderboardSnapshot from "./leaderboardSnapshot.model";
import Promocion from "./promocion.model";
import PromocionProducto from "./promocionProducto.model";
import UsoPromocion from "./usoPromocion.model";
import KickReward from "./kickReward.model";
import DiscordUserLink from "./discordUserLink.model";
import Notificacion from "./notificacion.model";
import UserWatchtime from "./userWatchtime.model";

// DEFINE ASSOCIATIONS
// Association between Permiso and RolPermiso (needed for the include in the middleware)
Permiso.hasMany(RolPermiso, { foreignKey: "permiso_id" });
RolPermiso.belongsTo(Permiso, { foreignKey: "permiso_id" });

// Association between Rol and RolPermiso
Rol.hasMany(RolPermiso, { foreignKey: "rol_id" });
RolPermiso.belongsTo(Rol, { foreignKey: "rol_id" });

// Many-to-many associations (optional but useful)
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

// Association between Usuario and Rol
Usuario.belongsTo(Rol, { foreignKey: "rol_id" });
Rol.hasMany(Usuario, { foreignKey: "rol_id" });

// Canje associations
Usuario.hasMany(Canje, { foreignKey: "usuario_id" });
Canje.belongsTo(Usuario, { foreignKey: "usuario_id" });
Producto.hasMany(Canje, { foreignKey: "producto_id" });
Canje.belongsTo(Producto, { foreignKey: "producto_id" });

// HistorialPunto associations
Usuario.hasMany(HistorialPunto, { foreignKey: "usuario_id" });
HistorialPunto.belongsTo(Usuario, { foreignKey: "usuario_id" });

// RefreshToken associations
Usuario.hasMany(RefreshToken, { foreignKey: "usuario_id" });
RefreshToken.belongsTo(Usuario, { foreignKey: "usuario_id" });

// LeaderboardSnapshot associations
Usuario.hasMany(LeaderboardSnapshot, { foreignKey: "usuario_id" });
LeaderboardSnapshot.belongsTo(Usuario, { foreignKey: "usuario_id" });

// Promocion associations
Promocion.belongsToMany(Producto, {
  through: PromocionProducto,
  foreignKey: "promocion_id",
  otherKey: "producto_id",
  as: "productos",
});
Producto.belongsToMany(Promocion, {
  through: PromocionProducto,
  foreignKey: "producto_id",
  otherKey: "promocion_id",
  as: "promociones",
});

// PromocionProducto associations
Promocion.hasMany(PromocionProducto, {
  foreignKey: "promocion_id",
  as: "promocionProductos",
});
PromocionProducto.belongsTo(Promocion, { foreignKey: "promocion_id" });
Producto.hasMany(PromocionProducto, {
  foreignKey: "producto_id",
  as: "productoPromociones",
});
PromocionProducto.belongsTo(Producto, { foreignKey: "producto_id" });

// UsoPromocion associations
Promocion.hasMany(UsoPromocion, { foreignKey: "promocion_id", as: "usos" });
UsoPromocion.belongsTo(Promocion, { foreignKey: "promocion_id" });
Usuario.hasMany(UsoPromocion, {
  foreignKey: "usuario_id",
  as: "usosPromociones",
});
UsoPromocion.belongsTo(Usuario, { foreignKey: "usuario_id" });
Canje.hasMany(UsoPromocion, {
  foreignKey: "canje_id",
  as: "promocionesAplicadas",
});
UsoPromocion.belongsTo(Canje, { foreignKey: "canje_id" });
Producto.hasMany(UsoPromocion, {
  foreignKey: "producto_id",
  as: "promocionesUsadas",
});
UsoPromocion.belongsTo(Producto, { foreignKey: "producto_id" });

// DiscordUserLink associations
Usuario.hasMany(DiscordUserLink, {
  foreignKey: "tienda_user_id",
  as: "discordLinks",
});
DiscordUserLink.belongsTo(Usuario, {
  foreignKey: "tienda_user_id",
  as: "usuario",
});

// UserWatchtime associations
Usuario.hasOne(UserWatchtime, { foreignKey: "usuario_id", as: "watchtime" });
UserWatchtime.belongsTo(Usuario, { foreignKey: "usuario_id" });

// Export sequelize and all models
export {
  sequelize,
  Usuario,
  Rol,
  Permiso,
  Producto,
  Canje,
  RolPermiso,
  HistorialPunto,
  KickEventSubscription,
  KickWebhookEvent,
  KickPointsConfig,
  KickChatCooldown,
  KickUserTracking,
  KickBroadcasterToken,
  KickBotToken,
  KickBotCommand,
  RefreshToken,
  BotrixMigrationConfig,
  LeaderboardSnapshot,
  Promocion,
  PromocionProducto,
  UsoPromocion,
  KickReward,
  DiscordUserLink,
  Notificacion,
  UserWatchtime,
};

// Default export for compatibility with `import models from "../models"`
export default {
  sequelize,
  Usuario,
  Rol,
  Permiso,
  Producto,
  Canje,
  RolPermiso,
  HistorialPunto,
  KickEventSubscription,
  KickWebhookEvent,
  KickPointsConfig,
  KickChatCooldown,
  KickUserTracking,
  KickBroadcasterToken,
  KickBotToken,
  KickBotCommand,
  RefreshToken,
  BotrixMigrationConfig,
  LeaderboardSnapshot,
  Promocion,
  PromocionProducto,
  UsoPromocion,
  KickReward,
  DiscordUserLink,
  Notificacion,
  UserWatchtime,
};
