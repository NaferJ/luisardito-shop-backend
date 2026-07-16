import crypto from "node:crypto";
import logger from "./logger";

// Kick public key for verifying signatures (loaded from environment variable)
// In .env it is stored in a single line with literal \n as separator
const KICK_PUBLIC_KEY = process.env.KICK_WEBHOOK_PUBLIC_KEY
  ? process.env.KICK_WEBHOOK_PUBLIC_KEY.replace(/\\n/g, "\n")
  : null;

/**
 * Verifies a Kick webhook signature
 * @param messageId - Kick-Event-Message-Id header
 * @param timestamp - Kick-Event-Message-Timestamp header
 * @param body - Raw body of the request
 * @param signatureBase64 - Kick-Event-Signature header (Base64 encoded)
 * @returns true if the signature is valid, false otherwise
 */
function verifyWebhookSignature(
  messageId: string,
  timestamp: string,
  body: string,
  signatureBase64: string
): boolean {
  try {
    if (!KICK_PUBLIC_KEY) {
      logger.error("[Kick Webhook] KICK_WEBHOOK_PUBLIC_KEY not configured");
      return false;
    }

    // Create the signature string by concatenating: messageId.timestamp.body
    const signatureString = `${messageId}.${timestamp}.${body}`;

    // Decode the signature from Base64
    const signature = Buffer.from(signatureBase64, "base64");

    // Verify the RSA-SHA256 signature with PKCS1v15
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(signatureString);

    return verifier.verify(KICK_PUBLIC_KEY, signature);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[Kick Webhook] Error verifying signature:", msg);
    return false;
  }
}

export { verifyWebhookSignature, KICK_PUBLIC_KEY };
