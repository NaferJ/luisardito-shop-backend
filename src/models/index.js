// Importar sequelize desde el archivo separado
const { sequelize } = require('./database');

// Importar todos los modelos
const Usuario = require('./usuario.model');
const Rol = require('./rol.model');
const Permiso = require('./permiso.model');
const Producto = require('./producto.model');
const Canje = require('./canje.model');
const RolPermiso = require('./rolPermiso.model');

// Exportar sequelize y todos los modelos
module.exports = { 
    sequelize,
    Usuario,
    Rol,
    Permiso,
    Producto,
    Canje,
    RolPermiso
};