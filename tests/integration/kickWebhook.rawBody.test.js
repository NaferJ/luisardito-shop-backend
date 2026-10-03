jest.mock("../../src/utils/kickWebhook.util", () => ({
  verifyWebhookSignature: jest.fn(() => false),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const request = require("supertest");
const { verifyWebhookSignature } = require("../../src/utils/kickWebhook.util");
const app = require("../../app");

describe("Kick webhook raw body capture", () => {
  beforeEach(() => jest.clearAllMocks());

  test("passes the exact received bytes to signature verification", async () => {
    const rawBody =
      '{"content":"hola \\u003c3 \\u0026 \\u003e","emotes":null,"n":1.50}';

    const res = await request(app)
      .post("/api/kick-webhook/events")
      .set("Content-Type", "application/json")
      .set("Kick-Event-Message-Id", "msg-1")
      .set("Kick-Event-Subscription-Id", "sub-1")
      .set("Kick-Event-Signature", "c2ln")
      .set("Kick-Event-Message-Timestamp", "2026-10-02T23:30:00Z")
      .set("Kick-Event-Type", "chat.message.sent")
      .set("Kick-Event-Version", "1")
      .send(rawBody);

    expect(res.status).toBe(401);
    expect(verifyWebhookSignature).toHaveBeenCalledTimes(1);
    const bodyArg = verifyWebhookSignature.mock.calls[0][2];
    expect(Buffer.isBuffer(bodyArg)).toBe(true);
    expect(bodyArg.toString("utf8")).toBe(rawBody);
  });
});
