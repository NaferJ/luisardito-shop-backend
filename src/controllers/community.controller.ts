import type { Request, Response } from "express";
import CommunityService from "../services/community.service";
import { listPostsQuerySchema } from "../schemas/community.schema";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/AppError";

// Express 5 exposes req.query as a getter-only property, so the shared
// validate middleware cannot assign the parsed query back to req.query.
// The list endpoint parses and validates the query here instead.
const listPosts = asyncHandler(async (req: Request, res: Response) => {
  const parsed = listPostsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(" ");
    throw new AppError(message, 400, { issues: parsed.error.issues });
  }

  const result = await CommunityService.listPosts({
    sort: parsed.data.sort ?? "new",
    page: parsed.data.page ?? 1,
    limit: parsed.data.limit ?? 20,
    viewerId: req.user ? req.user.id : null,
  });
  res.json(result);
});

const createPost = asyncHandler(async (req: Request, res: Response) => {
  const post = await CommunityService.createPost(req.user.id, req.body);
  res.status(201).json(post);
});

const getPost = asyncHandler(async (req: Request, res: Response) => {
  const post = await CommunityService.getPost(
    Number(req.params.id),
    req.user,
    req.ip
  );
  res.json(post);
});

const createComment = asyncHandler(async (req: Request, res: Response) => {
  const comment = await CommunityService.createComment(
    Number(req.params.id),
    req.user,
    req.body.body,
    req.body.parent_id
  );
  res.status(201).json(comment);
});

const updatePost = asyncHandler(async (req: Request, res: Response) => {
  const post = await CommunityService.updatePost(
    Number(req.params.id),
    req.user,
    req.body
  );
  res.json(post);
});

const updateComment = asyncHandler(async (req: Request, res: Response) => {
  const comment = await CommunityService.updateComment(
    Number(req.params.id),
    req.user,
    req.body.body
  );
  res.json(comment);
});

const likePost = asyncHandler(async (req: Request, res: Response) => {
  const result = await CommunityService.toggleLike(
    req.user.id,
    "post",
    Number(req.params.id)
  );
  res.json(result);
});

const likeComment = asyncHandler(async (req: Request, res: Response) => {
  const result = await CommunityService.toggleLike(
    req.user.id,
    "comment",
    Number(req.params.id)
  );
  res.json(result);
});

const removePost = asyncHandler(async (req: Request, res: Response) => {
  const post = await CommunityService.removePost(
    Number(req.params.id),
    req.user
  );
  res.json(post);
});

const removeComment = asyncHandler(async (req: Request, res: Response) => {
  const comment = await CommunityService.removeComment(
    Number(req.params.id),
    req.user
  );
  res.json(comment);
});

const setPinned = asyncHandler(async (req: Request, res: Response) => {
  const post = await CommunityService.setPinned(
    Number(req.params.id),
    req.body.pinned,
    req.user.id
  );
  res.json(post);
});

const setCommentPinned = asyncHandler(async (req: Request, res: Response) => {
  const comment = await CommunityService.setCommentPinned(
    Number(req.params.id),
    req.body.pinned,
    req.user
  );
  res.json(comment);
});

// reportContent returns `created` so a repeat report can be answered with
// 200 (idempotent) while a brand-new report gets 201.
const reportPost = asyncHandler(async (req: Request, res: Response) => {
  const { report, created } = await CommunityService.reportContent(
    req.user,
    "post",
    Number(req.params.id),
    req.body
  );
  res.status(created ? 201 : 200).json(report);
});

const reportComment = asyncHandler(async (req: Request, res: Response) => {
  const { report, created } = await CommunityService.reportContent(
    req.user,
    "comment",
    Number(req.params.id),
    req.body
  );
  res.status(created ? 201 : 200).json(report);
});

const hidePost = asyncHandler(async (req: Request, res: Response) => {
  const post = await CommunityService.hidePost(
    Number(req.params.id),
    req.user,
    req.body?.reason
  );
  res.json(post);
});

const unhidePost = asyncHandler(async (req: Request, res: Response) => {
  const post = await CommunityService.unhidePost(
    Number(req.params.id),
    req.user
  );
  res.json(post);
});

const hideComment = asyncHandler(async (req: Request, res: Response) => {
  const comment = await CommunityService.hideComment(
    Number(req.params.id),
    req.user,
    req.body?.reason
  );
  res.json(comment);
});

const unhideComment = asyncHandler(async (req: Request, res: Response) => {
  const comment = await CommunityService.unhideComment(
    Number(req.params.id),
    req.user
  );
  res.json(comment);
});

const getModerationQueue = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(await CommunityService.getModerationQueue());
  }
);

export = {
  listPosts,
  createPost,
  getPost,
  createComment,
  likePost,
  likeComment,
  removePost,
  removeComment,
  updatePost,
  updateComment,
  setPinned,
  setCommentPinned,
  reportPost,
  reportComment,
  hidePost,
  unhidePost,
  hideComment,
  unhideComment,
  getModerationQueue,
};
