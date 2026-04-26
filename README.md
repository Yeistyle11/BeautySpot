# Elite Barbershop

Sistema de gestion para barberias. Next.js 14, TypeScript, PostgreSQL, Prisma.

## Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes, Prisma ORM, PostgreSQL
- **Auth**: NextAuth.js (JWT + Credentials)
- **Validacion**: React Hook Form + Zod

## Funcionalidades

- Autenticacion por roles (Admin, Barbero, Cliente)
- CRUD de servicios, barberos y citas
- Sistema de reservas con disponibilidad por horario
- Resenas y calificaciones
- Programa de puntos de fidelidad
- Dashboard de administracion con metricas
- Notificaciones y promociones

## Instalacion

### Requisitos

- Node.js 18+
- PostgreSQL 14+ (o Docker)
- npm

### Pasos

```powershell
# 1. Clonar e instalar
git clone https://github.com/Yeistyle11/EliteBarbershop.git
cd EliteBarbershop
npm install --legacy-peer-deps

# 2. Configurar variables de entorno
copy .env.example .env
# Editar .env con las credenciales de tu base de datos

# 3. Levantar base de datos (con Docker)
docker-compose up -d

# 4. Crear tablas y cargar datos de prueba
npx prisma db push
npm run db:seed

# 5. Iniciar desarrollo
npm run dev
```

La app corre en `http://localhost:3000`

## Credenciales de prueba

| Rol     | Email                          | Password      |
|---------|--------------------------------|---------------|
| Admin   | admin@barbershop.com           | password123   |
| Barbero | carlos.barbero@barbershop.com  | password123   |
| Cliente | juan.perez@email.com           | password123   |

## Scripts

```powershell
npm run dev              # Servidor de desarrollo
npm run build            # Build de produccion
npm run start            # Servidor de produccion
npm run lint             # ESLint
npm run format           # Prettier
npm run type-check       # TypeScript check
npm test                 # Jest
npm run db:studio        # Prisma Studio (GUI de BD)
npm run db:seed          # Cargar datos de prueba
```

## Estructura

```
src/
├── app/               # Paginas y API routes (App Router)
│   ├── admin/         # Dashboard y gestion (Admin)
│   ├── barbero/       # Dashboard y disponibilidad (Barbero)
│   ├── cliente/       # Citas y reseñas (Cliente)
│   └── api/           # Endpoints REST
├── components/        # Componentes React
├── lib/               # Prisma client, auth config, validaciones
├── types/             # Tipos TypeScript
└── constants/         # Constantes de la app
prisma/
├── schema.prisma      # Modelo de datos
└── seed.js            # Datos de prueba
```

## Despliegue

Ver [DEPLOY.md](DEPLOY.md) para la guia completa de despliegue en servidor Windows.
