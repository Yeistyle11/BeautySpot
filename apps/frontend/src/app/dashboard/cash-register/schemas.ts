// Esquemas Zod y tipos de la caja registradora.
import { z } from "zod";

export const cashSessionSchema = z.object({
  id: z.string(),
  openingAmount: z.number(),
  closingAmount: z.number().nullish(),
  openedAt: z.string(),
  closedAt: z.string().nullish(),
  notes: z.string().nullish(),
  isOpen: z.boolean().optional(),
});
export type CashSession = z.infer<typeof cashSessionSchema>;

export const cashMovementSchema = z.object({
  id: z.string(),
  type: z.enum(["IN", "OUT"]),
  amount: z.number(),
  concept: z.string(),
  createdAt: z.string(),
});
export type CashMovement = z.infer<typeof cashMovementSchema>;

export const cashSummarySchema = z.object({
  movements: z.array(cashMovementSchema),
});

export const ACTIVE_KEY = "/payment/cash-register/active";
export const HISTORY_KEY = "/payment/cash-register/history";
