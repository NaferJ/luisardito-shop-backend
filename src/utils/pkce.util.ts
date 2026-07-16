/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import crypto from "crypto";
import logger from "./logger";

function base64url(input: any) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replaceAll("=", "");
}

function generatePkce() {
  const code_verifier = base64url(crypto.randomBytes(32));
  const challenge = crypto.createHash("sha256").update(code_verifier).digest();
  const code_challenge = base64url(challenge);
  // Debug PKCE
  logger.info("[PKCE][generatePkce] code_verifier generated:", code_verifier);
  logger.info("[PKCE][generatePkce] code_challenge generated:", code_challenge);
  return { code_verifier, code_challenge };
}

export { base64url, generatePkce };
