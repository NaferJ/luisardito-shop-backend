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

const createPostSchema = z.object({
  title: z
    .string({ message: "title is required" })
    .trim()
    .min(3, { message: "title must be at least 3 characters" })
    .max(200, { message: "title must be at most 200 characters" }),
  body: z
    .string({ message: "body is required" })
    .trim()
    .min(1, { message: "body is required" })
    .max(5000, { message: "body must be at most 5000 characters" }),
  media: z
    .array(mediaItemSchema)
    .max(4, { message: "a post can have at most 4 media items" })
    .optional(),
});

const createCommentSchema = z.object({
  body: z
    .string({ message: "body is required" })
    .trim()
    .min(1, { message: "body is required" })
    .max(2000, { message: "body must be at most 2000 characters" }),
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
  createCommentSchema,
  listPostsQuerySchema,
  postIdParamSchema,
  hideSchema,
  pinSchema,
};
