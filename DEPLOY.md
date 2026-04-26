# Elite Barbershop - Guia de Despliegue en Servidor Windows

## Requisitos del Servidor

- **SO**: Windows Server 2019/2022 o Windows 10/11 Pro
- **RAM**: Minimo 2 GB
- **Disco**: Minimo 20 GB
- **Node.js**: 18.x o superior
- **Docker Desktop** para Windows
- **PM2** (manejador de procesos)

---

## 1. Preparar el Servidor

### Instalar Node.js

1. Descargar Node.js 18+ desde https://nodejs.org (LTS)
2. Ejecutar el instalador y verificar:

```powershell
node --version
npm --version
```

### Instalar Docker Desktop

1. Descargar desde https://www.docker.com/products/docker-desktop
2. Instalar y reiniciar el servidor
3. Verificar que esta corriendo:

```powershell
docker --version
docker-compose --version
```

### Instalar PM2

```powershell
npm install -g pm2 pm2-windows-startup
pm2-startup install
```

---

## 2. Subir el Proyecto al Servidor

### Opcion A: Clonar con Git

```powershell
cd C:\
git clone <url-de-tu-repo> barbershop
cd C:\barbershop
```

### Opcion B: Copiar desde otra maquina

Copiar la carpeta completa del proyecto al servidor (via escritorio remoto, SMB, o FTP) a `C:\barbershop`.

---

## 3. Configurar Variables de Entorno

```powershell
cd C:\barbershop
Copy-Item .env.example .env
notepad .env
```

Editar `.env` con los valores de produccion:

```env
# Base de datos
DATABASE_URL="postgresql://postgres:UNA_PASSWORD_SEGURA@localhost:5432/barbershop?schema=public"

# NextAuth
NEXTAUTH_URL="https://tu-dominio.com"
NEXTAUTH_SECRET="genera-un-secreto-aleatorio-largo-y-seguro"

# Email (configurar con tu proveedor SMTP)
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER="tu-email@gmail.com"
EMAIL_SERVER_PASSWORD="tu-password-de-aplicacion"
EMAIL_FROM="noreply@tudominio.com"

# URL publica
NEXT_PUBLIC_APP_URL="https://tu-dominio.com"

# Datos del negocio
NEXT_PUBLIC_BUSINESS_NAME="Elite Barbershop"
NEXT_PUBLIC_BUSINESS_PHONE="+1234567890"
NEXT_PUBLIC_BUSINESS_EMAIL="contacto@barbershop.com"
```

Generar un secreto seguro para NEXTAUTH_SECRET:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 4. Configurar Docker para Produccion

Editar `docker-compose.yml` y cambiar la password por una segura:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    container_name: barbershop-postgres
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: UNA_PASSWORD_SEGURA
      POSTGRES_DB: barbershop
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
    driver: local
```

**Nota**: El bind `127.0.0.1:5432` restringe el acceso al puerto solo desde el servidor, no desde internet.

Levantar la base de datos:

```powershell
docker-compose up -d
```

Verificar que esta corriendo:

```powershell
docker ps
```

---

## 5. Instalar y Construir

```powershell
cd C:\barbershop

# Instalar dependencias
npm install --legacy-peer-deps

# Generar el cliente de Prisma
npx prisma generate

# Crear las tablas en la base de datos
npx prisma db push

# Cargar datos iniciales
npm run db:seed

# Construir la aplicacion para produccion
npm run build
```

---

## 6. Iniciar la Aplicacion con PM2

```powershell
# Iniciar la app en el puerto 3000
pm2 start npm --name "barbershop" -- start

# Guardar la configuracion de PM2
pm2 save
```

Comandos utiles de PM2:

```powershell
pm2 status              # Ver estado de los procesos
pm2 logs barbershop     # Ver logs en tiempo real
pm2 restart barbershop  # Reiniciar la aplicacion
pm2 stop barbershop     # Detener la aplicacion
pm2 delete barbershop   # Eliminar el proceso
pm2 monit               # Monitor de CPU y memoria
```

Si necesitas cambiar el puerto:

```powershell
pm2 delete barbershop
pm2 start npm --name "barbershop" -- start -- -p 3001
```

---

## 7. Configurar IIS como Reverse Proxy (Opcional - para acceso publico)

Si necesitas exponer la app con un dominio y HTTPS:

### 7.1 Instalar IIS

```powershell
# Abrir PowerShell como Administrador
Install-WindowsFeature -name Web-Server -IncludeManagementTools
```

### 7.2 Instalar URL Rewrite y Application Request Routing

1. Descargar e instalar **URL Rewrite**: https://www.iis.net/downloads/microsoft/url-rewrite
2. Descargar e instalar **ARR**: https://www.iis.net/downloads/microsoft/application-request-routing
3. Habilitar ARR proxy en IIS:

```powershell
# En PowerShell como Administrador
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "enabled" -value "True"
```

### 7.3 Crear sitio en IIS

```powershell
# Como Administrador
New-IISSite -Name "Barbershop" -PhysicalPath "C:\inetpub\barbershop" -BindingInformation "*:80:tu-dominio.com"
```

### 7.4 Crear web.config para el reverse proxy

Crear archivo `C:\inetpub\barbershop\web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyToBarbershop" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:3000/{R:1}" />
          <serverVariables>
            <set name="HTTP_X_FORWARDED_PROTO" value="https" />
            <set name="HTTP_X_FORWARDED_FOR" value="{REMOTE_ADDR}" />
          </serverVariables>
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

### 7.5 Configurar SSL con Certificado de Windows

Si tienes un dominio apuntando al servidor:

1. Abrir **Administrador de IIS**
2. Seleccionar el sitio "Barbershop"
3. Click en **Enlaces** (Bindings)
4. Agregar binding HTTPS en puerto 443
5. Seleccionar un certificado SSL (se puede obtener uno gratis con **win-acme**)

Instalar win-acme para certificados gratuitos Let's Encrypt:

```powershell
# Descargar win-acme
Invoke-WebRequest -Uri https://github.com/win-acme/win-acme/releases/latest/download/win-acme.v2.zip -OutFile win-acme.zip
Expand-Archive win-acme.zip -DestinationPath C:\win-acme

# Ejecutar y seguir las instrucciones
C:\win-acme\wacs.exe
```

---

## 8. Configurar Firewall de Windows

```powershell
# Como Administrador

# Permitir HTTP
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow

# Permitir HTTPS
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow

# Permitir escritorio remoto (si lo necesitas)
New-NetFirewallRule -DisplayName "RDP" -Direction Inbound -Protocol TCP -LocalPort 3389 -Action Allow

# Verificar reglas
Get-NetFirewallRule | Where-Object { $_.DisplayName -match "HTTP|HTTPS" }
```

---

## 9. Verificar que Todo Funciona

```powershell
# Verificar que Docker esta corriendo
docker ps

# Verificar que la app responde
curl http://localhost:3000

# Verificar que PM2 tiene la app corriendo
pm2 status

# Verificar desde fuera del servidor
curl http://IP_DEL_SERVIDOR
```

Abrir en el navegador: `http://IP_DEL_SERVIDOR` o `https://tu-dominio.com`

---

## Comandos de Mantenimiento

### Actualizar la aplicacion

```powershell
cd C:\barbershop
git pull origin main
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
npm run build
pm2 restart barbershop
```

### Reiniciar la base de datos (borra todos los datos)

```powershell
docker-compose down -v
docker-compose up -d
npx prisma db push
npm run db:seed
```

### Backups de la base de datos

```powershell
# Crear backup
docker exec barbershop-postgres pg_dump -U postgres barbershop > "backup_$(Get-Date -Format 'yyyyMMdd').sql"

# Restaurar backup
Get-Content backup_20260426.sql | docker exec -i barbershop-postgres psql -U postgres barbershop
```

### Ver logs

```powershell
# Logs de la aplicacion
pm2 logs barbershop

# Logs de PostgreSQL
docker logs barbershop-postgres

# Logs de IIS (si aplica)
Get-Content "C:\inetpub\logs\LogFiles\W3SVC1\*.log" -Tail 50
```

---

## Estructura de Puertos

| Servicio | Puerto | Acceso |
|----------|--------|--------|
| IIS | 80, 443 | Publico (internet) |
| Next.js | 3000 | Solo localhost |
| PostgreSQL | 5432 | Solo localhost |

---

## Solucion de Problemas

### Docker no inicia

- Verificar que **Docker Desktop** esta ejecutandose
- Reiniciar Docker Desktop desde la bandeja del sistema
- Verificar que la virtualizacion esta habilitada en BIOS

### La app no arranca con PM2

```powershell
# Ver logs de error
pm2 logs barbershop --lines 50

# Verificar que el build existe
Test-Path .next

# Reconstruir si es necesario
npm run build
pm2 restart barbershop
```

### No se puede acceder desde otra maquina

- Verificar firewall: `Get-NetFirewallRule | Where-Object { $_.DisplayName -match "HTTP" }`
- Verificar que IIS o la app escuchan en `0.0.0.0` no solo en `localhost`
- Si usas IIS: verificar los bindings del sitio

### Error de conexion a base de datos

```powershell
# Verificar que el contenedor esta saludable
docker ps
docker exec barbershop-postgres pg_isready -U postgres
```

---

## Checklist de Despliegue

- [ ] Node.js 18+ instalado
- [ ] Docker Desktop instalado y corriendo
- [ ] PM2 instalado con inicio automatico
- [ ] Proyecto copiado a `C:\barbershop`
- [ ] `.env` configurado con valores de produccion
- [ ] `docker-compose.yml` con password segura
- [ ] PostgreSQL corriendo en Docker (`docker ps`)
- [ ] `npm install` ejecutado
- [ ] `prisma db push` y `db:seed` ejecutados
- [ ] `npm run build` exitoso
- [ ] PM2 ejecutando la app (`pm2 status`)
- [ ] Firewall configurado (puertos 80 y 443 abiertos)
- [ ] IIS configurado como reverse proxy (opcional)
- [ ] SSL/HTTPS configurado (opcional)
- [ ] Login con credenciales de admin funciona
- [ ] Backup de la base de datos configurado (opcional)
