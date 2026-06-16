import "express";

declare global {
  namespace Express {
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
}
