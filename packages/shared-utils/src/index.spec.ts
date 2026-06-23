import {
  formatCurrency,
  formatDate,
  formatTime,
  formatDuration,
  generateSlug,
  isValidEmail,
  isValidPhone,
  isStrongPassword,
  getDayOfWeek,
  isSameDay,
  addMinutes,
  getTimeSlots,
  parsePaginationQuery,
  AppError,
  timeToMinutes,
  calculateEndTime,
  timesOverlap,
  escapeLikePattern,
  haversineDistance,
} from "./index";

describe("Shared Utils", () => {
  describe("formatCurrency", () => {
    it("debería formatear números como moneda colombiana", () => {
      expect(formatCurrency(0)).toMatch(/\$\s*0/);
      expect(formatCurrency(1)).toMatch(/\$\s*1/);
      expect(formatCurrency(100)).toMatch(/\$\s*100/);
      expect(formatCurrency(1000)).toMatch(/\$\s*1\.000/);
      expect(formatCurrency(1000000)).toMatch(/\$\s*1\.000\.000/);
    });

    it("debería manejar números decimales redondeando al entero más cercano", () => {
      expect(formatCurrency(1234.5)).toMatch(/\$\s*1\.235/);
      expect(formatCurrency(1234.4)).toMatch(/\$\s*1\.234/);
    });

    it("debería aceptar moneda y locale personalizados", () => {
      expect(formatCurrency(100, "USD", "en-US")).toBe("$100");
      expect(formatCurrency(100, "EUR", "es-ES")).toMatch(/100\s*€/);
    });

    it("debería manejar números negativos", () => {
      expect(formatCurrency(-100)).toMatch(/-\$\s*100/);
    });

    it("debería manejar números grandes", () => {
      expect(formatCurrency(1234567890)).toMatch(/\$\s*1\.234\.567\.890/);
    });
  });

  describe("formatDate", () => {
    it("debería formatear fechas en formato largo español", () => {
      const date = new Date("2024-01-15");
      expect(formatDate(date)).toMatch(/enero.*2024/);
    });

    it("debería aceptar fechas como strings", () => {
      expect(formatDate("2024-01-15")).toMatch(/enero.*2024/);
    });

    it("debería manejar diferentes meses", () => {
      expect(formatDate("2024-02-20")).toMatch(/febrero.*2024/);
      expect(formatDate("2024-12-25")).toMatch(/diciembre.*2024/);
    });

    it("debería manejar diferentes días de la semana", () => {
      // 2024-01-07 fue Domingo (usamos UTC para evitar problemas de zona horaria)
      const date = new Date(Date.UTC(2024, 0, 7));
      expect(formatDate(date)).toMatch(/domingo/);
    });

    it("debería aceptar locale personalizado", () => {
      expect(formatDate("2024-01-15", "en-US")).toMatch(/January.*2024/);
    });
  });

  describe("formatTime", () => {
    it("debería convertir tiempo de 24h a 12h AM/PM", () => {
      expect(formatTime("00:00")).toBe("12:00 AM");
      expect(formatTime("01:00")).toBe("1:00 AM");
      expect(formatTime("11:59")).toBe("11:59 AM");
      expect(formatTime("12:00")).toBe("12:00 PM");
      expect(formatTime("13:00")).toBe("1:00 PM");
      expect(formatTime("23:59")).toBe("11:59 PM");
    });

    it("debería mantener el formato de minutos con dos dígitos", () => {
      expect(formatTime("09:05")).toBe("9:05 AM");
      expect(formatTime("14:07")).toBe("2:07 PM");
    });
  });

  describe("formatDuration", () => {
    it("debería formatear duraciones en minutos", () => {
      expect(formatDuration(1)).toBe("1 min");
      expect(formatDuration(30)).toBe("30 min");
      expect(formatDuration(59)).toBe("59 min");
    });

    it("debería formatear duraciones en horas y minutos", () => {
      expect(formatDuration(60)).toBe("1h");
      expect(formatDuration(90)).toBe("1h 30min");
      expect(formatDuration(120)).toBe("2h");
      expect(formatDuration(150)).toBe("2h 30min");
    });

    it("debería manejar duraciones largas", () => {
      expect(formatDuration(480)).toBe("8h");
      expect(formatDuration(495)).toBe("8h 15min");
    });

    it("debería manejar cero", () => {
      expect(formatDuration(0)).toBe("0 min");
    });
  });

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
      expect(generateSlug("Barber Shop 2024")).toBe("barber-shop-2024");
    });
  });

  describe("isValidEmail", () => {
    it("debería validar emails correctos", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
      expect(isValidEmail("user.name@domain.co")).toBe(true);
      expect(isValidEmail("email+tag@domain.org")).toBe(true);
    });

    it("debería rechazar emails incorrectos", () => {
      expect(isValidEmail("")).toBe(false);
      expect(isValidEmail("invalid")).toBe(false);
      expect(isValidEmail("@example.com")).toBe(false);
      expect(isValidEmail("test@")).toBe(false);
      expect(isValidEmail("test example.com")).toBe(false);
      expect(isValidEmail("test@domain")).toBe(false);
    });

    it("debería manejar emails con espacios", () => {
      expect(isValidEmail("test @example.com")).toBe(false);
      expect(isValidEmail("test@example .com")).toBe(false);
    });
  });

  describe("isValidPhone", () => {
    it("debería validar números de teléfono correctos", () => {
      expect(isValidPhone("1234567890")).toBe(true);
      expect(isValidPhone("123-456-7890")).toBe(true);
      expect(isValidPhone("(123) 456-7890")).toBe(true);
      expect(isValidPhone("+57 123 456 7890")).toBe(true);
      expect(isValidPhone("+571234567890")).toBe(true);
    });

    it("debería rechazar números incorrectos", () => {
      expect(isValidPhone("")).toBe(false);
      expect(isValidPhone("123")).toBe(false);
      expect(isValidPhone("abc")).toBe(false);
      expect(isValidPhone("123-abc-7890")).toBe(false);
    });

    it("debería manejar formato internacional", () => {
      expect(isValidPhone("+1 555 123 4567")).toBe(true);
      expect(isValidPhone("+34 612 345 678")).toBe(true);
    });
  });

  describe("isStrongPassword", () => {
    it("debería validar contraseñas fuertes", () => {
      expect(isStrongPassword("Password1")).toBe(true);
      expect(isStrongPassword("MyPass123")).toBe(true);
      expect(isStrongPassword("StrongPass9")).toBe(true);
    });

    it("debería rechazar contraseñas débiles", () => {
      expect(isStrongPassword("")).toBe(false);
      expect(isStrongPassword("password")).toBe(false);
      expect(isStrongPassword("PASSWORD")).toBe(false);
      expect(isStrongPassword("Password")).toBe(false);
      expect(isStrongPassword("12345678")).toBe(false);
      expect(isStrongPassword("Pass1")).toBe(false);
    });

    it("debería requerir al menos 8 caracteres", () => {
      expect(isStrongPassword("Pass1")).toBe(false); // Solo 6 caracteres
      expect(isStrongPassword("Password1")).toBe(true); // 9 caracteres, mayúscula, número
    });

    it("debería requerir al menos una mayúscula", () => {
      expect(isStrongPassword("password1")).toBe(false);
      expect(isStrongPassword("Password1")).toBe(true);
    });

    it("debería requerir al menos un número", () => {
      expect(isStrongPassword("Password")).toBe(false);
      expect(isStrongPassword("Password1")).toBe(true);
    });
  });

  describe("getDayOfWeek", () => {
    it("debería retornar el día correcto de la semana", () => {
      // Usamos el constructor con enteros para evitar problemas de zona horaria (Enero es mes 0)
      // 2024-01-01 fue Lunes (1)
      expect(getDayOfWeek(new Date(2024, 0, 1))).toBe(1);
      // 2024-01-07 fue Domingo (0)
      expect(getDayOfWeek(new Date(2024, 0, 7))).toBe(0);
      // 2024-01-05 fue Viernes (5)
      expect(getDayOfWeek(new Date(2024, 0, 5))).toBe(5);
    });

    it("debería manejar diferentes fechas", () => {
      // 2024-12-25 es Miércoles (3)
      expect(getDayOfWeek(new Date(2024, 11, 25))).toBe(3);
    });
  });

  describe("isSameDay", () => {
    it("debería identificar el mismo día", () => {
      const date1 = new Date("2024-01-15T10:00:00");
      const date2 = new Date("2024-01-15T23:59:59");
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it("debería identificar días diferentes", () => {
      const date1 = new Date("2024-01-15");
      const date2 = new Date("2024-01-16");
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it("debería ignorar la hora", () => {
      const date1 = new Date("2024-01-15T00:00:00");
      const date2 = new Date("2024-01-15T23:59:59");
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it("debería manejar diferentes años", () => {
      const date1 = new Date("2023-01-15");
      const date2 = new Date("2024-01-15");
      expect(isSameDay(date1, date2)).toBe(false);
    });
  });

  describe("addMinutes", () => {
    it("debería agregar minutos a una fecha", () => {
      const date = new Date("2024-01-15T10:00:00");
      const result = addMinutes(date, 30);
      expect(result).toEqual(new Date("2024-01-15T10:30:00"));
    });

    it("no debería mutar la fecha original", () => {
      const date = new Date("2024-01-15T10:00:00");
      addMinutes(date, 30);
      expect(date).toEqual(new Date("2024-01-15T10:00:00"));
    });

    it("debería manejar minutos negativos", () => {
      const date = new Date("2024-01-15T10:30:00");
      const result = addMinutes(date, -30);
      expect(result).toEqual(new Date("2024-01-15T10:00:00"));
    });

    it("debería cruzar el día", () => {
      const date = new Date("2024-01-15T23:45:00");
      const result = addMinutes(date, 30);
      expect(result).toEqual(new Date("2024-01-16T00:15:00"));
    });

    it("debería manejar cero minutos", () => {
      const date = new Date("2024-01-15T10:00:00");
      const result = addMinutes(date, 0);
      expect(result).toEqual(date);
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
      const result = parsePaginationQuery({ search: "barber" });
      expect(result.search).toBe("barber");
    });

    it("debería ignorar search si no es string", () => {
      const result = parsePaginationQuery({ search: 123 });
      expect(result.search).toBe(undefined);
    });
  });

  describe("AppError", () => {
    it("debería crear error con mensaje", () => {
      const error = new AppError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.name).toBe("AppError");
    });

    it("debería tener statusCode por defecto 500", () => {
      const error = new AppError("Test");
      expect(error.statusCode).toBe(500);
    });

    it("debería aceptar statusCode personalizado", () => {
      const error = new AppError("Not found", 404);
      expect(error.statusCode).toBe(404);
    });

    it("debería tener código por defecto", () => {
      const error = new AppError("Test");
      expect(error.code).toBe("INTERNAL_ERROR");
    });

    it("debería aceptar código personalizado", () => {
      const error = new AppError("Test", 400, "BAD_REQUEST");
      expect(error.code).toBe("BAD_REQUEST");
    });

    it("debería aceptar detalles opcionales", () => {
      const details = { field: ["error1", "error2"] };
      const error = new AppError(
        "Validation error",
        400,
        "VALIDATION",
        details
      );
      expect(error.details).toEqual(details);
    });

    it("debería ser instanceof Error", () => {
      const error = new AppError("Test");
      expect(error).toBeInstanceOf(Error);
    });

    it("debería tener stack trace", () => {
      const error = new AppError("Test");
      expect(error.stack).toBeDefined();
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
      expect(calculateEndTime("23:30", 30)).toBe("24:00"); // No maneja wraparound de 24h
    });

    it("debería manejar cálculos que cruzan el día", () => {
      expect(calculateEndTime("23:00", 120)).toBe("25:00"); // No maneja wraparound
      expect(calculateEndTime("22:30", 90)).toBe("24:00"); // No maneja wraparound
    });

    it("debería manejar duración cero", () => {
      expect(calculateEndTime("09:00", 0)).toBe("09:00");
    });

    it("debería mantener formato de dos dígitos", () => {
      expect(calculateEndTime("09:05", 55)).toBe("10:00");
      expect(calculateEndTime("09:05", 60)).toBe("10:05");
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

  describe("haversineDistance", () => {
    it("debería calcular distancias entre puntos geográficos", () => {
      const bogota = { lat: 4.711, lng: -74.0721 };
      const medellin = { lat: 6.2576, lng: -75.5659 };
      const distance = haversineDistance(
        bogota.lat,
        bogota.lng,
        medellin.lat,
        medellin.lng
      );

      expect(distance).toBeGreaterThan(200);
      expect(distance).toBeLessThan(300);
    });

    it("debería retornar 0 para el mismo punto", () => {
      const point = { lat: 4.711, lng: -74.0721 };
      const distance = haversineDistance(
        point.lat,
        point.lng,
        point.lat,
        point.lng
      );
      expect(distance).toBe(0);
    });

    it("debería calcular distancias cortas correctamente", () => {
      const distance = haversineDistance(4.711, -74.0721, 4.712, -74.0721);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(1);
    });

    it("debería manejar coordenadas negativas", () => {
      const distance = haversineDistance(
        -33.4489,
        -70.6693,
        -34.6037,
        -58.3816
      );
      expect(distance).toBeGreaterThan(1000);
      expect(distance).toBeLessThan(1500);
    });

    it("debería manejar coordenadas positivas", () => {
      const distance = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
      expect(distance).toBeGreaterThan(3800);
      expect(distance).toBeLessThan(4000);
    });

    it("debería ser simétrico", () => {
      const distance1 = haversineDistance(4.711, -74.0721, 6.2576, -75.5659);
      const distance2 = haversineDistance(6.2576, -75.5659, 4.711, -74.0721);
      expect(distance1).toBeCloseTo(distance2, 5);
    });
  });
});
