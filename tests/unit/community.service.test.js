const mockRedisSet = jest.fn();

jest.mock("../../src/models", () => ({
  CommunityPost: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    increment: jest.fn(),
  },
  CommunityComment: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  CommunityLike: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  Usuario: { findByPk: jest.fn() },
  Permiso: { findAll: jest.fn() },
  RolPermiso: {},
}));

jest.mock("../../src/config/redis.config", () => ({
  getRedisClient: jest.fn(() => ({ set: mockRedisSet })),
}));

jest.mock("../../src/services/notificacion.service", () => ({
  crear: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const {
  CommunityPost,
  CommunityComment,
  CommunityLike,
  Permiso,
} = require("../../src/models");
const NotificacionService = require("../../src/services/notificacion.service");
const service = require("../../src/services/community.service");
const AppError = require("../../src/utils/AppError");
const { UniqueConstraintError } = require("sequelize");

function makePost(overrides = {}) {
  return {
    id: 1,
    usuario_id: 9,
    title: "A great post",
    body: "body",
    media: null,
    pinned: false,
    status: "visible",
    view_count: 3,
    like_count: 5,
    comment_count: 2,
    hidden_by: null,
    hidden_at: null,
    hidden_reason: null,
    creado: new Date("2026-09-28T10:00:00Z"),
    actualizado: new Date("2026-09-28T10:00:00Z"),
    author: {
      id: 9,
      nickname: "author",
      kick_data: { avatar_url: "https://img/avatar.png" },
    },
    update: jest.fn(async function (values) {
      Object.assign(this, values);
    }),
    destroy: jest.fn(),
    ...overrides,
  };
}

function makeComment(overrides = {}) {
  return {
    id: 7,
    post_id: 1,
    usuario_id: 9,
    body: "nice",
    status: "visible",
    like_count: 0,
    hidden_by: null,
    hidden_at: null,
    hidden_reason: null,
    creado: new Date("2026-09-28T11:00:00Z"),
    actualizado: new Date("2026-09-28T11:00:00Z"),
    author: { id: 9, nickname: "author", kick_data: null },
    update: jest.fn(async function (values) {
      Object.assign(this, values);
    }),
    destroy: jest.fn(),
    ...overrides,
  };
}

function makeUser(overrides = {}) {
  return {
    id: 2,
    nickname: "viewer",
    rol_id: 1,
    kick_data: null,
    ...overrides,
  };
}

describe("community.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisSet.mockResolvedValue("OK");
  });

  // ---------- buildFeedOrder ----------
  describe("buildFeedOrder", () => {
    test.each(["new", "top", "hot"])("%s: pinned DESC comes first", (sort) => {
      const order = service.buildFeedOrder(sort);
      expect(order[0]).toEqual(["pinned", "DESC"]);
    });

    test("new: second key is creado DESC", () => {
      const order = service.buildFeedOrder("new");
      expect(order).toHaveLength(2);
      expect(order[1]).toEqual(["creado", "DESC"]);
    });

    test("top: second key is like_count literal DESC, then creado DESC", () => {
      const order = service.buildFeedOrder("top");
      expect(order).toHaveLength(3);
      expect(order[1][0]).toHaveProperty("val", "like_count");
      expect(order[1][1]).toBe("DESC");
      expect(order[2]).toEqual(["creado", "DESC"]);
    });

    test("hot: second key is the HN-style literal DESC, then creado DESC", () => {
      const order = service.buildFeedOrder("hot");
      expect(order).toHaveLength(3);
      expect(order[1][0].val).toContain("TIMESTAMPDIFF(HOUR");
      expect(order[1][0].val).toContain("POW(");
      expect(order[1][1]).toBe("DESC");
      expect(order[2]).toEqual(["creado", "DESC"]);
    });
  });

  // ---------- toggleLike ----------
  describe("toggleLike", () => {
    test("creates the like when absent -> liked true", async () => {
      CommunityPost.findByPk.mockResolvedValue(makePost());
      CommunityLike.findOne.mockResolvedValue(null);
      CommunityLike.create.mockResolvedValue({});
      CommunityLike.count.mockResolvedValue(4);

      const result = await service.toggleLike(2, "post", 1);

      expect(CommunityLike.create).toHaveBeenCalledWith({
        usuario_id: 2,
        target_type: "post",
        target_id: 1,
      });
      expect(result).toEqual({ liked: true, like_count: 4 });
    });

    test("destroys the like when present -> liked false", async () => {
      const destroy = jest.fn().mockResolvedValue(undefined);
      CommunityPost.findByPk.mockResolvedValue(makePost());
      CommunityLike.findOne.mockResolvedValue({ destroy });
      CommunityLike.count.mockResolvedValue(3);

      const result = await service.toggleLike(2, "post", 1);

      expect(destroy).toHaveBeenCalledTimes(1);
      expect(CommunityLike.create).not.toHaveBeenCalled();
      expect(result).toEqual({ liked: false, like_count: 3 });
    });

    test("unique-constraint race on create -> liked true", async () => {
      CommunityPost.findByPk.mockResolvedValue(makePost());
      CommunityLike.findOne.mockResolvedValue(null);
      CommunityLike.create.mockRejectedValue(
        new UniqueConstraintError({ message: "dup", errors: [] })
      );
      CommunityLike.count.mockResolvedValue(1);

      const result = await service.toggleLike(2, "post", 1);

      expect(result).toEqual({ liked: true, like_count: 1 });
    });

    test("missing target -> 404", async () => {
      CommunityPost.findByPk.mockResolvedValue(null);
      await expect(service.toggleLike(2, "post", 99)).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(CommunityLike.findOne).not.toHaveBeenCalled();
    });

    test("hidden target -> 404", async () => {
      CommunityPost.findByPk.mockResolvedValue(makePost({ status: "hidden" }));
      await expect(service.toggleLike(2, "post", 1)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test("comment target resolves via CommunityComment", async () => {
      CommunityComment.findByPk.mockResolvedValue(makeComment());
      CommunityLike.findOne.mockResolvedValue(null);
      CommunityLike.create.mockResolvedValue({});
      CommunityLike.count.mockResolvedValue(1);

      const result = await service.toggleLike(2, "comment", 7);

      expect(CommunityComment.findByPk).toHaveBeenCalledWith(7);
      expect(result).toEqual({ liked: true, like_count: 1 });
    });
  });

  // ---------- listPosts ----------
  describe("listPosts", () => {
    test("pagination math + only visible posts", async () => {
      CommunityPost.count.mockResolvedValue(25);
      CommunityPost.findAll.mockResolvedValue([
        makePost({ id: 1 }),
        makePost({ id: 2 }),
      ]);
      CommunityComment.findAll.mockResolvedValue([]);

      const result = await service.listPosts({ page: 2, limit: 10 });

      expect(CommunityPost.count).toHaveBeenCalledWith({
        where: { status: "visible" },
      });
      expect(CommunityPost.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "visible" },
          limit: 10,
          offset: 10,
        })
      );
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.pages).toBe(3);
      expect(result.posts).toHaveLength(2);
    });

    test("anonymous viewer gets viewer_liked=false and no like query", async () => {
      CommunityPost.count.mockResolvedValue(1);
      CommunityPost.findAll.mockResolvedValue([makePost()]);
      CommunityComment.findAll.mockResolvedValue([]);

      const result = await service.listPosts({ viewerId: null });

      expect(CommunityLike.findAll).not.toHaveBeenCalled();
      expect(result.posts[0].viewer_liked).toBe(false);
      expect(result.posts[0].author).toEqual({
        id: 9,
        nickname: "author",
        avatar: "https://img/avatar.png",
      });
    });

    test("authenticated viewer gets batched viewer_liked flags", async () => {
      CommunityPost.count.mockResolvedValue(2);
      CommunityPost.findAll.mockResolvedValue([
        makePost({ id: 1 }),
        makePost({ id: 2 }),
      ]);
      CommunityComment.findAll.mockResolvedValue([]);
      CommunityLike.findAll.mockResolvedValue([{ target_id: 1 }]);

      const result = await service.listPosts({ viewerId: 2 });

      expect(CommunityLike.findAll).toHaveBeenCalledTimes(1);
      expect(result.posts[0].viewer_liked).toBe(true);
      expect(result.posts[1].viewer_liked).toBe(false);
    });

    test("top_comment is null when no comment has likes", async () => {
      CommunityPost.count.mockResolvedValue(1);
      CommunityPost.findAll.mockResolvedValue([makePost()]);
      CommunityComment.findAll.mockResolvedValue([
        makeComment({ like_count: 0 }),
      ]);

      const result = await service.listPosts({});

      expect(result.posts[0].top_comment).toBeNull();
    });

    test("top_comment picks the highest-liked visible comment", async () => {
      CommunityPost.count.mockResolvedValue(1);
      CommunityPost.findAll.mockResolvedValue([makePost()]);
      CommunityComment.findAll.mockResolvedValue([
        makeComment({ id: 7, post_id: 1, like_count: 4 }),
        makeComment({ id: 8, post_id: 1, like_count: 1 }),
      ]);

      const result = await service.listPosts({});

      expect(result.posts[0].top_comment).toMatchObject({
        id: 7,
        like_count: 4,
        author: { id: 9, nickname: "author", avatar: null },
      });
    });
  });

  // ---------- getPost ----------
  describe("getPost", () => {
    test("missing post -> 404", async () => {
      CommunityPost.findByPk.mockResolvedValue(null);
      await expect(service.getPost(99, null)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test("hidden post -> 404 for anonymous viewer", async () => {
      CommunityPost.findByPk.mockResolvedValue(makePost({ status: "hidden" }));
      await expect(service.getPost(1, null)).rejects.toMatchObject({
        statusCode: 404,
        message: "Post not found",
      });
    });

    test("hidden post -> 200 for the author", async () => {
      const post = makePost({ status: "hidden", usuario_id: 2 });
      CommunityPost.findByPk.mockResolvedValue(post);
      CommunityComment.findAll.mockResolvedValue([]);
      CommunityLike.findAll.mockResolvedValue([]);

      const result = await service.getPost(1, makeUser({ id: 2 }), "1.2.3.4");

      expect(result.id).toBe(1);
      expect(result.comments).toEqual([]);
    });

    test("hidden post -> 200 for a moderator", async () => {
      CommunityPost.findByPk.mockResolvedValue(makePost({ status: "hidden" }));
      CommunityComment.findAll.mockResolvedValue([]);
      CommunityLike.findAll.mockResolvedValue([]);
      Permiso.findAll.mockResolvedValue([{ nombre: "moderar_comunidad" }]);

      const result = await service.getPost(
        1,
        makeUser({ id: 3, rol_id: 4 }),
        "1.2.3.4"
      );

      expect(result.id).toBe(1);
    });

    test("hidden post -> 404 for a stranger", async () => {
      CommunityPost.findByPk.mockResolvedValue(makePost({ status: "hidden" }));
      Permiso.findAll.mockResolvedValue([]);

      await expect(
        service.getPost(1, makeUser({ id: 3, rol_id: 1 }), "1.2.3.4")
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test("Redis NX success increments view_count and reflects +1", async () => {
      CommunityPost.findByPk.mockResolvedValue(makePost({ view_count: 10 }));
      CommunityComment.findAll.mockResolvedValue([]);
      CommunityLike.findAll.mockResolvedValue([]);
      CommunityPost.increment.mockResolvedValue([]);
      mockRedisSet.mockResolvedValue("OK");

      const result = await service.getPost(1, null, "5.6.7.8");

      expect(mockRedisSet).toHaveBeenCalledWith(
        "community:viewed:post:1:5.6.7.8",
        "1",
        "EX",
        86400,
        "NX"
      );
      expect(CommunityPost.increment).toHaveBeenCalledWith("view_count", {
        where: { id: 1 },
      });
      expect(result.view_count).toBe(11);
    });

    test("Redis NX null (already viewed) does not increment", async () => {
      CommunityPost.findByPk.mockResolvedValue(makePost({ view_count: 10 }));
      CommunityComment.findAll.mockResolvedValue([]);
      CommunityLike.findAll.mockResolvedValue([]);
      mockRedisSet.mockResolvedValue(null);

      const result = await service.getPost(1, null, "5.6.7.8");

      expect(CommunityPost.increment).not.toHaveBeenCalled();
      expect(result.view_count).toBe(10);
    });

    test("Redis failure does not fail the request", async () => {
      CommunityPost.findByPk.mockResolvedValue(makePost({ view_count: 10 }));
      CommunityComment.findAll.mockResolvedValue([]);
      CommunityLike.findAll.mockResolvedValue([]);
      mockRedisSet.mockRejectedValue(new Error("redis down"));

      const result = await service.getPost(1, null, "5.6.7.8");

      expect(result.id).toBe(1);
      expect(result.view_count).toBe(10);
      expect(CommunityPost.increment).not.toHaveBeenCalled();
    });

    test("returns comments creado ASC with like_count and viewer_liked", async () => {
      CommunityPost.findByPk.mockResolvedValue(makePost());
      CommunityComment.findAll.mockResolvedValue([
        makeComment({ id: 5 }),
        makeComment({ id: 6 }),
      ]);
      CommunityLike.findAll
        .mockResolvedValueOnce([{ target_id: 1 }]) // post like lookup
        .mockResolvedValueOnce([{ target_id: 6 }]); // comment like lookup

      const result = await service.getPost(1, makeUser(), "5.6.7.8");

      expect(result.viewer_liked).toBe(true);
      expect(result.comments).toHaveLength(2);
      expect(result.comments[0].viewer_liked).toBe(false);
      expect(result.comments[1].viewer_liked).toBe(true);
    });
  });

  // ---------- createComment ----------
  describe("createComment", () => {
    test("notifies the post author when someone else comments", async () => {
      CommunityPost.findByPk.mockResolvedValue(
        makePost({ usuario_id: 9, title: "My post" })
      );
      CommunityComment.create.mockResolvedValue(
        makeComment({ id: 5, usuario_id: 2, body: "hi" })
      );
      NotificacionService.crear.mockResolvedValue({});

      const user = makeUser({ id: 2, nickname: "viewer" });
      const result = await service.createComment(1, user, "hi");

      expect(NotificacionService.crear).toHaveBeenCalledWith(
        9,
        "Nueva respuesta en tu post",
        'viewer comentó en "My post"',
        "comunidad_respuesta",
        {
          post_id: 1,
          comment_id: 5,
          actor_id: 2,
          actor_nickname: "viewer",
        },
        "/comunidad/1"
      );
      expect(result).toMatchObject({
        id: 5,
        post_id: 1,
        body: "hi",
        like_count: 0,
        viewer_liked: false,
      });
    });

    test("skips notification on self-comment", async () => {
      CommunityPost.findByPk.mockResolvedValue(makePost({ usuario_id: 2 }));
      CommunityComment.create.mockResolvedValue(makeComment({ usuario_id: 2 }));

      await service.createComment(1, makeUser({ id: 2 }), "hi");

      expect(NotificacionService.crear).not.toHaveBeenCalled();
    });

    test("notification failure still returns the comment", async () => {
      CommunityPost.findByPk.mockResolvedValue(makePost({ usuario_id: 9 }));
      CommunityComment.create.mockResolvedValue(makeComment({ id: 5 }));
      NotificacionService.crear.mockRejectedValue(new Error("db down"));

      const result = await service.createComment(1, makeUser({ id: 2 }), "hi");

      expect(result.id).toBe(5);
    });

    test("missing or hidden post -> 404", async () => {
      CommunityPost.findByPk.mockResolvedValue(null);
      await expect(
        service.createComment(99, makeUser(), "hi")
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(CommunityComment.create).not.toHaveBeenCalled();

      CommunityPost.findByPk.mockResolvedValue(makePost({ status: "hidden" }));
      await expect(
        service.createComment(1, makeUser(), "hi")
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ---------- removePost ----------
  describe("removePost", () => {
    async function runRemove(postOverrides, userOverrides, permisos = []) {
      const post = makePost(postOverrides);
      CommunityPost.findByPk.mockResolvedValue(post);
      Permiso.findAll.mockResolvedValue(permisos);
      CommunityLike.findAll.mockResolvedValue([]);
      CommunityComment.findAll.mockResolvedValue([]);
      const user = makeUser(userOverrides);
      return { post, result: await service.removePost(post.id, user) };
    }

    test("owner can hide own post with reason deleted_by_author", async () => {
      const { post, result } = await runRemove(
        { usuario_id: 2 },
        { id: 2, rol_id: 1 }
      );

      expect(post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "hidden",
          hidden_by: 2,
          hidden_reason: "deleted_by_author",
          hidden_at: expect.any(Date),
        })
      );
      expect(post.destroy).not.toHaveBeenCalled();
      expect(result.status).toBe("hidden");
    });

    test("moderator can hide someone else's post", async () => {
      const { post } = await runRemove(
        { usuario_id: 9 },
        { id: 2, rol_id: 4 },
        [{ nombre: "moderar_comunidad" }]
      );

      expect(post.update).toHaveBeenCalledWith(
        expect.objectContaining({ hidden_reason: "removed_by_moderator" })
      );
    });

    test("stranger without permission -> 403, row untouched", async () => {
      const post = makePost({ usuario_id: 9 });
      CommunityPost.findByPk.mockResolvedValue(post);
      Permiso.findAll.mockResolvedValue([]);

      await expect(
        service.removePost(1, makeUser({ id: 2, rol_id: 1 }))
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(post.update).not.toHaveBeenCalled();
      expect(post.destroy).not.toHaveBeenCalled();
    });

    test("missing or already hidden post -> 404", async () => {
      CommunityPost.findByPk.mockResolvedValue(null);
      await expect(service.removePost(99, makeUser())).rejects.toMatchObject({
        statusCode: 404,
      });

      CommunityPost.findByPk.mockResolvedValue(makePost({ status: "hidden" }));
      await expect(service.removePost(1, makeUser())).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // ---------- removeComment ----------
  describe("removeComment", () => {
    test("owner hides own comment, row never destroyed", async () => {
      const comment = makeComment({ usuario_id: 2 });
      CommunityComment.findByPk.mockResolvedValue(comment);
      CommunityLike.findAll.mockResolvedValue([]);
      CommunityLike.count.mockResolvedValue(0);

      const result = await service.removeComment(7, makeUser({ id: 2 }));

      expect(comment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "hidden",
          hidden_reason: "deleted_by_author",
        })
      );
      expect(comment.destroy).not.toHaveBeenCalled();
      expect(result.status).toBe("hidden");
    });
  });

  // ---------- setPinned ----------
  describe("setPinned", () => {
    test("missing post -> 404", async () => {
      CommunityPost.findByPk.mockResolvedValue(null);
      await expect(service.setPinned(99, true)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test("updates pinned flag and returns DTO", async () => {
      const post = makePost();
      CommunityPost.findByPk.mockResolvedValue(post);
      CommunityLike.findAll.mockResolvedValue([]);
      CommunityComment.findAll.mockResolvedValue([]);

      const result = await service.setPinned(1, true);

      expect(post.update).toHaveBeenCalledWith({ pinned: true });
      expect(result.pinned).toBe(true);
    });
  });

  // ---------- error type sanity ----------
  test("AppError instances carry HTTP status codes", async () => {
    CommunityPost.findByPk.mockResolvedValue(null);
    try {
      await service.getPost(1, null);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
    }
  });
});
