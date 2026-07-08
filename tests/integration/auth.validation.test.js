const request = require("supertest");
const app = require("../../app");

describe("Auth validation integration", () => {
  test.each([
    ["login", {}, "empty body"],
    ["login", { nickname: "x" }, "missing password"],
    ["refresh", {}, "empty body"],
    ["logout", {}, "empty body"],
  ])("POST /api/auth/%s with %s -> 400 (not 500)", async (endpoint, body) => {
    const res = await request(app).post(`/api/auth/${endpoint}`).send(body);
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.length).toBeGreaterThan(0);
  });
});
