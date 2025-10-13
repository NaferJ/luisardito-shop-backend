// Importar sequelize desde el archivo separado
const { sequelize } = require('./database');

// Importar todos los modelos
const Usuario = require('./usuario.model');
const Rol = require('./rol.model');
const Permiso = require('./permiso.model');
const Producto = require('./producto.model');
const Canje = require('./canje.model');
const RolPermiso = require('./rolPermiso.model');
const HistorialPunto = require('./historialPunto.model');
const KickEventSubscription = require('./kickEventSubscription.model');
const KickWebhookEvent = require('./kickWebhookEvent.model');
const KickPointsConfig = require('./kickPointsConfig.model');
const KickChatCooldown = require('./kickChatCooldown.model');
const KickUserTracking = require('./kickUserTracking.model');
const KickBroadcasterToken = require('./kickBroadcasterToken.model');
const RefreshToken = require('./refreshToken.model');

// DEFINIR ASOCIACIONES
// Asociación entre Permiso y RolPermiso (necesaria para el include en el middleware)
Permiso.hasMany(RolPermiso, { foreignKey: 'permiso_id' });
RolPermiso.belongsTo(Permiso, { foreignKey: 'permiso_id' });

// Asociación entre Rol y RolPermiso
Rol.hasMany(RolPermiso, { foreignKey: 'rol_id' });
RolPermiso.belongsTo(Rol, { foreignKey: 'rol_id' });

// Asociaciones many-to-many (opcionales pero útiles)
Rol.belongsToMany(Permiso, {
    through: RolPermiso,
    foreignKey: 'rol_id',
    otherKey: 'permiso_id'
});
Permiso.belongsToMany(Rol, {
    through: RolPermiso,
    foreignKey: 'permiso_id',
    otherKey: 'rol_id'
});

// Asociación entre Usuario y Rol (si no la tienes ya)
Usuario.belongsTo(Rol, { foreignKey: 'rol_id' });
Rol.hasMany(Usuario, { foreignKey: 'rol_id' });

// Asociaciones de Canje
Usuario.hasMany(Canje, { foreignKey: 'usuario_id' });
Canje.belongsTo(Usuario, { foreignKey: 'usuario_id' });
Producto.hasMany(Canje, { foreignKey: 'producto_id' });
Canje.belongsTo(Producto, { foreignKey: 'producto_id' });

// Asociaciones de HistorialPunto
Usuario.hasMany(HistorialPunto, { foreignKey: 'usuario_id' });
HistorialPunto.belongsTo(Usuario, { foreignKey: 'usuario_id' });

// Asociaciones de RefreshToken
Usuario.hasMany(RefreshToken, { foreignKey: 'usuario_id' });
RefreshToken.belongsTo(Usuario, { foreignKey: 'usuario_id' });

// Exportar sequelize y todos los modelos
module.exports = {
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
    RefreshToken
};