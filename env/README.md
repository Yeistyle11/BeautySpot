# Entorno de producción

Un fichero por contenedor, que `docker-compose.prod.yml` monta con `env_file`.
Se versionan sólo las plantillas `*.env.example`; los `*.env` reales están en
`.gitignore` porque contienen secretos.

```bash
for f in env/*.env.example; do cp -n "$f" "${f%.example}"; done
```

Después hay que rellenar a mano todo lo que aparece como `CAMBIAR`. Reglas:

- `JWT_SECRET` **idéntico** en `api-gateway` y `auth-service`, mínimo 32
  caracteres. `JWT_REFRESH_SECRET` distinto de `JWT_SECRET`.
- `INTERNAL_API_SECRET` **idéntico en los ocho** servicios.
- Un valor distinto por secreto, y ninguno igual al de los `.env.example` de
  desarrollo.

Los hosts son nombres de contenedor (`postgres`, `redis`, `rabbitmq`,
`auth-service`…) y los puertos son los internos, no los publicados en el host.

Las contraseñas de Postgres, Redis y RabbitMQ, más `VERSION`, van en el `.env`
de la raíz porque las interpola el propio compose; ver `.env.prod.example`.
