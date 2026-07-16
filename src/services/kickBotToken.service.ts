/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import KickBotToken from "../models/kickBotToken.model";

class KickBotTokenService {
  static async getBotToken() {
    return await KickBotToken.findOne({
      where: { is_active: true },
      order: [["created_at", "DESC"]],
    });
  }

  static async saveBotToken(tokenData: any) {
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
      } as any
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
