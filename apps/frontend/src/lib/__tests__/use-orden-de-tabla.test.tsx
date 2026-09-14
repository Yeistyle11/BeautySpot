import { act, renderHook } from "@testing-library/react";
import { useOrdenDeTabla } from "../use-orden-de-tabla";

describe("useOrdenDeTabla", () => {
  it("arranca por el campo y el sentido pedidos", () => {
    const { result } = renderHook(() => useOrdenDeTabla("name"));

    expect(result.current.orden).toEqual({ campo: "name", direccion: "asc" });
    expect(result.current.params).toEqual({ sort: "name", order: "ASC" });
  });

  it("da la vuelta al sentido al repetir la columna", () => {
    const { result } = renderHook(() => useOrdenDeTabla("name"));

    act(() => result.current.alternarOrden("name"));
    expect(result.current.orden.direccion).toBe("desc");
    expect(result.current.params.order).toBe("DESC");

    act(() => result.current.alternarOrden("name"));
    expect(result.current.orden.direccion).toBe("asc");
  });

  it("otra columna vuelve al sentido inicial", () => {
    const { result } = renderHook(() =>
      useOrdenDeTabla<"date" | "price">("date", "desc")
    );

    act(() => result.current.alternarOrden("date"));
    expect(result.current.orden.direccion).toBe("asc");

    act(() => result.current.alternarOrden("price"));
    expect(result.current.orden).toEqual({ campo: "price", direccion: "desc" });
  });
});
