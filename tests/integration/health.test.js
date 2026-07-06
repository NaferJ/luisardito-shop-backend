const request = require("supertest");
const app = require("../../app");

describe("Health & routing integration", () => {
  test("GET /health -> 200 { status: 'ok' }", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  test("GET / -> 200 with JSON body containing service and status", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("service");
    expect(res.body).toHaveProperty("status");
  });

  test("GET /this-route-does-not-exist -> 404 { error: 'Not found' }", async () => {
    const res = await request(app).get("/this-route-does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});
