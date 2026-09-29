import { Op, UniqueConstraintError } from "sequelize";
import type { Order, Transaction } from "sequelize";
import { sequelize } from "../models/database";
import {
  CommunityPost,
  CommunityComment,
  CommunityLike,
  CommunityReport,
  Usuario,
  Permiso,
  RolPermiso,
} from "../models";
import type {
  CommunityFeedSort,
  CommunityLikeTarget,
  CommunityMediaItem,
  CommunityReportReason,
  CommunityReportTarget,
  CommunityStatus,
} from "../types/community.types";
import { getRedisClient } from "../config/redis.config";
import ModerationService from "./moderation.service";
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
  parent_id: number | null;
  body: string | null;
  status: string;
  pinned: boolean;
  like_count: number;
  viewer_liked: boolean;
  author: AuthorDTO | null;
  creado: Date;
  actualizado: Date;
  edited_at: Date | null;
  replies: CommentDTO[];
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
  edited_at: Date | null;
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

interface ReportDTO {
  id: number;
  target_type: CommunityReportTarget;
  target_id: number;
  reason: CommunityReportReason;
  status: string;
  creado: Date;
}

interface ReportInput {
  reason: CommunityReportReason;
  details?: string | null;
}

interface QueueReportDTO {
  id: number;
  reason: CommunityReportReason;
  details: string | null;
  reporter: AuthorDTO | null;
  creado: Date;
}

interface QueuePostItem {
  id: number;
  title: string;
  body: string;
  media: CommunityMediaItem[];
  status: string;
  hidden_reason: string | null;
  author: AuthorDTO | null;
  creado: Date;
  report_count: number;
  reports: QueueReportDTO[];
}

interface QueueCommentItem {
  id: number;
  post_id: number;
  body: string;
  status: string;
  hidden_reason: string | null;
  author: AuthorDTO | null;
  creado: Date;
  report_count: number;
  reports: QueueReportDTO[];
}

interface ModerationQueueDTO {
  posts: QueuePostItem[];
  comments: QueueCommentItem[];
}

interface CreatePostData {
  title: string;
  body: string;
  media?: CommunityMediaItem[];
}

interface UpdatePostData {
  title?: string;
  body?: string;
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
    parent_id: row.parent_id ?? null,
    body: row.body,
    status: row.status,
    pinned: row.pinned ?? false,
    like_count: numericAttr(row, "like_count"),
    viewer_liked: likedIds.has(row.id),
    author: toAuthorDTO(row.author),
    creado: row.creado,
    actualizado: row.actualizado,
    edited_at: row.edited_at ?? null,
    replies: [],
  };
}

// Hidden comments with visible descendants stay in the tree as placeholders
// so the replies are not orphaned.
function toHiddenCommentPlaceholder(node: CommentDTO): CommentDTO {
  return {
    ...node,
    body: null,
    status: "hidden",
    pinned: false,
    like_count: 0,
    viewer_liked: false,
    author: null,
  };
}

// Builds a one-level reply tree from a flat, creado-ASC comment list: every
// reply is attached to its top-level ancestor, so `replies` never nests.
// Hidden roots survive as placeholders only while they have a visible reply;
// hidden replies are dropped. Top-level order is pinned first, then creado
// ASC; replies keep creado ASC (the input order). A comment whose parent is
// missing from the input is treated as a root.
// Exported so the ordering/placeholder rules are unit-testable.
function buildCommentTree(flat: CommentDTO[]): CommentDTO[] {
  const nodes = new Map<number, CommentDTO>();
  for (const comment of flat) {
    nodes.set(comment.id, { ...comment, replies: [] });
  }

  const parentOf = (node: CommentDTO): CommentDTO | undefined =>
    node.parent_id === null || node.parent_id === undefined
      ? undefined
      : nodes.get(node.parent_id);

  const roots: CommentDTO[] = [];
  for (const node of nodes.values()) {
    let root = parentOf(node);
    // Legacy deeper rows are flattened onto their top-level ancestor; the hop
    // limit guards against malformed parent cycles.
    for (let hops = 0; root && hops < nodes.size; hops++) {
      const next = parentOf(root);
      if (!next) break;
      root = next;
    }
    if (root && root !== node) {
      root.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  const prune = (list: CommentDTO[]): CommentDTO[] => {
    const kept: CommentDTO[] = [];
    for (const node of list) {
      node.replies = prune(node.replies);
      if (node.status === "hidden" && node.replies.length === 0) continue;
      kept.push(
        node.status === "hidden" ? toHiddenCommentPlaceholder(node) : node
      );
    }
    return kept;
  };

  const tree = prune(roots);
  tree.sort((a, b) => Number(b.pinned) - Number(a.pinned));
  return tree;
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
    edited_at: row.edited_at ?? null,
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

// Field set applied when the auto-moderation scan flags content: the row is
// created/updated as pending_review and stamped with the matched categories
// (truncated to the hidden_reason column size) so moderators see why.
function autoFlagFields(categories: string[]): {
  status: CommunityStatus;
  hidden_by: null;
  hidden_at: Date;
  hidden_reason: string;
} {
  return {
    status: "pending_review",
    hidden_by: null,
    hidden_at: new Date(),
    hidden_reason: `auto_flagged:${categories.join(",")}`.slice(0, 255),
  };
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
  // Visible + hidden comments: hidden ones may need a placeholder node when
  // they still have visible descendants (hidden leaf comments are pruned
  // while building the tree).
  const commentRows = await CommunityComment.findAll({
    where: { post_id: post.id, status: { [Op.in]: ["visible", "hidden"] } },
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
  // Hidden comments never leak into top_comment.
  const topCommentRow = commentRows.reduce<CommunityComment | null>(
    (best, row) => {
      if (row.status !== "visible") return best;
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
    comments: buildCommentTree(
      commentRows.map((row) => toCommentDTO(row, commentLikedIds))
    ),
  };
}

async function createPost(
  userId: number,
  data: CreatePostData
): Promise<PostDTO> {
  const scan = await ModerationService.scanContent({
    text: `${data.title}\n\n${data.body}`,
    media: data.media,
  });
  const post = await CommunityPost.create({
    usuario_id: userId,
    title: data.title,
    body: data.body,
    media: data.media ?? null,
    status: "visible",
    ...(scan.flagged ? autoFlagFields(scan.categories) : {}),
  });

  return fetchPostDTO(post.id, userId);
}

async function createComment(
  postId: number,
  user: Usuario,
  body: string,
  parentId?: number
): Promise<CommentDTO> {
  const post = await CommunityPost.findByPk(postId);
  if (post?.status !== "visible") {
    throw new AppError("Post not found", 404);
  }

  let parent: CommunityComment | null = null;
  if (parentId !== undefined && parentId !== null) {
    parent = await CommunityComment.findByPk(parentId);
    if (parent?.status !== "visible") {
      throw new AppError("Comment not found", 404);
    }
    if (parent.post_id !== post.id) {
      throw new AppError("Parent comment belongs to a different post", 400);
    }
  }

  const scan = await ModerationService.scanContent({ text: body });

  // Threads are one level deep: a reply to a reply is stored under the
  // top-level comment. Notifications still target the replied-to author.
  const comment = await CommunityComment.create({
    post_id: post.id,
    parent_id: parent ? (parent.parent_id ?? parent.id) : null,
    usuario_id: user.id,
    body,
    status: "visible",
    ...(scan.flagged ? autoFlagFields(scan.categories) : {}),
  });

  // Comments held for review do not notify anyone until they are approved.
  const isVisible = comment.status === "visible";

  // Notify the post author (skip self-comments). A notification failure must
  // never fail the comment itself.
  if (isVisible && post.usuario_id !== user.id) {
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

  // On replies, also notify the parent comment's author. Skipped on
  // self-replies and when the parent author is the post author (already
  // notified above, so nobody receives two notifications for one reply).
  if (
    isVisible &&
    parent &&
    parent.usuario_id !== user.id &&
    parent.usuario_id !== post.usuario_id
  ) {
    try {
      await NotificacionService.crear(
        parent.usuario_id,
        "Nueva respuesta a tu comentario",
        `${user.nickname} respondió a tu comentario en "${post.title}"`,
        "comunidad_respuesta",
        {
          post_id: post.id,
          comment_id: comment.id,
          parent_comment_id: parent.id,
          actor_id: user.id,
          actor_nickname: user.nickname,
        },
        `/comunidad/${post.id}`
      );
    } catch (error) {
      logger.warn(
        `[Community] Failed to create reply notification for comment ${parent.id}: ${toErrorMessage(error)}`
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

  if (target?.status !== "visible") {
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
  notFoundMessage: string,
  extraUpdates: Record<string, unknown> = {}
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
    ...extraUpdates,
  });
}

// Comment DTO with real like_count/viewer_liked for single-comment
// responses (create/edit/pin/remove). replies stays empty: the nested
// thread only exists inside the post detail tree.
async function fetchCommentDTO(
  comment: CommunityComment,
  viewerId: number | null
): Promise<CommentDTO> {
  const [likedIds, likeCount] = await Promise.all([
    fetchLikedTargets(viewerId, "comment", [comment.id]),
    CommunityLike.count({
      where: { target_type: "comment", target_id: comment.id },
    }),
  ]);

  const dto = toCommentDTO(comment, likedIds);
  dto.like_count = likeCount;
  return dto;
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
  // A hidden comment cannot be unpinned through the pin endpoint.
  await hideOwnedOrModerated(comment, user, "Comment not found", {
    pinned: false,
  });
  return fetchCommentDTO(comment, user.id);
}

async function updatePost(
  postId: number,
  user: Usuario,
  data: UpdatePostData
): Promise<PostDTO> {
  const post = await CommunityPost.findByPk(postId);
  if (post?.status !== "visible") {
    throw new AppError("Post not found", 404);
  }
  // Only the author edits content; moderators hide instead of editing.
  if (post.usuario_id !== user.id) {
    throw new AppError("Permission denied", 403);
  }

  // Edits must not bypass moderation: the resulting content is scanned again.
  const nextTitle = data.title !== undefined ? data.title : post.title;
  const nextBody = data.body !== undefined ? data.body : post.body;
  const scan = await ModerationService.scanContent({
    text: `${nextTitle}\n\n${nextBody}`,
    media: post.media ?? undefined,
  });

  await post.update({
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.body !== undefined ? { body: data.body } : {}),
    edited_at: new Date(),
    ...(scan.flagged ? autoFlagFields(scan.categories) : {}),
  });

  return fetchPostDTO(post.id, user.id);
}

async function updateComment(
  commentId: number,
  user: Usuario,
  body: string
): Promise<CommentDTO> {
  const comment = await CommunityComment.findByPk(commentId, {
    include: [AUTHOR_INCLUDE],
  });
  if (comment?.status !== "visible") {
    throw new AppError("Comment not found", 404);
  }
  const post = await CommunityPost.findByPk(comment.post_id);
  if (post?.status !== "visible") {
    throw new AppError("Comment not found", 404);
  }
  if (comment.usuario_id !== user.id) {
    throw new AppError("Permission denied", 403);
  }

  const scan = await ModerationService.scanContent({ text: body });
  await comment.update({
    body,
    edited_at: new Date(),
    ...(scan.flagged ? autoFlagFields(scan.categories) : {}),
  });
  return fetchCommentDTO(comment, user.id);
}

async function setCommentPinned(
  commentId: number,
  pinned: boolean,
  user: Usuario
): Promise<CommentDTO> {
  const comment = await CommunityComment.findByPk(commentId, {
    include: [AUTHOR_INCLUDE],
  });
  if (comment?.status !== "visible") {
    throw new AppError("Comment not found", 404);
  }
  const post = await CommunityPost.findByPk(comment.post_id);
  if (post?.status !== "visible") {
    throw new AppError("Comment not found", 404);
  }
  if (comment.parent_id !== null) {
    throw new AppError("Only top-level comments can be pinned", 400);
  }

  const isPostAuthor = user.id === post.usuario_id;
  if (
    !isPostAuthor &&
    !(await userHasPermission(user.rol_id, "moderar_comunidad"))
  ) {
    throw new AppError("Permission denied", 403);
  }

  if (pinned) {
    // At most one pinned comment per post: unpin the previous one in the
    // same transaction before pinning this comment.
    await sequelize.transaction(async (transaction) => {
      // Exclude this comment so re-pinning an already pinned comment is not
      // cleared in the DB while the loaded instance still reads pinned=true.
      await CommunityComment.update(
        { pinned: false },
        {
          where: {
            post_id: post.id,
            pinned: true,
            id: { [Op.ne]: comment.id },
          },
          transaction,
        }
      );
      await comment.update({ pinned: true }, { transaction });
    });
  } else {
    await comment.update({ pinned: false });
  }

  return fetchCommentDTO(comment, user.id);
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

function toReportDTO(row: CommunityReport): ReportDTO {
  return {
    id: row.id,
    target_type: row.target_type,
    target_id: row.target_id,
    reason: row.reason,
    status: row.status,
    creado: row.creado,
  };
}

// A target is reportable only while it is publicly visible; for comments the
// parent post must be visible too. `created` tells the controller whether to
// answer 201 (new report) or 200 (repeat report returns the existing row).
async function reportContent(
  user: Usuario,
  targetType: CommunityReportTarget,
  targetId: number,
  data: ReportInput
): Promise<{ report: ReportDTO; created: boolean }> {
  let authorId: number;
  if (targetType === "post") {
    const post = await CommunityPost.findByPk(targetId);
    if (post?.status !== "visible") {
      throw new AppError("Not found", 404);
    }
    authorId = post.usuario_id;
  } else {
    const comment = await CommunityComment.findByPk(targetId);
    const post =
      comment?.status === "visible"
        ? await CommunityPost.findByPk(comment.post_id)
        : null;
    if (!comment || post?.status !== "visible") {
      throw new AppError("Not found", 404);
    }
    authorId = comment.usuario_id;
  }

  if (authorId === user.id) {
    throw new AppError("You cannot report your own content", 400);
  }

  const reportWhere = {
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
  };

  try {
    const report = await CommunityReport.create({
      ...reportWhere,
      reason: data.reason,
      details: data.details ?? null,
    });
    return { report: toReportDTO(report), created: true };
  } catch (error) {
    // A repeat report hits the (reporter, target) unique index; return the
    // existing row so reporting stays idempotent.
    if (!(error instanceof UniqueConstraintError)) throw error;
    const existing = await CommunityReport.findOne({ where: reportWhere });
    if (!existing) throw error;
    return { report: toReportDTO(existing), created: false };
  }
}

// Marks every open report on the target inside an existing transaction.
async function resolveOpenReports(
  targetType: CommunityReportTarget,
  targetId: number,
  status: "resolved" | "dismissed",
  moderatorId: number,
  transaction: Transaction
): Promise<void> {
  await CommunityReport.update(
    { status, resolved_by: moderatorId, resolved_at: new Date() },
    {
      where: {
        target_type: targetType,
        target_id: targetId,
        status: "open",
      },
      transaction,
    }
  );
}

// Minimal shape shared by CommunityPost and CommunityComment for moderator
// hide/unhide (their Model.update overloads differ, so a union is not
// callable — same trick as HideableRow above).
interface ModeratableRow {
  id: number;
  status: string;
  hidden_reason: string | null;
  update(
    values: Record<string, unknown>,
    options?: { transaction?: Transaction }
  ): Promise<unknown>;
}

// Moderator hide: works on visible and pending_review content (auto-flagged
// items are confirmed directly from the queue) and resolves its open reports
// in the same transaction.
async function moderateHide(
  instance: ModeratableRow | null,
  targetType: CommunityReportTarget,
  user: Usuario,
  notFoundMessage: string,
  reason?: string,
  extraUpdates: Record<string, unknown> = {}
): Promise<void> {
  if (!instance || instance.status === "hidden") {
    throw new AppError(notFoundMessage, 404);
  }

  await sequelize.transaction(async (transaction) => {
    await instance.update(
      {
        status: "hidden",
        hidden_by: user.id,
        hidden_at: new Date(),
        hidden_reason: reason || "removed_by_moderator",
        ...extraUpdates,
      },
      { transaction }
    );
    await resolveOpenReports(
      targetType,
      instance.id,
      "resolved",
      user.id,
      transaction
    );
  });
}

// Moderator unhide/approve: restores hidden content and approves
// pending_review items, dismissing their open reports. Content deleted by its
// own author cannot be restored by a moderator.
async function moderateUnhide(
  instance: ModeratableRow | null,
  targetType: CommunityReportTarget,
  user: Usuario,
  notFoundMessage: string
): Promise<void> {
  if (!instance) {
    throw new AppError(notFoundMessage, 404);
  }
  if (instance.status === "visible") {
    throw new AppError("Content is already visible", 409);
  }
  if (instance.hidden_reason === "deleted_by_author") {
    throw new AppError("Content deleted by its author cannot be restored", 409);
  }

  await sequelize.transaction(async (transaction) => {
    await instance.update(
      {
        status: "visible",
        hidden_by: null,
        hidden_at: null,
        hidden_reason: null,
      },
      { transaction }
    );
    await resolveOpenReports(
      targetType,
      instance.id,
      "dismissed",
      user.id,
      transaction
    );
  });
}

async function hidePost(
  postId: number,
  user: Usuario,
  reason?: string
): Promise<PostDTO> {
  const post = await CommunityPost.findByPk(postId);
  await moderateHide(post, "post", user, "Post not found", reason);
  return fetchPostDTO(post.id, user.id);
}

async function unhidePost(postId: number, user: Usuario): Promise<PostDTO> {
  const post = await CommunityPost.findByPk(postId);
  await moderateUnhide(post, "post", user, "Post not found");
  return fetchPostDTO(post.id, user.id);
}

async function hideComment(
  commentId: number,
  user: Usuario,
  reason?: string
): Promise<CommentDTO> {
  const comment = await CommunityComment.findByPk(commentId, {
    include: [AUTHOR_INCLUDE],
  });
  await moderateHide(comment, "comment", user, "Comment not found", reason, {
    pinned: false,
  });
  return fetchCommentDTO(comment, user.id);
}

async function unhideComment(
  commentId: number,
  user: Usuario
): Promise<CommentDTO> {
  const comment = await CommunityComment.findByPk(commentId, {
    include: [AUTHOR_INCLUDE],
  });
  await moderateUnhide(comment, "comment", user, "Comment not found");
  return fetchCommentDTO(comment, user.id);
}

const QUEUE_LIMIT = 100;

const REPORTER_INCLUDE = {
  model: Usuario,
  as: "reporter",
  attributes: ["id", "nickname", "kick_data"],
};

// Moderation queue: everything pending_review plus visible content that has
// at least one open report. Hidden content never appears. Open reports are
// fetched once and grouped in memory to avoid an N+1 per queue item.
async function getModerationQueue(): Promise<ModerationQueueDTO> {
  const openReports = await CommunityReport.findAll({
    where: { status: "open" },
    include: [REPORTER_INCLUDE],
    order: [["creado", "ASC"]],
  });

  const reportsByTarget = new Map<string, QueueReportDTO[]>();
  const reportedPostIds = new Set<number>();
  const reportedCommentIds = new Set<number>();
  for (const row of openReports) {
    const key = `${row.target_type}:${row.target_id}`;
    const list = reportsByTarget.get(key) ?? [];
    list.push({
      id: row.id,
      reason: row.reason,
      details: row.details ?? null,
      reporter: toAuthorDTO(row.reporter),
      creado: row.creado,
    });
    reportsByTarget.set(key, list);
    if (row.target_type === "post") {
      reportedPostIds.add(row.target_id);
    } else {
      reportedCommentIds.add(row.target_id);
    }
  }

  const [postRows, commentRows] = await Promise.all([
    CommunityPost.findAll({
      where: {
        [Op.or]: [
          { status: "pending_review" },
          { status: "visible", id: { [Op.in]: [...reportedPostIds] } },
        ],
      },
      include: [AUTHOR_INCLUDE],
      order: [["creado", "ASC"]],
      limit: QUEUE_LIMIT,
    }),
    CommunityComment.findAll({
      where: {
        [Op.or]: [
          { status: "pending_review" },
          { status: "visible", id: { [Op.in]: [...reportedCommentIds] } },
        ],
      },
      include: [AUTHOR_INCLUDE],
      order: [["creado", "ASC"]],
      limit: QUEUE_LIMIT,
    }),
  ]);

  const posts: QueuePostItem[] = postRows.map((row) => {
    const reports = reportsByTarget.get(`post:${row.id}`) ?? [];
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      media: row.media ?? [],
      status: row.status,
      hidden_reason: row.hidden_reason ?? null,
      author: toAuthorDTO(row.author),
      creado: row.creado,
      report_count: reports.length,
      reports,
    };
  });

  const comments: QueueCommentItem[] = commentRows.map((row) => {
    const reports = reportsByTarget.get(`comment:${row.id}`) ?? [];
    return {
      id: row.id,
      post_id: row.post_id,
      body: row.body,
      status: row.status,
      hidden_reason: row.hidden_reason ?? null,
      author: toAuthorDTO(row.author),
      creado: row.creado,
      report_count: reports.length,
      reports,
    };
  });

  return { posts, comments };
}

const CommunityService = {
  buildFeedOrder,
  buildCommentTree,
  listPosts,
  getPost,
  createPost,
  createComment,
  toggleLike,
  removePost,
  removeComment,
  updatePost,
  updateComment,
  setPinned,
  setCommentPinned,
  reportContent,
  hidePost,
  unhidePost,
  hideComment,
  unhideComment,
  getModerationQueue,
  userHasPermission,
};

export = CommunityService;
