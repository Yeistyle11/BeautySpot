import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MarketplaceFeed from "../marketplace-feed";
import type { FeedResponse, Profile } from "../schemas";

// El feed y la búsqueda salen del mismo hook; el mock decide qué devuelve cada
// clave para poder montar los dos estados vacíos por separado.
const respuestas: Record<string, unknown> = {};
jest.mock("@/lib/swr", () => ({
  useApiPublic: (clave: string | null) => ({
    data: clave ? respuestas[clave.split("?")[0]] : undefined,
    isLoading: false,
  }),
}));

// El retardo de la búsqueda no aporta nada aquí y obligaría a temporizadores.
jest.mock("@/lib/use-debounced-value", () => ({
  useDebouncedValue: (valor: string) => valor,
}));

const FEED_VACIO: FeedResponse = { categories: [], sections: [] };

/** Perfil tal y como lo sirve el feed, con lo justo que pinta la tarjeta. */
function perfil(extra: Partial<Profile> = {}): Profile {
  return {
    id: "p-1",
    slug: "la-noche",
    name: "Barbería La Noche",
    description: null,
    logo: null,
    coverImage: null,
    city: "Bogotá",
    address: null,
    businessType: "BARBERIA",
    rating: 4.8,
    totalReviews: 120,
    tagline: null,
    profileCompleteness: 60,
    galleryImages: [],
    verified: false,
    ...extra,
  };
}

const FEED_CON_NEGOCIOS: FeedResponse = {
  categories: [
    { id: "BARBERIA", name: "Barberías", icon: "scissors", count: 1 },
    { id: "SPA", name: "Spas", icon: "spa", count: 0 },
  ],
  sections: [
    {
      id: "popular_nearby",
      title: "Populares cerca de ti",
      type: "carousel",
      items: [perfil()],
    },
    {
      id: "top_rated",
      title: "Mejor valorados",
      type: "grid",
      items: [perfil({ id: "p-2", slug: "aurora", name: "Salón Aurora" })],
    },
  ],
};

beforeEach(() => {
  respuestas["/marketplace/feed"] = FEED_VACIO;
  respuestas["/marketplace/search"] = { items: [], total: 0 };
});

describe("MarketplaceFeed", () => {
  // Sugerir otra búsqueda a quien no ha buscado nada confunde "no hay nada" con
  // "tu búsqueda no dio resultados", que son dos estados distintos.
  it("no habla de búsquedas cuando el catálogo está vacío", () => {
    render(<MarketplaceFeed initialFeed={FEED_VACIO} />);

    expect(
      screen.getByText(/todavía no hay negocios publicados/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/otra búsqueda/i)).not.toBeInTheDocument();
  });

  it("ofrece publicarse cuando no hay ningún negocio", () => {
    render(<MarketplaceFeed initialFeed={FEED_VACIO} />);

    expect(
      screen.getByRole("link", { name: /tienes un negocio/i })
    ).toHaveAttribute("href", "/registro");
  });

  it("sugiere cambiar la búsqueda cuando sí se buscó algo", async () => {
    render(<MarketplaceFeed initialFeed={FEED_VACIO} />);

    fireEvent.change(screen.getByPlaceholderText(/buscar por nombre/i), {
      target: { value: "peluquería" },
    });

    await waitFor(() =>
      expect(screen.getByText(/otra búsqueda/i)).toBeInTheDocument()
    );
    expect(
      screen.queryByText(/todavía no hay negocios publicados/i)
    ).not.toBeInTheDocument();
  });

  describe("con negocios publicados", () => {
    beforeEach(() => {
      respuestas["/marketplace/feed"] = FEED_CON_NEGOCIOS;
    });

    it("pinta cada sección con sus negocios", () => {
      render(<MarketplaceFeed initialFeed={FEED_CON_NEGOCIOS} />);

      expect(screen.getByText("Populares cerca de ti")).toBeInTheDocument();
      expect(screen.getByText("Mejor valorados")).toBeInTheDocument();
      expect(screen.getByText("Barbería La Noche")).toBeInTheDocument();
      expect(screen.getByText("Salón Aurora")).toBeInTheDocument();
    });

    it("enlaza cada tarjeta con el perfil público del negocio", () => {
      render(<MarketplaceFeed initialFeed={FEED_CON_NEGOCIOS} />);

      expect(
        screen.getByRole("link", { name: /barbería la noche/i })
      ).toHaveAttribute("href", "/marketplace/business/la-noche");
    });

    it("nombra el tipo de negocio en la tarjeta", () => {
      render(<MarketplaceFeed initialFeed={FEED_CON_NEGOCIOS} />);

      expect(screen.getAllByText("Barbería").length).toBeGreaterThan(0);
    });

    it("ofrece las categorías con su número de negocios", () => {
      render(<MarketplaceFeed initialFeed={FEED_CON_NEGOCIOS} />);

      expect(
        screen.getByRole("button", { name: /barberías/i })
      ).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByText("(1)")).toBeInTheDocument();
    });

    it("filtra al pulsar una categoría y vuelve al pulsarla otra vez", async () => {
      respuestas["/marketplace/search"] = { items: [perfil()], total: 1 };
      render(<MarketplaceFeed initialFeed={FEED_CON_NEGOCIOS} />);

      const barberias = screen.getByRole("button", { name: /barberías/i });
      fireEvent.click(barberias);

      await waitFor(() =>
        expect(screen.getByText("Resultados")).toBeInTheDocument()
      );
      expect(barberias).toHaveAttribute("aria-pressed", "true");

      fireEvent.click(barberias);

      await waitFor(() =>
        expect(screen.queryByText("Resultados")).not.toBeInTheDocument()
      );
    });

    it("dice cuántos resultados encontró la búsqueda", async () => {
      respuestas["/marketplace/search"] = { items: [perfil()], total: 1 };
      render(<MarketplaceFeed initialFeed={FEED_CON_NEGOCIOS} />);

      fireEvent.change(screen.getByPlaceholderText(/buscar por nombre/i), {
        target: { value: "noche" },
      });

      await waitFor(() =>
        expect(screen.getByText("1 encontrados")).toBeInTheDocument()
      );
      expect(screen.getByText("Barbería La Noche")).toBeInTheDocument();
    });
  });
});
