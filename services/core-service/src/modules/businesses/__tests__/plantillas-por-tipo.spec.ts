import { VALORES_TIPO_DE_NEGOCIO } from "@beautyspot/shared-constants";
import { PLANTILLAS_POR_TIPO, plantillaDe } from "../plantillas-por-tipo";

describe("plantillaDe", () => {
  // Un tipo del catálogo sin plantilla dejaría el panel vacío justo al cliente
  // que eligió ese sector, y nadie se enteraría.
  it("todos los tipos que se ofrecen al crear tienen plantilla", () => {
    for (const tipo of VALORES_TIPO_DE_NEGOCIO) {
      expect(plantillaDe(tipo)).not.toBeNull();
    }
  });

  it("un tipo desconocido no tiene plantilla, y no es un error", () => {
    expect(plantillaDe("FRANQUICIA")).toBeNull();
    expect(plantillaDe(undefined)).toBeNull();
    expect(plantillaDe(null)).toBeNull();
  });
});

describe("las plantillas", () => {
  const plantillas = Object.entries(PLANTILLAS_POR_TIPO);

  it.each(plantillas)("%s trae servicios, categorías y horario", (_, p) => {
    expect(p.servicios.length).toBeGreaterThan(0);
    expect(p.categoriasDeServicio.length).toBeGreaterThan(0);
    expect(p.categoriasDeProfesional.length).toBeGreaterThan(0);
    expect(p.horario.length).toBeGreaterThan(0);
  });

  // Un servicio cuya categoría no existe nace «sin categoría» y el filtro del
  // panel no lo encuentra, que es justo el lío de BS-007.
  it.each(plantillas)(
    "%s solo usa categorías que la propia plantilla crea",
    (_, p) => {
      for (const servicio of p.servicios) {
        expect(p.categoriasDeServicio).toContain(servicio.category);
      }
    }
  );

  it.each(plantillas)("%s propone precios y duraciones creíbles", (_, p) => {
    for (const servicio of p.servicios) {
      expect(servicio.price).toBeGreaterThan(0);
      expect(servicio.duration).toBeGreaterThan(0);
      // Nada de jornadas completas: una cita de más de tres horas no es un
      // punto de partida razonable.
      expect(servicio.duration).toBeLessThanOrEqual(180);
    }
  });

  it.each(plantillas)("%s abre y cierra el mismo día, en orden", (_, p) => {
    for (const tramo of p.horario) {
      expect(tramo.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(tramo.dayOfWeek).toBeLessThanOrEqual(6);
      expect(tramo.openTime < tramo.closeTime).toBe(true);
    }
  });

  it.each(plantillas)("%s no declara dos veces el mismo día", (_, p) => {
    const dias = p.horario.map((t) => t.dayOfWeek);
    expect(new Set(dias).size).toBe(dias.length);
  });

  it.each(plantillas)("%s no repite el nombre de un servicio", (_, p) => {
    const nombres = p.servicios.map((s) => s.name);
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});
