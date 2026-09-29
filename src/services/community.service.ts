import { Op, UniqueConstraintError } from "sequelize";
import type { Order } from "sequelize";
import { sequelize } from "../models/database";
import {
  CommunityPost,
  CommunityComment,
  CommunityLike,
  Usuario,
  Permiso,
  RolPermiso,
} from "../models";
import type {
  CommunityFeedSort,
  CommunityLikeTarget,
  CommunityMediaItem,
} from "../types/community.types";
import { getRedisClient } from "../config/redis.config";
import NotificacionService from "./notificacion.service";
import AppError from "../utils/AppError";
import logger from "../utils/logger";
import toErrorMessage from "../utils/toErrorMessage";

const VIEW_DEDUP_TTL_SECONDS = 86400;

const AUTHOR_INCLUDE = {
  model: Usuario,
  as: "author",
  attributes: ["id", "nickname", "kick_data"],
};

const POST_LIKE_COUNT_SQL =
  "(SELECT COUNT(*) FROM community_likes WHERE community_likes.target_type = 'post' AND community_likes.target_id = CommunityPost.id)";
const POST_COMMENT_COUNT_SQL =
  "(SELECT COUNT(*) FROM community_comments WHERE community_comments.post_id = CommunityPost.id AND community_comments.status = 'visible')";
const COMMENT_LIKE_COUNT_SQL =
  "(SELECT COUNT(*) FROM community_likes WHERE community_likes.target_type = 'comment' AND community_likes.target_id = CommunityComment.id)";

// HN-style hot ranking: score decays with post age
const HOT_SCORE_SQL = `${POST_LIKE_COUNT_SQL} / POW(TIMESTAMPDIFF(HOUR, CommunityPost.creado, NOW()) + 2, 1.8)`;

interface AuthorDTO {
  id: number;
  nickname: string;
  avatar: string | null;
}

interface TopCommentDTO {
  id: number;
  body: string;
  like_count: number;
  author: AuthorDTO | null;
  creado: Date;
}

interface CommentDTO {
  id: number;
  post_id: number;
  body: string;
  status: string;
  like_count: number;
  viewer_liked: boolean;
  author: AuthorDTO | null;
  creado: Date;
  actualizado: Date;
}

interface PostDTO {
  id: number;
  title: string;
  body: string;
  media: CommunityMediaItem[];
  pinned: boolean;
  status: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  top_comment: TopCommentDTO | null;
  author: AuthorDTO | null;
  creado: Date;
  actualizado: Date;
  viewer_liked: boolean;
}

interface PostDetailDTO extends PostDTO {
  comments: CommentDTO[];
}

interface ListPostsOptions {
  sort?: CommunityFeedSort;
  page?: number;
  limit?: number;
  viewerId?: number | null;
}

interface ListPostsResult {
  posts: PostDTO[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface CreatePostData {
  title: string;
  body: string;
  media?: CommunityMediaItem[];
}

// Literal-included attributes are not declared model fields, so read them
// via getDataValue on real rows and fall back to plain properties in tests.
function numericAttr(
  row: CommunityPost | CommunityComment,
  key: string
): number {
  const record = row as unknown as Record<string, unknown> & {
    getDataValue?: (name: string) => unknown;
  };
  const value =
    typeof record.getDataValue === "function"
      ? record.getDataValue(key)
      : record[key];
  return Number(value ?? 0);
}

function toAuthorDTO(user: Usuario | null | undefined): AuthorDTO | null {
  if (!user) return null;
  const kickData = user.kick_data as { avatar_url?: string } | null;
  return {
    id: user.id,
    nickname: user.nickname,
    avatar: kickData?.avatar_url ?? null,
  };
}

function toTopCommentDTO(row: CommunityComment): TopCommentDTO {
  return {
    id: row.id,
    body: row.body,
    like_count: numericAttr(row, "like_count"),
    author: toAuthorDTO(row.author),
    creado: row.creado,
  };
}

function toCommentDTO(
  row: CommunityComment,
  likedIds: Set<number>
): CommentDTO {
  return {
    id: row.id,
    post_id: row.post_id,
    body: row.body,
    status: row.status,
    like_count: numericAttr(row, "like_count"),
    viewer_liked: likedIds.has(row.id),
    author: toAuthorDTO(row.author),
    creado: row.creado,
    actualizado: row.actualizado,
  };
}

function toPostDTO(
  row: CommunityPost,
  extras: { viewerLiked: boolean; topComment: TopCommentDTO | null }
): PostDTO {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    media: row.media ?? [],
    pinned: row.pinned,
    status: row.status,
    view_count: row.view_count,
    like_count: numericAttr(row, "like_count"),
    comment_count: numericAttr(row, "comment_count"),
    top_comment: extras.topComment,
    author: toAuthorDTO(row.author),
    creado: row.creado,
    actualizado: row.actualizado,
    viewer_liked: extras.viewerLiked,
  };
}

// Feed ordering. Pinned posts always come first; the second key depends on
// the requested sort. Exported so the ordering is unit-testable.
function buildFeedOrder(sort: CommunityFeedSort): Order {
  switch (sort) {
    case "top":
      return [
        ["pinned", "DESC"],
        [sequelize.literal("like_count"), "DESC"],
        ["creado", "DESC"],
      ];
    case "hot":
      return [
        ["pinned", "DESC"],
        [sequelize.literal(HOT_SCORE_SQL), "DESC"],
        ["creado", "DESC"],
      ];
    case "new":
    default:
      return [
        ["pinned", "DESC"],
        ["creado", "DESC"],
      ];
  }
}

async function userHasPermission(
  rolId: number,
  nombre: string
): Promise<boolean> {
  const permisos = await Permiso.findAll({
    where: { nombre },
    include: {
      model: RolPermiso,
      where: { rol_id: rolId },
    },
  });
  return permisos.length > 0;
}

// Batched lookup of which targets the viewer already liked (no N+1).
async function fetchLikedTargets(
  viewerId: number | null,
  targetType: CommunityLikeTarget,
  targetIds: number[]
): Promise<Set<number>> {
  if (!viewerId || targetIds.length === 0) return new Set<number>();
  const likes = await CommunityLike.findAll({
    attributes: ["target_id"],
    where: {
      usuario_id: viewerId,
      target_type: targetType,
      target_id: { [Op.in]: targetIds },
    },
  });
  return new Set(likes.map((like) => like.target_id));
}

// Batched top-comment lookup for a page of posts. Rows come back ordered by
// like_count DESC then creado ASC, so the first row seen per post is its top
// comment (oldest wins ties); comments with no likes are ignored.
async function fetchTopCommentsByPost(
  postIds: number[]
): Promise<Map<number, TopCommentDTO>> {
  const topByPost = new Map<number, TopCommentDTO>();
  if (postIds.length === 0) return topByPost;

  const rows = await CommunityComment.findAll({
    where: {
      post_id: { [Op.in]: postIds },
      status: "visible",
    },
    attributes: {
      include: [[sequelize.literal(COMMENT_LIKE_COUNT_SQL), "like_count"]],
    },
    include: [AUTHOR_INCLUDE],
    order: [
      [sequelize.literal("like_count"), "DESC"],
      ["creado", "ASC"],
    ],
  });

  for (const row of rows) {
    if (topByPost.has(row.post_id)) continue;
    if (numericAttr(row, "like_count") < 1) continue;
    topByPost.set(row.post_id, toTopCommentDTO(row));
  }

  return topByPost;
}

// Full post DTO via a fresh fetch: used after create/update so the response
// always carries real like_count, comment_count, top_comment and viewer_liked.
async function fetchPostDTO(
  postId: number,
  viewerId: number | null
): Promise<PostDTO> {
  const post = await CommunityPost.findByPk(postId, {
    attributes: {
      include: [
        [sequelize.literal(POST_LIKE_COUNT_SQL), "like_count"],
        [sequelize.literal(POST_COMMENT_COUNT_SQL), "comment_count"],
      ],
    },
    include: [AUTHOR_INCLUDE],
  });
  if (!post) {
    throw new AppError("Post not found", 404);
  }

  const [likedIds, topComments] = await Promise.all([
    fetchLikedTargets(viewerId, "post", [post.id]),
    fetchTopCommentsByPost([post.id]),
  ]);

  return toPostDTO(post, {
    viewerLiked: likedIds.has(post.id),
    topComment: topComments.get(post.id) ?? null,
  });
}

// Redis-deduped view counter. Any Redis failure is logged and skipped so a
// cache outage can never break the post detail endpoint.
async function trackPostView(
  postId: number,
  viewerId: number | null,
  viewerIp?: string
): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const viewerKey = viewerId ?? viewerIp ?? "anonymous";
    const dedupKey = `community:viewed:post:${postId}:${viewerKey}`;
    const setResult = await redis.set(
      dedupKey,
      "1",
      "EX",
      VIEW_DEDUP_TTL_SECONDS,
      "NX"
    );
    if (setResult !== "OK") return false;
    try {
      await CommunityPost.increment("view_count", { where: { id: postId } });
    } catch (error) {
      await redis.del(dedupKey).catch(() => undefined);
      throw error;
    }
    return true;
  } catch (error) {
    logger.warn(
      `[Community] View tracking skipped for post ${postId}: ${toErrorMessage(error)}`
    );
    return false;
  }
}

async function listPosts(
  options: ListPostsOptions = {}
): Promise<ListPostsResult> {
  const sort = options.sort ?? "new";
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(Math.max(1, options.limit ?? 20), 50);
  const viewerId = options.viewerId ?? null;

  const where = { status: "visible" };

  // Separate count so the correlated-subquery attributes cannot leak into
  // the COUNT query and the pagination total stays correct.
  const [total, rows] = await Promise.all([
    CommunityPost.count({ where }),
    CommunityPost.findAll({
      where,
      attributes: {
        include: [
          [sequelize.literal(POST_LIKE_COUNT_SQL), "like_count"],
          [sequelize.literal(POST_COMMENT_COUNT_SQL), "comment_count"],
        ],
      },
      include: [AUTHOR_INCLUDE],
      order: buildFeedOrder(sort),
      limit,
      offset: (page - 1) * limit,
    }),
  ]);

  const postIds = rows.map((row) => row.id);
  const [likedIds, topComments] = await Promise.all([
    fetchLikedTargets(viewerId, "post", postIds),
    fetchTopCommentsByPost(postIds),
  ]);

  const posts = rows.map((row) =>
    toPostDTO(row, {
      viewerLiked: likedIds.has(row.id),
      topComment: topComments.get(row.id) ?? null,
    })
  );

  return {
    posts,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

async function getPost(
  postId: number,
  viewer: Usuario | null,
  viewerIp?: string
): Promise<PostDetailDTO> {
  const post = await CommunityPost.findByPk(postId, {
    attributes: {
      include: [
        [sequelize.literal(POST_LIKE_COUNT_SQL), "like_count"],
        [sequelize.literal(POST_COMMENT_COUNT_SQL), "comment_count"],
      ],
    },
    include: [AUTHOR_INCLUDE],
  });

  if (!post) {
    throw new AppError("Post not found", 404);
  }

  if (post.status !== "visible") {
    const isAuthor = viewer !== null && viewer.id === post.usuario_id;
    const canModerate =
      !isAuthor && viewer !== null
        ? await userHasPermission(viewer.rol_id, "moderar_comunidad")
        : false;
    if (!isAuthor && !canModerate) {
      throw new AppError("Post not found", 404);
    }
  }

  const viewerId = viewer ? viewer.id : null;
  const commentRows = await CommunityComment.findAll({
    where: { post_id: post.id, status: "visible" },
    attributes: {
      include: [[sequelize.literal(COMMENT_LIKE_COUNT_SQL), "like_count"]],
    },
    include: [AUTHOR_INCLUDE],
    order: [["creado", "ASC"]],
  });

  const commentIds = commentRows.map((row) => row.id);
  const [postLikedIds, commentLikedIds] = await Promise.all([
    fetchLikedTargets(viewerId, "post", [post.id]),
    fetchLikedTargets(viewerId, "comment", commentIds),
  ]);

  const viewCounted = await trackPostView(post.id, viewerId, viewerIp);

  // commentRows are creado ASC, so `>` keeps the oldest comment on ties.
  const topCommentRow = commentRows.reduce<CommunityComment | null>(
    (best, row) => {
      const likeCount = numericAttr(row, "like_count");
      if (likeCount < 1) return best;
      if (!best || likeCount > numericAttr(best, "like_count")) return row;
      return best;
    },
    null
  );

  const dto = toPostDTO(post, {
    viewerLiked: postLikedIds.has(post.id),
    topComment: topCommentRow ? toTopCommentDTO(topCommentRow) : null,
  });
  if (viewCounted) {
    dto.view_count += 1;
  }

  return {
    ...dto,
    comments: commentRows.map((row) => toCommentDTO(row, commentLikedIds)),
  };
}

async function createPost(
  userId: number,
  data: CreatePostData
): Promise<PostDTO> {
  // Moderation scan (pending_review) is handled by a later feature (#89);
  // posts are created as visible for now.
  const post = await CommunityPost.create({
    usuario_id: userId,
    title: data.title,
    body: data.body,
    media: data.media ?? null,
    status: "visible",
  });

  return fetchPostDTO(post.id, userId);
}

async function createComment(
  postId: number,
  user: Usuario,
  body: string
): Promise<CommentDTO> {
  const post = await CommunityPost.findByPk(postId);
  if (!post || post.status !== "visible") {
    throw new AppError("Post not found", 404);
  }

  const comment = await CommunityComment.create({
    post_id: post.id,
    usuario_id: user.id,
    body,
    status: "visible",
  });

  // Notify the post author (skip self-comments). A notification failure must
  // never fail the comment itself.
  if (post.usuario_id !== user.id) {
    try {
      await NotificacionService.crear(
        post.usuario_id,
        "Nueva respuesta en tu post",
        `${user.nickname} comentó en "${post.title}"`,
        "comunidad_respuesta",
        {
          post_id: post.id,
          comment_id: comment.id,
          actor_id: user.id,
          actor_nickname: user.nickname,
        },
        `/comunidad/${post.id}`
      );
    } catch (error) {
      logger.warn(
        `[Community] Failed to create reply notification for post ${post.id}: ${toErrorMessage(error)}`
      );
    }
  }

  return {
    ...toCommentDTO(comment, new Set<number>()),
    author: toAuthorDTO(user),
  };
}

async function toggleLike(
  userId: number,
  targetType: CommunityLikeTarget,
  targetId: number
): Promise<{ liked: boolean; like_count: number }> {
  let target: CommunityPost | CommunityComment | null;
  if (targetType === "post") {
    target = await CommunityPost.findByPk(targetId);
  } else {
    // Comments are only likeable while their post is visible too.
    const comment = await CommunityComment.findByPk(targetId);
    const parent =
      comment?.status === "visible"
        ? await CommunityPost.findByPk(comment.post_id)
        : null;
    target = parent?.status === "visible" ? comment : null;
  }

  if (!target || target.status !== "visible") {
    throw new AppError("Not found", 404);
  }

  const likeWhere = {
    usuario_id: userId,
    target_type: targetType,
    target_id: targetId,
  };

  // Delete-first toggle: each request applies exactly one atomic change, so
  // concurrent toggles behave as if they ran one after another.
  let liked: boolean;
  const removed = await CommunityLike.destroy({ where: likeWhere });
  if (removed > 0) {
    liked = false;
  } else {
    try {
      await CommunityLike.create(likeWhere);
      liked = true;
    } catch (error) {
      // A concurrent toggle inserted the like first; this toggle undoes it.
      if (!(error instanceof UniqueConstraintError)) throw error;
      await CommunityLike.destroy({ where: likeWhere });
      liked = false;
    }
  }

  const like_count = await CommunityLike.count({
    where: { target_type: targetType, target_id: targetId },
  });

  return { liked, like_count };
}

// Minimal shape shared by CommunityPost and CommunityComment for soft-hides.
interface HideableRow {
  usuario_id: number;
  status: string;
  update(values: Record<string, unknown>): Promise<unknown>;
}

async function hideOwnedOrModerated(
  instance: HideableRow | null,
  user: Usuario,
  notFoundMessage: string
): Promise<void> {
  if (!instance || instance.status === "hidden") {
    throw new AppError(notFoundMessage, 404);
  }

  const isOwner = instance.usuario_id === user.id;
  if (
    !isOwner &&
    !(await userHasPermission(user.rol_id, "moderar_comunidad"))
  ) {
    throw new AppError("Permission denied", 403);
  }

  await instance.update({
    status: "hidden",
    hidden_by: user.id,
    hidden_at: new Date(),
    hidden_reason: isOwner ? "deleted_by_author" : "removed_by_moderator",
  });
}

async function removePost(postId: number, user: Usuario): Promise<PostDTO> {
  const post = await CommunityPost.findByPk(postId);
  await hideOwnedOrModerated(post, user, "Post not found");
  return fetchPostDTO(post.id, user.id);
}

async function removeComment(
  commentId: number,
  user: Usuario
): Promise<CommentDTO> {
  const comment = await CommunityComment.findByPk(commentId, {
    include: [AUTHOR_INCLUDE],
  });
  await hideOwnedOrModerated(comment, user, "Comment not found");

  const [likedIds, likeCount] = await Promise.all([
    fetchLikedTargets(user.id, "comment", [comment.id]),
    CommunityLike.count({
      where: { target_type: "comment", target_id: comment.id },
    }),
  ]);

  const dto = toCommentDTO(comment, likedIds);
  dto.like_count = likeCount;
  return dto;
}

async function setPinned(
  postId: number,
  pinned: boolean,
  viewerId: number | null = null
): Promise<PostDTO> {
  const post = await CommunityPost.findByPk(postId);
  if (!post) {
    throw new AppError("Post not found", 404);
  }

  await post.update({ pinned });
  return fetchPostDTO(post.id, viewerId);
}

const CommunityService = {
  buildFeedOrder,
  listPosts,
  getPost,
  createPost,
  createComment,
  toggleLike,
  removePost,
  removeComment,
  setPinned,
  userHasPermission,
};

export = CommunityService;
