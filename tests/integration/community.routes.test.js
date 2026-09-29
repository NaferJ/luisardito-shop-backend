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
  Usuario,
  Permiso,
} = require("../../src/models");
const {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  updateCommentSchema,
  listPostsQuerySchema,
  pinSchema,
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
    ...overrides,
  };
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
