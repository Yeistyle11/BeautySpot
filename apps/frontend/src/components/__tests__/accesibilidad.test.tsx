import { fireEvent, render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { Sidebar } from "@/components/sidebar";
import { SelectorDeEntidad } from "@/components/ui/selector-de-entidad";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { useAuthStore } from "@/lib/store";

expect.extend(toHaveNoViolations);

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/lib/use-logout", () => ({ useLogout: () => jest.fn() }));

/** Finge el ancho de la ventana, que es lo que decide si el menú es modal. */
function anchoDePantalla(escritorio: boolean) {
  window.matchMedia = ((consulta: string) => ({
    matches: escritorio,
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

describe("Sidebar", () => {
  beforeEach(() => {
    useAuthStore.setState({
      role: "RECEPTIONIST",
      user: { id: "u-1", email: "r@b.local", name: "Recepción" },
      hydrated: true,
    });
  });

  it("no tiene infracciones de accesibilidad", async () => {
    anchoDePantalla(true);
    const { container } = render(<Sidebar />);

    expect(await axe(container)).toHaveNoViolations();
  });

  // En movil el menu cerrado sigue en el documento, y una transformacion CSS no
  // saca del orden de tabulacion: sin `inert` se tabula por sus enlaces
  // invisibles antes de llegar al contenido.
  it("deja el menú fuera del tabulador mientras está cerrado en móvil", () => {
    anchoDePantalla(false);
    render(<Sidebar />);

    expect(screen.getByRole("navigation").closest("aside")).toHaveAttribute(
      "inert"
    );
  });

  it("en escritorio el menú siempre es navegable", () => {
    anchoDePantalla(true);
    render(<Sidebar />);

    expect(screen.getByRole("navigation").closest("aside")).not.toHaveAttribute(
      "inert"
    );
  });

  it("abierto en móvil es un diálogo y se lleva el foco", () => {
    anchoDePantalla(false);
    render(<Sidebar />);

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir menú de navegación" })
    );

    const panel = screen.getByRole("dialog", { name: "Menú de navegación" });
    expect(panel).toHaveAttribute("aria-modal", "true");
    expect(
      screen.getByRole("button", { name: "Cerrar menú de navegación" })
    ).toHaveFocus();
  });

  it("muestra el rol en español, no su código", () => {
    anchoDePantalla(true);
    render(<Sidebar />);

    expect(screen.getByText("Recepcionista")).toBeInTheDocument();
    expect(screen.queryByText("RECEPTIONIST")).not.toBeInTheDocument();
  });
});

describe("SelectorDeEntidad", () => {
  const opciones = [
    { id: "1", nombre: "Camila Rueda", detalle: "300 111 2233" },
    { id: "2", nombre: "Diego Pardo", detalle: "300 444 5566" },
  ];

  function abrirLista() {
    render(
      <SelectorDeEntidad
        opciones={opciones}
        value=""
        onChange={jest.fn()}
        aria-label="Cliente"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cliente" }));
  }

  it("no tiene infracciones de accesibilidad con la lista abierta", async () => {
    const { container } = render(
      <SelectorDeEntidad
        opciones={opciones}
        value=""
        onChange={jest.fn()}
        aria-label="Cliente"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cliente" }));

    expect(await axe(container)).toHaveNoViolations();
  });

  // Sin `aria-activedescendant` el resaltado de las flechas es solo un color, y
  // quien usa lector de pantalla pulsa Enter sin saber qué está eligiendo.
  it("anuncia cuál es la opción resaltada", () => {
    abrirLista();
    const buscador = screen.getByRole("combobox", { name: "Buscar" });

    const primera = screen.getByRole("option", { name: /Camila Rueda/ });
    expect(buscador).toHaveAttribute("aria-activedescendant", primera.id);

    fireEvent.keyDown(buscador, { key: "ArrowDown" });

    const segunda = screen.getByRole("option", { name: /Diego Pardo/ });
    expect(buscador).toHaveAttribute("aria-activedescendant", segunda.id);
  });
});

/** Lanza un aviso de cada tono al montarse. */
function AvisosDeMuestra() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.error("No se pudo guardar")}>Fallar</button>
      <button onClick={() => toast.exito("Cita reagendada")}>Guardar</button>
    </>
  );
}

describe("ToastProvider", () => {
  // `assertive` interrumpe la lectura en curso: bien para un error, de más para
  // un «guardado».
  it("interrumpe con los errores y espera con los éxitos", () => {
    render(
      <ToastProvider>
        <AvisosDeMuestra />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Fallar"));
    fireEvent.click(screen.getByText("Guardar"));

    const error = screen.getByText("No se pudo guardar").closest("[aria-live]");
    const exito = screen.getByText("Cita reagendada").closest("[aria-live]");
    expect(error).toHaveAttribute("aria-live", "assertive");
    expect(error).toHaveAttribute("role", "alert");
    expect(exito).toHaveAttribute("aria-live", "polite");
    expect(exito).toHaveAttribute("role", "status");
  });
});
