import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

type CommandType = "simple" | "dynamic";
type PermissionLevel = "viewer" | "vip" | "moderator" | "broadcaster";

class KickBotCommand extends Model<
  InferAttributes<KickBotCommand>,
  InferCreationAttributes<KickBotCommand>
> {
  declare id: CreationOptional<number>;
  declare command: string;
  declare aliases: CreationOptional<string[]>;
  declare response_message: string;
  declare description: string | null;
  declare command_type: CreationOptional<CommandType>;
  declare dynamic_handler: string | null;
  declare enabled: CreationOptional<boolean>;
  declare requires_permission: CreationOptional<boolean>;
  declare permission_level: CreationOptional<PermissionLevel | null>;
  declare cooldown_seconds: CreationOptional<number>;
  declare usage_count: CreationOptional<number>;
  declare last_used_at: Date | null;
  declare auto_send_interval_seconds: CreationOptional<number>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  // Instance methods
  async incrementUsage(): Promise<void> {
    this.usage_count += 1;
    this.last_used_at = new Date();
    await this.save();
  }

  matchesCommand(commandText: string): boolean {
    const cleanCommand = commandText
      .toLowerCase()
      .replace(/^!/, "")
      .split(/\s+/)[0];

    if (this.command.toLowerCase() === cleanCommand) {
      return true;
    }

    const aliases = this.aliases || [];
    return aliases.some(
      (alias: string) => alias.toLowerCase() === cleanCommand
    );
  }

  // Static methods
  static async findByCommand(
    commandText: string
  ): Promise<KickBotCommand | undefined> {
    const cleanCommand = commandText
      .toLowerCase()
      .replace(/^!/, "")
      .split(/\s+/)[0];

    const commands = await this.findAll({
      where: {
        enabled: true,
      },
    });

    return commands.find((cmd: KickBotCommand) =>
      cmd.matchesCommand(cleanCommand)
    );
  }
}

KickBotCommand.init(
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
      comment: "Command name without the ! symbol (e.g: tienda, puntos)",
    },
    aliases: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'Array of command aliases (e.g: ["shop"] for tienda)',
      get() {
        const rawValue = this.getDataValue("aliases");
        if (!rawValue) return [];
        if (typeof rawValue === "string") {
          try {
            return JSON.parse(rawValue);
          } catch {
            return [];
          }
        }
        return Array.isArray(rawValue) ? rawValue : [];
      },
      set(value: string[]) {
        this.setDataValue("aliases", Array.isArray(value) ? value : []);
      },
    },
    response_message: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment:
        "Response message. Supports variables: {username}, {channel}, {args}, {target_user}, {points}",
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Command description for the administrator",
    },
    command_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "simple",
      comment: "simple: static response, dynamic: specially programmed logic",
      validate: {
        isIn: [["simple", "dynamic"]],
      },
    },
    dynamic_handler: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment:
        "Special handler name for dynamic commands (e.g: puntos_handler, tienda_handler)",
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether the command is enabled (false = draft/disabled)",
    },
    requires_permission: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment:
        "Whether it requires special permissions (moderator, admin, etc)",
    },
    permission_level: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "viewer",
      comment: "Permission level required to use the command",
      validate: {
        isIn: [["viewer", "vip", "moderator", "broadcaster"]],
      },
    },
    cooldown_seconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Cooldown in seconds for this command (0 = no cooldown)",
    },
    usage_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Counter of how many times the command has been used",
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Last time the command was used",
    },
    auto_send_interval_seconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment:
        "Interval in seconds for automatic sending (0 = do not send automatically)",
    },
    created_at: {
      type: DataTypes.DATE,
    },
    updated_at: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "kick_bot_commands",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export = KickBotCommand;
