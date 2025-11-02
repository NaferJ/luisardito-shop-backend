const crypto = require('crypto');
const logger = require('./logger');

// Clave pública de Kick para verificar firmas
const KICK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`;

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
        // Crear la cadena de firma concatenando: messageId.timestamp.body
        const signatureString = `${messageId}.${timestamp}.${body}`;

        // Decodificar la firma de Base64
        const signature = Buffer.from(signatureBase64, 'base64');

        // Crear el hash SHA256 de la cadena de firma
        const hash = crypto.createHash('sha256').update(signatureString).digest();

        // Crear el objeto de verificación con la clave pública
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(signatureString);

        // Verificar la firma usando PKCS1v15
        const isValid = verifier.verify(KICK_PUBLIC_KEY, signature);

        return isValid;
    } catch (error) {
        logger.error('[Kick Webhook] Error verificando firma:', error.message);
        return false;
    }
}

module.exports = {
    verifyWebhookSignature,
    KICK_PUBLIC_KEY
};
