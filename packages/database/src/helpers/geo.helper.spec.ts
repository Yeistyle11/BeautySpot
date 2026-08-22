import { distanciaEnKm } from "./geo.helper";

describe("distanciaEnKm", () => {
  it("usa las columnas del alias que se le pasa", () => {
    const sql = distanciaEnKm("bp");

    expect(sql).toContain("bp.lat");
    expect(sql).toContain("bp.lng");
  });

  it("toma el punto de los parámetros de la consulta, no de la cadena", () => {
    const sql = distanciaEnKm("bp");

    expect(sql).toContain(":lat");
    expect(sql).toContain(":lng");
  });

  it("admite otros nombres de parámetro para el mismo punto", () => {
    const sql = distanciaEnKm("pp", { lat: "latBusqueda", lng: "lngBusqueda" });

    expect(sql).toContain(":latBusqueda");
    expect(sql).toContain(":lngBusqueda");
    expect(sql).not.toContain(":lat)");
  });

  it("mide en kilómetros", () => {
    expect(distanciaEnKm("bp")).toContain("6371");
  });
});
