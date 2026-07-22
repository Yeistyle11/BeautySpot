import { withSerializableRetry } from "./serializable-retry";

describe("withSerializableRetry", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
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

  it("relanza el error tras agotar los intentos", async () => {
    const op = jest.fn().mockRejectedValue({ code: "40001" });

    await expect(withSerializableRetry(op, 3)).rejects.toEqual({
      code: "40001",
    });
    expect(op).toHaveBeenCalledTimes(3);
  });
});
