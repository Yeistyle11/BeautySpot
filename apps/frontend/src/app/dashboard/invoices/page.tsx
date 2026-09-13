"use client";

// Pagina de facturas del negocio: listado con filtros, detalle, PDF, cambio de
// estado y emision desde un cobro.
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import {
  TablaDeRegistros,
  FilaDeTabla,
  CeldaDeTabla,
  CeldaPrincipal,
  type ColumnaDeTabla,
} from "@/components/ui/tabla-de-registros";
import { FilterChip } from "@/components/ui/filter-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import { LoadingState } from "@/components/ui/loading-state";
import { Download, FileText, Plus, Receipt } from "lucide-react";
import { api } from "@/lib/api";
import { useApi, paginatedSchema, revalidatePrefix } from "@/lib/swr";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { descargarPdf } from "@/lib/descargar";
import { formatCurrency, formatDate } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { mensajeDeError } from "@/lib/error-message";
import { useToast } from "@/components/ui/toast";
import { InvoiceDetailDialog } from "./invoice-detail-dialog";
import { EmitirDialog } from "./emitir-dialog";
import {
  clientSchema,
  cobroFacturableSchema,
  invoiceSchema,
  CLIENTS_KEY,
  ESTADOS,
  FILTROS_DE_ESTADO,
  INVOICES_KEY,
  type Client,
  type CobroFacturable,
  type Invoice,
} from "./schemas";

/** Cobros completados entre los que se elige al emitir. */
const COBROS_KEY = "/payment/payments?status=COMPLETED&limit=50";

const COLUMNAS_DE_FACTURAS: ColumnaDeTabla[] = [
  { label: "Factura" },
  { label: "Cliente" },
  { label: "Fecha", ocultaEnMovil: true },
  { label: "Total", alineacion: "right" },
  { label: "Estado" },
];

export default function InvoicesPage() {
  const toast = useToast();
  const { role } = useAuthStore();
  const puedeEmitir = canDo(role, "invoices_create");

  const [estado, setEstado] = useState("all");
  const [detalle, setDetalle] = useState<Invoice | null>(null);
  const [emitirDialog, setEmitirDialog] = useState(false);
  const [emitiendo, setEmitiendo] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [errorAlEmitir, setErrorAlEmitir] = useState("");

  const {
    items: invoices,
    meta,
    setPage,
    isLoading,
    error,
    mutate: recargar,
  } = usePaginatedList<Invoice>({
    basePath: INVOICES_KEY,
    itemSchema: invoiceSchema,
    params: estado === "all" ? undefined : { status: estado },
  });

  // Los nombres de los clientes se piden aparte: la factura solo trae su id. Las
  // dos rutas son paginadas, así que llegan envueltas en { data, meta } y hay que
  // validarlas como tales.
  const { data: clientesPage } = useApi(
    CLIENTS_KEY,
    undefined,
    paginatedSchema(clientSchema)
  );
  const clientes = useMemo(() => {
    const mapa: Record<string, string> = {};
    (clientesPage?.data ?? []).forEach((c: Client) => {
      mapa[c.id] = c.name;
    });
    return mapa;
  }, [clientesPage]);

  // Los cobros solo hacen falta con el diálogo abierto.
  const {
    data: cobrosPage,
    isLoading: cargandoCobros,
    error: errorCobros,
  } = useApi(
    emitirDialog ? COBROS_KEY : null,
    undefined,
    paginatedSchema(cobroFacturableSchema)
  );

  const descargar = async (invoice: Invoice) => {
    try {
      await descargarPdf(
        `${INVOICES_KEY}/${invoice.id}/pdf`,
        `factura-${invoice.number}.pdf`
      );
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    }
  };

  const emitir = async (cobro: CobroFacturable) => {
    setEmitiendo(cobro.id);
    setErrorAlEmitir("");
    try {
      await api.post(INVOICES_KEY, { paymentId: cobro.id });
      await recargar();
      // Ese cobro ya no se puede volver a facturar: la lista lo refleja.
      revalidatePrefix("/payment/payments");
      setEmitirDialog(false);
      toast.exito("Factura emitida");
    } catch (err) {
      logger.error(err);
      setErrorAlEmitir(mensajeDeError(err));
    } finally {
      setEmitiendo(null);
    }
  };

  const cambiarEstado = async (invoice: Invoice, nuevo: string) => {
    setCambiando(true);
    try {
      const actualizada = await api.patch<Invoice>(
        `${INVOICES_KEY}/${invoice.id}/status`,
        { status: nuevo }
      );
      await recargar();
      setDetalle({ ...invoice, ...actualizada });
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setCambiando(false);
    }
  };

  if (error) return <ErrorDeCarga error={error} recurso="las facturas" />;

  return (
    <div>
      <PageHeader
        titulo="Facturas"
        descripcion="Las facturas que emite el negocio, con su PDF"
        accion={
          puedeEmitir && (
            <Button onClick={() => setEmitirDialog(true)}>
              <Plus className="mr-2 h-4 w-4" /> Emitir factura
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS_DE_ESTADO.map((filtro) => (
          <FilterChip
            key={filtro.valor}
            activo={estado === filtro.valor}
            onClick={() => setEstado(filtro.valor)}
          >
            {filtro.etiqueta}
          </FilterChip>
        ))}
      </div>

      {isLoading ? (
        <LoadingState recurso="las facturas" />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          titulo={
            estado === "all"
              ? "Aún no hay facturas"
              : "Ninguna factura en ese estado"
          }
          descripcion={
            estado === "all"
              ? "Emite la primera desde un cobro ya registrado."
              : "Prueba con otro filtro."
          }
        />
      ) : (
        <>
          <TablaDeRegistros
            titulo="Facturas emitidas"
            columnas={COLUMNAS_DE_FACTURAS}
          >
            {invoices.map((invoice) => {
              const badge = ESTADOS[invoice.status] ?? {
                label: invoice.status,
                variant: "secondary" as const,
              };
              return (
                <FilaDeTabla
                  key={invoice.id}
                  acciones={
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => descargar(invoice)}
                      aria-label={`Descargar la factura ${invoice.number}`}
                      title="Descargar PDF"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  }
                >
                  <CeldaPrincipal
                    icono={FileText}
                    titulo={
                      /* El numero abre el desglose, tambien con teclado. */
                      <button
                        type="button"
                        onClick={() => setDetalle(invoice)}
                        aria-label={`Ver la factura ${invoice.number}`}
                        className="focus-visible:ring-ring hover:text-primary rounded-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
                      >
                        {invoice.number}
                      </button>
                    }
                  />
                  <CeldaDeTabla apagada>
                    {clientes[invoice.clientId] || "Cliente"}
                  </CeldaDeTabla>
                  <CeldaDeTabla apagada ocultaEnMovil>
                    <span className="whitespace-nowrap">
                      {formatDate(invoice.date)}
                    </span>
                  </CeldaDeTabla>
                  <CeldaDeTabla alineacion="right" className="font-semibold">
                    {formatCurrency(invoice.total)}
                  </CeldaDeTabla>
                  <CeldaDeTabla>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </CeldaDeTabla>
                </FilaDeTabla>
              );
            })}
          </TablaDeRegistros>
          <Pagination meta={meta} onPageChange={setPage} itemLabel="facturas" />
        </>
      )}

      <InvoiceDetailDialog
        invoice={detalle}
        onClose={() => setDetalle(null)}
        onDescargar={descargar}
        onCambiarEstado={cambiarEstado}
        cliente={detalle ? clientes[detalle.clientId] : undefined}
        puedeCambiarEstado={canDo(role, "invoices_status")}
        cambiando={cambiando}
      />

      <EmitirDialog
        open={emitirDialog}
        onClose={() => setEmitirDialog(false)}
        onEmitir={emitir}
        cobros={cobrosPage?.data ?? []}
        clientes={clientes}
        cargando={cargandoCobros}
        errorAlCargar={errorCobros}
        emitiendo={emitiendo}
        error={errorAlEmitir}
      />
    </div>
  );
}
