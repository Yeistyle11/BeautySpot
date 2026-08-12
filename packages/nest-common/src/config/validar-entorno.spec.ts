import { problemasDelEntorno, validarEntorno } from "./validar-entorno";

/** Secreto que pasa los tres filtros: largo, propio y sin marca de ejemplo. */
const SECRETO_BUENO = "9f3a7c1e5b2d8a4f6c0e9b3d7a1f5c8e";

describe("validarEntorno", () => {
  describe("variables obligatorias", () => {
    it("acepta el entorno completo", () => {
      expect(
        problemasDelEntorno({ PORT: "3003" }, { obligatorias: ["PORT"] }, false)
      ).toEqual([]);
    });

    it("reclama la que falta", () => {
      expect(
        problemasDelEntorno({}, { obligatorias: ["PORT"] }, false)
      ).toEqual(["PORT no está definida"]);
    });

    // Una variable declarada y vacía es el caso típico del .env a medio rellenar,
    // y es indistinguible de no tenerla.
    it("trata la cadena vacía como ausente", () => {
      expect(
        problemasDelEntorno({ PORT: "   " }, { obligatorias: ["PORT"] }, false)
      ).toEqual(["PORT no está definida"]);
    });
  });

  describe("secretos", () => {
    it("exige que estén, también fuera de producción", () => {
      expect(
        problemasDelEntorno({}, { secretos: ["JWT_SECRET"] }, false)
      ).toEqual(["JWT_SECRET no está definida"]);
    });

    // En local el proyecto tiene que arrancar recién clonado, y para eso están
    // los valores de los .env.example.
    it("admite el valor de ejemplo fuera de producción", () => {
      expect(
        problemasDelEntorno(
          { INTERNAL_API_SECRET: "dev-internal-secret-change-in-production" },
          { secretos: ["INTERNAL_API_SECRET"] },
          false
        )
      ).toEqual([]);
    });

    it("lo rechaza en producción por la marca de ejemplo", () => {
      expect(
        problemasDelEntorno(
          { INTERNAL_API_SECRET: "dev-internal-secret-change-in-production" },
          { secretos: ["INTERNAL_API_SECRET"] },
          true
        )
      ).toEqual([
        'INTERNAL_API_SECRET conserva el valor de ejemplo ("...change-in-production")',
      ]);
    });

    it("rechaza en producción los secretos conocidos de los .env.test", () => {
      expect(
        problemasDelEntorno(
          {
            JWT_SECRET:
              "test_secret_key_for_testing_only_do_not_use_in_production",
          },
          { secretos: ["JWT_SECRET"] },
          true
        )
      ).toEqual(["JWT_SECRET tiene un valor de ejemplo conocido"]);
    });

    it("rechaza en producción un secreto corto", () => {
      expect(
        problemasDelEntorno(
          { JWT_SECRET: "corto" },
          { secretos: ["JWT_SECRET"] },
          true
        )
      ).toEqual(["JWT_SECRET es demasiado corta (mínimo 32 caracteres)"]);
    });

    it("acepta en producción un secreto propio y largo", () => {
      expect(
        problemasDelEntorno(
          { JWT_SECRET: SECRETO_BUENO },
          { secretos: ["JWT_SECRET"] },
          true
        )
      ).toEqual([]);
    });
  });

  describe("urls", () => {
    it("acepta una URL absoluta", () => {
      expect(
        problemasDelEntorno(
          { DATABASE_URL: "postgresql://u:p@localhost:5433/db" },
          { urls: ["DATABASE_URL"] },
          false
        )
      ).toEqual([]);
    });

    it("rechaza lo que no se puede parsear", () => {
      expect(
        problemasDelEntorno(
          { CORE_SERVICE_URL: "localhost:3002" },
          { urls: ["CORE_SERVICE_URL"] },
          false
        )
      ).toEqual(['CORE_SERVICE_URL no es una URL válida: "localhost:3002"']);
    });
  });

  // Quien despliega con tres variables mal prefiere verlas de una vez a
  // descubrirlas en tres reinicios.
  it("junta todos los problemas en un solo error", () => {
    const problemas = problemasDelEntorno(
      { JWT_SECRET: "corto" },
      {
        obligatorias: ["PORT"],
        secretos: ["JWT_SECRET", "INTERNAL_API_SECRET"],
        urls: ["DATABASE_URL"],
      },
      true
    );

    expect(problemas).toHaveLength(4);
  });

  describe("validarEntorno", () => {
    it("no lanza si la configuración da para arrancar", () => {
      expect(() =>
        validarEntorno(
          { JWT_SECRET: SECRETO_BUENO },
          { secretos: ["JWT_SECRET"] },
          "booking"
        )
      ).not.toThrow();
    });

    it("lanza nombrando el servicio y cada problema", () => {
      expect(() =>
        validarEntorno(
          { NODE_ENV: "production" },
          { secretos: ["JWT_SECRET"], urls: ["DATABASE_URL"] },
          "booking"
        )
      ).toThrow(
        /booking no puede arrancar[\s\S]*JWT_SECRET[\s\S]*DATABASE_URL/
      );
    });

    it("aplica el rigor de producción según NODE_ENV", () => {
      const entorno = { JWT_SECRET: "changeme" };

      expect(() =>
        validarEntorno(entorno, { secretos: ["JWT_SECRET"] }, "booking")
      ).not.toThrow();
      expect(() =>
        validarEntorno(
          { ...entorno, NODE_ENV: "production" },
          { secretos: ["JWT_SECRET"] },
          "booking"
        )
      ).toThrow(/valor de ejemplo conocido/);
    });
  });
});
