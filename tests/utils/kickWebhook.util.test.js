const { verifyWebhookSignature } = require("../../src/utils/kickWebhook.util");

describe("verifyWebhookSignature", () => {
  const originalKey = process.env.KICK_WEBHOOK_PUBLIC_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    } else {
      process.env.KICK_WEBHOOK_PUBLIC_KEY = originalKey;
    }
    jest.resetModules();
  });

  test("returns false when KICK_WEBHOOK_PUBLIC_KEY is unset", () => {
    delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    const result = verifyWebhookSignature(
      "msg-id",
      "123",
      "body",
      "bogus-signature"
    );
    expect(result).toBe(false);
  });

  test("returns false (does not throw) with a bogus signature", () => {
    process.env.KICK_WEBHOOK_PUBLIC_KEY = "not-a-real-key";
    const fn = () =>
      verifyWebhookSignature("msg-id", "123", "body", "bogus-signature");
    expect(fn).not.toThrow();
    expect(fn()).toBe(false);
  });

  describe("with a real RSA key pair", () => {
    const crypto = require("node:crypto");
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const messageId = "01M3ZGCH53PSF54BQGYXZB67NR";
    const timestamp = "2026-10-02T23:30:00Z";
    const rawBody = Buffer.from(
      '{"content":"te quiero \\u003c3 \\u0026 saludos","sender":{"username":"NaferJ"}}'
    );
    const sign = (body) =>
      crypto
        .createSign("RSA-SHA256")
        .update(
          Buffer.concat([Buffer.from(`${messageId}.${timestamp}.`), body])
        )
        .sign(privateKey, "base64");

    function loadVerifier() {
      let fn;
      process.env.KICK_WEBHOOK_PUBLIC_KEY = publicKey.replace(/\n/g, "\\n");
      jest.isolateModules(() => {
        fn = require("../../src/utils/kickWebhook.util").verifyWebhookSignature;
      });
      return fn;
    }

    test("accepts the exact raw body bytes Kick signed", () => {
      const verify = loadVerifier();
      expect(verify(messageId, timestamp, rawBody, sign(rawBody))).toBe(true);
    });

    test("accepts the raw body passed as a string", () => {
      const verify = loadVerifier();
      expect(
        verify(messageId, timestamp, rawBody.toString("utf8"), sign(rawBody))
      ).toBe(true);
    });

    test("rejects a re-serialized body (JSON.stringify drops Go escapes)", () => {
      const verify = loadVerifier();
      const reserialized = JSON.stringify(JSON.parse(rawBody.toString()));
      expect(reserialized).not.toBe(rawBody.toString());
      expect(verify(messageId, timestamp, reserialized, sign(rawBody))).toBe(
        false
      );
    });

    test("rejects a tampered body", () => {
      const verify = loadVerifier();
      const tampered = Buffer.from(rawBody.toString().replace("NaferJ", "x"));
      expect(verify(messageId, timestamp, tampered, sign(rawBody))).toBe(false);
    });
  });
});
