describe("logger", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as { NODE_ENV?: string }).NODE_ENV = originalEnv;
    jest.resetModules();
  });

  it("reenvia a console en desarrollo", async () => {
    (process.env as { NODE_ENV?: string }).NODE_ENV = "development";
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    // Import dinamico para que el modulo capture el NODE_ENV actual.
    const { logger } = await import("../logger");
    logger.error("boom");
    expect(spy).toHaveBeenCalledWith("boom");
    spy.mockRestore();
  });

  it("no emite nada en produccion", async () => {
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { logger } = await import("../logger");
    logger.error("boom");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
