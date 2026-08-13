import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { CitasCobradasDto, PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

/** El DTO tal y como lo arma el ValidationPipe a partir del query string. */
function desdeLaQuery(appointmentIds: unknown): CitasCobradasDto {
  return plainToInstance(CitasCobradasDto, { appointmentIds });
}

const UNA = "11111111-1111-4111-8111-111111111111";
const OTRA = "22222222-2222-4222-8222-222222222222";

describe("CitasCobradasDto", () => {
  it("parte la lista separada por comas", async () => {
    const dto = desdeLaQuery(`${UNA},${OTRA}`);

    expect(dto.appointmentIds).toEqual([UNA, OTRA]);
    expect(await validate(dto)).toEqual([]);
  });

  it("tolera espacios y elementos vacíos", async () => {
    const dto = desdeLaQuery(` ${UNA} , , ${OTRA} `);

    expect(dto.appointmentIds).toEqual([UNA, OTRA]);
  });

  // Sin tope, un `?appointmentIds=` largo arma un IN (...) de miles de
  // elementos con una sola petición.
  it("acota la lista a cien citas", () => {
    const muchas = Array.from({ length: 150 }, () => UNA).join(",");

    expect(desdeLaQuery(muchas).appointmentIds).toHaveLength(100);
  });

  it("sin parámetro responde una lista vacía", () => {
    expect(desdeLaQuery(undefined).appointmentIds).toEqual([]);
  });

  it("rechaza lo que no sea un UUID", async () => {
    const errores = await validate(desdeLaQuery("no-es-un-uuid"));

    expect(errores).not.toEqual([]);
  });
});

describe("PaymentsController", () => {
  // El negocio sale del token, nunca de la query: es lo que impide preguntar
  // por las citas de otro.
  it("consulta las citas cobradas del negocio del token", async () => {
    const service = {
      citasYaCobradas: jest.fn().mockResolvedValue([UNA]),
    } as unknown as PaymentsService;
    const controller = new PaymentsController(service);

    const cobradas = await controller.cobradas(
      "business-123",
      desdeLaQuery(`${UNA},${OTRA}`)
    );

    expect(cobradas).toEqual([UNA]);
    expect(service.citasYaCobradas).toHaveBeenCalledWith("business-123", [
      UNA,
      OTRA,
    ]);
  });
});
