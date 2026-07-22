jest.unmock("@nestjs/jwt");
jest.unmock("@nestjs/config");

import { Global, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { getDataSourceToken, getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  SecurityModule,
  TOKEN_VERSION_RESOLVER,
  TokenVersionStore,
  EventBusService,
  OutboxService,
  RedisCacheService,
} from "@beautyspot/nest-common";
import { AuthService } from "./modules/auth/auth.service";
import { UsersService } from "./modules/users/users.service";
import { MembershipsService } from "./modules/memberships/memberships.service";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { MembershipsModule } from "./modules/memberships/memberships.module";
import { DbTokenVersionResolver } from "./security/db-token-version.resolver";
import { User } from "./entities/user.entity";
import { Membership } from "./entities/membership.entity";
import { PasswordReset } from "./entities/password-reset.entity";
import { AuditLog } from "./entities/audit-log.entity";

const repositoryMock = {};

/**
 * Doble del DataSource con la forma mínima que TypeOrmModule.forFeature
 * inspecciona al construir los providers de repositorio.
 */
const dataSourceMock = {
  options: { type: "postgres" },
  entityMetadatas: [],
  transaction: jest.fn(),
  getRepository: () => repositoryMock,
};

/**
 * Sustituye a TypeOrmModule.forRoot/forFeature aportando los tokens de
 * repositorio y de DataSource que los módulos de dominio esperan, sin abrir
 * ninguna conexión real a Postgres.
 */
@Global()
@Module({
  providers: [
    { provide: getRepositoryToken(User), useValue: repositoryMock },
    { provide: getRepositoryToken(Membership), useValue: repositoryMock },
    { provide: getRepositoryToken(PasswordReset), useValue: repositoryMock },
    { provide: getRepositoryToken(AuditLog), useValue: repositoryMock },
    { provide: getDataSourceToken(), useValue: dataSourceMock },
    { provide: DataSource, useValue: dataSourceMock },
    { provide: EventBusService, useValue: { emit: jest.fn() } },
    { provide: OutboxService, useValue: { enqueue: jest.fn() } },
  ],
  exports: [
    getRepositoryToken(User),
    getRepositoryToken(Membership),
    getRepositoryToken(PasswordReset),
    getRepositoryToken(AuditLog),
    getDataSourceToken(),
    DataSource,
    EventBusService,
    OutboxService,
  ],
})
class MockPersistenceModule {}

/**
 * Regresión: AuthService, UsersService y MembershipsService inyectan
 * TokenVersionStore, que durante un tiempo no estuvo registrado en ningún
 * módulo. Los tests unitarios lo mockeaban, así que el fallo solo aparecía al
 * arrancar el servicio de verdad. Aquí se compila el grafo de DI real para que
 * una dependencia sin registrar rompa la suite.
 */
describe("AppModule (grafo de inyección)", () => {
  it("resuelve TokenVersionStore para los servicios que lo consumen", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        MockPersistenceModule,
        SecurityModule.withResolver({
          resolver: {
            provide: TOKEN_VERSION_RESOLVER,
            useClass: DbTokenVersionResolver,
          },
        }),
        AuthModule,
        UsersModule,
        MembershipsModule,
      ],
    })
      .overrideProvider(RedisCacheService)
      .useValue({ get: jest.fn(), set: jest.fn(), incr: jest.fn() })
      .compile();

    expect(moduleRef.get(AuthService)).toBeDefined();
    expect(moduleRef.get(UsersService)).toBeDefined();
    expect(moduleRef.get(MembershipsService)).toBeDefined();
    expect(moduleRef.get(TokenVersionStore)).toBeInstanceOf(TokenVersionStore);

    await moduleRef.close();
  });
});
