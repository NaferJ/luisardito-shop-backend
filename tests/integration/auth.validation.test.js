const request = require("supertest");
const app = require("../../app");

describe("Auth validation integration", () => {
  test("POST /api/auth/login with empty body -> 400 (not 500)", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  test("POST /api/auth/login with missing password -> 400", async () => {
    const res = await request(app).post("/api/auth/login").send({
      nickname: "x",
    });
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  test("POST /api/auth/refresh with empty body -> 400", async () => {
    const res = await request(app).post("/api/auth/refresh").send({});
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  test("POST /api/auth/logout with empty body -> 400", async () => {
    const res = await request(app).post("/api/auth/logout").send({});
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.length).toBeGreaterThan(0);
  });
});
