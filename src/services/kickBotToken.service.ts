import KickBotToken from "../models/kickBotToken.model";
import type { UpsertOptions } from "sequelize";

interface BotTokenData {
  kick_user_id: string | number;
  kick_username: string | number;
  access_token: string;
  refresh_token?: string | null;
  token_expires_at: Date;
  scopes?: string[];
}

class KickBotTokenService {
  static async getBotToken() {
    return await KickBotToken.findOne({
      where: { is_active: true },
      order: [["created_at", "DESC"]],
    });
  }

  static async saveBotToken(tokenData: BotTokenData) {
    const {
      kick_user_id,
      kick_username,
      access_token,
      refresh_token,
      token_expires_at,
      scopes,
    } = tokenData;

    return await KickBotToken.upsert(
      {
        kick_user_id: String(kick_user_id),
        kick_username: String(kick_username),
        access_token,
        refresh_token: refresh_token || null,
        token_expires_at,
        scopes: scopes || ["chat:write", "channel:read"],
        is_active: true,
      },
      {
        where: { kick_user_id: String(kick_user_id) },
        returning: true,
      } as UpsertOptions
    );
  }

  static async deactivateAllTokens() {
    return await KickBotToken.update(
      { is_active: false },
      { where: { is_active: true } }
    );
  }
}

export default KickBotTokenService;
