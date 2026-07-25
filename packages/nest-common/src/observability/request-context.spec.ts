import type { NextFunction, Request, Response } from "express";
import {
  REQUEST_ID_HEADER,
  conContextoPeticion,
  requestContextMiddleware,
  requestIdActual,
} from "./request-context";

const peticion = (headers: Record<string, string> = {}) =>
  ({ headers }) as unknown as Request;

const respuesta = () => ({ setHeader: jest.fn() }) as unknown as Response;

describe("requestContextMiddleware", () => {
  it("genera un identificador cuando la petición no lo trae", () => {
    const req = peticion();
    const res = respuesta();
    let visto: string | undefined;

    requestContextMiddleware(req, res, (() => {
      visto = requestIdActual();
    }) as NextFunction);

    expect(visto).toEqual(expect.any(String));
    expect(req.headers[REQUEST_ID_HEADER]).toBe(visto);
  });

  // Es lo que hace que una petición sea seguible de extremo a extremo: si cada
  // servicio generase el suyo, el identificador no serviría para cruzar logs.
  it("respeta el identificador que llega en la cabecera", () => {
    const req = peticion({ [REQUEST_ID_HEADER]: "id-del-gateway" });
    let visto: string | undefined;

    requestContextMiddleware(req, respuesta(), (() => {
      visto = requestIdActual();
    }) as NextFunction);

    expect(visto).toBe("id-del-gateway");
  });

  it("ignora una cabecera vacía y genera uno nuevo", () => {
    const req = peticion({ [REQUEST_ID_HEADER]: "" });
    let visto: string | undefined;

    requestContextMiddleware(req, respuesta(), (() => {
      visto = requestIdActual();
    }) as NextFunction);

    expect(visto).toEqual(expect.any(String));
    expect(visto).not.toBe("");
  });

  it("devuelve el identificador al cliente en la respuesta", () => {
    const res = respuesta();

    requestContextMiddleware(
      peticion({ [REQUEST_ID_HEADER]: "abc" }),
      res,
      (() => undefined) as NextFunction
    );

    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, "abc");
  });

  it("no expone identificador fuera de una petición", () => {
    expect(requestIdActual()).toBeUndefined();
  });

  // El contexto tiene que sobrevivir a los saltos de microtarea; si no, se
  // perdería en cuanto el handler hiciera el primer await.
  it("mantiene el contexto a través de operaciones asíncronas", async () => {
    const visto = await conContextoPeticion({ requestId: "persistente" }, () =>
      Promise.resolve()
        .then(() => new Promise((r) => setTimeout(r, 1)))
        .then(() => requestIdActual())
    );

    expect(visto).toBe("persistente");
  });

  it("aísla el contexto entre peticiones simultáneas", async () => {
    const observar = (id: string) =>
      conContextoPeticion({ requestId: id }, () =>
        new Promise((r) => setTimeout(r, Math.random() * 5)).then(() =>
          requestIdActual()
        )
      );

    const [a, b] = await Promise.all([
      observar("peticion-a"),
      observar("peticion-b"),
    ]);

    expect(a).toBe("peticion-a");
    expect(b).toBe("peticion-b");
  });
});
