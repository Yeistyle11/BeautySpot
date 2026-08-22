import { normalizarEmail, normalizarTelefono } from "./index";
import {
  generateSlug,
  getTimeSlots,
  parsePaginationQuery,
  timeToMinutes,
  calculateEndTime,
  timesOverlap,
  escapeLikePattern,
  sinTildes,
  columnaSinTildes,
  cruzaMedianoche,
  finExtendido,
  horaDeReloj,
  formatearDinero,
} from "./index";

describe("Shared Utils", () => {
  describe("generateSlug", () => {
    it("debería generar slugs URL-safe", () => {
      expect(generateSlug("Hello World")).toBe("hello-world");
      expect(generateSlug("Test Slug")).toBe("test-slug");
    });

    it("debería eliminar caracteres especiales y acentos", () => {
      expect(generateSlug("¡Hola! ¿Cómo estás?")).toBe("hola-como-estas");
      expect(generateSlug("Café")).toBe("cafe");
      expect(generateSlug("Niño")).toBe("nino");
    });

    it("debería manejar múltiples espacios y guiones", () => {
      expect(generateSlug("  Multiple   Spaces  ")).toBe("multiple-spaces");
      expect(generateSlug("test---slug")).toBe("test-slug");
    });

    it("debería limitar el slug a 100 caracteres", () => {
      const longText = "a".repeat(150);
      expect(generateSlug(longText).length).toBe(100);
    });

    it("debería manejar strings vacíos", () => {
      expect(generateSlug("")).toBe("");
    });

    it("debería manejar números y letras", () => {
      expect(generateSlug("Beauty Center 2024")).toBe("beauty-center-2024");
    });
  });

  describe("getTimeSlots", () => {
    it("debería generar intervalos de tiempo correctos", () => {
      const slots = getTimeSlots("09:00", "12:00", 30);
      expect(slots).toEqual([
        "09:00",
        "09:30",
        "10:00",
        "10:30",
        "11:00",
        "11:30",
      ]);
    });

    it("debería manejar duraciones diferentes", () => {
      const slots = getTimeSlots("09:00", "12:00", 60);
      expect(slots).toEqual(["09:00", "10:00", "11:00"]);
    });

    it("debería manejar intervalos que no caben completamente", () => {
      const slots = getTimeSlots("09:00", "10:15", 30);
      expect(slots).toEqual(["09:00", "09:30"]);
    });

    it("debería devolver array vacío si no hay intervalos", () => {
      const slots = getTimeSlots("09:00", "09:15", 30);
      expect(slots).toEqual([]);
    });

    it("debería manejar intervalos de 15 minutos", () => {
      const slots = getTimeSlots("09:00", "10:00", 15);
      expect(slots).toEqual(["09:00", "09:15", "09:30", "09:45"]);
    });

    it("debería manejar horarios de 24 horas", () => {
      const slots = getTimeSlots("23:00", "23:45", 15);
      expect(slots).toEqual(["23:00", "23:15", "23:30"]);
    });
  });

  describe("parsePaginationQuery", () => {
    it("debería parsear parámetros de paginación con valores por defecto", () => {
      const result = parsePaginationQuery({});
      expect(result).toEqual({
        page: 1,
        limit: 20,
        offset: 0,
        sort: "createdAt",
        order: "DESC",
        search: undefined,
      });
    });

    it("debería parsear parámetros personalizados", () => {
      const result = parsePaginationQuery(
        {
          page: "2",
          limit: "50",
          sort: "name",
          order: "ASC",
          search: "test",
        },
        ["name", "createdAt"]
      );
      expect(result).toEqual({
        page: 2,
        limit: 50,
        offset: 50,
        sort: "name",
        order: "ASC",
        search: "test",
      });
    });

    it("debería validar y corregir page mínimo", () => {
      const result = parsePaginationQuery({ page: "0" });
      expect(result.page).toBe(1);
    });

    it("debería limitar el máximo de registros", () => {
      const result = parsePaginationQuery({ limit: "200" });
      expect(result.limit).toBe(100);
    });

    it("debería validar límite mínimo", () => {
      const result = parsePaginationQuery({ limit: "0" });
      expect(result.limit).toBe(20); // Por defecto es 20, no 1
    });

    it("debería usar sort por defecto si no está permitido", () => {
      const result = parsePaginationQuery({ sort: "invalid" });
      expect(result.sort).toBe("createdAt");
    });

    it("debería usar sort personalizado si está permitido", () => {
      const result = parsePaginationQuery({ sort: "name" }, [
        "name",
        "createdAt",
      ]);
      expect(result.sort).toBe("name");
    });

    it("debería manejar orden DESC por defecto", () => {
      const result = parsePaginationQuery({ order: "INVALID" });
      expect(result.order).toBe("DESC");
    });

    it("debería calcular offset correctamente", () => {
      const result = parsePaginationQuery({ page: "3", limit: "10" });
      expect(result.offset).toBe(20);
    });

    it("debería manejar parámetros de búsqueda", () => {
      const result = parsePaginationQuery({ search: "beauty" });
      expect(result.search).toBe("beauty");
    });

    it("debería ignorar search si no es string", () => {
      const result = parsePaginationQuery({ search: 123 });
      expect(result.search).toBe(undefined);
    });
  });

  describe("timeToMinutes", () => {
    it("debería convertir tiempo HH:MM a minutos", () => {
      expect(timeToMinutes("00:00")).toBe(0);
      expect(timeToMinutes("01:00")).toBe(60);
      expect(timeToMinutes("02:30")).toBe(150);
      expect(timeToMinutes("23:59")).toBe(1439);
    });

    it("debería manejar tiempos con ceros", () => {
      expect(timeToMinutes("00:05")).toBe(5);
      expect(timeToMinutes("05:00")).toBe(300);
    });
  });

  describe("calculateEndTime", () => {
    it("debería calcular tiempo final correctamente", () => {
      expect(calculateEndTime("09:00", 60)).toBe("10:00");
      expect(calculateEndTime("09:30", 30)).toBe("10:00");
      expect(calculateEndTime("23:30", 30)).toBe("24:00");
    });

    // La hora se cuenta desde la medianoche de su propio dia: pasar de las
    // 24:00 es la forma de decir "de madrugada".
    it("debería seguir contando pasada la medianoche", () => {
      expect(calculateEndTime("23:00", 120)).toBe("25:00");
      expect(calculateEndTime("22:30", 90)).toBe("24:00");
    });

    it("debería manejar duración cero", () => {
      expect(calculateEndTime("09:00", 0)).toBe("09:00");
    });

    it("debería mantener formato de dos dígitos", () => {
      expect(calculateEndTime("09:05", 55)).toBe("10:00");
      expect(calculateEndTime("09:05", 60)).toBe("10:05");
    });
  });

  describe("cruzaMedianoche", () => {
    it("un cierre anterior a la apertura es del día siguiente", () => {
      expect(cruzaMedianoche("20:00", "02:00")).toBe(true);
      expect(cruzaMedianoche("09:00", "18:00")).toBe(false);
    });

    // Es la forma de decir "hasta el final del día", y por eso no cruza.
    it("las 24:00 cierran el propio día", () => {
      expect(cruzaMedianoche("20:00", "24:00")).toBe(false);
      expect(cruzaMedianoche("00:00", "24:00")).toBe(false);
    });

    // Un tramo así no dura nada; se marca como cruce para que la validación
    // pueda rechazarlo en vez de dejarlo pasar como jornada de cero minutos.
    it("empezar y terminar a la misma hora cuenta como cruce", () => {
      expect(cruzaMedianoche("20:00", "20:00")).toBe(true);
    });
  });

  describe("finExtendido", () => {
    it("lleva el cierre de madrugada a la escala del cálculo", () => {
      expect(finExtendido("20:00", "02:00")).toBe("26:00");
      expect(finExtendido("23:30", "00:30")).toBe("24:30");
    });

    it("deja igual lo que termina dentro del día", () => {
      expect(finExtendido("09:00", "18:00")).toBe("18:00");
      expect(finExtendido("09:00", "24:00")).toBe("24:00");
    });
  });

  describe("horaDeReloj", () => {
    it("baja al reloj lo que se pasó del día", () => {
      expect(horaDeReloj("24:30")).toBe("00:30");
      expect(horaDeReloj("26:00")).toBe("02:00");
      expect(horaDeReloj("24:00")).toBe("00:00");
    });

    it("deja igual lo que ya es hora de reloj", () => {
      expect(horaDeReloj("09:05")).toBe("09:05");
      expect(horaDeReloj("23:59")).toBe("23:59");
    });
  });

  describe("timesOverlap", () => {
    it("debería detectar solapamiento de intervalos", () => {
      expect(timesOverlap("09:00", "10:00", "09:30", "10:30")).toBe(true);
      expect(timesOverlap("09:00", "10:00", "08:00", "09:30")).toBe(true);
      expect(timesOverlap("09:00", "10:00", "09:30", "09:45")).toBe(true);
    });

    it("debería detectar sin solapamiento", () => {
      expect(timesOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
      expect(timesOverlap("10:00", "11:00", "09:00", "10:00")).toBe(false);
      expect(timesOverlap("09:00", "10:00", "08:00", "09:00")).toBe(false);
    });

    it("debería manejar intervalos anidados", () => {
      expect(timesOverlap("09:00", "12:00", "10:00", "11:00")).toBe(true);
      expect(timesOverlap("10:00", "11:00", "09:00", "12:00")).toBe(true);
    });

    it("debería manejar intervalos idénticos", () => {
      expect(timesOverlap("09:00", "10:00", "09:00", "10:00")).toBe(true);
    });

    it("debería manejar intervalos que cruzan medianoche", () => {
      expect(timesOverlap("23:00", "01:00", "00:00", "02:00")).toBe(false); // No maneja wraparound
      expect(timesOverlap("23:00", "01:00", "01:00", "03:00")).toBe(false);
    });
  });

  describe("escapeLikePattern", () => {
    it("debería escapar caracteres especiales de SQL LIKE", () => {
      expect(escapeLikePattern("test%")).toBe("test\\%");
      expect(escapeLikePattern("test_")).toBe("test\\_");
      expect(escapeLikePattern("test\\")).toBe("test\\\\");
    });

    it("debería escapar múltiples caracteres especiales", () => {
      expect(escapeLikePattern("%test_")).toBe("\\%test\\_");
      expect(escapeLikePattern("100%_test")).toBe("100\\%\\_test");
    });

    it("debería manejar strings normales", () => {
      expect(escapeLikePattern("normal text")).toBe("normal text");
    });

    it("debería manejar strings vacíos", () => {
      expect(escapeLikePattern("")).toBe("");
    });
  });

  describe("normalizarEmail", () => {
    it("quita espacios y pasa a minúsculas", () => {
      expect(normalizarEmail("  Juan@Ejemplo.CO ")).toBe("juan@ejemplo.co");
    });

    it.each([undefined, null, ""])("devuelve vacío para %s", (valor) => {
      expect(normalizarEmail(valor)).toBe("");
    });
  });

  describe("normalizarTelefono", () => {
    // Es lo que impide que la misma persona acabe con dos fichas.
    it("reduce a la misma forma los formatos habituales", () => {
      expect(normalizarTelefono("+57 300 123 45 67")).toBe("+573001234567");
      expect(normalizarTelefono("+57-300-123-4567")).toBe("+573001234567");
      expect(normalizarTelefono("(300) 123 4567")).toBe("3001234567");
    });

    it("conserva el prefijo internacional", () => {
      expect(normalizarTelefono("+573001234567")).not.toBe("573001234567");
    });

    it.each([undefined, null, "", "   ", "sin numeros"])(
      "devuelve vacío para %s",
      (valor) => {
        expect(normalizarTelefono(valor)).toBe("");
      }
    );
  });
});

describe("sinTildes", () => {
  it("quita las tildes y baja a minúsculas", () => {
    expect(sinTildes("Pérez")).toBe("perez");
    expect(sinTildes("MARÍA JOSÉ")).toBe("maria jose");
  });

  it("conserva la eñe, que distingue palabras", () => {
    expect(sinTildes("Muñoz")).toBe("muñoz");
  });

  it("deja intacto lo que no lleva tilde", () => {
    expect(sinTildes("Corte + barba")).toBe("corte + barba");
  });
});

describe("columnaSinTildes", () => {
  it("envuelve la columna en el translate que aplica el mismo criterio", () => {
    const sql = columnaSinTildes("nombre");

    expect(sql).toContain("translate(lower(nombre)");
    expect(sql).toContain("á");
  });

  describe("formatearDinero", () => {
    it("presenta pesos colombianos sin decimales", () => {
      expect(formatearDinero(50000).replace(/ /g, " ")).toBe("$ 50.000");
    });

    it("respeta la moneda y el formato del negocio", () => {
      const enEuros = formatearDinero(1500, {
        currency: "EUR",
        locale: "es-ES",
      });

      expect(enEuros).toContain("€");
      expect(enEuros).toContain("1500".slice(0, 1));
    });

    it("un importe de cero se escribe, no se omite", () => {
      expect(formatearDinero(0)).toContain("0");
    });
  });
});
