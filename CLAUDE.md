# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Elite Barbershop is a barbershop management system built with Next.js 14 (App Router), TypeScript, PostgreSQL, and Prisma. It supports three user roles: CLIENT, BARBER, and ADMIN, each with their own route segment and dashboard.

The UI language is Spanish (all user-facing text, validation messages, and comments are in Spanish).

## Common Commands

```bash
# Development
npm run dev                    # Start dev server (http://localhost:3000)
npm run build                  # Production build

# Database (requires running PostgreSQL)
npm run db:push                # Sync Prisma schema to DB (dev workflow)
npm run db:migrate             # Create a Prisma migration
npm run db:seed                # Seed with test data
npm run db:studio              # Open Prisma Studio GUI
npm run db:generate            # Regenerate Prisma Client

# Code quality
npm run lint                   # ESLint check
npm run lint:fix               # ESLint auto-fix
npm run format                 # Prettier format
npm run format:check           # Prettier check
npm run type-check             # TypeScript type checking (tsc --noEmit)

# Tests
npm test                       # Run all Jest tests
npm run test:watch             # Jest in watch mode
npm run test:coverage          # Jest with coverage

# Docker (alternative to local PostgreSQL)
npm run docker:up              # Start PostgreSQL container
npm run docker:down            # Stop container
```

Install dependencies with `npm install --legacy-peer-deps` (the `--legacy-peer-deps` flag is required).

## Architecture

### Routing & Role Separation

The middleware ([src/middleware.ts](src/middleware.ts)) enforces role-based access:
- `/admin/*` — ADMIN only
- `/barbero/*` — BARBER only
- `/cliente/*` — CLIENT only
- `/login`, `/register`, `/forgot-password`, `/reset-password` — unauthenticated; redirect logged-in users to their role dashboard
- `/`, `/barberos/*`, `/servicios` — public

Each role's pages live under their respective route group (`src/app/admin/`, `src/app/barbero/`, `src/app/cliente/`). Auth pages use the `(auth)` route group and `(dashboard)` group for the profile page.

### Authentication

NextAuth.js with Credentials provider and JWT session strategy. Configuration is in [src/lib/auth.ts](src/lib/auth.ts). The NextAuth type augmentations for `id` and `role` on Session/User/JWT are in [src/types/next-auth.d.ts](src/types/next-auth.d.ts).

The `AuthProvider` ([src/components/shared/AuthProvider.tsx](src/components/shared/AuthProvider.tsx)) wraps the app in a `SessionProvider` and is used in the root layout.

### Database

Prisma with PostgreSQL. Schema at [prisma/schema.prisma](prisma/schema.prisma). Key models:
- **User** — with `Role` enum (CLIENT, BARBER, ADMIN), includes NextAuth Account/Session relations
- **Barber** — extends User (1:1 via `userId`), has specialties, availability, portfolio, reviews
- **Service** — with category, price, duration; linked to barbers via `BarberService` join table
- **Appointment** — links client, barber, services (via `AppointmentService`), has status lifecycle (PENDING → CONFIRMED → COMPLETED / CANCELLED / NO_SHOW)
- **Availability** / **BlockedSlot** — barber scheduling
- **Review**, **Notification**, **Promotion**, **SystemConfig**

Prisma client is a singleton exported from [src/lib/prisma.ts](src/lib/prisma.ts), using the dev-only global cache pattern.

### API Routes

All under `src/app/api/`, following REST-ish conventions:
- `api/auth/*` — NextAuth + custom register/reset-password/forgot-password
- `api/appointments` — CRUD + status transitions (cancel, confirm, complete, no-show, reschedule) + availability checking
- `api/barbers` — CRUD + availability + blocked-slots sub-routes
- `api/services` — CRUD
- `api/barber-services` — barber-service assignments
- `api/reviews` — create/list reviews
- `api/profile`, `api/user/profile` — profile management

### Validation

Zod schemas in [src/lib/validations/schemas.ts](src/lib/validations/schemas.ts) (`loginSchema`, `registerSchema`, `serviceSchema`, `appointmentSchema`). Forms use React Hook Form with Zod resolvers.

### Component Organization

- `src/components/ui/` — Reusable UI primitives (ConfirmDialog, Toast)
- `src/components/forms/` — Form components (LoginForm, RegisterForm, ServiceForm, BarberForm, AppointmentForm, ReviewForm, ProfileForm, ForgotPasswordForm, ResetPasswordForm)
- `src/components/layouts/` — Layout components (MainNav — role-aware navigation)
- `src/components/shared/` — Shared utilities (AuthProvider, AutoRefresh, BarberImage, Breadcrumbs, LastUpdateIndicator)
- `src/components/admin/` — Admin-specific components (AppointmentActions, BarberActions, ServiceActions, EditAppointmentForm, ServiceAssignment)
- `src/components/dashboard/` — Dashboard components (AdminCalendar, BarberAppointments, BarberCalendar)
- `src/components/appointments/` — Appointment components (CancelAppointmentButton)

### Path Aliases

Configured in `tsconfig.json`:
- `@/*` → `./src/*`
- `@/components/*`, `@/lib/*`, `@/hooks/*`, `@/types/*`, `@/constants/*` → respective `src/` subdirectories

### Styling

TailwindCSS with shadcn/ui CSS variable theme system (see [tailwind.config.ts](tailwind.config.ts)). The `prettier-plugin-tailwindcss` plugin auto-sorts class names.

## Key Conventions

- **Prettier**: double quotes, semicolons, ES5 trailing commas, 80 char print width, LF line endings
- **ESLint**: extends `next/core-web-vitals` + `prettier`; `no-explicit-any` is a warning; unused vars with `_` prefix are allowed; `console.log` is warned (use `console.warn`/`console.error`)
- **Husky + lint-staged**: pre-commit hook runs ESLint fix + Prettier on staged `.ts/.tsx` files, Prettier on `.json/.md` files
- **All Prisma models use `@@map`** to snake_case table names (e.g., `User` → `users`, `BarberService` → `barber_services`)
- **Service categories** are defined in [src/constants/index.ts](src/constants/index.ts): "Cortes", "Barba", "Paquetes", "Tratamientos", "Otros"
