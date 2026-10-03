const logger = require("../../src/utils/logger");

describe("logger", () => {
  let errorSpy;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => errorSpy.mockRestore());

  test("strips request config (Authorization, client_secret) from axios errors", () => {
    const axiosError = Object.assign(new Error("Request failed"), {
      isAxiosError: true,
      code: "ERR_BAD_REQUEST",
      config: {
        method: "post",
        url: "https://id.kick.com/oauth/token",
        headers: { Authorization: "Bearer super-secret-token" },
        data: "client_secret=super-secret-value",
      },
      response: { status: 400, data: { error: "invalid_grant" } },
    });

    logger.error("[Test] Failed:", axiosError);

    const [label, logged] = errorSpy.mock.calls[0];
    expect(label).toBe("[Test] Failed:");
    expect(logged).toEqual({
      message: "Request failed",
      code: "ERR_BAD_REQUEST",
      method: "post",
      url: "https://id.kick.com/oauth/token",
      status: 400,
    });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("super-secret");
  });

  test("strips response bodies that echo credentials from axios errors", () => {
    const axiosError = Object.assign(new Error("Request failed"), {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          error: "invalid_client",
          echoed_request: "client_secret=super-secret-value",
        },
      },
    });

    logger.error("[Test] Failed:", axiosError);

    const [, logged] = errorSpy.mock.calls[0];
    expect(logged).toEqual({
      message: "Request failed",
      code: undefined,
      method: undefined,
      url: undefined,
      status: 400,
    });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("super-secret");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("invalid_client");
  });

  test("passes non-axios values through unchanged", () => {
    const plain = new Error("boom");
    logger.error("msg", plain, { a: 1 }, 42);

    expect(errorSpy).toHaveBeenCalledWith("msg", plain, { a: 1 }, 42);
  });
});
