import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigService } from "@nestjs/config";
import { S3Client } from "@aws-sdk/client-s3";
import {
  AlmacenEnDisco,
  AlmacenEnS3,
  crearAlmacen,
} from "./almacen-de-imagenes";

const CLAVE = "negocios/n-1/logo/a.webp";

describe("AlmacenEnDisco", () => {
  let raiz: string;
  let almacen: AlmacenEnDisco;

  beforeEach(async () => {
    raiz = await mkdtemp(join(tmpdir(), "imagenes-"));
    almacen = new AlmacenEnDisco(raiz);
  });

  afterEach(() => rm(raiz, { recursive: true, force: true }));

  it("guarda, lee y borra un archivo por su clave", async () => {
    await almacen.guardar(CLAVE, Buffer.from("webp"));

    await expect(almacen.leer(CLAVE)).resolves.toEqual(Buffer.from("webp"));
    // Sin restos del archivo temporal con el que se escribe.
    await expect(readdir(join(raiz, "negocios/n-1/logo"))).resolves.toEqual([
      "a.webp",
    ]);

    await almacen.borrar(CLAVE);
    await expect(almacen.leer(CLAVE)).resolves.toBeNull();
  });

  it("borrar lo que no está no es un error", async () => {
    await expect(almacen.borrar(CLAVE)).resolves.toBeUndefined();
  });

  it("no deja salir del directorio", async () => {
    await expect(almacen.leer("../fuera.webp")).rejects.toThrow(
      "fuera del almacén"
    );
    await expect(
      almacen.guardar("negocios/../../fuera.webp", Buffer.from("x"))
    ).rejects.toThrow("fuera del almacén");
  });
});

describe("AlmacenEnS3", () => {
  const send = jest.fn();
  const almacen = new AlmacenEnS3({ send } as unknown as S3Client, "bucket");

  beforeEach(() => send.mockReset());

  it("guarda el archivo como WebP en el bucket", async () => {
    send.mockResolvedValue({});

    await almacen.guardar(CLAVE, Buffer.from("webp"));

    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: "bucket",
      Key: CLAVE,
      Body: Buffer.from("webp"),
      ContentType: "image/webp",
    });
  });

  it("lee el archivo y da null si no existe", async () => {
    send.mockResolvedValueOnce({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2]) },
    });
    await expect(almacen.leer(CLAVE)).resolves.toEqual(Buffer.from([1, 2]));

    send.mockRejectedValueOnce(
      Object.assign(new Error("x"), { name: "NoSuchKey" })
    );
    await expect(almacen.leer(CLAVE)).resolves.toBeNull();

    send.mockResolvedValueOnce({});
    await expect(almacen.leer(CLAVE)).resolves.toBeNull();
  });

  it("deja pasar los demás fallos del bucket", async () => {
    send.mockRejectedValue(new Error("sin red"));

    await expect(almacen.leer(CLAVE)).rejects.toThrow("sin red");
  });

  it("borra por clave", async () => {
    send.mockResolvedValue({});

    await almacen.borrar(CLAVE);

    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: "bucket",
      Key: CLAVE,
    });
  });
});

describe("crearAlmacen", () => {
  const config = (valores: Record<string, string>) =>
    ({
      get: (clave: string, porDefecto?: string) => valores[clave] ?? porDefecto,
    }) as unknown as ConfigService;

  it("usa el disco salvo que se pida S3", () => {
    expect(crearAlmacen(config({}))).toBeInstanceOf(AlmacenEnDisco);
    expect(
      crearAlmacen(
        config({ MEDIA_DRIVER: "s3", AWS_ENDPOINT: "https://r2.example" })
      )
    ).toBeInstanceOf(AlmacenEnS3);
    expect(crearAlmacen(config({ MEDIA_DRIVER: "s3" }))).toBeInstanceOf(
      AlmacenEnS3
    );
  });
});
