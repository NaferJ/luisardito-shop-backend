import { Router } from "express";
import communityCtrl from "../controllers/community.controller";
import auth from "../middleware/auth.middleware";
import authRequired from "../middleware/authRequired.middleware";
import permiso from "../middleware/permisos.middleware";
import {
  communityPostLimiter,
  communityWriteLimiter,
} from "../middleware/rateLimit.middleware";
import validate from "../middleware/validate.middleware";
import {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  updateCommentSchema,
  postIdParamSchema,
  pinSchema,
} from "../schemas/community.schema";

const router = Router();

// Feed: public read, optional auth (req.user may be null). The sort/page/limit
// query is validated inside the controller because Express 5 makes req.query
// getter-only and the shared validate middleware cannot reassign it.
router.get("/posts", auth, communityCtrl.listPosts);

router.post(
  "/posts",
  authRequired,
  communityPostLimiter,
  validate(createPostSchema),
  communityCtrl.createPost
);

router.get(
  "/posts/:id",
  auth,
  validate(postIdParamSchema, "params"),
  communityCtrl.getPost
);

router.post(
  "/posts/:id/comments",
  authRequired,
  communityWriteLimiter,
  validate(postIdParamSchema, "params"),
  validate(createCommentSchema),
  communityCtrl.createComment
);

router.post(
  "/posts/:id/like",
  authRequired,
  communityWriteLimiter,
  validate(postIdParamSchema, "params"),
  communityCtrl.likePost
);

router.post(
  "/comments/:id/like",
  authRequired,
  communityWriteLimiter,
  validate(postIdParamSchema, "params"),
  communityCtrl.likeComment
);

router.delete(
  "/posts/:id",
  authRequired,
  validate(postIdParamSchema, "params"),
  communityCtrl.removePost
);

router.delete(
  "/comments/:id",
  authRequired,
  validate(postIdParamSchema, "params"),
  communityCtrl.removeComment
);

// "/posts/:id" is a single-segment match and cannot shadow "/posts/:id/pin".
// Edits use the write limiter, not the strict post-creation bucket.
router.patch(
  "/posts/:id",
  authRequired,
  communityWriteLimiter,
  validate(postIdParamSchema, "params"),
  validate(updatePostSchema),
  communityCtrl.updatePost
);

router.patch(
  "/comments/:id",
  authRequired,
  communityWriteLimiter,
  validate(postIdParamSchema, "params"),
  validate(updateCommentSchema),
  communityCtrl.updateComment
);

// Comment pinning is decided in the service: the post author OR a user with
// the moderar_comunidad permission may pin, so no permiso() gate here.
router.patch(
  "/comments/:id/pin",
  authRequired,
  validate(postIdParamSchema, "params"),
  validate(pinSchema),
  communityCtrl.setCommentPinned
);

router.patch(
  "/posts/:id/pin",
  authRequired,
  permiso("fijar_comunidad"),
  validate(postIdParamSchema, "params"),
  validate(pinSchema),
  communityCtrl.setPinned
);

export = router;
