import "express";
import { Role } from "@beautyspot/shared-types";

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
