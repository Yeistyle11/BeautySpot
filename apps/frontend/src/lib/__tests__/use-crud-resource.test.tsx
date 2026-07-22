import { renderHook, waitFor, act } from "@testing-library/react";
import { SWRConfig } from "swr";
import { useCrudResource } from "../use-crud-resource";
import { api } from "../api";

jest.mock("../api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function wrapper({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ dedupingInterval: 0 }}>{children}</SWRConfig>;
}

interface Item {
  id: string;
  name?: string;
}

describe("useCrudResource", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("carga la lista inicial haciendo GET al listKey", async () => {
    mockedApi.get.mockResolvedValue([{ id: "1" }]);

    const { result } = renderHook(
      () => useCrudResource<Item>({ listKey: "/x-load", basePath: "/x" }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockedApi.get).toHaveBeenCalledWith("/x-load");
    expect(result.current.items).toEqual([{ id: "1" }]);
  });

  it("devuelve un arreglo vacio mientras no hay datos", async () => {
    mockedApi.get.mockResolvedValue([]);
    const { result } = renderHook(
      () => useCrudResource<Item>({ listKey: "/x-empty", basePath: "/x" }),
      { wrapper }
    );
    expect(result.current.items).toEqual([]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("create hace POST al basePath y recarga la lista", async () => {
    mockedApi.get.mockResolvedValue([]);
    mockedApi.post.mockResolvedValue({ id: "2" });

    const { result } = renderHook(
      () => useCrudResource<Item>({ listKey: "/x-create", basePath: "/x" }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.create({ name: "nuevo" });
    });

    expect(mockedApi.post).toHaveBeenCalledWith("/x", { name: "nuevo" });
    expect(mockedApi.get).toHaveBeenCalledTimes(2);
  });

  it("update hace PATCH a basePath/id y recarga la lista", async () => {
    mockedApi.get.mockResolvedValue([]);
    mockedApi.patch.mockResolvedValue({ id: "1" });

    const { result } = renderHook(
      () => useCrudResource<Item>({ listKey: "/x-update", basePath: "/x" }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.update("1", { name: "editado" });
    });

    expect(mockedApi.patch).toHaveBeenCalledWith("/x/1", { name: "editado" });
    expect(mockedApi.get).toHaveBeenCalledTimes(2);
  });

  it("remove hace DELETE a basePath/id y recarga la lista", async () => {
    mockedApi.get.mockResolvedValue([]);
    mockedApi.delete.mockResolvedValue(undefined);

    const { result } = renderHook(
      () => useCrudResource<Item>({ listKey: "/x-remove", basePath: "/x" }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.remove("1");
    });

    expect(mockedApi.delete).toHaveBeenCalledWith("/x/1");
    expect(mockedApi.get).toHaveBeenCalledTimes(2);
  });
});
