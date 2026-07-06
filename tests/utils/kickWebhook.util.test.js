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
});
