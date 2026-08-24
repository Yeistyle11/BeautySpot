import { render, screen } from "@testing-library/react";
import BusinessProfile from "../business-profile";
import type { Profile, ProfesionalPublico, ServicioPublico } from "../schemas";

// Las cinco llamadas del perfil salen del mismo hook; el mock responde por
// clave para poder montar la ficha completa de un negocio publicado.
const respuestas: Record<string, unknown> = {};
jest.mock("@/lib/swr", () => ({
  useApiPublic: (clave: string | null) => ({
    data: clave ? respuestas[clave.split("?")[0]] : undefined,
    isLoading: false,
  }),
}));

/** Perfil tal como lo sirve `GET /marketplace/profiles/:slug`. */
function perfil(extra: Partial<Profile> = {}): Profile {
  return {
    id: "bp-1",
    businessId: "biz-1",
    slug: "qa-barberia-la-noche",
    name: "QA-Barbería La Noche",
    description: "Barbería nocturna",
    logo: null,
    coverImage: null,
    phone: "+573001112233",
    email: null,
    address: "Calle 1 #2-3",
    city: "Bogotá",
    state: null,
    country: "CO",
    lat: null,
    lng: null,
    rating: 4.5,
    totalReviews: 12,
    businessType: "BARBERIA",
    verified: true,
    tagline: "Cortes de noche",
    storyTitle: "Cómo empezamos",
    storyText: "Abrimos en 2019.",
    storyImage: null,
    foundedYear: 2019,
    founders: null,
    socialLinks: null,
    sectionConfig: null,
    galleryImages: [],
    isPublished: true,
    profileCompleteness: 80,
    ...extra,
  };
}

const SERVICIO: ServicioPublico = {
  id: "s-1",
  name: "Corte clásico",
  description: null,
  category: "Cabello",
  price: 30000,
  duration: 45,
};

const PROFESIONAL: ProfesionalPublico = {
  id: "pro-1",
  name: "Ana Restrepo",
  photo: null,
  bio: null,
  specialties: ["Cabello"],
  yearsExp: 5,
  rating: 4.9,
  totalReviews: 8,
};

beforeEach(() => {
  for (const clave of Object.keys(respuestas)) delete respuestas[clave];
});

describe("BusinessProfile", () => {
  it("pinta la ficha de un negocio publicado con sus secciones", () => {
    respuestas["/marketplace/profiles/qa-barberia-la-noche"] = {
      profile: perfil(),
    };
    respuestas["/core/public/businesses/biz-1/services"] = [SERVICIO];
    respuestas["/core/public/businesses/biz-1/professionals"] = [PROFESIONAL];

    render(
      <BusinessProfile slug="qa-barberia-la-noche" initialProfile={perfil()} />
    );

    expect(
      screen.getByRole("heading", { name: "QA-Barbería La Noche" })
    ).toBeInTheDocument();
    expect(screen.getByText("Corte clásico")).toBeInTheDocument();
    expect(screen.getByText("Ana Restrepo")).toBeInTheDocument();
    expect(screen.getAllByText(/Agendar cita/).length).toBeGreaterThan(0);
  });

  it("ofrece volver al escaparate cuando el negocio no existe", () => {
    render(<BusinessProfile slug="no-existe" initialProfile={null} />);

    expect(screen.getByText("Negocio no encontrado")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver al marketplace" })
    ).toBeInTheDocument();
  });
});
