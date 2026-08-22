import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { InjectRepository, InjectDataSource } from "@nestjs/typeorm";
import {
  TenantCrudService,
  OutboxService,
  InternalHttpClient,
} from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import { Repository, In, DataSource, EntityManager } from "typeorm";
import { normalizarEmail, normalizarTelefono } from "@beautyspot/shared-utils";
import {
  nivelDePuntos,
  siguienteNivel,
  NIVELES_FIDELIDAD_POR_DEFECTO,
  type NivelDeFidelidad,
} from "@beautyspot/shared-constants";
import { contieneTexto, paginate, PaginateParams } from "@beautyspot/database";
import { IPaginatedResponse } from "@beautyspot/shared-types";
import {
  BusinessConfigService,
  CLAVE_FIDELIZACION,
} from "../business-config/business-config.service";
import { Client } from "../../entities/client.entity";
import {
  CampoDeFicha,
  TipoDeCampo,
} from "../../entities/campo-de-ficha.entity";
import { ProfessionalsService } from "../professionals/professionals.service";

/**
 * Lo unico que ve de una ficha quien solo la atiende: el nombre con el que
 * reconocerla en su agenda.
 */
const CAMPOS_PARA_PROFESIONAL = { id: true, name: true } as const;

/** Rótulo con el que se queda una ficha tras suprimir sus datos. */
const NOMBRE_ANONIMO = "Cliente anonimizado";

/** Fecha de calendario, que es como viaja un campo de tipo fecha. */
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Deja correo y teléfono en su forma canónica, para poder cotejarlos. */
function normalizarContacto(data: Partial<Client>): {
  email?: string;
  phone?: string;
} {
  const contacto: { email?: string; phone?: string } = {};
  if (data.email !== undefined) contacto.email = normalizarEmail(data.email);
  if (data.phone !== undefined) contacto.phone = normalizarTelefono(data.phone);
  return contacto;
}

/** CRUD de la cartera de clientes de un negocio, incluida su fidelización por puntos. */
@Injectable()
export class ClientsService extends TenantCrudService<Client> {
  constructor(
    @InjectRepository(Client) repo: Repository<Client>,
    @InjectRepository(CampoDeFicha)
    private readonly camposRepo: Repository<CampoDeFicha>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly configuracion: BusinessConfigService,
    private readonly professionals: ProfessionalsService,
    private readonly http: InternalHttpClient
  ) {
    super(repo, "Cliente no encontrado");
  }

  /** Registra un cliente en el negocio indicado y publica el alta. */
  async create(businessId: string, data: Partial<Client>): Promise<Client> {
    const contacto = normalizarContacto(data);
    await this.rechazarSiYaExiste(businessId, contacto);
    await this.validarFicha(businessId, data.ficha);

    const client = this.repo.create({ ...data, ...contacto, businessId });

    return this.dataSource.transaction(async (manager) => {
      const creado = await manager.getRepository(Client).save(client);

      await this.outbox.enqueue(manager, {
        eventType: EventNames.CORE_CLIENT_CREATED,
        aggregateType: "client",
        aggregateId: creado.id,
        payload: {
          clientId: creado.id,
          businessId,
          name: creado.name,
          email: creado.email,
          phone: creado.phone,
        },
      });

      return creado;
    });
  }

  /**
   * Rechaza el alta si el negocio ya tiene una ficha con ese correo o teléfono.
   * Dos fichas de la misma persona parten su historial y sus puntos.
   */
  private async rechazarSiYaExiste(
    businessId: string,
    contacto: { email?: string; phone?: string }
  ): Promise<void> {
    const existente = await this.buscarPorContacto(businessId, contacto);
    if (existente) {
      throw new ConflictException(
        `Ya existe un cliente con ese ${existente.email === contacto.email ? "correo" : "teléfono"}: ${existente.name}`
      );
    }
  }

  /** Ficha del negocio que coincide por correo o por teléfono, si la hay. */
  private async buscarPorContacto(
    businessId: string,
    contacto: { email?: string; phone?: string }
  ): Promise<Client | null> {
    const criterios: Record<string, unknown>[] = [];
    if (contacto.email) criterios.push({ businessId, email: contacto.email });
    if (contacto.phone) criterios.push({ businessId, phone: contacto.phone });
    if (criterios.length === 0) return null;

    return this.repo.findOne({ where: criterios });
  }

  /** Actualiza la ficha, salvo que ya se haya ejercido la supresión sobre ella. */
  async update(
    id: string,
    businessId: string,
    data: Partial<Client>
  ): Promise<Client> {
    await this.rechazarSiEstaAnonimizado(id, businessId);
    await this.validarFicha(businessId, data.ficha);
    return super.update(id, businessId, data);
  }

  /**
   * Comprueba la ficha contra los campos que el negocio tiene definidos. Los
   * obligatorios solo se exigen cuando se envia ficha.
   */
  private async validarFicha(
    businessId: string,
    ficha: Record<string, unknown> | null | undefined
  ): Promise<void> {
    if (ficha === undefined || ficha === null) return;

    const campos = await this.camposRepo.find({
      where: { businessId, active: true },
    });
    const porId = new Map(campos.map((campo) => [campo.id, campo]));

    for (const clave of Object.keys(ficha)) {
      if (!porId.has(clave)) {
        throw new BadRequestException(
          "La ficha trae un campo que este negocio no tiene definido"
        );
      }
    }

    for (const campo of campos) {
      const valor = ficha[campo.id];
      if (valor === undefined || valor === null || valor === "") {
        if (campo.obligatorio) {
          throw new BadRequestException(`«${campo.etiqueta}» es obligatorio`);
        }
        continue;
      }
      this.validarValor(campo, valor);
    }
  }

  /** Contrasta un valor con el tipo declarado en su campo. */
  private validarValor(campo: CampoDeFicha, valor: unknown): void {
    const invalido = (motivo: string) => {
      throw new BadRequestException(`«${campo.etiqueta}» ${motivo}`);
    };

    switch (campo.tipo) {
      case TipoDeCampo.NUMERO:
        if (typeof valor !== "number" || Number.isNaN(valor)) {
          invalido("tiene que ser un número");
        }
        break;
      case TipoDeCampo.SI_NO:
        if (typeof valor !== "boolean") invalido("tiene que ser sí o no");
        break;
      case TipoDeCampo.FECHA:
        if (typeof valor !== "string" || !PATRON_FECHA.test(valor)) {
          invalido("tiene que ser una fecha (AAAA-MM-DD)");
        }
        break;
      case TipoDeCampo.OPCIONES:
        if (
          typeof valor !== "string" ||
          !(campo.opciones ?? []).includes(valor)
        ) {
          invalido("no admite ese valor");
        }
        break;
      default:
        if (typeof valor !== "string") invalido("tiene que ser texto");
    }
  }

  /**
   * Ejerce el derecho de supresion: vacia los datos personales y da de baja la
   * ficha, que se conserva porque citas y facturas la referencian.
   */
  async anonymize(id: string, businessId: string): Promise<Client> {
    await this.rechazarSiEstaAnonimizado(id, businessId);

    await this.repo.update(
      { id, businessId },
      {
        // Un rótulo y no una cadena vacía: los listados ordenan por nombre y
        // una fila sin él se vuelve imposible de identificar en pantalla.
        name: NOMBRE_ANONIMO,
        email: null,
        phone: null,
        documento: null,
        notes: null,
        tags: null,
        ficha: null,
        userId: null,
        active: false,
        anonymizedAt: new Date(),
      }
    );
    return this.findById(id, businessId);
  }

  /** Corta cualquier reescritura de una ficha ya suprimida. */
  private async rechazarSiEstaAnonimizado(
    id: string,
    businessId: string
  ): Promise<void> {
    const client = await this.findById(id, businessId);
    if (client.anonymizedAt) {
      throw new ConflictException(
        "Los datos de este cliente ya se suprimieron y no se pueden volver a tocar"
      );
    }
  }

  /** Lista los clientes activos del negocio, con búsqueda por nombre/email/teléfono y paginación. */
  async findByBusiness(
    businessId: string,
    search: string | undefined,
    pagination: PaginateParams
  ): Promise<IPaginatedResponse<Client>> {
    const base = { businessId, active: true };
    const where = search
      ? [
          { ...base, name: contieneTexto(search) },
          { ...base, email: contieneTexto(search) },
          { ...base, phone: contieneTexto(search) },
        ]
      : base;
    return paginate(this.repo, pagination, { where, order: { name: "ASC" } });
  }

  /**
   * Clientes que ha atendido quien pregunta, con la ficha recortada. La lista
   * se le pide a booking y, si no contesta, la peticion falla.
   */
  async findByBusinessParaProfesional(
    businessId: string,
    userId: string,
    search: string | undefined,
    pagination: PaginateParams
  ): Promise<IPaginatedResponse<Pick<Client, "id" | "name">>> {
    // Un usuario con rol de profesional puede no tener ficha: desvincularla no
    // le quita el rol. Ve una agenda sin nombres, no un error.
    const profesional = await this.professionals.findByUserId(
      userId,
      businessId
    );
    if (!profesional) return this.paginaVacia(pagination);

    const atendidos = await this.http.pedir<{ clientIds: string[] }>(
      "booking",
      `/internal/appointments/professional/${profesional.id}/client-ids?businessId=${businessId}`
    );
    const clientIds = atendidos?.clientIds ?? [];
    if (clientIds.length === 0) return this.paginaVacia(pagination);

    // La busqueda se limita al nombre: por correo o telefono, teclear un
    // numero confirmaria que pertenece a un cliente del negocio.
    return paginate(this.repo, pagination, {
      where: {
        businessId,
        active: true,
        id: In(clientIds),
        ...(search ? { name: contieneTexto(search) } : {}),
      },
      order: { name: "ASC" },
      select: CAMPOS_PARA_PROFESIONAL,
    });
  }

  /** Página sin resultados con la forma que espera quien la pidió. */
  private paginaVacia(
    pagination: PaginateParams
  ): IPaginatedResponse<Pick<Client, "id" | "name">> {
    return {
      data: [],
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: pagination.page > 1,
      },
    };
  }

  /** Nombre de los clientes pedidos, acotado al negocio: solo id y nombre. */
  async findNamesByIds(
    businessId: string,
    ids: string[]
  ): Promise<{ id: string; name: string }[]> {
    if (ids.length === 0) return [];

    return this.repo.find({
      where: { businessId, id: In(ids) },
      select: { id: true, name: true },
    });
  }

  /** Busca el cliente asociado a una cuenta de usuario dentro del negocio. */
  async findByUserId(
    userId: string,
    businessId: string
  ): Promise<Client | null> {
    return this.repo.findOne({ where: { userId, businessId, active: true } });
  }

  /**
   * Ficha más reciente del usuario, sin acotar a un negocio: el cliente final
   * no pertenece a ninguno y puede tener una por cada sitio donde reservó.
   */
  async findMineByUser(userId: string): Promise<Client | null> {
    return this.repo.findOne({
      where: { userId, active: true },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Ficha del usuario con su nivel de fidelidad ya resuelto por el servidor,
   * sin exponer la escala.
   */
  async findMineConNivel(userId: string): Promise<
    | (Client & {
        nivel: NivelDeFidelidad | null;
        siguienteNivel: NivelDeFidelidad | null;
      })
    | null
  > {
    const ficha = await this.findMineByUser(userId);
    if (!ficha) return null;

    const niveles = await this.nivelesDe(ficha.businessId);
    return Object.assign(ficha, {
      nivel: nivelDePuntos(ficha.loyaltyPoints, niveles),
      siguienteNivel: siguienteNivel(ficha.loyaltyPoints, niveles),
    });
  }

  /** Escala de fidelidad del negocio, o la de por defecto si no la ha configurado. */
  private async nivelesDe(businessId: string): Promise<NivelDeFidelidad[]> {
    const guardado = await this.configuracion.leer(
      businessId,
      CLAVE_FIDELIZACION
    );
    const niveles = guardado.niveles as NivelDeFidelidad[] | undefined;
    return niveles?.length ? niveles : NIVELES_FIDELIDAD_POR_DEFECTO;
  }

  /** Actualiza los datos personales en todas las fichas del usuario. */
  async updateMineByUser(
    userId: string,
    data: Pick<Partial<Client>, "name" | "phone">
  ): Promise<Client | null> {
    const fichas = await this.repo.find({ where: { userId } });
    if (fichas.length === 0) return null;

    for (const ficha of fichas) {
      if (data.name !== undefined) ficha.name = data.name;
      if (data.phone !== undefined) ficha.phone = data.phone;
    }
    await this.repo.save(fichas);

    return this.findMineByUser(userId);
  }

  /**
   * Suma puntos de fidelidad al cliente. Acepta un `manager` para correr
   * dentro de la transaccion de quien llame.
   */
  async addLoyaltyPoints(
    id: string,
    businessId: string,
    points: number,
    manager?: EntityManager
  ): Promise<void> {
    const repo = manager ? manager.getRepository(Client) : this.repo;
    await repo.increment({ id, businessId }, "loyaltyPoints", points);
  }

  /** Suma una falta al cliente, dentro de la transacción de quien llame. */
  async addNoShow(
    id: string,
    businessId: string,
    manager?: EntityManager
  ): Promise<void> {
    const repo = manager ? manager.getRepository(Client) : this.repo;
    await repo.increment({ id, businessId }, "noShowCount", 1);
  }

  /**
   * Descuenta los puntos al cliente si le alcanzan, en una sola sentencia, y
   * dice si pudo. Leer el saldo y escribirlo después dejaría que dos canjes
   * simultáneos pasaran ambos la comprobación y gastaran el mismo saldo dos
   * veces, así que la condición viaja dentro del propio UPDATE.
   */
  async redeemLoyaltyPoints(
    id: string,
    businessId: string,
    points: number,
    manager?: EntityManager
  ): Promise<boolean> {
    if (!Number.isInteger(points) || points <= 0) {
      throw new BadRequestException("Los puntos a canjear no son válidos");
    }

    const repo = manager ? manager.getRepository(Client) : this.repo;
    const resultado = await repo
      .createQueryBuilder()
      .update(Client)
      .set({ loyaltyPoints: () => `"loyalty_points" - ${points}` })
      .where("id = :id", { id })
      .andWhere("business_id = :businessId", { businessId })
      .andWhere("loyalty_points >= :points", { points })
      .execute();

    return (resultado.affected ?? 0) > 0;
  }
}
