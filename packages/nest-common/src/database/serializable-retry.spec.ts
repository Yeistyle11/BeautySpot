import { withSerializableRetry } from "./serializable-retry";

describe("withSerializableRetry", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("devuelve el resultado sin reintentar cuando la operación tiene éxito", async () => {
    const op = jest.fn().mockResolvedValue("ok");

    await expect(withSerializableRetry(op)).resolves.toBe("ok");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("reintenta ante un error de serialización (40001) y termina bien", async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce({ code: "40001" })
      .mockResolvedValueOnce("ok");

    await expect(withSerializableRetry(op)).resolves.toBe("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("reintenta ante un deadlock (40P01)", async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce({ code: "40P01" })
      .mockResolvedValueOnce("ok");

    await expect(withSerializableRetry(op)).resolves.toBe("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("propaga de inmediato los errores no recuperables", async () => {
    const businessError = { code: "23505" };
    const op = jest.fn().mockRejectedValue(businessError);

    await expect(withSerializableRetry(op)).rejects.toBe(businessError);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("espera antes de reintentar, y la espera crece", async () => {
    // Con el azar fijado, la espera es la mitad del tope de cada intento:
    // 20 y 40 ms de tope dan 10 y 20.
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    const dormir = jest.spyOn(globalThis, "setTimeout");
    const op = jest
      .fn()
      .mockRejectedValueOnce({ code: "40001" })
      .mockRejectedValueOnce({ code: "40001" })
      .mockResolvedValueOnce("ok");

    await expect(withSerializableRetry(op, 3, 20)).resolves.toBe("ok");

    expect(dormir.mock.calls.map((llamada) => llamada[1])).toEqual([10, 20]);
  });

  // Dos transacciones que acaban de chocar no deben volver a la vez.
  it("reparte la espera al azar dentro del tope", async () => {
    const dormir = jest.spyOn(globalThis, "setTimeout");
    const op = jest
      .fn()
      .mockRejectedValueOnce({ code: "40001" })
      .mockResolvedValueOnce("ok");

    await withSerializableRetry(op, 3, 20);

    const espera = dormir.mock.calls[0][1] as number;
    expect(espera).toBeGreaterThanOrEqual(0);
    expect(espera).toBeLessThanOrEqual(20);
  });

  it("no espera cuando la operación va bien a la primera", async () => {
    const dormir = jest.spyOn(globalThis, "setTimeout");

    await withSerializableRetry(jest.fn().mockResolvedValue("ok"));

    expect(dormir).not.toHaveBeenCalled();
  });

  it("relanza el error tras agotar los intentos", async () => {
    const op = jest.fn().mockRejectedValue({ code: "40001" });

    await expect(withSerializableRetry(op, 3)).rejects.toEqual({
      code: "40001",
    });
    expect(op).toHaveBeenCalledTimes(3);
  });
});
