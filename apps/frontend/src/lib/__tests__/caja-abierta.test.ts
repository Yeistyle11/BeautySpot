import { motivoParaNoCobrar } from "../caja-abierta";
import { api } from "../api";

jest.mock("../api", () => ({ api: { get: jest.fn() } }));

const get = api.get as jest.Mock;

describe("motivoParaNoCobrar", () => {
  beforeEach(() => jest.clearAllMocks());

  it("no consulta la caja cuando el cobro no es en efectivo", async () => {
    await expect(motivoParaNoCobrar("CARD")).resolves.toBeNull();
    await expect(motivoParaNoCobrar("TRANSFER")).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("deja cobrar en efectivo si hay una caja abierta", async () => {
    get.mockResolvedValue({ id: "caja-1" });

    await expect(motivoParaNoCobrar("CASH")).resolves.toBeNull();
    expect(get).toHaveBeenCalledWith("/payment/cash-register/active");
  });

  it("explica que hay que abrir la caja cuando no hay ninguna", async () => {
    get.mockResolvedValue(null);

    await expect(motivoParaNoCobrar("CASH")).resolves.toBe(
      "No hay una caja abierta: ábrela antes de cobrar en efectivo"
    );
  });
});
