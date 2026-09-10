import { render, screen } from "@testing-library/react";
import { CategoryBadge } from "@/components/ui/category-badge";

describe("CategoryBadge", () => {
  it("no pinta nada si la ficha no tiene categoría", () => {
    const { container } = render(
      <CategoryBadge nombre="" delCatalogo={false} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("muestra la categoría del catálogo con su color", () => {
    render(<CategoryBadge nombre="Coloración" delCatalogo color="#EC4899" />);

    const insignia = screen.getByText("Coloración");
    expect(insignia).toBeInTheDocument();
    expect(insignia).not.toHaveAttribute("title");
  });

  // Pintadas igual, el dueño ve todo clasificado, intenta filtrar por ello y no
  // encuentra nada. La etiqueta heredada no puede tener forma de categoría.
  it("dice que el servicio no tiene categoría, y qué etiqueta lleva", () => {
    render(<CategoryBadge nombre="Cabello" delCatalogo={false} />);

    const texto = screen.getByText(/Sin categoría · etiqueta: Cabello/);
    expect(texto).toHaveAttribute(
      "title",
      expect.stringContaining("no se puede filtrar")
    );
    // Texto y no insignia: es lo que la distingue de una categoría de verdad.
    expect(texto.tagName).toBe("P");
  });

  it("la heredada no toma el color de ninguna categoría", () => {
    render(
      <CategoryBadge nombre="Cabello" delCatalogo={false} color="#EC4899" />
    );

    expect(
      screen.getByText(/Sin categoría · etiqueta: Cabello/)
    ).not.toHaveStyle({
      color: "#EC4899",
    });
  });
});
