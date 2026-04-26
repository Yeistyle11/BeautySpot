# 💈 Elite Barbershop - Sistema de Gestión Completo

Sistema moderno de gestión para barberías desarrollado con **Next.js 14**, **TypeScript**, **PostgreSQL**, **Prisma** y las mejores prácticas de desarrollo.

## 🚀 Stack Tecnológico

### Frontend
- **Next.js 14** (App Router)
- **TypeScript** - Tipado estático
- **TailwindCSS** + **shadcn/ui** - Diseño moderno
- **React Hook Form** + **Zod** - Validación de formularios
- **Tanstack Query** - Gestión de estado del servidor

### Backend
- **Next.js API Routes**
- **Prisma ORM** - Gestor de base de datos
- **PostgreSQL** - Base de datos relacional
- **NextAuth.js** - Autenticación segura
- **bcryptjs** - Hashing de contraseñas

### Herramientas de Desarrollo
- **ESLint** + **Prettier** - Calidad de código
- **Husky** - Git hooks
- **Jest** - Testing

## 📋 Características Principales

### Para Clientes
✅ Registro y autenticación segura  
✅ Visualización de servicios y precios  
✅ Sistema de reservas en tiempo real  
✅ Gestión de citas (crear, cancelar, reagendar)  
✅ Sistema de reseñas y calificaciones  
✅ Programa de puntos de fidelidad  
✅ Historial completo de servicios

### Para Barberos
✅ Dashboard personalizado  
✅ Calendario de citas diarias  
✅ Gestión de disponibilidad  
✅ Portfolio de trabajos  
✅ Visualización de reseñas  
✅ Bloqueo de horarios específicos

### Para Administradores
✅ Dashboard con métricas del negocio  
✅ Gestión completa de usuarios  
✅ Gestión de servicios y precios  
✅ Gestión de barberos y horarios  
✅ Reportes y estadísticas  
✅ Sistema de promociones  
✅ Configuración del sistema

## 🗄️ Modelo de Datos

El sistema cuenta con un modelo de datos robusto que incluye:
- **Usuarios** (clientes, barberos, administradores)
- **Servicios** (cortes, barba, paquetes)
- **Citas/Reservas** con diferentes estados
- **Disponibilidad** de barberos
- **Reseñas** y calificaciones
- **Portfolio** de trabajos
- **Notificaciones**
- **Promociones** y descuentos
- **Sistema de puntos** de fidelidad

## 🛠️ Instalación

### Prerrequisitos
- Node.js 18+ 
- PostgreSQL 14+
- npm (incluido con Node.js)

### Pasos de Instalación

1. **Clonar el repositorio** (si aplica)
```powershell
git clone <url-del-repo>
cd barbershop
```

2. **Instalar dependencias**
```powershell
npm install --legacy-peer-deps
```

3. **Configurar PostgreSQL**
```powershell
# Instalar PostgreSQL si no lo tienes
# Windows: Descargar desde https://www.postgresql.org/download/windows/

# Crear la base de datos
psql -U postgres
CREATE DATABASE barbershop;
\q
```

4. **Configurar variables de entorno**
```powershell
# Copiar el archivo de ejemplo
Copy-Item .env.example .env

# Editar .env con tus credenciales
# DATABASE_URL="postgresql://postgres:tupassword@localhost:5432/barbershop?schema=public"
```

5. **Ejecutar migraciones de Prisma**
```powershell
npm run db:push
```

6. **Poblar la base de datos con datos de prueba**
```powershell
npm run db:seed
```

7. **Iniciar el servidor de desarrollo**
```powershell
npm run dev
```

8. **Abrir el navegador**
```
http://localhost:3000
```

## 👥 Credenciales de Prueba

Después de ejecutar el seed, puedes usar estas credenciales:

**Administrador**
- Email: `admin@barbershop.com`
- Password: `password123`

**Barbero 1**
- Email: `carlos.barbero@barbershop.com`
- Password: `password123`

**Barbero 2**
- Email: `luis.barbero@barbershop.com`
- Password: `password123`

**Cliente 1**
- Email: `juan.perez@email.com`
- Password: `password123`

**Cliente 2**
- Email: `maria.gomez@email.com`
- Password: `password123`

## 📜 Scripts Disponibles

```powershell
# Desarrollo
npm run dev              # Iniciar servidor de desarrollo
npm run build            # Build de producción
npm run start            # Iniciar servidor de producción

# Base de Datos
npm run db:push          # Sincronizar schema con BD
npm run db:migrate       # Crear nueva migración
npm run db:studio        # Abrir Prisma Studio (GUI)
npm run db:seed          # Poblar BD con datos de prueba
npm run db:generate      # Generar Prisma Client

# Calidad de Código
npm run lint             # Ejecutar ESLint
npm run lint:fix         # Corregir errores de ESLint
npm run format           # Formatear código con Prettier
npm run format:check     # Verificar formato
npm run type-check       # Verificar tipos de TypeScript

# Testing
npm test                 # Ejecutar tests
npm run test:watch       # Ejecutar tests en modo watch
npm run test:coverage    # Ejecutar tests con cobertura
```

## 📁 Estructura del Proyecto

```
barbershop/
├── prisma/
│   ├── schema.prisma      # Definición del modelo de datos
│   ├── seed.ts            # Datos de prueba
│   └── migrations/        # Historial de migraciones
├── public/                # Archivos estáticos
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── (auth)/        # Rutas de autenticación
│   │   ├── (dashboard)/   # Dashboards por rol
│   │   ├── api/           # API Routes
│   │   ├── servicios/     # Páginas de servicios
│   │   ├── barberos/      # Páginas de barberos
│   │   ├── reservas/      # Sistema de reservas
│   │   ├── layout.tsx     # Layout principal
│   │   ├── page.tsx       # Página de inicio
│   │   └── globals.css    # Estilos globales
│   ├── components/
│   │   ├── ui/            # Componentes de shadcn/ui
│   │   ├── forms/         # Formularios reutilizables
│   │   ├── layouts/       # Layouts compartidos
│   │   └── shared/        # Componentes compartidos
│   ├── lib/
│   │   ├── prisma.ts      # Cliente de Prisma
│   │   ├── auth.ts        # Configuración de NextAuth
│   │   ├── utils.ts       # Utilidades
│   │   └── validations/   # Schemas de Zod
│   ├── hooks/             # Custom hooks
│   ├── types/             # Tipos de TypeScript
│   └── constants/         # Constantes de la app
├── tests/                 # Tests automatizados
├── .env                   # Variables de entorno
├── .env.example           # Ejemplo de variables
├── .eslintrc.json         # Configuración de ESLint
├── .prettierrc            # Configuración de Prettier
├── next.config.js         # Configuración de Next.js
├── tailwind.config.ts     # Configuración de Tailwind
├── tsconfig.json          # Configuración de TypeScript
└── package.json           # Dependencias y scripts
```

## 📊 Sprints de Desarrollo

El proyecto está organizado en 7 sprints:

### Sprint 0 - Setup (3 días) ✅
- Configuración del proyecto
- Base de datos y Prisma

### Sprint 1 - Autenticación (5 días)
- Registro y login
- Recuperación de contraseña
- Perfiles de usuario

### Sprint 2 - Servicios (5 días)
- CRUD de servicios
- Categorías y filtros

### Sprint 3 - Barberos (5 días)
- Gestión de barberos
- Portafolio
- Disponibilidad

### Sprint 4 - Reservas (8 días)
- Sistema de reservas
- Calendario
- Gestión de citas

### Sprint 5 - Administración (5 días)
- Dashboard admin
- Reportes y métricas
- Gestión de usuarios

### Sprint 6 - Funcionalidades Extra (5 días)
- Sistema de reseñas
- Notificaciones
- Programa de fidelidad

### Sprint 7 - Testing y Optimización (5 días)
- Tests automatizados
- Performance
- SEO y accesibilidad

**Total estimado: ~41 días laborales**

## 🎨 Principios de Diseño

- **Mobile First**: Diseño responsive que funciona en todos los dispositivos
- **Accesibilidad**: WCAG 2.1 Level AA
- **Performance**: Optimización de imágenes, lazy loading, code splitting
- **UX**: Interfaz intuitiva y flujos de usuario optimizados

## 🔐 Seguridad

- Contraseñas hasheadas con bcrypt
- Autenticación basada en JWT
- Protección CSRF
- Validación de datos en cliente y servidor
- Sanitización de inputs
- Rate limiting en APIs

## 🧪 Testing

El proyecto incluye configuración para:
- **Unit Tests**: Funciones y utilidades
- **Integration Tests**: API routes
- **E2E Tests**: Flujos principales de usuario

## 📈 Próximas Características

- [ ] Integración con pasarelas de pago
- [ ] Sistema de recordatorios por SMS
- [ ] App móvil con React Native
- [ ] Sistema de inventario de productos
- [ ] Integración con redes sociales
- [ ] Análisis avanzado con IA

## 🤝 Contribución

Este es un proyecto educativo. Para contribuir:

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Mejores Prácticas Implementadas

✅ **Arquitectura limpia**: Separación de responsabilidades  
✅ **Tipado estático**: TypeScript en todo el proyecto  
✅ **Validación de datos**: Zod schemas  
✅ **Code splitting**: Optimización de bundle  
✅ **SEO friendly**: Metadata y sitemap  
✅ **Accesibilidad**: ARIA labels y navegación por teclado  
✅ **Responsive design**: Mobile, tablet y desktop  
✅ **Git hooks**: Pre-commit linting  
✅ **Conventional commits**: Mensajes de commit estandarizados  
✅ **Error handling**: Manejo robusto de errores  

## 📚 Recursos de Aprendizaje

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)

## 📄 Licencia

Este proyecto es de código abierto para fines educativos.

## 👨‍💻 Autor

Proyecto desarrollado como guía de aprendizaje para desarrollo web moderno.

---

**¿Necesitas ayuda?** Revisa la documentación o abre un issue en GitHub.

**Happy Coding! 🚀**
