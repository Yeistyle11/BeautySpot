/**
 * El helper lee la allowlist de process.env al importarse, asi que el entorno
 * se prepara antes del require.
 */
const ORIGINAL = process.env.NEXT_PUBLIC_IMAGE_HOSTS;

function loadHelper(hosts: string) {
  process.env.NEXT_PUBLIC_IMAGE_HOSTS = hosts;
  let mod: typeof import("../image");
  jest.isolateModules(() => {
    // require() es necesario aqui: hay que reevaluar el modulo despues de
    // cambiar la variable de entorno, y un import estatico se cachea.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("../image");
  });
  return mod!;
}

afterAll(() => {
  process.env.NEXT_PUBLIC_IMAGE_HOSTS = ORIGINAL;
});

describe("canOptimizeImage", () => {
  const hosts = "images.unsplash.com,*.amazonaws.com";

  it("acepta un host declarado explicitamente", () => {
    const { canOptimizeImage } = loadHelper(hosts);
    expect(canOptimizeImage("https://images.unsplash.com/photo-1.jpg")).toBe(
      true
    );
  });

  it("acepta subdominios cuando el patron empieza por *.", () => {
    const { canOptimizeImage } = loadHelper(hosts);
    expect(canOptimizeImage("https://mi-bucket.amazonaws.com/a.png")).toBe(
      true
    );
  });

  it("rechaza un host no declarado", () => {
    const { canOptimizeImage } = loadHelper(hosts);
    expect(canOptimizeImage("https://sitio-cualquiera.com/foto.jpg")).toBe(
      false
    );
  });

  it("no confunde un dominio que solo termina parecido", () => {
    const { canOptimizeImage } = loadHelper(hosts);
    // "evilamazonaws.com" no es subdominio de "amazonaws.com".
    expect(canOptimizeImage("https://evilamazonaws.com/x.png")).toBe(false);
  });

  it("rechaza http para no degradar a contenido mixto", () => {
    const { canOptimizeImage } = loadHelper(hosts);
    expect(canOptimizeImage("http://images.unsplash.com/photo.jpg")).toBe(
      false
    );
  });

  it("acepta rutas relativas del propio dominio", () => {
    const { canOptimizeImage } = loadHelper(hosts);
    expect(canOptimizeImage("/logo.png")).toBe(true);
  });

  it("trata null, undefined y vacio como no optimizables", () => {
    const { canOptimizeImage } = loadHelper(hosts);
    expect(canOptimizeImage(null)).toBe(false);
    expect(canOptimizeImage(undefined)).toBe(false);
    expect(canOptimizeImage("")).toBe(false);
  });
});

describe("imageUnoptimized", () => {
  it("es la negacion de canOptimizeImage", () => {
    const { imageUnoptimized } = loadHelper("images.unsplash.com");
    expect(imageUnoptimized("https://images.unsplash.com/a.jpg")).toBe(false);
    expect(imageUnoptimized("https://otro.com/a.jpg")).toBe(true);
  });
});
