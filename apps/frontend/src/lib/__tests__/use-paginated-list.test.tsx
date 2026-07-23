import { renderHook, waitFor, act } from "@testing-library/react";
import { SWRConfig } from "swr";
import { z } from "zod";
import { usePaginatedList } from "../use-paginated-list";
import { api } from "../api";

jest.mock("../api", () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>
      {children}
    </SWRConfig>
  );
}

const itemSchema = z.object({ id: z.string() });

function page(
  items: { id: string }[],
  meta: Partial<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> = {}
) {
  return {
    data: items,
    meta: {
      page: 1,
      limit: 20,
      total: items.length,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
      ...meta,
    },
  };
}

describe("usePaginatedList", () => {
  beforeEach(() => jest.clearAllMocks());

  it("pide la primera pagina con page y limit en la query", async () => {
    mockedApi.get.mockResolvedValue(page([{ id: "1" }]));

    const { result } = renderHook(
      () => usePaginatedList({ basePath: "/clients", itemSchema }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockedApi.get).toHaveBeenCalledWith("/clients?page=1&limit=20");
    expect(result.current.items).toEqual([{ id: "1" }]);
  });

  it("cambiar de pagina vuelve a pedir con el nuevo page", async () => {
    mockedApi.get.mockResolvedValue(
      page([{ id: "1" }], { totalPages: 3, hasNext: true, total: 50 })
    );

    const { result } = renderHook(
      () => usePaginatedList({ basePath: "/clients", itemSchema }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setPage(2));

    await waitFor(() =>
      expect(mockedApi.get).toHaveBeenCalledWith("/clients?page=2&limit=20")
    );
  });

  it("manda la busqueda al servidor y no filtra en cliente", async () => {
    mockedApi.get.mockResolvedValue(page([{ id: "1" }]));

    const { result } = renderHook(
      () =>
        usePaginatedList({ basePath: "/clients", itemSchema, search: "ana" }),
      { wrapper }
    );

    await waitFor(() =>
      expect(mockedApi.get).toHaveBeenCalledWith(
        "/clients?page=1&limit=20&search=ana"
      )
    );
    expect(result.current.items).toEqual([{ id: "1" }]);
  });

  it("omite de la query los filtros vacios", async () => {
    mockedApi.get.mockResolvedValue(page([]));

    renderHook(
      () =>
        usePaginatedList({
          basePath: "/payments",
          itemSchema,
          params: { method: undefined, from: "" },
        }),
      { wrapper }
    );

    await waitFor(() =>
      expect(mockedApi.get).toHaveBeenCalledWith("/payments?page=1&limit=20")
    );
  });

  it("vuelve a la pagina 1 cuando cambia la busqueda", async () => {
    mockedApi.get.mockResolvedValue(
      page([{ id: "1" }], { totalPages: 5, hasNext: true, total: 90 })
    );

    const { result, rerender } = renderHook(
      ({ search }) => usePaginatedList({ basePath: "/c", itemSchema, search }),
      { wrapper, initialProps: { search: "" } }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.page).toBe(3));

    rerender({ search: "ana" });

    await waitFor(() => expect(result.current.page).toBe(1));
  });

  it("retrocede si la pagina actual supera el total devuelto", async () => {
    mockedApi.get.mockResolvedValue(
      page([{ id: "1" }], { page: 4, totalPages: 2, total: 25 })
    );

    const { result } = renderHook(
      () => usePaginatedList({ basePath: "/c", itemSchema }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setPage(4));

    await waitFor(() => expect(result.current.page).toBe(2));
  });
});
