const { DataTypes } = require("sequelize");
const { sequelize } = require("./database");

const KickBotCommand = sequelize.define(
  "KickBotCommand",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    command: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "Nombre del comando sin el símbolo ! (ej: tienda, puntos)",
    },
    aliases: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'Array de aliases del comando (ej: ["shop"] para tienda)',
      get() {
        const rawValue = this.getDataValue("aliases");
        if (!rawValue) return [];
        if (typeof rawValue === "string") {
          try {
            return JSON.parse(rawValue);
          } catch (e) {
            return [];
          }
        }
        return Array.isArray(rawValue) ? rawValue : [];
      },
      set(value) {
        this.setDataValue("aliases", Array.isArray(value) ? value : []);
      },
    },
    response_message: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment:
        "Mensaje de respuesta. Soporta variables: {username}, {channel}, {args}, {target_user}, {points}",
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Descripción del comando para el administrador",
    },
    command_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "simple",
      comment:
        "simple: respuesta estática, dynamic: lógica especial programada",
      validate: {
        isIn: [["simple", "dynamic"]],
      },
    },
    dynamic_handler: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment:
        "Nombre del handler especial para comandos dynamic (ej: puntos_handler, tienda_handler)",
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Si el comando está habilitado (false = borrador/deshabilitado)",
    },
    requires_permission: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Si requiere permisos especiales (moderador, admin, etc)",
    },
    permission_level: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "viewer",
      comment: "Nivel de permiso requerido para usar el comando",
      validate: {
        isIn: [["viewer", "vip", "moderator", "broadcaster"]],
      },
    },
    cooldown_seconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Cooldown en segundos para este comando (0 = sin cooldown)",
    },
    usage_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Contador de veces que se ha usado el comando",
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Última vez que se usó el comando",
    },
    auto_send_interval_seconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Intervalo en segundos para envío automático (0 = no enviar automáticamente)",
    },
  },
  {
    tableName: "kick_bot_commands",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

// Métodos de instancia
KickBotCommand.prototype.incrementUsage = async function () {
  this.usage_count += 1;
  this.last_used_at = new Date();
  await this.save();
};

KickBotCommand.prototype.matchesCommand = function (commandText) {
  const cleanCommand = commandText
    .toLowerCase()
    .replace(/^!/, "")
    .split(/\s+/)[0];

  if (this.command.toLowerCase() === cleanCommand) {
    return true;
  }

  const aliases = this.aliases || [];
  return aliases.some((alias) => alias.toLowerCase() === cleanCommand);
};

// Métodos estáticos
KickBotCommand.findByCommand = async function (commandText) {
  const cleanCommand = commandText
    .toLowerCase()
    .replace(/^!/, "")
    .split(/\s+/)[0];

  const commands = await this.findAll({
    where: {
      enabled: true,
    },
  });

  return commands.find((cmd) => cmd.matchesCommand(cleanCommand));
};

module.exports = KickBotCommand;
