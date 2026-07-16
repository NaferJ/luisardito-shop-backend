import { z } from "zod";

const registerSchema = z.object({
  nickname: z
    .string({ message: "nickname is required" })
    .trim()
    .min(1, { message: "nickname is required" }),
  email: z
    .string({ message: "email is required" })
    .trim()
    .min(1, { message: "email is required" })
    .email({ message: "email must be a valid email address" }),
  password: z
    .string({ message: "password is required" })
    .min(1, { message: "password is required" }),
});

const loginSchema = z.object({
  nickname: z
    .string({ message: "nickname is required" })
    .min(1, { message: "nickname is required" }),
  password: z
    .string({ message: "password is required" })
    .min(1, { message: "password is required" }),
});

const refreshSchema = z.object({
  refreshToken: z
    .string({ message: "refreshToken is required" })
    .min(1, { message: "refreshToken is required" }),
});

const logoutSchema = z.object({
  refreshToken: z
    .string({ message: "refreshToken is required" })
    .min(1, { message: "refreshToken is required" }),
});

export { registerSchema, loginSchema, refreshSchema, logoutSchema };
