import "express";
import { Role } from "@beautyspot/shared-types";

// Extiende el Request de Express con los campos que inyectan los guards:
// `businessId` (tenant resuelto) y `user` (payload del JWT autenticado).
declare module "express-serve-static-core" {
  interface Request {
    businessId?: string;
    user?: {
      userId: string;
      email: string;
      role: Role;
      businessId?: string;
      businessIds?: string[];
    };
  }
}
