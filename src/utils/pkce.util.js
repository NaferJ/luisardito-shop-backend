const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generatePkce() {
  const code_verifier = base64url(crypto.randomBytes(32));
  const challenge = crypto.createHash('sha256').update(code_verifier).digest();
  const code_challenge = base64url(challenge);
  // Debug PKCE
  console.log('[PKCE][generatePkce] code_verifier generado:', code_verifier);
  console.log('[PKCE][generatePkce] code_challenge generado:', code_challenge);
  return { code_verifier, code_challenge };
}

module.exports = { base64url, generatePkce };
