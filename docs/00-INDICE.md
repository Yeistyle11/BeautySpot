# Índice de documentación

Mapa de la documentación de BeautySpot. **Lee primero esta distinción**, porque
cambia cómo hay que interpretar cada documento:

| Tipo                  | Qué significa                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 **Realidad**       | Describe lo que el código hace hoy. Se genera o verifica contra el repositorio. Si contradice al código, es un error del documento. |
| 🔵 **Especificación** | Describe lo que el producto debe ser: requisitos, historias, modelo de negocio, diseño. Puede describir cosas aún no implementadas. |

## Empezar aquí

| Documento                    | Tipo | Para qué                                            |
| ---------------------------- | ---- | --------------------------------------------------- |
| [../README.md](../README.md) | 🟢   | Visión general, stack, instalación rápida           |
| [SETUP.md](SETUP.md)         | 🟢   | Montar el entorno de desarrollo                     |
| [DOCKER.md](DOCKER.md)       | 🟢   | Qué hace cada compose y cómo construir las imágenes |

## Referencia técnica

| Documento                                          | Tipo  | Contenido                                                                                    |
| -------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------- |
| [API.md](API.md)                                   | 🟢    | Las 216 rutas de los 48 controladores, con roles, paginación, errores y enrutado del gateway |
| [04-ARQUITECTURA.md](04-ARQUITECTURA.md)           | 🟢/🔵 | Arquitectura, ADRs, comunicación entre servicios, multi-tenancy, eventos, circuit breaker    |
| [05-BASE-DATOS.md](05-BASE-DATOS.md)               | 🟢    | Las 47 tablas de las 7 bases, con sus columnas, índices y por qué                            |
| [13-SCHEMA-BASEDATOS.md](13-SCHEMA-BASEDATOS.md)   | 🟢    | Escribir SQL a mano: volcar el DDL real, los tipos enum y qué hay en una base recién creada  |
| [08-ROLES-PERMISOS.md](08-ROLES-PERMISOS.md)       | 🟢/🔵 | Los 6 roles y la matriz de permisos                                                          |
| [16-AUDITORIA-TECNICA.md](16-AUDITORIA-TECNICA.md) | 🟢    | Estado medido en seguridad, arquitectura, rendimiento, calidad e interfaz, con fecha         |
| [TESTING.md](TESTING.md)                           | 🟢    | Tests unitarios y de integración, cobertura, cómo escribir uno                               |
| [CI-CD.md](CI-CD.md)                               | 🟢    | El workflow de GitHub Actions, sus 6 jobs y su coste                                         |
| [../DEPLOY.md](../DEPLOY.md)                       | 🟢    | Despliegue en producción: migraciones, compose de producción y checklist                     |
| [10-DEVOPS.md](10-DEVOPS.md)                       | 🔵    | Estrategia DevOps objetivo (entornos, observabilidad, escalado)                              |

## Producto y negocio

| Documento                                                    | Tipo | Contenido                                                                  |
| ------------------------------------------------------------ | ---- | -------------------------------------------------------------------------- |
| [01-REQUISITOS.md](01-REQUISITOS.md)                         | 🔵   | Requisitos funcionales y no funcionales                                    |
| [02-MODULOS.md](02-MODULOS.md)                               | 🔵   | Desglose funcional por módulo                                              |
| [06-ROADMAP.md](06-ROADMAP.md)                               | 🔵   | Plan de evolución por fases. Su apartado «Dónde está el proyecto» sí es 🟢 |
| [07-UX.md](07-UX.md)                                         | 🔵   | Diseño de experiencia y sistema visual                                     |
| [09-DIFERENCIADORES.md](09-DIFERENCIADORES.md)               | 🔵   | Diferenciadores frente a la competencia                                    |
| [11-MVP.md](11-MVP.md)                                       | 🔵   | Alcance del producto mínimo                                                |
| [12-MODELO-NEGOCIO.md](12-MODELO-NEGOCIO.md)                 | 🔵   | Modelo de negocio, planes y precios                                        |
| [14-MARKETPLACE-EXPERIENCE.md](14-MARKETPLACE-EXPERIENCE.md) | 🔵   | Experiencia del marketplace público                                        |

## Preguntas frecuentes

**¿Qué endpoints existen y quién puede llamarlos?**
[API.md](API.md). Se genera desde los controladores: si una ruta no está ahí, no
existe.

**¿Cómo llamo a la API?**
`http://localhost:3000/api/v1/{servicio}/{ruta}`, con el nombre **corto** del
servicio (`core`, no `core-service`). La forma larga devuelve 404 por cómo el
gateway reescribe la ruta; está explicado en
[API.md](API.md#url-base-y-enrutado-del-gateway).

**¿Cómo levanto esto en local?**
[SETUP.md](SETUP.md).

**¿Puedo desplegar a producción ya?**
El código está listo: hay migraciones para las siete bases, `docker-compose.prod.yml`
y `/health` en los ocho servicios. Queda la parte de operación —secretos, DNS y
reverse proxy con certificado wildcard—, en el checklist de
[../DEPLOY.md](../DEPLOY.md).

**¿Cómo ejecuto los tests? ¿Y los de integración?**
[TESTING.md](TESTING.md).

**¿Por qué falla el CI?**
[CI-CD.md](CI-CD.md) explica los 6 jobs y qué comprueba cada uno.

**¿Dónde están las decisiones de arquitectura?**
Los ADRs viven en [04-ARQUITECTURA.md](04-ARQUITECTURA.md).

**¿Qué columnas tiene una tabla?**
[05-BASE-DATOS.md](05-BASE-DATOS.md). La fuente sigue siendo la entidad
(`services/*/src/entities/`) y su migración; que las dos digan lo mismo lo
comprueba `schema-migrations.int-test.ts` en cada servicio.

**¿Cómo está el proyecto técnicamente? ¿Qué deuda hay?**
[16-AUDITORIA-TECNICA.md](16-AUDITORIA-TECNICA.md), medido contra el código y con
la fecha de la medición.

**¿Qué eventos publica cada servicio y quién los consume?**
El catálogo real está en
[04-ARQUITECTURA.md](04-ARQUITECTURA.md#71-catalogo-de-eventos), con los nombres
que hoy circulan y los que están declarados sin usar.

## Notas sobre el estado de la documentación

- Los documentos 🔵 de producto se escribieron antes de la implementación y
  **describen el objetivo, no necesariamente lo construido**. Todos llevan un aviso
  en la cabecera que lo dice. Se han corregido sus afirmaciones técnicas obsoletas
  (el proyecto usa TypeORM y npm, no Prisma ni pnpm), pero su alcance funcional no
  se ha reajustado a lo implementado: para eso está
  [06-ROADMAP.md](06-ROADMAP.md#donde-esta-el-proyecto), que compara el plan con lo
  que hay.
- Los 🟢 se revisaron contra el código en agosto de 2026, contando rutas,
  entidades, eventos y tests en vez de darlos por buenos. Si uno vuelve a
  contradecir al código, es el documento el que está mal.
- El monolito Next.js que vivía en la raíz del repositorio (`src/`, `prisma/`) fue
  **eliminado**. La fuente de verdad de la UI es `apps/frontend/`. Cualquier
  referencia a `src/app/admin/` o `src/lib/auth.ts` es de esa época.
- `Configuracion_Entorno_Virtual.docx` y `generate_docx.py` son material heredado y
  no se mantienen.
