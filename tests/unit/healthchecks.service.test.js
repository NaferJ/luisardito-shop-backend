const axios = require("axios");

jest.mock("axios");

jest.mock("../../src/utils/logger", () => ({
  warn: jest.fn(),
}));

const {
  pingHealthcheck,
  HEALTHCHECK_TIMEOUT_MS,
} = require("../../src/services/healthchecks.service");
const logger = require("../../src/utils/logger");

const PING_URL = "https://hc-ping.com/test-check-uuid";

describe("healthchecks.service pingHealthcheck", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ status: 200 });
  });

  test("success ping performs a GET with a 5-second timeout", async () => {
    await expect(pingHealthcheck(PING_URL)).resolves.toBeUndefined();

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(PING_URL, {
      timeout: HEALTHCHECK_TIMEOUT_MS,
    });
    expect(HEALTHCHECK_TIMEOUT_MS).toBe(5000);
  });

  test("failure ping performs a GET against the /fail endpoint", async () => {
    await expect(pingHealthcheck(PING_URL, true)).resolves.toBeUndefined();

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(`${PING_URL}/fail`, {
      timeout: HEALTHCHECK_TIMEOUT_MS,
    });
  });

  test("unset URL is a no-op", async () => {
    await expect(pingHealthcheck(undefined)).resolves.toBeUndefined();

    expect(axios.get).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("timeout rejection is caught and never thrown", async () => {
    const timeoutError = new Error("timeout of 5000ms exceeded");
    timeoutError.code = "ECONNABORTED";
    axios.get.mockRejectedValue(timeoutError);

    await expect(pingHealthcheck(PING_URL)).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      "[Healthchecks] Ping failed (code=ECONNABORTED)"
    );
  });
});
