import { render, screen } from "@testing-library/react";
import { MarcaBeautySpot } from "@/components/ui/marca-beautyspot";

describe("MarcaBeautySpot", () => {
  it("la marca lleva al inicio", () => {
    render(<MarcaBeautySpot />);

    const enlace = screen.getByRole("link", {
      name: "Ir al inicio de BeautySpot",
    });
    expect(enlace).toHaveAttribute("href", "/");
  });
});
