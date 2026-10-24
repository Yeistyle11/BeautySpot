import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NotificationsPage from "../page";

const post = jest.fn().mockResolvedValue({});
jest.mock("@/lib/api", () => ({
  api: { post: (...args: unknown[]) => post(...args) },
}));
jest.mock("swr", () => ({ mutate: jest.fn() }));

/** Un aviso sin leer y otro leído, como los devuelve la bandeja. */
const AVISOS = [
  {
    id: "n-1",
    type: "APPOINTMENT",
    channel: "IN_APP",
    title: "Cita confirmada",
    message: "María confirmó su cita del viernes a las 10:00.",
    read: false,
    createdAt: "2026-10-20T15:00:00.000Z",
  },
  {
    id: "n-2",
    type: "PAYMENT",
    channel: "IN_APP",
    title: "Cobro registrado",
    message: "Se registró un cobro de $ 42.000.",
    read: true,
    createdAt: "2026-10-19T15:00:00.000Z",
  },
];

jest.mock("@/lib/use-paginated-list", () => ({
  usePaginatedList: () => ({
    items: AVISOS,
    meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
    setPage: jest.fn(),
    listKey: "/notification/notifications?page=1",
    isLoading: false,
    error: undefined,
    mutate: jest.fn(),
  }),
}));

describe("NotificationsPage", () => {
  it("pinta los avisos en la tabla de los listados, con el mensaje entero", () => {
    render(<NotificationsPage />);

    expect(
      screen.getByRole("table", { name: "Notificaciones" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("María confirmó su cita del viernes a las 10:00.")
    ).toBeInTheDocument();
    expect(screen.getByText("Nuevo")).toBeInTheDocument();
    expect(screen.getByText("Leído")).toBeInTheDocument();
  });

  it("solo ofrece marcar como leído lo que no se ha leído", async () => {
    render(<NotificationsPage />);

    const marcar = screen.getAllByRole("button", {
      name: "Marcar el aviso como leido",
    });
    expect(marcar).toHaveLength(1);

    fireEvent.click(marcar[0]);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/notification/notifications/n-1/read",
        {}
      )
    );
  });
});
