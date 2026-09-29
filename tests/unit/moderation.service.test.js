jest.mock("axios", () => ({ post: jest.fn() }));

// The config module is mocked so each test can toggle the API key freely.
jest.mock("../../config", () => ({
  openai: { apiKey: null },
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const axios = require("axios");
const config = require("../../config");
const logger = require("../../src/utils/logger");
const ModerationService = require("../../src/services/moderation.service");

describe("moderation.service scanContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.openai.apiKey = "test-key";
  });

  test("no API key -> not flagged, no HTTP call", async () => {
    config.openai.apiKey = undefined;

    const result = await ModerationService.scanContent({ text: "hello" });

    expect(result).toEqual({ flagged: false, categories: [] });
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("flagged result -> flagged with the union of true categories", async () => {
    axios.post.mockResolvedValue({
      data: {
        results: [
          { flagged: true, categories: { hate: true, spam: false } },
          { flagged: false, categories: { sexual: true, hate: true } },
        ],
      },
    });

    const result = await ModerationService.scanContent({ text: "bad" });

    expect(result.flagged).toBe(true);
    expect(result.categories.sort()).toEqual(["hate", "sexual"]);
  });

  test("no result flagged -> not flagged even if categories are true", async () => {
    axios.post.mockResolvedValue({
      data: {
        results: [{ flagged: false, categories: { spam: true } }],
      },
    });

    const result = await ModerationService.scanContent({ text: "ok" });

    expect(result.flagged).toBe(false);
    expect(result.categories).toEqual(["spam"]);
  });

  test("sends model, auth header, timeout and text input", async () => {
    axios.post.mockResolvedValue({ data: { results: [] } });

    await ModerationService.scanContent({ text: "a body" });

    expect(axios.post).toHaveBeenCalledWith(
      "https://api.openai.com/v1/moderations",
      {
        model: "omni-moderation-latest",
        input: [{ type: "text", text: "a body" }],
      },
      {
        headers: { Authorization: "Bearer test-key" },
        timeout: 5000,
      }
    );
  });

  test("image media is sent as image_url; video uses its thumbnail only", async () => {
    axios.post.mockResolvedValue({ data: { results: [] } });

    await ModerationService.scanContent({
      text: "post",
      media: [
        { type: "image", url: "https://res.cloudinary.com/img.png" },
        {
          type: "video",
          url: "https://res.cloudinary.com/vid.mp4",
          thumbnail_url: "https://res.cloudinary.com/thumb.png",
        },
        // Video without thumbnail is skipped entirely.
        { type: "video", url: "https://res.cloudinary.com/vid2.mp4" },
      ],
    });

    const [, body] = axios.post.mock.calls[0];
    expect(body.input).toEqual([
      { type: "text", text: "post" },
      {
        type: "image_url",
        image_url: { url: "https://res.cloudinary.com/img.png" },
      },
      {
        type: "image_url",
        image_url: { url: "https://res.cloudinary.com/thumb.png" },
      },
    ]);
  });

  test("axios failure fails open -> not flagged and logs a warning", async () => {
    axios.post.mockRejectedValue(new Error("network down"));

    const result = await ModerationService.scanContent({ text: "x" });

    expect(result).toEqual({ flagged: false, categories: [] });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("[Moderation]")
    );
  });

  test("non-2xx responses also fail open", async () => {
    axios.post.mockRejectedValue({ response: { status: 500 } });

    const result = await ModerationService.scanContent({ text: "x" });

    expect(result.flagged).toBe(false);
  });
});
