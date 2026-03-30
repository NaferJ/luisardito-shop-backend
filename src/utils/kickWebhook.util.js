const crypto = require('node:crypto');
const logger = require('./logger');

// Clave pública de Kick para verificar firmas (cargada desde variable de entorno)
// En .env se almacena en una sola línea con \n literales como separador
const KICK_PUBLIC_KEY = process.env.KICK_WEBHOOK_PUBLIC_KEY
    ? process.env.KICK_WEBHOOK_PUBLIC_KEY.replace(/\\n/g, '\n')
    : null;

/**
 * Verifica la firma de un webhook de Kick
 * @param {string} messageId - Kick-Event-Message-Id header
 * @param {string} timestamp - Kick-Event-Message-Timestamp header
 * @param {string} body - Cuerpo sin procesar de la solicitud
 * @param {string} signatureBase64 - Kick-Event-Signature header (codificado en Base64)
 * @returns {boolean} - true si la firma es válida, false en caso contrario
 */
function verifyWebhookSignature(messageId, timestamp, body, signatureBase64) {
    try {
        if (!KICK_PUBLIC_KEY) {
            logger.error('[Kick Webhook] KICK_WEBHOOK_PUBLIC_KEY no configurada');
            return false;
        }

        // Crear la cadena de firma concatenando: messageId.timestamp.body
        const signatureString = `${messageId}.${timestamp}.${body}`;

        // Decodificar la firma de Base64
        const signature = Buffer.from(signatureBase64, 'base64');

        // Verificar la firma RSA-SHA256 con PKCS1v15
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(signatureString);

        return verifier.verify(KICK_PUBLIC_KEY, signature);
    } catch (error) {
        logger.error('[Kick Webhook] Error verificando firma:', error.message);
        return false;
    }
}

module.exports = {
    verifyWebhookSignature,
    KICK_PUBLIC_KEY
};
