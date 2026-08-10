"use client";

// Facturas del cliente, de todos los negocios donde haya comprado.
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import { Download, Receipt } from "lucide-react";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { descargarPdf } from "@/lib/descargar";
import { formatCurrency, formatDate } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { mensajeDeError } from "@/lib/error-message";

const invoiceSchema = z.object({
  id: z.string(),
  number: z.string(),
  date: z.string(),
  total: z.number(),
  status: z.string(),
});
type Invoice = z.infer<typeof invoiceSchema>;

const MY_INVOICES_KEY = "/payment/invoices/mine";

/** Cómo se pinta cada estado de factura. */
const ESTADOS: Record<
  string,
  { label: string; variant: "secondary" | "success" | "destructive" }
> = {
  DRAFT: { label: "Borrador", variant: "secondary" },
  SENT: { label: "Enviada", variant: "secondary" },
  PAID: { label: "Pagada", variant: "success" },
  CANCELLED: { label: "Anulada", variant: "destructive" },
};

export default function ClientInvoicesPage() {
  const toast = useToast();
  const {
    items: invoices,
    meta,
    setPage,
    isLoading,
    error,
  } = usePaginatedList<Invoice>({
    basePath: MY_INVOICES_KEY,
    itemSchema: invoiceSchema,
  });

  const descargar = async (invoice: Invoice) => {
    try {
      await descargarPdf(
        `${MY_INVOICES_KEY}/${invoice.id}/pdf`,
        `factura-${invoice.number}.pdf`
      );
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    }
  };

  if (error) return <ErrorDeCarga error={error} recurso="las facturas" />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mis facturas</h1>
        <p className="text-muted-foreground">
          Las facturas de todos los negocios donde has reservado
        </p>
      </div>

      {isLoading ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="text-muted-foreground p-8 text-center">
            Cargando facturas...
          </CardContent>
        </Card>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          titulo="Todavía no tienes facturas"
          descripcion="Aquí aparecerán las de los servicios que te facturen."
        />
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const estado = ESTADOS[invoice.status] ?? {
              label: invoice.status,
              variant: "secondary" as const,
            };
            return (
              <Card key={invoice.id} className="border-0 shadow-sm">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{invoice.number}</p>
                    <p className="text-muted-foreground text-sm">
                      {formatDate(invoice.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      {formatCurrency(invoice.total)}
                    </span>
                    <Badge variant={estado.variant}>{estado.label}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => descargar(invoice)}
                      className="gap-1"
                    >
                      <Download className="h-3 w-3" /> PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <Pagination meta={meta} onPageChange={setPage} itemLabel="facturas" />
        </div>
      )}
    </div>
  );
}
