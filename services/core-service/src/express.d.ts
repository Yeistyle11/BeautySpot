import "express";

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
