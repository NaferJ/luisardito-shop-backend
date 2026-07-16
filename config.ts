import dotenv from "dotenv";
import fs from "node:fs";

dotenv.config();

if (fs.existsSync(".env.development")) {
  dotenv.config({ path: ".env.development", override: true });
}

const toBool = (val: string | undefined, def = false): boolean => {
  if (val === undefined) return def;
  return /^(1|true|yes|on)$/i.test(String(val).trim());
};

interface DbConfig {
  host: string | undefined;
  port: number;
  user: string | undefined;
  password: string | undefined;
  database: string | undefined;
  ssl: boolean;
  sslRejectUnauthorized: boolean;
}

interface KickConfig {
  clientId: string | undefined;
  clientSecret: string | undefined;
  redirectUri: string | undefined;
  broadcasterId: string | undefined;
  apiBaseUrl: string;
  oauthAuthorize: string;
  oauthToken: string;
  oauthRevoke: string;
}

interface KickBotConfig {
  clientId: string | undefined;
  clientSecret: string | undefined;
  redirectUri: string | undefined;
  accessToken: string | undefined;
  username: string | undefined;
}

interface CloudinaryConfig {
  cloudName: string | undefined;
  apiKey: string | undefined;
  apiSecret: string | undefined;
}

interface CookiesConfig {
  domain: string | undefined;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
}

interface DiscordConfig {
  botToken: string | undefined;
  clientId: string | undefined;
  clientSecret: string | undefined;
  guildId: string | undefined;
  oauthAuthorize: string;
  oauthToken: string;
  oauthRevoke: string;
  apiBaseUrl: string;
  redirectUri: string;
}

interface AppConfig {
  db: DbConfig;
  jwtSecret: string | undefined;
  kick: KickConfig;
  kickBot: KickBotConfig;
  cloudinary: CloudinaryConfig;
  cookies: CookiesConfig;
  frontendUrl: string | undefined;
  port: number;
  discord: DiscordConfig;
}

const config: AppConfig = {
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: toBool(process.env.DB_SSL, false),
    sslRejectUnauthorized: toBool(
      process.env.DB_SSL_REJECT_UNAUTHORIZED,
      false
    ),
  },
  jwtSecret: process.env.JWT_SECRET,
  kick: {
    clientId: process.env.KICK_CLIENT_ID,
    clientSecret: process.env.KICK_CLIENT_SECRET,
    redirectUri: process.env.KICK_REDIRECT_URI,
    broadcasterId: process.env.KICK_BROADCASTER_ID, // Luisardito's broadcaster ID
    // API base (different host from OAuth). Adjust per the public API docs.
    apiBaseUrl: process.env.KICK_API_BASE_URL || "https://api.kick.com",
    // Allow environment override if needed
    oauthAuthorize:
      process.env.KICK_OAUTH_AUTHORIZE_URL ||
      "https://id.kick.com/oauth/authorize",
    oauthToken:
      process.env.KICK_OAUTH_TOKEN_URL || "https://id.kick.com/oauth/token",
    oauthRevoke:
      process.env.KICK_OAUTH_REVOKE_URL || "https://id.kick.com/oauth/revoke",
  },
  // Chat bot configuration (separate application)
  kickBot: {
    clientId: process.env.KICK_BOT_CLIENT_ID,
    clientSecret: process.env.KICK_BOT_CLIENT_SECRET,
    redirectUri: process.env.KICK_BOT_REDIRECT_URI,
    // To simplify sending messages, a bot access token (user token) is used
    accessToken: process.env.KICK_BOT_ACCESS_TOKEN,
    // Optional: bot username for logs/diagnostics
    username: process.env.KICK_BOT_USERNAME,
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  cookies: {
    domain:
      process.env.COOKIE_DOMAIN ||
      (process.env.NODE_ENV === "production" ? ".luisardito.com" : undefined),
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
  frontendUrl: process.env.FRONTEND_URL,
  port: Number(process.env.PORT || 3000),
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    guildId: process.env.DISCORD_GUILD_ID,
    // Discord OAuth URLs
    oauthAuthorize: "https://discord.com/api/oauth2/authorize",
    oauthToken: "https://discord.com/api/oauth2/token",
    oauthRevoke: "https://discord.com/api/oauth2/token/revoke",
    apiBaseUrl: "https://discord.com/api",
    redirectUri:
      process.env.DISCORD_REDIRECT_URI ||
      "https://api.luisardito.com/api/auth/discord/callback",
  },
};

export = config;
