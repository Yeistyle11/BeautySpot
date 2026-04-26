# 🐳 Uso de Docker para el Proyecto

## Iniciar Docker Desktop

1. **Abre Docker Desktop** desde el menú de inicio de Windows
2. Espera a que Docker Desktop esté completamente iniciado (el ícono de la ballena en la barra de tareas debe estar estático)

## Opción 1: Usar docker-compose (Recomendado)

```powershell
# Iniciar PostgreSQL
docker-compose up -d

# Verificar que está corriendo
docker-compose ps

# Ver logs si hay problemas
docker-compose logs

# Detener PostgreSQL
docker-compose down

# Detener y eliminar datos (cuidado!)
docker-compose down -v
```

## Opción 2: Comando Docker directo

```powershell
# Iniciar PostgreSQL
docker run --name barbershop-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=barbershop -p 5432:5432 -d postgres:14

# Verificar que está corriendo
docker ps

# Ver logs
docker logs barbershop-postgres

# Detener
docker stop barbershop-postgres

# Iniciar de nuevo
docker start barbershop-postgres

# Eliminar contenedor
docker rm -f barbershop-postgres
```

## Después de iniciar PostgreSQL

```powershell
# 1. Crear las tablas en la base de datos
npm run db:push

# 2. Poblar con datos de prueba
npm run db:seed

# 3. Iniciar la aplicación
npm run dev
```

## Comandos Útiles

```powershell
# Ver bases de datos (conectarse al contenedor)
docker exec -it barbershop-postgres psql -U postgres -d barbershop

# Dentro de psql:
\dt          # Listar tablas
\d users     # Describir tabla users
\q           # Salir

# Backup de la base de datos
docker exec barbershop-postgres pg_dump -U postgres barbershop > backup.sql

# Restaurar backup
docker exec -i barbershop-postgres psql -U postgres barbershop < backup.sql
```

## Solución de Problemas

### Error: "port is already allocated"
El puerto 5432 ya está en uso. Opciones:
```powershell
# Ver qué está usando el puerto
netstat -ano | findstr :5432

# Cambiar puerto en docker-compose.yml
ports:
  - "5433:5432"  # Usa 5433 en tu máquina

# Actualizar .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/barbershop?schema=public"
```

### Docker Desktop no inicia
- Reinicia tu computadora
- Asegúrate de tener WSL 2 instalado
- Verifica que la virtualización esté habilitada en BIOS

### Error de conexión a la base de datos
```powershell
# Verificar que el contenedor está corriendo
docker ps

# Verificar logs del contenedor
docker logs barbershop-postgres

# Reiniciar el contenedor
docker restart barbershop-postgres
```
