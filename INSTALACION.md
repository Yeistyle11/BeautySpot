# 🚀 Guía de Instalación Rápida

## ✅ Paso 1: Dependencias Instaladas ✅

Las dependencias de Node.js ya están instaladas correctamente.

---

## 📦 Paso 2: Instalar PostgreSQL

### Opción A: Instalar PostgreSQL (Recomendado para producción)

1. **Descargar PostgreSQL para Windows:**
   - Ve a: https://www.postgresql.org/download/windows/
   - Descarga el instalador de EDB (versión 14 o superior)
   - Ejecuta el instalador

2. **Durante la instalación:**
   - Usuario: `postgres` (por defecto)
   - Contraseña: **Elige una contraseña** (recuérdala)
   - Puerto: `5432` (por defecto)
   - Marca la casilla "pgAdmin 4" (GUI para gestionar la BD)

3. **Crear la base de datos:**
   ```powershell
   # Abre PowerShell como Administrador
   # Navega a la carpeta bin de PostgreSQL (ejemplo):
   cd "C:\Program Files\PostgreSQL\16\bin"
   
   # Conéctate a PostgreSQL
   .\psql.exe -U postgres
   
   # Dentro de psql, ejecuta:
   CREATE DATABASE barbershop;
   \q
   ```

4. **Actualizar el archivo .env:**
   ```
   DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/barbershop?schema=public"
   ```

### Opción B: Docker (Más rápido)

Si tienes Docker Desktop instalado:

```powershell
# Iniciar PostgreSQL en Docker
docker run --name barbershop-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=barbershop -p 5432:5432 -d postgres:14

# El .env ya está configurado para esta opción
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/barbershop?schema=public"
```

---

## 🗄️ Paso 3: Configurar la Base de Datos

Una vez que PostgreSQL esté instalado y corriendo:

```powershell
# 1. Sincronizar el schema de Prisma con la base de datos
npm run db:push

# 2. Poblar con datos de prueba
npm run db:seed
```

---

## 🎯 Paso 4: Iniciar el Proyecto

```powershell
# Iniciar servidor de desarrollo
npm run dev
```

Abre tu navegador en: **http://localhost:3000**

---

## 👥 Credenciales de Prueba

Después de ejecutar `npm run db:seed`, usa estas credenciales:

### Administrador
- Email: `admin@barbershop.com`
- Password: `password123`

### Barbero
- Email: `carlos.barbero@barbershop.com`
- Password: `password123`

### Cliente
- Email: `juan.perez@email.com`
- Password: `password123`

---

## 🛠️ Comandos Útiles

```powershell
# Ver la base de datos gráficamente
npm run db:studio

# Reiniciar la base de datos (CUIDADO: Borra todos los datos)
npm run db:push -- --force-reset
npm run db:seed

# Ver logs de desarrollo
npm run dev

# Formatear código
npm run format

# Ver errores de linting
npm run lint
```

---

## ❌ Solución de Problemas

### Error: "Can't reach database server"
- Verifica que PostgreSQL esté corriendo
- Revisa que el puerto 5432 no esté en uso
- Verifica las credenciales en el archivo `.env`

### Error: "Schema not found"
- Ejecuta: `npm run db:push`

### Error al hacer seed
- Asegúrate de que la base de datos existe
- Ejecuta: `npm run db:push` primero

### Puerto 3000 en uso
```powershell
# Iniciar en otro puerto
npm run dev -- -p 3001
```

---

## 📚 Próximos Pasos

1. ✅ Dependencias instaladas
2. ⏳ Instalar PostgreSQL
3. ⏳ Configurar base de datos
4. ⏳ Iniciar desarrollo
5. ⏳ Comenzar Sprint 1 (Autenticación)

---

**¿Necesitas ayuda?** Revisa el `README.md` principal para más detalles.
