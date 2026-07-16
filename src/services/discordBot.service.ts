import {
  Client,
  GatewayIntentBits,
  type Message,
  type TextChannel,
} from "discord.js";
import config from "../../config";
import logger from "../utils/logger";
import KickBotCommandHandlerService from "./kickBotCommandHandler.service";

interface EmbedContent {
  embeds?: unknown[];
  data?: unknown;
  [key: string]: unknown;
}

interface SendMessageResult {
  ok: boolean;
  error?: string;
}

/**
 * Discord bot service
 * Uses the same command logic as the Kick bot
 */
class DiscordBotService {
  client: Client | null = null;
  commandHandler: typeof KickBotCommandHandlerService =
    KickBotCommandHandlerService;
  isReady: boolean = false;

  /**
   * Initialize and connect the Discord bot
   */
  async initialize(): Promise<boolean> {
    try {
      logger.info("[Discord Bot] Initializing Discord bot...");

      // Check configuration
      if (!config.discord?.botToken) {
        logger.warn(
          "[Discord Bot] DISCORD_BOT_TOKEN not configured, bot disabled"
        );
        return false;
      }

      // Create Discord client
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
        ],
      });

      // Event: Bot ready
      this.client.once("ready", () => {
        if (this.client?.user) {
          logger.info(`[Discord Bot] Bot connected as ${this.client.user.tag}`);
        }
        this.isReady = true;
      });

      // Event: Message received
      this.client.on("messageCreate", async (message: Message) => {
        await this.handleMessage(message);
      });

      // Event: Error
      this.client.on("error", (error: Error) => {
        logger.error("[Discord Bot] Error:", error);
      });

      // Connect the bot
      await this.client.login(config.discord.botToken);
      logger.info("[Discord Bot] Bot initialized successfully");

      return true;
    } catch (error: unknown) {
      logger.error("[Discord Bot] Error initializing bot:", error);
      return false;
    }
  }

  /**
   * Handle Discord chat messages
   */
  async handleMessage(message: Message): Promise<void> {
    try {
      // Ignore messages from the bot itself
      if (message.author.bot) return;

      // Only process in the configured guild (if specified)
      if (
        config.discord?.guildId &&
        message.guild?.id !== config.discord.guildId
      ) {
        return;
      }

      const content = message.content.trim();
      const username = message.author.username;
      const channelName = message.guild?.name || "Discord";

      logger.info(`[Discord Bot] Message from ${username}: ${content}`);

      // Process commands (same system as Kick)
      if (content.startsWith("!")) {
        const commandProcessed = await this.commandHandler.processMessage(
          content,
          username,
          channelName,
          this, // Pass this as bot service
          {
            messageContext: message, // Pass the message as context
            platform: "discord", // Indicate it comes from Discord
            discordUserId: message.author.id, // Pass the Discord user ID
          }
        );

        if (commandProcessed) {
          logger.info(`[Discord Bot] Command processed for ${username}`);
        }
      }
    } catch (error: unknown) {
      logger.error("[Discord Bot] Error handling message:", error);
    }
  }

  /**
   * Send message to the current channel
   * @param content - Message content (string or embed object)
   * @param message - Discord message object (optional)
   */
  async sendMessage(
    content: string | EmbedContent,
    message: Message | null = null
  ): Promise<SendMessageResult> {
    try {
      if (!this.isReady) {
        logger.warn("[Discord Bot] Bot is not ready to send messages");
        return { ok: false, error: "Bot not ready" };
      }

      // If we have a context message, reply in that channel
      if (message) {
        if (typeof content === "string") {
          await message.reply(content);
        } else if (content && typeof content === "object") {
          // Check if it is an object with embeds (multiple embeds)
          if (content.embeds) {
            await message.reply({ embeds: content.embeds as never[] });
          }
          // Check if it is an individual embed (backwards compatibility)
          else if (content.data) {
            await message.reply({ embeds: [content as never] });
          } else {
            await message.reply(String(content));
          }
        } else {
          await message.reply(String(content));
        }
        logger.info(`[Discord Bot] Message sent as reply`);
        return { ok: true };
      }

      // If no context, look for a default channel
      // This requires more configuration, for now just reply
      logger.warn("[Discord Bot] No message context to send reply");
      return { ok: false, error: "No message context" };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[Discord Bot] Error sending message:", error);
      return { ok: false, error: msg };
    }
  }

  /**
   * Send message to a specific channel
   * @param channelId - Channel ID
   * @param content - Message content (string or embed object)
   */
  async sendMessageToChannel(
    channelId: string,
    content: string | EmbedContent
  ): Promise<SendMessageResult> {
    try {
      if (!this.isReady || !this.client) {
        return { ok: false, error: "Bot not ready" };
      }

      const channel = await this.client.channels.fetch(channelId);
      if (channel?.isTextBased()) {
        const textChannel = channel as TextChannel;
        if (typeof content === "string") {
          await textChannel.send(content);
        } else if (content && typeof content === "object") {
          // Check if it is an object with embeds (multiple embeds)
          if ((content as EmbedContent).embeds) {
            await textChannel.send({
              embeds: (content as EmbedContent).embeds as never[],
            });
          }
          // Check if it is an individual embed (backwards compatibility)
          else if ((content as EmbedContent).data) {
            await textChannel.send({ embeds: [content as never] });
          } else {
            await textChannel.send(String(content));
          }
        } else {
          await textChannel.send(String(content));
        }
        logger.info(`[Discord Bot] Message sent to channel ${channelId}`);
        return { ok: true };
      } else {
        return { ok: false, error: "Invalid channel" };
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[Discord Bot] Error sending message to channel:", error);
      return { ok: false, error: msg };
    }
  }

  /**
   * Disconnect the bot
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.isReady = false;
      logger.info("[Discord Bot] Bot disconnected");
    }
  }

  /**
   * Check if the bot is ready
   */
  isBotReady(): boolean {
    return this.isReady;
  }
}

// Export the singleton instance (compatible with require() in app.js)
const instance = new DiscordBotService();
export = instance;
