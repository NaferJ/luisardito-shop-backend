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
    req.body.body
  );
  res.status(201).json(comment);
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

export = {
  listPosts,
  createPost,
  getPost,
  createComment,
  likePost,
  likeComment,
  removePost,
  removeComment,
  setPinned,
};
