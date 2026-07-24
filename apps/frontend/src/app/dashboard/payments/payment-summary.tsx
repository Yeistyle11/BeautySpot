"use client";

// Resumen de pagos agrupados por metodo (efectivo, tarjeta, transferencia).
import { Banknote, CreditCard, Smartphone, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { PaymentSummary as Summary } from "./schemas";

function SummaryCard({
  icon,
  iconClass,
  label,
  amount,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  amount: number;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="truncate text-lg font-bold">{formatCurrency(amount)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Totales del dia por metodo de cobro. */
export function PaymentSummaryCards({ summary }: { summary: Summary }) {
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        icon={<Wallet className="text-success h-5 w-5" />}
        iconClass="bg-success-soft"
        label="Total hoy"
        amount={summary.total}
      />
      <SummaryCard
        icon={<Banknote className="text-success h-5 w-5" />}
        iconClass="bg-success-soft"
        label="Efectivo"
        amount={summary.cash}
      />
      <SummaryCard
        icon={<CreditCard className="text-info h-5 w-5" />}
        iconClass="bg-info-soft"
        label="Tarjeta"
        amount={summary.card}
      />
      <SummaryCard
        icon={<Smartphone className="text-primary h-5 w-5" />}
        iconClass="bg-primary/10"
        label="Transferencia"
        amount={summary.transfer}
      />
    </div>
  );
}
