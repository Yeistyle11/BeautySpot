import { ApiError } from "../api-error";
import { descargarPdf } from "../descargar";

describe("descargarPdf", () => {
  const fetchMock = jest.fn();
  const createObjectURL = jest.fn(() => "blob:factura");
  const revokeObjectURL = jest.fn();
  let click: jest.SpyInstance;

  /** Respuesta mínima con la superficie que consume la descarga. */
  const respuesta = (status: number, tipo: string) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": tipo }),
    blob: async () => new Blob(["%PDF-1.3"], { type: tipo }),
  });

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    click = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    click.mockRestore();
    jest.clearAllMocks();
  });

  it("guarda el PDF con el nombre indicado", async () => {
    fetchMock.mockResolvedValue(respuesta(200, "application/pdf"));

    await descargarPdf("/payment/invoices/1/pdf", "factura-A-00001.pdf");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/payment/invoices/1/pdf",
      expect.objectContaining({ credentials: "include" })
    );
    expect(click).toHaveBeenCalledTimes(1);
    const enlace = click.mock.contexts[0] as HTMLAnchorElement;
    expect(enlace.download).toBe("factura-A-00001.pdf");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:factura");
  });

  it("falla con el estado del gateway cuando la respuesta no es correcta", async () => {
    fetchMock.mockResolvedValue(respuesta(404, "application/json"));

    await expect(
      descargarPdf("/payment/invoices/1/pdf", "factura.pdf")
    ).rejects.toMatchObject({ status: 404 });
    expect(click).not.toHaveBeenCalled();
  });

  it("no guarda como PDF una respuesta correcta que no lo es", async () => {
    fetchMock.mockResolvedValue(respuesta(200, "application/json"));

    await expect(
      descargarPdf("/payment/invoices/1/pdf", "factura.pdf")
    ).rejects.toBeInstanceOf(ApiError);
    expect(click).not.toHaveBeenCalled();
  });
});
