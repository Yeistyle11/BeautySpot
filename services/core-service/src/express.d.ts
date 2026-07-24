import "express";

/** Extiende Request de Express con el tenant y el usuario que inyectan los guards. */
declare module "express-serve-static-core" {
  interface Request {
    businessId: string;
    user?: {
      userId: string;
      email: string;
      role: string;
      businessId?: string;
    };
  }
}
