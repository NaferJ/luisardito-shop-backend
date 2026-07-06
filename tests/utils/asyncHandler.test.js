const asyncHandler = require("../../src/utils/asyncHandler");

describe("asyncHandler", () => {
  test("calls next with the error when the wrapped async fn rejects", async () => {
    const boom = new Error("boom");
    const fn = async () => {
      throw boom;
    };
    const next = jest.fn();
    const handler = asyncHandler(fn);
    await handler({}, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(boom);
  });

  test("does not call next when the wrapped async fn resolves", async () => {
    const fn = async () => "ok";
    const next = jest.fn();
    const handler = asyncHandler(fn);
    await handler({}, {}, next);
    expect(next).not.toHaveBeenCalled();
  });
});
