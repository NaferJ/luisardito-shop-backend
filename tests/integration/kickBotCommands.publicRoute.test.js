const request = require("supertest");
const app = require("../../app");
const { KickBotCommand } = require("../../src/models");

// Regression: kickBotCommandsRoutes must mount before kickAdminRoutes in app.ts.
// kickAdminRoutes has a blanket router.use(authRequired) that would otherwise
// 401 every /api/kick-admin/bot-commands/* request, including /public.
describe("GET /api/kick-admin/bot-commands/public - mount order regression", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("returns 200 without authentication", async () => {
    const rows = [{ id: 1, command: "test" }];
    jest
      .spyOn(KickBotCommand, "findAndCountAll")
      .mockResolvedValue({ count: 1, rows });

    const res = await request(app).get(
      "/api/kick-admin/bot-commands/public?enabled=true&limit=100"
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      data: rows,
      pagination: { total: 1, page: 1, limit: 100, totalPages: 1 },
    });
  });

  test("other bot-commands routes still require auth -> 401 TOKEN_MISSING", async () => {
    const res = await request(app).get("/api/kick-admin/bot-commands");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("TOKEN_MISSING");
  });

  test("kick-admin routes still require auth -> 401 TOKEN_MISSING", async () => {
    const res = await request(app).get("/api/kick-admin/config");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("TOKEN_MISSING");
  });
});
