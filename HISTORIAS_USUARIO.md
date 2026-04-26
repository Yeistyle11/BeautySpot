# 📝 HISTORIAS DE USUARIO - PROYECTO BARBERSHOP

## SPRINT 0 - Configuración del Proyecto ✅

### HU-000: Setup inicial del proyecto
**Como:** Desarrollador  
**Quiero:** Configurar el entorno de desarrollo  
**Para:** Empezar a desarrollar con las mejores prácticas

**Criterios de aceptación:**
- [x] Proyecto Next.js 14 con TypeScript configurado
- [x] TailwindCSS instalado y configurado
- [x] ESLint, Prettier y Husky configurados
- [x] Estructura de carpetas definida
- [x] Variables de entorno configuradas
- [x] Git inicializado con .gitignore

---

### HU-001: Configuración de base de datos
**Como:** Desarrollador  
**Quiero:** Configurar Prisma con PostgreSQL  
**Para:** Gestionar la base de datos del proyecto

**Criterios de aceptación:**
- [x] Schema de Prisma completo definido
- [x] Seed data preparado
- [ ] PostgreSQL instalado y conectado
- [ ] Migraciones ejecutadas
- [ ] Datos de prueba cargados

---

## SPRINT 1 - Autenticación y Usuarios (5 días)

### HU-002: Registro de usuarios
**Como:** Usuario nuevo  
**Quiero:** Registrarme en el sistema  
**Para:** Poder usar los servicios de la barbería

**Tareas técnicas:**
- [ ] Crear componente de formulario de registro
- [ ] Implementar validación con Zod
- [ ] Crear API route `/api/auth/register`
- [ ] Hash de contraseña con bcrypt
- [ ] Enviar email de confirmación
- [ ] Manejo de errores y mensajes de validación

**Archivos a crear:**
- `src/app/(auth)/register/page.tsx`
- `src/components/forms/RegisterForm.tsx`
- `src/app/api/auth/register/route.ts`

---

### HU-003: Inicio de sesión
**Como:** Usuario registrado  
**Quiero:** Iniciar sesión  
**Para:** Acceder a mi cuenta

**Tareas técnicas:**
- [ ] Configurar NextAuth.js con credentials provider
- [ ] Crear página de login
- [ ] Implementar formulario de login con validación
- [ ] Configurar JWT tokens
- [ ] Implementar middleware de protección de rutas
- [ ] Redirección según rol de usuario

**Archivos a crear:**
- `src/app/(auth)/login/page.tsx`
- `src/components/forms/LoginForm.tsx`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/lib/auth.ts`
- `src/middleware.ts`

---

### HU-004: Recuperación de contraseña
**Como:** Usuario  
**Quiero:** Recuperar mi contraseña si la olvido  
**Para:** Poder acceder nuevamente a mi cuenta

**Tareas técnicas:**
- [ ] Crear página de solicitud de recuperación
- [ ] Generar token temporal único
- [ ] Enviar email con link de recuperación
- [ ] Crear página para establecer nueva contraseña
- [ ] Validar token y expiración (1 hora)
- [ ] Actualizar contraseña en BD

**Archivos a crear:**
- `src/app/(auth)/forgot-password/page.tsx`
- `src/app/(auth)/reset-password/page.tsx`
- `src/app/api/auth/forgot-password/route.ts`
- `src/app/api/auth/reset-password/route.ts`

---

### HU-005: Perfiles de usuario
**Como:** Usuario autenticado  
**Quiero:** Ver y editar mi perfil  
**Para:** Mantener mi información actualizada

**Tareas técnicas:**
- [ ] Crear página de perfil
- [ ] Mostrar información del usuario
- [ ] Implementar edición de datos
- [ ] Upload de foto de perfil
- [ ] Validación de datos
- [ ] Actualización en BD

**Archivos a crear:**
- `src/app/(dashboard)/perfil/page.tsx`
- `src/components/forms/ProfileForm.tsx`
- `src/app/api/users/[id]/route.ts`

---

## SPRINT 2 - Gestión de Servicios (5 días)

### HU-006: Listar servicios (público)
**Como:** Visitante  
**Quiero:** Ver los servicios disponibles  
**Para:** Conocer qué ofrece la barbería

**Tareas técnicas:**
- [ ] Crear página pública de servicios
- [ ] Implementar grid de servicios
- [ ] Mostrar: nombre, descripción, precio, duración, imagen
- [ ] Implementar filtros por categoría
- [ ] Diseño responsive
- [ ] Optimizar imágenes con Next/Image

**Archivos a crear:**
- `src/app/servicios/page.tsx`
- `src/components/shared/ServiceCard.tsx`
- `src/components/shared/ServiceFilter.tsx`
- `src/app/api/services/route.ts`

---

### HU-007: Crear servicios (admin)
**Como:** Administrador  
**Quiero:** Crear nuevos servicios  
**Para:** Mantener actualizado el catálogo

**Tareas técnicas:**
- [ ] Crear página de administración de servicios
- [ ] Implementar formulario de creación
- [ ] Upload de imagen del servicio
- [ ] Validación con Zod
- [ ] Proteger ruta (solo admin)
- [ ] API route para crear servicio

**Archivos a crear:**
- `src/app/(dashboard)/admin/servicios/nuevo/page.tsx`
- `src/components/forms/ServiceForm.tsx`
- `src/app/api/admin/services/route.ts`

---

### HU-008: Editar servicios (admin)
**Como:** Administrador  
**Quiero:** Editar servicios existentes  
**Para:** Actualizar precios o información

**Tareas técnicas:**
- [ ] Crear página de edición
- [ ] Pre-llenar formulario con datos actuales
- [ ] Permitir cambio de imagen
- [ ] Validación de datos
- [ ] API route para actualizar

**Archivos a crear:**
- `src/app/(dashboard)/admin/servicios/[id]/editar/page.tsx`
- `src/app/api/admin/services/[id]/route.ts`

---

### HU-009: Eliminar servicios (admin)
**Como:** Administrador  
**Quiero:** Eliminar servicios  
**Para:** Remover servicios que ya no ofrecemos

**Tareas técnicas:**
- [ ] Implementar botón de eliminar con confirmación
- [ ] Soft delete (marcar como inactivo)
- [ ] Validar que no tenga citas futuras
- [ ] API route para eliminar

---

## SPRINT 3 - Gestión de Barberos (5 días)

### HU-010: Listar barberos
**Como:** Cliente  
**Quiero:** Ver los barberos disponibles  
**Para:** Elegir quién me atenderá

**Tareas técnicas:**
- [ ] Crear página de barberos
- [ ] Grid de cards con foto, nombre, especialidad
- [ ] Mostrar rating y años de experiencia
- [ ] Link a perfil detallado
- [ ] Diseño responsive

**Archivos a crear:**
- `src/app/barberos/page.tsx`
- `src/components/shared/BarberCard.tsx`
- `src/app/api/barbers/route.ts`

---

### HU-011: Perfil de barbero
**Como:** Cliente  
**Quiero:** Ver el perfil detallado de un barbero  
**Para:** Conocer más sobre su experiencia

**Tareas técnicas:**
- [ ] Crear página de perfil individual
- [ ] Mostrar bio, especialidades, portfolio
- [ ] Listar reseñas con rating
- [ ] Mostrar disponibilidad semanal
- [ ] Botón para agendar cita

**Archivos a crear:**
- `src/app/barberos/[id]/page.tsx`
- `src/components/shared/BarberProfile.tsx`
- `src/components/shared/ReviewsList.tsx`
- `src/app/api/barbers/[id]/route.ts`

---

### HU-012: Crear barbero (admin) ✅
**Como:** Administrador  
**Quiero:** Agregar nuevos barberos  
**Para:** Ampliar el equipo

**Tareas técnicas:**
- [x] Formulario de creación con datos personales y profesionales
- [x] Asignar servicios que puede realizar (mediante página separada)
- [ ] Definir horario laboral por defecto
- [ ] Upload de foto
- [x] Crear usuario con rol BARBER
- [x] Proteger ruta (solo admin)

**Archivos creados:**
- `src/app/admin/barberos/nuevo/page.tsx`
- `src/components/forms/BarberForm.tsx`
- `src/app/api/barbers/route.ts`

**Nota:** Solo el administrador puede crear barberos. El registro público solo crea usuarios CLIENT.

---

### HU-013: Gestionar disponibilidad (barbero)
**Como:** Barbero  
**Quiero:** Gestionar mi disponibilidad  
**Para:** Indicar cuándo puedo atender

**Tareas técnicas:**
- [ ] Crear calendario semanal editable
- [ ] Definir horarios por día de semana
- [ ] Bloquear días/horas específicas
- [ ] Marcar vacaciones o días libres
- [ ] API para guardar disponibilidad

**Archivos a crear:**
- `src/app/(dashboard)/barbero/disponibilidad/page.tsx`
- `src/components/shared/AvailabilityCalendar.tsx`
- `src/app/api/barbers/availability/route.ts`

---

## SPRINT 4 - Sistema de Reservas (8 días)

### HU-014: Crear reserva (cliente)
**Como:** Cliente autenticado  
**Quiero:** Agendar una cita  
**Para:** Recibir un servicio

**Tareas técnicas:**
- [ ] Crear flujo de reserva multi-paso
- [ ] Paso 1: Seleccionar servicio
- [ ] Paso 2: Seleccionar barbero (o auto-asignar)
- [ ] Paso 3: Seleccionar fecha y hora
- [ ] Validar disponibilidad en tiempo real
- [ ] Confirmación con resumen
- [ ] Enviar email de confirmación
- [ ] Calcular puntos de fidelidad

**Archivos a crear:**
- `src/app/reservas/nueva/page.tsx`
- `src/components/forms/AppointmentWizard.tsx`
- `src/components/shared/DateTimePicker.tsx`
- `src/app/api/appointments/route.ts`
- `src/app/api/appointments/availability/route.ts`

---

### HU-015: Ver mis reservas (cliente)
**Como:** Cliente  
**Quiero:** Ver mis citas agendadas  
**Para:** Recordar cuándo debo asistir

**Tareas técnicas:**
- [ ] Crear página de mis reservas
- [ ] Tabs: Próximas, Pasadas, Canceladas
- [ ] Filtros por fecha
- [ ] Mostrar detalles completos de cada cita
- [ ] Botones de acción según estado
- [ ] Badge de estado visual

**Archivos a crear:**
- `src/app/(dashboard)/cliente/citas/page.tsx`
- `src/components/shared/AppointmentCard.tsx`
- `src/app/api/appointments/user/[userId]/route.ts`

---

### HU-016: Cancelar reserva (cliente)
**Como:** Cliente  
**Quiero:** Cancelar una cita  
**Para:** Liberar el horario si no puedo asistir

**Tareas técnicas:**
- [ ] Validar que falten más de 2 horas para la cita
- [ ] Modal de confirmación con campo de razón
- [ ] Actualizar estado en BD
- [ ] Liberar disponibilidad del barbero
- [ ] Enviar email de cancelación
- [ ] Notificar al barbero

**Archivos a crear:**
- `src/components/shared/CancelAppointmentDialog.tsx`
- `src/app/api/appointments/[id]/cancel/route.ts`

---

### HU-017: Reagendar reserva (cliente)
**Como:** Cliente  
**Quiero:** Cambiar la fecha/hora de mi cita  
**Para:** Ajustarla a mi disponibilidad

**Tareas técnicas:**
- [ ] Mostrar calendario con nueva disponibilidad
- [ ] Permitir cambiar servicio y/o barbero (opcional)
- [ ] Validar nueva disponibilidad
- [ ] Actualizar cita en BD
- [ ] Enviar email de confirmación de cambio
- [ ] Liberar slot anterior

**Archivos a crear:**
- `src/components/shared/RescheduleAppointmentDialog.tsx`
- `src/app/api/appointments/[id]/reschedule/route.ts`

---

### HU-018: Dashboard de citas (barbero)
**Como:** Barbero  
**Quiero:** Ver mis citas del día  
**Para:** Organizarme

**Tareas técnicas:**
- [ ] Crear dashboard del barbero
- [ ] Vista de calendario diario
- [ ] Lista de citas ordenadas por hora
- [ ] Información del cliente y servicio
- [ ] Botones: Marcar completada, No show
- [ ] Campo de notas sobre el servicio
- [ ] Contadores: citas del día, ingresos estimados

**Archivos a crear:**
- `src/app/(dashboard)/barbero/page.tsx`
- `src/components/shared/BarberDashboard.tsx`
- `src/app/api/appointments/barber/[barberId]/route.ts`

---

## SPRINT 5 - Panel Administrativo (5 días)

### HU-019: Dashboard admin
**Como:** Administrador  
**Quiero:** Ver métricas del negocio  
**Para:** Tomar decisiones informadas

**Tareas técnicas:**
- [ ] Crear dashboard con KPIs
- [ ] Ingresos del mes actual
- [ ] Citas del día/semana
- [ ] Tasa de cancelación
- [ ] Gráfico de ingresos mensuales (Recharts)
- [ ] Servicios más solicitados
- [ ] Top barberos por reservas
- [ ] Filtros por período

**Archivos a crear:**
- `src/app/(dashboard)/admin/page.tsx`
- `src/components/shared/AdminDashboard.tsx`
- `src/components/shared/Charts.tsx`
- `src/app/api/admin/metrics/route.ts`

---

### HU-020: Gestión de usuarios (admin)
**Como:** Administrador  
**Quiero:** Gestionar todos los usuarios  
**Para:** Mantener control del sistema

**Tareas técnicas:**
- [ ] Tabla de usuarios con filtros
- [ ] Filtrar por rol
- [ ] Ver detalles de cualquier usuario
- [ ] Cambiar roles
- [ ] Activar/desactivar cuentas
- [ ] Ver historial de citas
- [ ] Búsqueda por nombre/email

**Archivos a crear:**
- `src/app/(dashboard)/admin/usuarios/page.tsx`
- `src/components/shared/UsersTable.tsx`
- `src/app/api/admin/users/route.ts`

---

### HU-021: Gestión de citas (admin)
**Como:** Administrador  
**Quiero:** Gestionar todas las citas  
**Para:** Resolver incidencias

**Tareas técnicas:**
- [ ] Vista de todas las citas con filtros múltiples
- [ ] Filtros: fecha, estado, barbero, cliente
- [ ] Crear cita manualmente
- [ ] Editar cualquier cita
- [ ] Cancelar citas con razón
- [ ] Reasignar barbero
- [ ] Exportar listado

**Archivos a crear:**
- `src/app/(dashboard)/admin/citas/page.tsx`
- `src/components/shared/AppointmentsTable.tsx`
- `src/app/api/admin/appointments/route.ts`

---

### HU-022: Reportes (admin)
**Como:** Administrador  
**Quiero:** Generar reportes  
**Para:** Análisis del negocio

**Tareas técnicas:**
- [ ] Reporte de ingresos por período
- [ ] Reporte de servicios más vendidos
- [ ] Reporte de performance de barberos
- [ ] Reporte de clientes frecuentes
- [ ] Selector de rango de fechas
- [ ] Visualización con gráficos
- [ ] Botón para exportar a PDF

**Archivos a crear:**
- `src/app/(dashboard)/admin/reportes/page.tsx`
- `src/components/shared/Reports.tsx`
- `src/app/api/admin/reports/route.ts`

---

## SPRINT 6 - Funcionalidades Adicionales (5 días)

### HU-023: Sistema de reseñas
**Como:** Cliente  
**Quiero:** Dejar una reseña después del servicio  
**Para:** Compartir mi experiencia

**Tareas técnicas:**
- [ ] Solo clientes con cita COMPLETED pueden reseñar
- [ ] Formulario con rating 1-5 estrellas
- [ ] Comentario opcional
- [ ] Una reseña por cita
- [ ] Mostrar reseñas en perfil de barbero
- [ ] Calcular rating promedio del barbero

**Archivos a crear:**
- `src/components/forms/ReviewForm.tsx`
- `src/components/shared/ReviewCard.tsx`
- `src/app/api/reviews/route.ts`

---

### HU-024: Notificaciones
**Como:** Usuario  
**Quiero:** Recibir notificaciones  
**Para:** Estar informado sobre mis citas

**Tareas técnicas:**
- [ ] Email de confirmación de cita
- [ ] Email de recordatorio (24h antes)
- [ ] Email de cancelación
- [ ] Notificaciones in-app (badge)
- [ ] Página de notificaciones
- [ ] Marcar como leídas
- [ ] Configuración de preferencias

**Archivos a crear:**
- `src/lib/email.ts`
- `src/app/(dashboard)/notificaciones/page.tsx`
- `src/components/shared/NotificationBell.tsx`
- `src/app/api/notifications/route.ts`

---

### HU-025: Programa de fidelidad
**Como:** Cliente frecuente  
**Quiero:** Acumular puntos  
**Para:** Obtener descuentos

**Tareas técnicas:**
- [ ] Otorgar puntos por cada servicio completado
- [ ] Visualización de puntos en perfil
- [ ] Listado de promociones disponibles
- [ ] Canjear puntos por descuentos
- [ ] Historial de transacciones de puntos
- [ ] Aplicar descuento en nueva reserva

**Archivos a crear:**
- `src/app/(dashboard)/cliente/puntos/page.tsx`
- `src/components/shared/LoyaltyCard.tsx`
- `src/app/api/loyalty/route.ts`

---

### HU-026: Búsqueda avanzada
**Como:** Cliente  
**Quiero:** Buscar servicios o barberos  
**Para:** Encontrar rápidamente lo que necesito

**Tareas técnicas:**
- [ ] Barra de búsqueda global
- [ ] Búsqueda en tiempo real
- [ ] Resultados: servicios + barberos
- [ ] Filtros avanzados: precio, duración, categoría, rating
- [ ] Ordenamiento de resultados
- [ ] Diseño responsive

**Archivos a crear:**
- `src/components/shared/SearchBar.tsx`
- `src/app/buscar/page.tsx`
- `src/app/api/search/route.ts`

---

## SPRINT 7 - Optimización y Testing (5 días)

### HU-027: Testing
**Como:** Desarrollador  
**Quiero:** Tests automatizados  
**Para:** Garantizar calidad del código

**Tareas técnicas:**
- [ ] Unit tests para funciones de utils
- [ ] Unit tests para validaciones de Zod
- [ ] Integration tests para API routes críticas
- [ ] Tests de autenticación
- [ ] Tests de creación de citas
- [ ] Cobertura mínima del 70%

**Archivos a crear:**
- `tests/unit/utils.test.ts`
- `tests/unit/validations.test.ts`
- `tests/integration/auth.test.ts`
- `tests/integration/appointments.test.ts`

---

### HU-028: Performance
**Como:** Usuario  
**Quiero:** Que la app cargue rápido  
**Para:** Tener buena experiencia

**Tareas técnicas:**
- [ ] Implementar ISR en páginas de servicios y barberos
- [ ] Lazy loading de imágenes
- [ ] Code splitting por rutas
- [ ] Optimizar queries de Prisma (include, select)
- [ ] Implementar React Query para cache
- [ ] Lighthouse score > 90

**Tareas:**
- Auditoría de performance
- Optimización de bundle size
- Optimización de imágenes
- Cache de datos frecuentes

---

### HU-029: SEO
**Como:** Dueño del negocio  
**Quiero:** Que el sitio sea encontrado en Google  
**Para:** Atraer más clientes

**Tareas técnicas:**
- [ ] Metadata dinámica en todas las páginas
- [ ] Generar sitemap.xml
- [ ] Configurar robots.txt
- [ ] Schema markup para negocio local
- [ ] Open Graph tags para redes sociales
- [ ] Canonical URLs

**Archivos a crear:**
- `src/app/sitemap.ts`
- `src/app/robots.ts`
- Actualizar metadata en layouts

---

### HU-030: Accesibilidad
**Como:** Usuario con discapacidad  
**Quiero:** Poder usar el sitio  
**Para:** Acceder a los servicios

**Tareas técnicas:**
- [ ] ARIA labels en todos los componentes
- [ ] Navegación completa por teclado
- [ ] Focus visible en elementos interactivos
- [ ] Contraste de colores WCAG AA
- [ ] Screen reader compatible
- [ ] Textos alternativos en imágenes
- [ ] Formularios accesibles

**Tareas:**
- Auditoría de accesibilidad
- Implementar mejoras
- Testing con screen readers
- Validación WCAG 2.1 Level AA

---

## RESUMEN POR SPRINT

| Sprint | Días | HUs | Estado |
|--------|------|-----|--------|
| Sprint 0 | 3 | 2 | ✅ Setup completado |
| Sprint 1 | 5 | 4 | 🔄 Autenticación |
| Sprint 2 | 5 | 4 | ⏳ Servicios |
| Sprint 3 | 5 | 4 | ⏳ Barberos |
| Sprint 4 | 8 | 5 | ⏳ Reservas |
| Sprint 5 | 5 | 4 | ⏳ Admin |
| Sprint 6 | 5 | 4 | ⏳ Extras |
| Sprint 7 | 5 | 4 | ⏳ Testing |
| **TOTAL** | **41** | **31** | **3%** |

---

## PRÓXIMOS PASOS INMEDIATOS

1. ✅ **Instalar dependencias**: `npm install --legacy-peer-deps`
2. **Configurar PostgreSQL**
3. **Ejecutar migraciones**: `npm run db:push`
4. **Poblar datos**: `npm run db:seed`
5. **Iniciar desarrollo**: `npm run dev`
6. **Comenzar Sprint 1**: HU-002 (Registro de usuarios)
