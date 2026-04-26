# Documentación de la API - Sistema de Barbería

## Índice
- [Autenticación](#autenticación)
- [Usuarios](#usuarios)
- [Barberos](#barberos)
- [Servicios](#servicios)
- [Citas](#citas)

## Autenticación

Todas las rutas están protegidas con NextAuth. Las credenciales deben enviarse mediante el sistema de autenticación.

### Roles de Usuario
- `ADMIN`: Acceso total al sistema
- `BARBER`: Gestión de citas propias y perfil
- `CLIENT`: Reserva de citas y gestión de perfil

---

## Usuarios

### GET /api/user/profile
Obtiene el perfil del usuario autenticado.

**Requiere**: Autenticación

**Respuesta**:
```json
{
  "id": 1,
  "name": "Juan Pérez",
  "email": "juan@email.com",
  "phone": "+56912345678",
  "role": "CLIENT",
  "loyaltyPoints": 150,
  "image": "url_imagen"
}
```

### PATCH /api/profile
Actualiza el perfil del usuario autenticado.

**Requiere**: Autenticación

**Body**:
```json
{
  "name": "Juan Pérez",
  "email": "juan@email.com",
  "phone": "+56912345678",
  "currentPassword": "actual123",  // Opcional, solo si cambia contraseña
  "newPassword": "nueva123"        // Opcional
}
```

---

## Barberos

### GET /api/barbers
Obtiene lista de barberos.

**Parámetros de query**:
- `active`: `true` | `false` - Filtrar por estado activo

**Respuesta**:
```json
[
  {
    "id": 1,
    "bio": "Especialista en cortes modernos",
    "specialties": ["Corte clásico", "Degradado"],
    "yearsExp": 5,
    "rating": 4.8,
    "active": true,
    "user": {
      "name": "Carlos Barbero",
      "email": "carlos@barbershop.com",
      "image": "url_imagen"
    },
    "services": [
      { "serviceId": 1 }
    ]
  }
]
```

### GET /api/barbers/[id]
Obtiene detalles de un barbero específico.

**Requiere**: Autenticación (ADMIN o el mismo barbero)

### POST /api/barbers
Crea un nuevo barbero.

**Requiere**: Rol ADMIN

**Body**:
```json
{
  "name": "Carlos Barbero",
  "email": "carlos@barbershop.com",
  "password": "password123",
  "phone": "+56912345678",
  "bio": "Especialista en cortes modernos",
  "specialties": ["Corte clásico", "Degradado"],
  "yearsExp": 5,
  "image": "data:image/jpeg;base64,..."  // Opcional
}
```

### PATCH /api/barbers/[id]
Actualiza un barbero.

**Requiere**: Rol ADMIN o ser el mismo barbero

**Body**: Campos a actualizar (name, phone, bio, specialties, yearsExp, image, active)

### DELETE /api/barbers/[id]
Elimina (desactiva) un barbero.

**Requiere**: Rol ADMIN

**Validación**: No se puede eliminar si tiene citas pendientes

---

## Servicios

### GET /api/services
Obtiene lista de servicios.

**Parámetros de query**:
- `active`: `true` | `false` - Filtrar por estado activo

**Respuesta**:
```json
[
  {
    "id": 1,
    "name": "Corte Clásico",
    "description": "Corte tradicional con tijeras",
    "price": 15000,
    "duration": 30,
    "category": "corte",
    "active": true
  }
]
```

### POST /api/services
Crea un nuevo servicio.

**Requiere**: Rol ADMIN

**Body**:
```json
{
  "name": "Corte Clásico",
  "description": "Corte tradicional",
  "price": 15000,
  "duration": 30,
  "category": "corte"
}
```

### PATCH /api/services/[id]
Actualiza un servicio.

**Requiere**: Rol ADMIN

### DELETE /api/services/[id]
Elimina (desactiva) un servicio.

**Requiere**: Rol ADMIN

---

## Citas (Appointments)

### GET /api/appointments
Obtiene citas según el rol del usuario.

**Requiere**: Autenticación

**Comportamiento por rol**:
- `ADMIN`: Todas las citas
- `BARBER`: Solo citas del barbero
- `CLIENT`: Solo citas del cliente

**Respuesta**:
```json
[
  {
    "id": 1,
    "date": "2025-12-08T00:00:00.000Z",
    "startTime": "10:00",
    "endTime": "11:00",
    "status": "CONFIRMED",
    "notes": "Preferencia por degradado bajo",
    "pointsEarned": 150,
    "client": {
      "name": "Juan Pérez",
      "email": "juan@email.com",
      "phone": "+56912345678"
    },
    "barber": {
      "user": {
        "name": "Carlos Barbero",
        "image": "url_imagen"
      }
    },
    "services": [
      {
        "service": {
          "id": 1,
          "name": "Corte Clásico",
          "price": 15000,
          "duration": 30
        }
      }
    ]
  }
]
```

### POST /api/appointments
Crea una nueva cita.

**Requiere**: Autenticación (CLIENT)

**Body**:
```json
{
  "barberId": 1,
  "serviceIds": [1, 2],
  "date": "2025-12-08",
  "startTime": "10:00",
  "notes": "Preferencia por degradado bajo"
}
```

**Validaciones**:
- Horario disponible (no conflictos)
- Mínimo 2 horas de anticipación
- Servicios existen y están activos
- Barbero existe y está activo

### GET /api/appointments/[id]
Obtiene detalles de una cita específica.

**Requiere**: Autenticación (propietario o ADMIN)

### PATCH /api/appointments/[id]
Actualiza una cita.

**Requiere**: Autenticación (ADMIN)

**Body**:
```json
{
  "barberId": 1,
  "serviceIds": [1, 2],
  "date": "2025-12-08",
  "startTime": "10:00"
}
```

**Nota**: Al editar, el status vuelve a `PENDING`

### DELETE /api/appointments/[id]
Elimina una cita.

**Requiere**: Rol ADMIN

### POST /api/appointments/[id]/confirm
Confirma una cita.

**Requiere**: Rol ADMIN o BARBER (si es su cita)

**Efecto**: Cambia status de `PENDING` a `CONFIRMED`

### POST /api/appointments/[id]/complete
Marca una cita como completada.

**Requiere**: Rol BARBER (solo sus citas)

**Efectos**:
- Cambia status a `COMPLETED`
- Suma puntos de lealtad al cliente (10% del precio total)

### POST /api/appointments/[id]/no-show
Marca una cita como no presentado.

**Requiere**: Rol BARBER (solo sus citas)

**Efecto**: Cambia status a `NO_SHOW`

### POST /api/appointments/[id]/cancel
Cancela una cita.

**Requiere**: Autenticación (propietario o ADMIN)

**Body**:
```json
{
  "reason": "Motivo de cancelación"
}
```

**Validación**: Solo se pueden cancelar citas con status `PENDING` o `CONFIRMED`

### GET /api/appointments/availability
Verifica disponibilidad de horarios.

**Parámetros de query**:
- `barberId`: ID del barbero
- `date`: Fecha en formato YYYY-MM-DD
- `serviceIds`: IDs de servicios separados por coma

**Respuesta**:
```json
{
  "available": true,
  "suggestedTimes": ["10:00", "11:30", "14:00"]
}
```

---

## Estados de Citas

- `PENDING`: Cita creada, pendiente de confirmación
- `CONFIRMED`: Cita confirmada por el barbero/admin
- `COMPLETED`: Servicio completado
- `CANCELLED`: Cancelada por el cliente/admin
- `NO_SHOW`: Cliente no se presentó

---

## Gestión de Servicios de Barberos

### POST /api/barber-services
Asigna servicios a un barbero.

**Requiere**: Rol ADMIN

**Body**:
```json
{
  "barberId": 1,
  "serviceId": 2
}
```

### DELETE /api/barber-services
Remueve un servicio de un barbero.

**Requiere**: Rol ADMIN

**Body**:
```json
{
  "barberId": 1,
  "serviceId": 2
}
```

---

## Códigos de Error Comunes

- `401`: No autenticado
- `403`: No autorizado (falta permisos)
- `404`: Recurso no encontrado
- `400`: Error de validación o datos inválidos
- `500`: Error interno del servidor

## Notas Importantes

1. **Fechas y Horas**: 
   - Las fechas se envían en formato `YYYY-MM-DD`
   - Las horas en formato `HH:MM` (24 horas)

2. **Puntos de Lealtad**: 
   - Se otorgan al completar una cita
   - Equivalen al 10% del precio total

3. **Imágenes**: 
   - Se aceptan en formato Base64
   - Tamaño máximo: 2MB

4. **Horarios**:
   - Horario de trabajo: 9:00 - 20:00
   - Días: Lunes a Sábado
   - Las citas deben reservarse con mínimo 2 horas de anticipación
