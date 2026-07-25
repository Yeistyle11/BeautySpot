import { DataSource, EntityManager } from "typeorm";
import { ProcessedEventsStore } from "./processed-events.store";

/**
 * DataSource mínimo: `transaction(fn)` ejecuta el callback con un manager cuyo
 * INSERT devuelve las filas que se le indiquen. `raw` vacío significa que el
 * ON CONFLICT DO NOTHING no insertó nada, es decir, que ya estaba procesado.
 */
function dataSourceCon(filasInsertadas: unknown[]): {
  dataSource: DataSource;
  manager: EntityManager;
} {
  const manager = {
    createQueryBuilder: () => ({
      insert: () => ({
        into: () => ({
          values: () => ({
            orIgnore: () => ({
              execute: async () => ({ raw: filasInsertadas }),
            }),
          }),
        }),
      }),
    }),
  } as unknown as EntityManager;

  const dataSource = {
    transaction: (fn: (m: EntityManager) => Promise<unknown>) => fn(manager),
  } as unknown as DataSource;

  return { dataSource, manager };
}

const evento = {
  eventId: "11111111-1111-4111-8111-111111111111",
  eventType: "booking.appointment.created",
};

describe("ProcessedEventsStore", () => {
  it("ejecuta el trabajo la primera vez que ve el evento", async () => {
    const { dataSource, manager } = dataSourceCon([
      { event_id: evento.eventId },
    ]);
    const store = new ProcessedEventsStore(dataSource);
    const trabajo = jest.fn().mockResolvedValue(undefined);

    const aplicado = await store.once(evento, "analytics:cita creada", trabajo);

    expect(aplicado).toBe(true);
    expect(trabajo).toHaveBeenCalledWith(manager);
  });

  // Es el caso que evita corromper los contadores: la reentrega no debe sumar.
  it("no ejecuta el trabajo si el handler ya procesó el evento", async () => {
    const { dataSource } = dataSourceCon([]);
    const store = new ProcessedEventsStore(dataSource);
    const trabajo = jest.fn().mockResolvedValue(undefined);

    const aplicado = await store.once(evento, "analytics:cita creada", trabajo);

    expect(aplicado).toBe(false);
    expect(trabajo).not.toHaveBeenCalled();
  });

  // La marca y el trabajo comparten transacción: si el trabajo falla, el error
  // sale hacia arriba y la transacción revierte también la marca.
  it("propaga el error del trabajo para que la transacción revierta la marca", async () => {
    const { dataSource } = dataSourceCon([{ event_id: evento.eventId }]);
    const store = new ProcessedEventsStore(dataSource);
    const trabajo = jest
      .fn()
      .mockRejectedValue(new Error("fallo de escritura"));

    await expect(
      store.once(evento, "analytics:cita creada", trabajo)
    ).rejects.toThrow("fallo de escritura");
  });

  it("procesa el evento aunque no traiga eventId, avisando de que no hay control de duplicados", async () => {
    const { dataSource, manager } = dataSourceCon([]);
    const store = new ProcessedEventsStore(dataSource);
    const trabajo = jest.fn().mockResolvedValue(undefined);
    const warn = jest
      .spyOn(store["logger"], "warn")
      .mockImplementation(() => undefined);

    const aplicado = await store.once(
      { eventId: "", eventType: "legacy.evento" },
      "analytics:legacy",
      trabajo
    );

    expect(aplicado).toBe(true);
    expect(trabajo).toHaveBeenCalledWith(manager);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("sin eventId"));
  });

  it("distingue el mismo evento procesado por handlers distintos", async () => {
    const { dataSource } = dataSourceCon([{ event_id: evento.eventId }]);
    const store = new ProcessedEventsStore(dataSource);
    const trabajo = jest.fn().mockResolvedValue(undefined);

    await store.once(evento, "analytics:cita creada", trabajo);
    await store.once(evento, "analytics:pago", trabajo);

    expect(trabajo).toHaveBeenCalledTimes(2);
  });
});
