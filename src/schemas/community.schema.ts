import { z } from "zod";

const CLOUDINARY_URL = /^https:\/\/res\.cloudinary\.com\//;

const mediaItemSchema = z.object({
  type: z.enum(["image", "video"], {
    message: "media type must be image or video",
  }),
  url: z
    .string({ message: "media url is required" })
    .regex(CLOUDINARY_URL, { message: "media url must be a Cloudinary URL" }),
  thumbnail_url: z
    .string()
    .regex(CLOUDINARY_URL, {
      message: "thumbnail url must be a Cloudinary URL",
    })
    .optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const postTitleSchema = z
  .string({ message: "title is required" })
  .trim()
  .min(3, { message: "title must be at least 3 characters" })
  .max(200, { message: "title must be at most 200 characters" });

const postBodySchema = z
  .string({ message: "body is required" })
  .trim()
  .min(1, { message: "body is required" })
  .max(5000, { message: "body must be at most 5000 characters" });

const commentBodySchema = z
  .string({ message: "body is required" })
  .trim()
  .min(1, { message: "body is required" })
  .max(2000, { message: "body must be at most 2000 characters" });

const createPostSchema = z.object({
  title: postTitleSchema,
  body: postBodySchema,
  media: z
    .array(mediaItemSchema)
    .max(4, { message: "a post can have at most 4 media items" })
    .optional(),
});

const updatePostSchema = z
  .object({
    title: postTitleSchema.optional(),
    body: postBodySchema.optional(),
  })
  .refine((data) => data.title !== undefined || data.body !== undefined, {
    message: "at least one of title or body is required",
  });

const createCommentSchema = z.object({
  body: commentBodySchema,
  parent_id: z
    .number({ message: "parent_id must be a number" })
    .int({ message: "parent_id must be an integer" })
    .positive({ message: "parent_id must be a positive integer" })
    .nullish(),
});

const updateCommentSchema = z.object({
  body: commentBodySchema,
});

const listPostsQuerySchema = z.object({
  sort: z.enum(["new", "top", "hot"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const postIdParamSchema = z.object({
  id: z.coerce
    .number({ message: "id must be a number" })
    .int()
    .positive({ message: "id must be a positive integer" }),
});

const hideSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(255, { message: "reason must be at most 255 characters" })
    .optional(),
});

const pinSchema = z.object({
  pinned: z.boolean({ message: "pinned must be a boolean" }),
});

export {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  updateCommentSchema,
  listPostsQuerySchema,
  postIdParamSchema,
  hideSchema,
  pinSchema,
};
