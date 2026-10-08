process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const jwt = require("jsonwebtoken");

// View tracking must never hit a real Redis in tests.
jest.mock("../../src/config/redis.config", () => ({
  getRedisClient: jest.fn(() => ({ set: jest.fn().mockResolvedValue("OK") })),
}));

const app = require("../../app");
const {
  CommunityPost,
  CommunityComment,
  CommunityLike,
  CommunityReport,
  Usuario,
  Permiso,
} = require("../../src/models");
const { sequelize } = require("../../src/models/database");
const { UniqueConstraintError } = require("sequelize");
const {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  updateCommentSchema,
  listPostsQuerySchema,
  pinSchema,
  hideSchema,
  reportSchema,
} = require("../../src/schemas/community.schema");

function makePostRow(overrides = {}) {
  return {
    id: 1,
    usuario_id: 9,
    title: "A great post",
    body: "body",
    media: null,
    pinned: false,
    status: "visible",
    view_count: 0,
    like_count: 0,
    comment_count: 0,
    creado: new Date("2026-09-28T10:00:00Z"),
    actualizado: new Date("2026-09-28T10:00:00Z"),
    edited_at: null,
    author: { id: 9, nickname: "author", kick_data: null },
    update: jest.fn(async function (values) {
      Object.assign(this, values);
    }),
    ...overrides,
  };
}

function makeCommentRow(overrides = {}) {
  return {
    id: 7,
    post_id: 1,
    parent_id: null,
    usuario_id: 9,
    body: "nice",
    status: "visible",
    pinned: false,
    hidden_by: null,
    hidden_at: null,
    hidden_reason: null,
    creado: new Date("2026-09-28T11:00:00Z"),
    actualizado: new Date("2026-09-28T11:00:00Z"),
    edited_at: null,
    author: { id: 9, nickname: "author", kick_data: null },
    update: jest.fn(async function (values) {
      Object.assign(this, values);
    }),
    ...overrides,
  };
}

function authToken(userId = 2) {
  return jwt.sign({ userId }, process.env.JWT_SECRET);
}

describe("community routes", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("GET /api/community/posts", () => {
    test("returns the feed without authentication", async () => {
      jest.spyOn(CommunityPost, "count").mockResolvedValue(1);
      jest.spyOn(CommunityPost, "findAll").mockResolvedValue([makePostRow()]);
      jest.spyOn(CommunityComment, "findAll").mockResolvedValue([]);

      const res = await request(app).get("/api/community/posts?sort=new");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        total: 1,
        page: 1,
        limit: 20,
        pages: 1,
      });
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.posts[0].author).toEqual({
        id: 9,
        nickname: "author",
        avatar: null,
      });
      expect(res.body.posts[0].viewer_liked).toBe(false);
      expect(res.body.posts[0].top_comment).toBeNull();
    });

    test("invalid sort -> 400", async () => {
      const res = await request(app).get("/api/community/posts?sort=bogus");
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/community/posts/:id", () => {
    test("missing post -> 404", async () => {
      jest.spyOn(CommunityPost, "findByPk").mockResolvedValue(null);

      const res = await request(app).get("/api/community/posts/999");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Post not found");
    });

    test("hidden post -> 404 for anonymous viewer", async () => {
      jest
        .spyOn(CommunityPost, "findByPk")
        .mockResolvedValue(makePostRow({ status: "hidden" }));

      const res = await request(app).get("/api/community/posts/1");

      expect(res.status).toBe(404);
    });

    test("non-numeric id -> 400", async () => {
      const res = await request(app).get("/api/community/posts/abc");
      expect(res.status).toBe(400);
    });
  });

  describe("auth enforcement", () => {
    test("POST /api/community/posts without token -> 401 TOKEN_MISSING", async () => {
      const res = await request(app)
        .post("/api/community/posts")
        .send({ title: "hello", body: "world" });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("TOKEN_MISSING");
    });

    test("POST /api/community/posts/:id/comments without token -> 401", async () => {
      const res = await request(app)
        .post("/api/community/posts/1/comments")
        .send({ body: "hi" });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("TOKEN_MISSING");
    });

    test("POST /api/community/posts/:id/like without token -> 401", async () => {
      const res = await request(app).post("/api/community/posts/1/like");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("TOKEN_MISSING");
    });

    test("POST /api/community/comments/:id/like without token -> 401", async () => {
      const res = await request(app).post("/api/community/comments/1/like");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("TOKEN_MISSING");
    });

    test("DELETE /api/community/posts/:id without token -> 401", async () => {
      const res = await request(app).delete("/api/community/posts/1");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("TOKEN_MISSING");
    });

    test("DELETE /api/community/comments/:id without token -> 401", async () => {
      const res = await request(app).delete("/api/community/comments/1");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("TOKEN_MISSING");
    });

    test("PATCH /api/community/posts/:id/pin without token -> 401 TOKEN_MISSING", async () => {
      const res = await request(app)
        .patch("/api/community/posts/1/pin")
        .send({ pinned: true });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("TOKEN_MISSING");
    });

    test("PATCH /api/community/posts/:id without token -> 401", async () => {
      const res = await request(app)
        .patch("/api/community/posts/1")
        .send({ body: "edited" });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("TOKEN_MISSING");
    });

    test("PATCH /api/community/comments/:id without token -> 401", async () => {
      const res = await request(app)
        .patch("/api/community/comments/1")
        .send({ body: "edited" });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("TOKEN_MISSING");
    });

    test("PATCH /api/community/comments/:id/pin without token -> 401", async () => {
      const res = await request(app)
        .patch("/api/community/comments/1/pin")
        .send({ pinned: true });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("TOKEN_MISSING");
    });
  });

  describe("authenticated requests with invalid payloads", () => {
    function authToken(userId = 2) {
      return jwt.sign({ userId }, process.env.JWT_SECRET);
    }

    test("POST /api/community/posts with invalid body -> 400", async () => {
      jest
        .spyOn(Usuario, "findByPk")
        .mockResolvedValue({ id: 2, nickname: "u", rol_id: 1 });

      const res = await request(app)
        .post("/api/community/posts")
        .set("Authorization", `Bearer ${authToken()}`)
        .send({ title: "x" });

      expect(res.status).toBe(400);
    });

    test("PATCH /api/community/posts/:id with no fields -> 400", async () => {
      // Distinct user id so the strict communityPostLimiter bucket is separate.
      jest
        .spyOn(Usuario, "findByPk")
        .mockResolvedValue({ id: 7, nickname: "u", rol_id: 1 });

      const res = await request(app)
        .patch("/api/community/posts/1")
        .set("Authorization", `Bearer ${authToken(7)}`)
        .send({});

      expect(res.status).toBe(400);
    });

    test("PATCH /api/community/comments/:id with invalid body -> 400", async () => {
      jest
        .spyOn(Usuario, "findByPk")
        .mockResolvedValue({ id: 2, nickname: "u", rol_id: 1 });

      const res = await request(app)
        .patch("/api/community/comments/1")
        .set("Authorization", `Bearer ${authToken()}`)
        .send({});

      expect(res.status).toBe(400);
    });

    test("PATCH /api/community/comments/:id/pin with non-boolean pinned -> 400", async () => {
      jest
        .spyOn(Usuario, "findByPk")
        .mockResolvedValue({ id: 2, nickname: "u", rol_id: 1 });

      const res = await request(app)
        .patch("/api/community/comments/1/pin")
        .set("Authorization", `Bearer ${authToken()}`)
        .send({ pinned: "yes" });

      expect(res.status).toBe(400);
    });

    test("PATCH pin without fijar_comunidad -> 403 PERMISSION_DENIED", async () => {
      // authRequired succeeds, then permiso() runs before body validation.
      jest
        .spyOn(Usuario, "findByPk")
        .mockResolvedValue({ id: 2, nickname: "u", rol_id: 1 });
      jest.spyOn(Permiso, "findAll").mockResolvedValue([]);

      const res = await request(app)
        .patch("/api/community/posts/1/pin")
        .set("Authorization", `Bearer ${authToken()}`)
        .send({ pinned: "yes" });

      // User lacks fijar_comunidad -> 403 (permiso middleware runs first).
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PERMISSION_DENIED");
    });
  });

  describe("reports", () => {
    function mockAuth(userId = 2, rolId = 1) {
      jest
        .spyOn(Usuario, "findByPk")
        .mockResolvedValue({ id: userId, nickname: "u", rol_id: rolId });
    }

    test("POST /posts/:id/report without token -> 401", async () => {
      const res = await request(app)
        .post("/api/community/posts/1/report")
        .send({ reason: "spam" });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("TOKEN_MISSING");
    });

    test("POST /posts/:id/report with invalid reason -> 400", async () => {
      mockAuth();
      const createSpy = jest.spyOn(CommunityReport, "create");

      const res = await request(app)
        .post("/api/community/posts/1/report")
        .set("Authorization", `Bearer ${authToken()}`)
        .send({ reason: "bogus" });

      expect(res.status).toBe(400);
      expect(createSpy).not.toHaveBeenCalled();
    });

    test("POST /posts/:id/report on a visible post -> 201", async () => {
      mockAuth();
      jest
        .spyOn(CommunityPost, "findByPk")
        .mockResolvedValue(makePostRow({ usuario_id: 9 }));
      jest.spyOn(CommunityReport, "create").mockResolvedValue({
        id: 10,
        target_type: "post",
        target_id: 1,
        reason: "spam",
        status: "open",
        creado: new Date("2026-09-29T10:00:00Z"),
      });

      const res = await request(app)
        .post("/api/community/posts/1/report")
        .set("Authorization", `Bearer ${authToken()}`)
        .send({ reason: "spam", details: "it is spam" });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: 10,
        target_type: "post",
        target_id: 1,
        reason: "spam",
        status: "open",
      });
      expect(CommunityReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reporter_id: 2,
          target_type: "post",
          target_id: 1,
          reason: "spam",
          details: "it is spam",
        })
      );
    });

    test("POST /posts/:id/report on own post -> 400", async () => {
      mockAuth();
      jest
        .spyOn(CommunityPost, "findByPk")
        .mockResolvedValue(makePostRow({ usuario_id: 2 }));

      const res = await request(app)
        .post("/api/community/posts/1/report")
        .set("Authorization", `Bearer ${authToken()}`)
        .send({ reason: "spam" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("You cannot report your own content");
    });

    test("POST /posts/:id/report on a hidden post -> 404", async () => {
      mockAuth();
      jest
        .spyOn(CommunityPost, "findByPk")
        .mockResolvedValue(makePostRow({ status: "hidden" }));

      const res = await request(app)
        .post("/api/community/posts/1/report")
        .set("Authorization", `Bearer ${authToken()}`)
        .send({ reason: "spam" });

      expect(res.status).toBe(404);
    });

    test("POST /posts/:id/report twice -> 200 with the existing report", async () => {
      mockAuth();
      jest
        .spyOn(CommunityPost, "findByPk")
        .mockResolvedValue(makePostRow({ usuario_id: 9 }));
      jest
        .spyOn(CommunityReport, "create")
        .mockRejectedValue(
          new UniqueConstraintError({ message: "dup", errors: [] })
        );
      jest.spyOn(CommunityReport, "findOne").mockResolvedValue({
        id: 10,
        target_type: "post",
        target_id: 1,
        reason: "spam",
        status: "open",
        creado: new Date("2026-09-29T10:00:00Z"),
      });

      const res = await request(app)
        .post("/api/community/posts/1/report")
        .set("Authorization", `Bearer ${authToken()}`)
        .send({ reason: "spam" });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(10);
    });

    test("POST /comments/:id/report on a visible comment -> 201", async () => {
      mockAuth();
      jest
        .spyOn(CommunityComment, "findByPk")
        .mockResolvedValue(makeCommentRow({ usuario_id: 9 }));
      jest
        .spyOn(CommunityPost, "findByPk")
        .mockResolvedValue(makePostRow({ status: "visible" }));
      jest.spyOn(CommunityReport, "create").mockResolvedValue({
        id: 11,
        target_type: "comment",
        target_id: 7,
        reason: "harassment",
        status: "open",
        creado: new Date("2026-09-29T10:00:00Z"),
      });

      const res = await request(app)
        .post("/api/community/comments/7/report")
        .set("Authorization", `Bearer ${authToken()}`)
        .send({ reason: "harassment" });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 11, target_type: "comment" });
    });
  });

  describe("moderator hide / unhide", () => {
    function mockAuth(userId = 2, rolId = 4) {
      jest
        .spyOn(Usuario, "findByPk")
        .mockResolvedValue({ id: userId, nickname: "mod", rol_id: rolId });
    }

    function mockTransaction() {
      jest
        .spyOn(sequelize, "transaction")
        .mockImplementation(async (cb) => cb({}));
    }

    test("PATCH /posts/:id/hide without moderar_comunidad -> 403", async () => {
      mockAuth(2, 1);
      jest.spyOn(Permiso, "findAll").mockResolvedValue([]);

      const res = await request(app)
        .patch("/api/community/posts/1/hide")
        .set("Authorization", `Bearer ${authToken()}`)
        .send({ reason: "spam" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PERMISSION_DENIED");
    });

    test("PATCH /posts/:id/unhide without permission -> 403", async () => {
      mockAuth(2, 1);
      jest.spyOn(Permiso, "findAll").mockResolvedValue([]);

      const res = await request(app)
        .patch("/api/community/posts/1/unhide")
        .set("Authorization", `Bearer ${authToken()}`);

      expect(res.status).toBe(403);
    });

    test("PATCH /comments/:id/hide without permission -> 403", async () => {
      mockAuth(2, 1);
      jest.spyOn(Permiso, "findAll").mockResolvedValue([]);

      const res = await request(app)
        .patch("/api/community/comments/7/hide")
        .set("Authorization", `Bearer ${authToken()}`)
        .send({ reason: "spam" });

      expect(res.status).toBe(403);
    });

    test("PATCH /posts/:id/hide hides the post and resolves open reports", async () => {
      mockAuth();
      jest
        .spyOn(Permiso, "findAll")
        .mockResolvedValue([{ nombre: "moderar_comunidad" }]);
      const post = makePostRow({ usuario_id: 9 });
      jest.spyOn(CommunityPost, "findByPk").mockResolvedValue(post);
      jest.spyOn(CommunityReport, "update").mockResolvedValue([2]);
      jest.spyOn(CommunityLike, "findAll").mockResolvedValue([]);
      jest.spyOn(CommunityComment, "findAll").mockResolvedValue([]);
      mockTransaction();

      const res = await request(app)
        .patch("/api/community/posts/1/hide")
        .set("Authorization", `Bearer ${authToken()}`)
        .send({ reason: "spam" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("hidden");
      expect(CommunityReport.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "resolved", resolved_by: 2 }),
        expect.objectContaining({
          where: { target_type: "post", target_id: 1, status: "open" },
        })
      );
    });

    test("PATCH /comments/:id/hide hides the comment and clears pinned", async () => {
      mockAuth();
      jest
        .spyOn(Permiso, "findAll")
        .mockResolvedValue([{ nombre: "moderar_comunidad" }]);
      const comment = makeCommentRow({ pinned: true });
      jest.spyOn(CommunityComment, "findByPk").mockResolvedValue(comment);
      jest.spyOn(CommunityReport, "update").mockResolvedValue([0]);
      jest.spyOn(CommunityLike, "findAll").mockResolvedValue([]);
      jest.spyOn(CommunityLike, "count").mockResolvedValue(0);
      mockTransaction();

      const res = await request(app)
        .patch("/api/community/comments/7/hide")
        .set("Authorization", `Bearer ${authToken()}`)
        .send({});

      expect(res.status).toBe(200);
      expect(comment.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "hidden", pinned: false }),
        expect.anything()
      );
      expect(res.body.status).toBe("hidden");
    });

    test("PATCH /posts/:id/unhide on a visible post -> 409", async () => {
      mockAuth();
      jest
        .spyOn(Permiso, "findAll")
        .mockResolvedValue([{ nombre: "moderar_comunidad" }]);
      jest
        .spyOn(CommunityPost, "findByPk")
        .mockResolvedValue(makePostRow({ status: "visible" }));

      const res = await request(app)
        .patch("/api/community/posts/1/unhide")
        .set("Authorization", `Bearer ${authToken()}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Content is already visible");
    });

    test("PATCH /posts/:id/unhide on author-deleted content -> 409", async () => {
      mockAuth();
      jest
        .spyOn(Permiso, "findAll")
        .mockResolvedValue([{ nombre: "moderar_comunidad" }]);
      const post = makePostRow({
        status: "hidden",
        hidden_reason: "deleted_by_author",
      });
      jest.spyOn(CommunityPost, "findByPk").mockResolvedValue(post);

      const res = await request(app)
        .patch("/api/community/posts/1/unhide")
        .set("Authorization", `Bearer ${authToken()}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe(
        "Content deleted by its author cannot be restored"
      );
      expect(post.update).not.toHaveBeenCalled();
    });

    test("PATCH /posts/:id/unhide approves pending_review and dismisses reports", async () => {
      mockAuth();
      jest
        .spyOn(Permiso, "findAll")
        .mockResolvedValue([{ nombre: "moderar_comunidad" }]);
      const post = makePostRow({
        status: "pending_review",
        hidden_reason: "auto_flagged:hate",
      });
      jest.spyOn(CommunityPost, "findByPk").mockResolvedValue(post);
      jest.spyOn(CommunityReport, "update").mockResolvedValue([1]);
      jest.spyOn(CommunityLike, "findAll").mockResolvedValue([]);
      jest.spyOn(CommunityComment, "findAll").mockResolvedValue([]);
      mockTransaction();

      const res = await request(app)
        .patch("/api/community/posts/1/unhide")
        .set("Authorization", `Bearer ${authToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("visible");
      expect(CommunityReport.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "dismissed", resolved_by: 2 }),
        expect.anything()
      );
    });
  });

  describe("GET /api/community/admin/queue", () => {
    function mockAuth(userId = 2, rolId = 4) {
      jest
        .spyOn(Usuario, "findByPk")
        .mockResolvedValue({ id: userId, nickname: "mod", rol_id: rolId });
    }

    test("without token -> 401", async () => {
      const res = await request(app).get("/api/community/admin/queue");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("TOKEN_MISSING");
    });

    test("without moderar_comunidad -> 403", async () => {
      mockAuth(2, 1);
      jest.spyOn(Permiso, "findAll").mockResolvedValue([]);

      const res = await request(app)
        .get("/api/community/admin/queue")
        .set("Authorization", `Bearer ${authToken()}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PERMISSION_DENIED");
    });

    test("returns pending and reported content grouped with report details", async () => {
      mockAuth();
      jest
        .spyOn(Permiso, "findAll")
        .mockResolvedValue([{ nombre: "moderar_comunidad" }]);
      jest.spyOn(CommunityReport, "findAll").mockResolvedValue([
        {
          id: 1,
          target_type: "post",
          target_id: 5,
          reason: "spam",
          details: "ads",
          status: "open",
          creado: new Date("2026-09-29T10:00:00Z"),
          reporter: { id: 3, nickname: "rep", kick_data: null },
        },
      ]);
      jest
        .spyOn(CommunityPost, "findAll")
        .mockResolvedValue([
          makePostRow({ id: 5 }),
          makePostRow({ id: 6, status: "pending_review" }),
        ]);
      jest.spyOn(CommunityComment, "findAll").mockResolvedValue([]);

      const res = await request(app)
        .get("/api/community/admin/queue")
        .set("Authorization", `Bearer ${authToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(2);
      expect(res.body.comments).toHaveLength(0);
      const reported = res.body.posts.find((p) => p.id === 5);
      expect(reported.report_count).toBe(1);
      expect(reported.reports[0]).toMatchObject({
        id: 1,
        reason: "spam",
        details: "ads",
        reporter: { id: 3, nickname: "rep", avatar: null },
      });
      const pending = res.body.posts.find((p) => p.id === 6);
      expect(pending.status).toBe("pending_review");
      expect(pending.report_count).toBe(0);
    });
  });

  describe("zod schemas", () => {
    test("createPostSchema rejects empty body and oversized title", () => {
      expect(createPostSchema.safeParse({}).success).toBe(false);
      expect(
        createPostSchema.safeParse({ title: "ab", body: "x" }).success
      ).toBe(false);
      expect(
        createPostSchema.safeParse({ title: "ok title", body: "x" }).success
      ).toBe(true);
    });

    test("reportSchema requires a known reason and optional details", () => {
      expect(reportSchema.safeParse({}).success).toBe(false);
      expect(reportSchema.safeParse({ reason: "bogus" }).success).toBe(false);
      expect(reportSchema.safeParse({ reason: "spam" }).success).toBe(true);
      expect(
        reportSchema.safeParse({
          reason: "other",
          details: "x".repeat(501),
        }).success
      ).toBe(false);
      expect(
        reportSchema.safeParse({ reason: "hate", details: " context " }).success
      ).toBe(true);
    });

    test("hideSchema allows an empty body and caps the reason", () => {
      expect(hideSchema.safeParse({}).success).toBe(true);
      expect(hideSchema.safeParse({ reason: "spam" }).success).toBe(true);
      expect(hideSchema.safeParse({ reason: "x".repeat(256) }).success).toBe(
        false
      );
    });

    test("pinSchema requires a boolean", () => {
      expect(pinSchema.safeParse({}).success).toBe(false);
      expect(pinSchema.safeParse({ pinned: "yes" }).success).toBe(false);
      expect(pinSchema.safeParse({ pinned: true }).success).toBe(true);
    });

    test("updatePostSchema requires at least one editable field", () => {
      expect(updatePostSchema.safeParse({}).success).toBe(false);
      expect(updatePostSchema.safeParse({ title: "ab" }).success).toBe(false);
      expect(updatePostSchema.safeParse({ title: "ok title" }).success).toBe(
        true
      );
      expect(updatePostSchema.safeParse({ body: "x" }).success).toBe(true);
    });

    test("updateCommentSchema enforces the comment body rule", () => {
      expect(updateCommentSchema.safeParse({}).success).toBe(false);
      expect(updateCommentSchema.safeParse({ body: "" }).success).toBe(false);
      expect(updateCommentSchema.safeParse({ body: "ok" }).success).toBe(true);
    });

    test("createCommentSchema accepts an optional positive parent_id", () => {
      expect(createCommentSchema.safeParse({ body: "hi" }).success).toBe(true);
      expect(
        createCommentSchema.safeParse({ body: "hi", parent_id: 3 }).success
      ).toBe(true);
      expect(
        createCommentSchema.safeParse({ body: "hi", parent_id: null }).success
      ).toBe(true);
      expect(
        createCommentSchema.safeParse({ body: "hi", parent_id: -1 }).success
      ).toBe(false);
      expect(
        createCommentSchema.safeParse({ body: "hi", parent_id: "x" }).success
      ).toBe(false);
    });

    test("listPostsQuerySchema coerces page/limit and caps sort values", () => {
      const ok = listPostsQuerySchema.safeParse({
        sort: "hot",
        page: "2",
        limit: "10",
      });
      expect(ok.success).toBe(true);
      expect(ok.data).toEqual({ sort: "hot", page: 2, limit: 10 });
      expect(listPostsQuerySchema.safeParse({ sort: "bogus" }).success).toBe(
        false
      );
      expect(listPostsQuerySchema.safeParse({ limit: "51" }).success).toBe(
        false
      );
    });
  });
});
