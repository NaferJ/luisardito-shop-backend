#!/usr/bin/env node

/**
 * Re-authorize the Kick bot when the refresh token expires.
 *
 * Requires `npm run build` first (loads compiled output from dist/).
 * Usage: node scripts/reauth-bot.js <authorization_code> <username>
 */

const kickBotService = require("./dist/src/services/kickBot.service");

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(
      "Usage: node scripts/reauth-bot.js <authorization_code> <username>"
    );
    console.log("");
    console.log("Steps to re-authorize:");
    console.log("1. Go to the authorization URL:");
    console.log(kickBotService.generateAuthUrl());
    console.log("");
    console.log(
      "2. Authorize the application and copy the code from the redirect URL"
    );
    console.log("3. Run: node scripts/reauth-bot.js <code> <username>");
    process.exit(1);
  }

  const [code, username] = args;

  try {
    console.log(`Re-authorizing bot for user: ${username}`);
    const tokens = await kickBotService.exchangeCodeForTokens(code, username);
    console.log("Re-authorization successful!");
    console.log(`   User: ${tokens.kick_username}`);
    console.log(`   Expires: ${tokens.token_expires_at}`);
    console.log(
      "The bot will now refresh tokens automatically every 15 minutes."
    );
  } catch (error) {
    console.error("Error during re-authorization:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
