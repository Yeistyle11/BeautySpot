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
  // encuentra nada. La etiqueta heredada tiene que verse distinta y explicarse.
  it("distingue la etiqueta heredada y dice por qué no filtra", () => {
    render(<CategoryBadge nombre="Cabello" delCatalogo={false} />);

    const insignia = screen.getByText("Cabello");
    expect(insignia).toHaveAttribute(
      "title",
      expect.stringContaining("no se puede filtrar")
    );
    expect(insignia.className).toContain("border-dashed");
  });

  it("la heredada no toma el color de ninguna categoría", () => {
    render(
      <CategoryBadge nombre="Cabello" delCatalogo={false} color="#EC4899" />
    );

    expect(screen.getByText("Cabello")).not.toHaveStyle({
      color: "#EC4899",
    });
  });
});
