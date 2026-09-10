import { readFileSync, readdirSync } from "fs";
import { join } from "path";

/**
 * Un componente con hooks y sin "use client" revienta en ejecucion —Next lo
 * renderiza en el servidor— pero pasa cualquier test de jsdom, que no aplica la
 * frontera. De ahi que la comprobacion sea sobre el codigo fuente.
 */
const RAIZ = join(__dirname, "..");
const CARPETAS = ["app", "components", "lib"];

/** Hooks de React y los propios del repositorio, que tambien son de cliente. */
const HOOKS =
  /(^|[^A-Za-z0-9_])(useState|useEffect|useLayoutEffect|useRef|useMemo|useCallback|useContext|useReducer|useTransition|useOptimistic|useApi|useApiPublic|useAuthStore|useToast|useRouter|useSearchParams|usePathname|useSeededForm|usePaginatedList|useCrudResource|useDebouncedValue)\s*[(<]/;

function archivosFuente(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      return entrada.name === "__tests__" ? [] : archivosFuente(ruta);
    }
    return /\.tsx?$/.test(entrada.name) ? [ruta] : [];
  });
}

/** La directiva solo cuenta si es lo primero del archivo, antes de los imports. */
function declaraCliente(contenido: string): boolean {
  const primeraInstruccion = contenido
    .split("\n")
    .map((linea) => linea.trim())
    .find(
      (linea) => linea && !linea.startsWith("//") && !linea.startsWith("*")
    );
  return (
    primeraInstruccion === '"use client";' ||
    primeraInstruccion === "'use client';"
  );
}

describe("directiva de cliente", () => {
  it("todo archivo que usa hooks la declara", () => {
    const sinDirectiva = CARPETAS.flatMap((carpeta) =>
      archivosFuente(join(RAIZ, carpeta))
    )
      .filter((ruta) => {
        const contenido = readFileSync(ruta, "utf8");
        return HOOKS.test(contenido) && !declaraCliente(contenido);
      })
      .map((ruta) => ruta.slice(RAIZ.length + 1).replace(/\\/g, "/"));

    expect(sinDirectiva).toEqual([]);
  });
});
