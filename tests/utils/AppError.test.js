const AppError = require("../../src/utils/AppError");

describe("AppError", () => {
  test("sets statusCode, details, isOperational, name and extends Error", () => {
    const err = new AppError("msg", 400, { field: "x" });
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ field: "x" });
    expect(err.isOperational).toBe(true);
    expect(err.name).toBe("AppError");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("msg");
  });
});
