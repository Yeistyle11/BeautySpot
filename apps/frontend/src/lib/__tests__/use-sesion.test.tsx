import { renderHook, waitFor } from "@testing-library/react";
import { useSesion } from "../use-sesion";
import { useAuthStore } from "../store";
import { api } from "../api";

jest.mock("../api", () => ({ api: { get: jest.fn() } }));

const get = api.get as jest.Mock;

const usuario = {
  id: "u-1",
  email: "recep@beautyspot.local",
  name: "Recepción",
  phone: null,
  avatar: null,
};

describe("useSesion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      role: null,
      businessId: null,
      branchId: null,
      hydrated: false,
    });
  });

  it("no pide el usuario cuando no hay sesión", async () => {
    renderHook(() => useSesion());

    await waitFor(() => expect(useAuthStore.getState().hydrated).toBe(true));
    expect(get).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("lo pide a auth cuando hay sesión y no está en memoria", async () => {
    localStorage.setItem("auth:v1:role", "RECEPTIONIST");
    get.mockResolvedValue(usuario);

    const { result } = renderHook(() => useSesion());

    await waitFor(() => expect(result.current.user).toEqual(usuario));
    expect(get).toHaveBeenCalledWith("/auth/me");
    // Queda en memoria, nunca en el navegador.
    expect(localStorage.getItem("auth:v1:user")).toBeNull();
  });

  it("no lo vuelve a pedir si ya está en memoria", async () => {
    localStorage.setItem("auth:v1:role", "RECEPTIONIST");
    useAuthStore.setState({ user: usuario });

    renderHook(() => useSesion());

    await waitFor(() => expect(useAuthStore.getState().hydrated).toBe(true));
    expect(get).not.toHaveBeenCalled();
  });
});
