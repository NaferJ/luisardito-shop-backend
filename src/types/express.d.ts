import type { Usuario } from "../models/usuario.model";

// Express Request augmentation: the auth middleware attaches the
// authenticated Usuario instance (or null when unauthenticated).
declare module "express-serve-static-core" {
  interface Request {
    user: Usuario | null;
  }
}
