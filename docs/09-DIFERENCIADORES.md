# 09 - Diferenciadores Competitivos - BeautySpot SaaS

## Resumen

Este documento describe los diferenciadores competitivos de BeautySpot frente a las
soluciones existentes en el mercado latinoamericano (Booksy, Treatwell, Fresha, agenda
digital básica). Cada diferenciador incluye una descripción funcional, el enfoque técnico
de implementación y el alcance definido para el MVP versus funcionalidades futuras.

---

## Contexto Competitivo

### Alternativas Actuales

| Solución                   | Fortalezas                        | Debilidades en LATAM                                        |
| -------------------------- | --------------------------------- | ----------------------------------------------------------- |
| Booksy                     | App madura, gran base de usuarios | Costoso, poco personalizable, sin WhatsApp nativo           |
| Fresha                     | Gratuito, buena UI                | Sin soporte regional, sin fidelización, sin geolocalización |
| Agenda Excel/Papel         | Sin costo, familiar               | Sin analytics, sin marketplace, sin recordatorios           |
| Sistemas locales genéricos | Baratos                           | Sin marketplace, sin mobile, sin integración WhatsApp       |

### Propuesta de Valor de BeautySpot

BeautySpot se diferencia al combinar tres pilares que ningún competidor ofrece de forma
integrada en América Latina:

1. **Inteligencia operativa**: IA que optimiza la agenda y predice comportamiento
2. **Conexión regional**: WhatsApp nativo + geolocalización + contexto cultural LATAM
3. **Crecimiento orgánico**: Marketplace con SEO + programa de fidelización + gamificación

---

## 1. Sugerencias de Horarios con IA

### Descripción

El motor de inteligencia analiza patrones históricos de reservas para recomendar slots
óptimos que maximizan la ocupación del profesional y minimizan los huecos en la agenda.
El sistema aprende de los datos de cada negocio y adapta sus sugerencias en tiempo real.

### Funcionalidades

- **Para clientes**: Al reservar, el sistema sugiere "Horarios recomendados" basados en:
  - Probabilidad de asistencia del cliente (historial de no-show)
  - Preferencias horarias del cliente (horarios frecuentes)
  - Contexto del servicio (duración, profesional preferido)
- **Para profesionales**: Sugerencias de bloqueos óptimos para descansos:
  - Análisis de patrones de baja demanda
  - Recomendación de ventanas para almuerzo/descanso
- **Para owners/admins**: Recomendaciones de configuración:
  - Horarios de apertura/cierre óptimos basados en demanda real
  - Sugerencia de agregar/quitar profesionales en ciertos horarios
  - Detección de cuellos de botella (horarios con exceso de demanda)

### Enfoque Técnico

#### Arquitectura

```
[Booking Service] --> [Analytics Service] --> [ML Engine]
       |                    |                      |
  Datos de citas     Procesamiento de       Modelo predictivo
  en tiempo real     patrones históricos    (scoring de slots)
       |                    |                      |
       v                    v                      v
  API de sugerencias <-- Cached predictions <-- Feature store
```

#### Algoritmo de Recomendación de Slots

```typescript
interface SlotRecommendation {
  startTime: Date;
  professionalId: string;
  score: number; // 0.0 - 1.0, probabilidad de asistencia
  reasons: string[]; // Explicación de la recomendación
}

// Factores del scoring:
// - Probabilidad de asistencia del cliente (peso: 0.30)
// - Proximidad a preferencias horarias del cliente (peso: 0.20)
// - Optimización de agenda del profesional (peso: 0.25)
// - Demanda histórica del horario (peso: 0.15)
// - Frecuencia del servicio (peso: 0.10)

// Feature store por cliente:
interface ClientFeatures {
  noShowRate: number; // Tasa de no-show histórica
  preferredTimeSlots: string[]; // Top 5 horarios frecuentes
  preferredProfessional: string;
  averageBookingFrequency: number; // Días entre reservas
  cancellationRate: number;
  preferredDaysOfWeek: number[]; // 0-6
}
```

#### Stack Tecnológico

- **Feature Store**: Redis con hashes para features de clientes y profesionales
- **Modelo**: Heurística ponderada en MVP; transición a modelo ML (scikit-learn) post-MVP
- **Cache**: Predicciones pre-calculadas cada 15 minutos para slots del día
- **Fallback**: Si no hay datos suficientes (<5 citas), mostrar todos los slots disponibles

#### API

```typescript
// Endpoint de sugerencias
GET /api/v1/booking/suggestions
  ?businessId={id}
  &serviceIds={id1,id2}
  &professionalId={id}        // opcional
  &dateFrom={ISO date}
  &dateTo={ISO date}
  &clientId={id}              // opcional, para personalización

Response:
{
  "recommendations": [
    {
      "startTime": "2024-05-15T14:00:00Z",
      "endTime": "2024-05-15T15:00:00Z",
      "professionalId": "uuid",
      "professionalName": "Carlos Pérez",
      "score": 0.92,
      "reasons": [
        "Horario consistente con tus reservas anteriores",
        "Alta probabilidad de asistencia según tu historial"
      ]
    }
  ],
  "allSlots": [ ... ]  // Todos los slots disponibles como referencia
}
```

### Alcance MVP vs Futuro

| Funcionalidad                         | MVP                  | Post-MVP       |
| ------------------------------------- | -------------------- | -------------- |
| Recomendación de slots al cliente     | Si (heurística)      | Si (ML)        |
| Sugerencia de bloqueos al profesional | No                   | Si             |
| Recomendación de horarios óptimos     | No                   | Si             |
| Detección de cuellos de botella       | No                   | Si             |
| Feature store en Redis                | Si                   | Si             |
| Modelo ML (scikit-learn)              | No                   | Si             |
| A/B testing de recomendaciones        | No                   | Si             |
| Explicabilidad de recomendaciones     | Si (razones básicas) | Si (detallado) |

---

## 2. Búsqueda por Geolocalización

### Descripción

Los clientes pueden descubrir negocios cercanos a su ubicación actual o a una dirección
específica, con filtrado por radio de distancia. Esto transforma la búsqueda de servicios
de belleza de un modelo de directorio pasivo a uno activo basado en proximidad.

### Funcionalidades

- **Búsqueda por GPS**: Usar la ubicación actual del dispositivo como punto de origen
- **Búsqueda por dirección**: Ingresar una dirección manualmente con autocompletado
- **Filtro por radio**: Opciones predefinidas (1km, 5km, 10km, 25km) o personalizado
- **Ordenamiento por distancia**: Los resultados más cercanos aparecen primero
- **Vista de mapa**: Visualizar negocios en un mapa interactivo con pines
- **Indicador de distancia**: Cada resultado muestra la distancia al usuario ("A 800m")
- **Ruta al negocio**: Botón para abrir la ruta en Google Maps / Waze
- **SEO local**: Las páginas de negocio incluyen meta tags de ubicación para indexación
  local por motores de búsqueda

### Enfoque Técnico

#### Almacenamiento de Coordenadas

```typescript
model Business {
  id          String   @id @default(uuid())
  name        String
  // ... otros campos
  latitude    Float    // Coordenada de latitud
  longitude   Float    // Coordenada de longitud
  address     String   // Dirección completa
  city        String   // Ciudad
  neighborhood String  // Barrio/Zona

  @@index([latitude, longitude]) // Índice espacial
  @@map("businesses")
}
```

#### Consulta de Búsqueda Geográfica

```sql
-- Búsqueda por radio usando fórmula de Haversine
-- Optimizada con índice espacial y bounding box pre-filtro

WITH bounds AS (
  SELECT
    :lat - (:radius_km / 111.045) AS min_lat,
    :lat + (:radius_km / 111.045) AS max_lat,
    :lon - (:radius_km / (111.045 * cos(radians(:lat)))) AS min_lon,
    :lon + (:radius_km / (111.045 * cos(radians(:lat)))) AS max_lon
)
SELECT
  b.*,
  (
    6371 * acos(
      cos(radians(:lat))
      * cos(radians(b.latitude))
      * cos(radians(b.longitude) - radians(:lon))
      + sin(radians(:lat))
      * sin(radians(b.latitude))
    )
  ) AS distance_km
FROM businesses b, bounds
WHERE b.latitude BETWEEN bounds.min_lat AND bounds.max_lat
  AND b.longitude BETWEEN bounds.min_lon AND bounds.max_lon
  AND b.is_active = true
  AND b.is_published = true
HAVING distance_km <= :radius_km
ORDER BY distance_km ASC
LIMIT 50;
```

#### API

```typescript
// Endpoint de búsqueda geolocalizada
GET /api/v1/marketplace/search
  ?lat={latitude}
  &lon={longitude}
  &radius={km}                // 1, 5, 10, 25
  &type={barberia|salon|spa}  // opcional
  &service={serviceId}        // opcional
  &rating={minRating}         // opcional, 1-5
  &page={number}
  &limit={number}

Response:
{
  "results": [
    {
      "id": "uuid",
      "name": "Barbería Elite",
      "type": "barberia",
      "address": "Cra 15 #82-34, Bogotá",
      "distanceKm": 0.8,
      "rating": 4.7,
      "reviewCount": 124,
      "photoUrl": "https://...",
      "isOpen": true,
      "nextAvailableSlot": "2024-05-15T14:00:00Z",
      "priceFrom": 25000,
      "services": ["Corte", "Barba", "Ceja"]
    }
  ],
  "total": 23,
  "center": { "lat": 4.7110, "lon": -74.0721 },
  "radius": 5
}
```

#### Integración con Mapas

- **Proveedores**: Google Maps JavaScript API (primario) + Mapbox (alternativa económica)
- **Frontend**: Componente de mapa con clustering para muchos resultados
- **Caché**: Coordenadas de negocios en caché Redis (TTL: 24h, raramente cambian)
- **Geocoding**: Google Geocoding API para convertir direcciones a coordenadas al
  registrar un negocio

### Alcance MVP vs Futuro

| Funcionalidad                            | MVP               | Post-MVP           |
| ---------------------------------------- | ----------------- | ------------------ |
| Búsqueda por GPS                         | Si                | Si                 |
| Búsqueda por dirección                   | Si                | Si                 |
| Filtro por radio                         | Si (predefinidos) | Si (personalizado) |
| Vista de lista con distancia             | Si                | Si                 |
| Vista de mapa interactivo                | No (solo lista)   | Si                 |
| Ruta al negocio (Maps/Waze)              | Si (link externo) | Si (in-app)        |
| SEO local                                | Si                | Si                 |
| Geofencing (notificación al pasar cerca) | No                | Si                 |
| Heatmap de demanda por zona              | No                | Si                 |
| Clustering de resultados en mapa         | No                | Si                 |
| Búsqueda por zona/barrio sin coordenadas | No                | Si                 |

---

## 3. Integración WhatsApp

### Descripción

Integración nativa con WhatsApp Business API para enviar confirmaciones de reserva,
recordatorios, notificaciones de cancelación y reagendamiento directamente al WhatsApp
del cliente. En América Latina, WhatsApp es el canal de comunicación dominante y esta
integración reduce significativamente los no-shows.

### Funcionalidades

- **Confirmación de reserva**: Mensaje automático con detalles de la cita al reservar
- **Recordatorios programados**: Recordatorios configurables (24h antes, 2h antes)
- **Confirmación rápida**: Botón en el mensaje para confirmar asistencia con un tap
- **Cancelación notificación**: Aviso automático si se cancela o reagenda una cita
- **Reagendamiento rápido**: Link directo para elegir nuevo horario desde WhatsApp
- **Bienvenida**: Mensaje de bienvenida al nuevo negocio con link al perfil
- **Opt-in/opt-out**: El cliente puede activar o desactivar notificaciones WhatsApp
- **Templates aprobados**: Mensajes con formato profesional aprobados por Meta

### Enfoque Técnico

#### Arquitectura de Integración

```
[Booking Service] --evento--> [RabbitMQ] --consumir--> [Notification Service]
                                                              |
                                                              v
                                                    [WhatsApp Business API]
                                                    (Meta Cloud API)
                                                              |
                                                              v
                                                    WhatsApp del cliente
```

#### Configuración por Negocio

```typescript
model WhatsAppConfig {
  id                String   @id @default(uuid())
  businessId        String   @unique
  phoneNumberId     String   // ID del número de WhatsApp Business
  businessAccountId String   // WhatsApp Business Account ID
  accessToken       String   // Token de acceso (encriptado)
  webhookVerifyToken String  // Token de verificación del webhook
  isActive          Boolean  @default(false)
  templatesApproved Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@map("whatsapp_configs")
}
```

#### Templates de Mensajes

```json
{
  "appointment_confirmation": {
    "name": "confirmacion_cita",
    "category": "UTILITY",
    "language": "es_CO",
    "components": [
      {
        "type": "body",
        "text": "Tu cita esta confirmada:\n\nNegocio: {{1}}\nServicio: {{2}}\nProfesional: {{3}}\nFecha: {{4}}\nHora: {{5}}\n\nResponde CONFIRMAR para confirmar tu asistencia."
      },
      {
        "type": "button",
        "buttons": [
          { "type": "QUICK_REPLY", "text": "Confirmar" },
          { "type": "QUICK_REPLY", "text": "Reagendar" },
          { "type": "QUICK_REPLY", "text": "Cancelar" }
        ]
      }
    ]
  },
  "appointment_reminder_24h": {
    "name": "recordatorio_24h",
    "category": "UTILITY",
    "language": "es_CO",
    "components": [
      {
        "type": "body",
        "text": "Recordatorio: Manana tienes cita en {{1}}.\n\nServicio: {{2}}\nHora: {{3}}\n\nResponde SI para confirmar."
      }
    ]
  },
  "appointment_reminder_2h": {
    "name": "recordatorio_2h",
    "category": "UTILITY",
    "language": "es_CO",
    "components": [
      {
        "type": "body",
        "text": "Tu cita en {{1}} es en 2 horas ({{2}}).\n\nTe esperamos!"
      }
    ]
  },
  "appointment_cancelled": {
    "name": "cita_cancelada",
    "category": "UTILITY",
    "language": "es_CO",
    "components": [
      {
        "type": "body",
        "text": "Tu cita en {{1}} para el {{2}} ha sido cancelada.\n\nMotivo: {{3}}\n\nPuedes reagendar en: {{4}}"
      }
    ]
  }
}
```

#### Webhook de Respuestas

```typescript
// Endpoint para recibir respuestas del cliente via WhatsApp
@Post('whatsapp/webhook')
async handleWhatsAppResponse(@Body() payload: WhatsAppWebhookPayload) {
  const { from, message, buttonReply } = payload;

  // Identificar al cliente por su número de WhatsApp
  const client = await this.findClientByPhone(from);

  if (!client) return;

  // Procesar la respuesta
  if (buttonReply === 'Confirmar') {
    await this.confirmClientAppointment(client.id);
    await this.sendTextMessage(from, 'Asistencia confirmada. Te esperamos!');
  } else if (buttonReply === 'Reagendar') {
    const link = `${APP_URL}/cliente/reagendar?clientId=${client.id}`;
    await this.sendTextMessage(from, `Reagendar tu cita: ${link}`);
  } else if (buttonReply === 'Cancelar') {
    await this.initiateCancellation(from, client.id);
    await this.sendTextMessage(from, 'Responde con el motivo de cancelacion (opcional):');
  }
}
```

#### Proceso de Onboarding de WhatsApp por Negocio

```
1. Owner va a Configuracion > WhatsApp
2. Sistema redirige a Meta Business login
3. Owner autoriza la conexion
4. Sistema guarda el token y phone number ID
5. Owner selecciona templates a usar
6. Sistema envia templates a Meta para aprobacion
7. Meta aprueba templates (24-48h)
8. WhatsApp se activa automaticamente
```

### Alcance MVP vs Futuro

| Funcionalidad                         | MVP            | Post-MVP            |
| ------------------------------------- | -------------- | ------------------- |
| Confirmación de reserva               | Si             | Si                  |
| Recordatorio 24h                      | Si             | Si                  |
| Recordatorio 2h                       | Si             | Si                  |
| Botones de respuesta rápida           | Si             | Si                  |
| Cancelación automática por inacción   | No             | Si                  |
| Reagendamiento desde WhatsApp         | No (solo link) | Si (flujo completo) |
| Chat directo negocio-cliente          | No             | Si                  |
| Catálogo de servicios en WhatsApp     | No             | Si                  |
| Mensajes promocionales                | No             | Si                  |
| Templates personalizados por negocio  | No (estándar)  | Si                  |
| Multi-idioma (ES/PT/EN)               | No (solo ES)   | Si                  |
| Métricas de entrega y lectura         | Si (básico)    | Si (detallado)      |
| Webhook de respuestas bidireccionales | Si (básico)    | Si (completo)       |

---

## 4. Sistema de Gamificación y Fidelización

### Descripción

Programa de fidelización que incentiva la repetición de visitas mediante un sistema de
puntos acumulables, niveles de membresía con beneficios escalados y recompensas
canjeables. El sistema está diseñado para el contexto latinoamericano donde la retención
de clientes es un desafío clave para negocios de belleza.

### Funcionalidades

#### Sistema de Puntos

- **Acumulación por visita**: 10% del valor pagado se convierte en puntos
- **Bonus por reseña**: 50 puntos por dejar una reseña verificada
- **Bonus por referido**: 100 puntos cuando un referido completa su primera cita
- **Bonus de cumpleaños**: 200 puntos en el mes de cumpleaños
- **Multiplicador por nivel**: Los niveles superiores ganan puntos más rápido

#### Niveles de Membresía

| Nivel    | Puntos requeridos | Multiplicador | Beneficios                                              |
| -------- | ----------------- | ------------- | ------------------------------------------------------- |
| Bronce   | 0 - 499           | 1.0x          | Acumulación básica, recordatorios                       |
| Plata    | 500 - 1,499       | 1.5x          | Reserva prioritaria, descuentos del 5%                  |
| Oro      | 1,500 - 4,999     | 2.0x          | Descuentos del 10%, promociones anticipadas             |
| Diamante | 5,000+            | 3.0x          | Descuentos del 15%, servicio VIP, beneficios exclusivos |

#### Canje de Puntos

- **Descuentos**: 100 puntos = $1,000 COP de descuento
- **Servicio gratuito**: Varía según el servicio (ej: corte = 2,500 puntos)
- **Productos**: Canje por productos del negocio si están configurados
- **Experiencias**: Acceso a eventos exclusivos (Diamante)

### Enfoque Técnico

#### Modelo de Datos

```typescript
model LoyaltyAccount {
  id          String   @id @default(uuid())
  clientId    String   @unique
  businessId  String
  points      Int      @default(0)
  lifetimePoints Int   @default(0)   // Total histórico (nunca decrece)
  tier        Tier     @default(BRONZE)
  referredBy  String?  // ID del cliente que lo refirió
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  client      Client   @relation(fields: [clientId], references: [id])
  business    Business @relation(fields: [businessId], references: [id])
  transactions LoyaltyTransaction[]

  @@map("loyalty_accounts")
}

model LoyaltyTransaction {
  id          String   @id @default(uuid())
  accountId   String
  type        TransactionType  // EARN, REDEEM, EXPIRE, BONUS
  points      Int              // Positivo para earn/bonus, negativo para redeem
  reason      String           // "Pago cita", "Reseña", "Canje descuento", etc.
  referenceId String?          // ID de la cita, reseña, etc.
  createdAt   DateTime @default(now())

  account     LoyaltyAccount @relation(fields: [accountId], references: [id])

  @@map("loyalty_transactions")
}

enum Tier {
  BRONZE
  SILVER
  GOLD
  DIAMOND
}

enum TransactionType {
  EARN
  REDEEM
  EXPIRE
  BONUS
}
```

#### Motor de Puntos

```typescript
class LoyaltyEngine {
  // Calcular puntos ganados por un pago
  calculateEarnedPoints(paymentAmount: number, tier: Tier): number {
    const baseRate = 0.1; // 10% del valor
    const multiplier = this.getTierMultiplier(tier);
    const points = Math.floor(paymentAmount * baseRate * multiplier);
    return points;
  }

  // Evaluar y actualizar nivel del cliente
  async evaluateTierUpgrade(accountId: string): Promise<Tier> {
    const account = await this.getAccount(accountId);
    const newTier = this.calculateTier(account.lifetimePoints);

    if (newTier !== account.tier) {
      await this.updateTier(accountId, newTier);
      await this.sendTierNotification(account.clientId, newTier);
    }

    return newTier;
  }

  // Calcular nivel basado en puntos históricos
  private calculateTier(lifetimePoints: number): Tier {
    if (lifetimePoints >= 5000) return "DIAMOND";
    if (lifetimePoints >= 1500) return "GOLD";
    if (lifetimePoints >= 500) return "SILVER";
    return "BRONZE";
  }

  // Canjear puntos por descuento
  async redeemForDiscount(
    accountId: string,
    points: number,
    appointmentId: string
  ): Promise<number> {
    const account = await this.getAccount(accountId);
    if (account.points < points) throw new Error("Puntos insuficientes");

    const discountAmount = points * 10; // 100 pts = $1,000 COP

    await this.createTransaction(
      accountId,
      "REDEEM",
      -points,
      "Canje descuento",
      appointmentId
    );
    await this.updatePoints(accountId, -points);

    return discountAmount;
  }
}
```

#### Integración con Booking y Payment

```typescript
// Al completar una cita y registrar el pago
async completeAppointment(appointmentId: string, paymentAmount: number) {
  const appointment = await this.getAppointment(appointmentId);
  const account = await this.getOrCreateAccount(appointment.clientId, appointment.businessId);

  // Calcular puntos ganados
  const earnedPoints = this.loyaltyEngine.calculateEarnedPoints(
    paymentAmount,
    account.tier
  );

  // Registrar transacción
  await this.createTransaction(
    account.id,
    'EARN',
    earnedPoints,
    `Pago cita: ${appointmentId}`,
    appointmentId
  );

  // Evaluar upgrade de nivel
  await this.loyaltyEngine.evaluateTierUpgrade(account.id);

  // Notificar al cliente
  await this.notifyPointsEarned(appointment.clientId, earnedPoints, account.points + earnedPoints);
}
```

### Alcance MVP vs Futuro

| Funcionalidad                     | MVP         | Post-MVP          |
| --------------------------------- | ----------- | ----------------- |
| Acumulación por visita (10%)      | Si          | Si                |
| Niveles Bronce/Plata/Oro/Diamante | Si          | Si                |
| Bonus por reseña                  | Si          | Si                |
| Bonus por referido                | No          | Si                |
| Bonus de cumpleaños               | No          | Si                |
| Canje por descuento en cita       | Si          | Si                |
| Canje por servicio gratuito       | No          | Si                |
| Canje por productos               | No          | Si                |
| Leaderboard de clientes           | No          | Si                |
| Misiones y desafíos               | No          | Si                |
| Streak de visitas                 | No          | Si                |
| Notificación de nivel alcanzado   | Si          | Si                |
| Historial de puntos               | Si          | Si                |
| Dashboard de fidelización (owner) | Si (básico) | Si (completo)     |
| Expiración de puntos              | No          | Si (configurable) |

---

## 5. Analíticas Avanzadas y Predicciones

### Descripción

Dashboard de analíticas que va más allá de reportes básicos, incorporando predicciones
de demanda, pronósticos de ingresos, detección de patrones de no-show y recomendaciones
accionables para optimizar la operación del negocio.

### Funcionalidades

#### Métricas Operativas

- Citas por período (día, semana, mes, trimestre) con comparativa vs período anterior
- Ingresos por período con desglose por método de pago
- Tasa de ocupación por profesional y por día de la semana
- Tasa de no-show y cancelación con tendencia
- Servicios más y menos populares
- Clientes nuevos vs recurrentes con ratio de retención
- Ticket promedio por servicio y por profesional
- Tiempo promedio de servicio vs duración configurada

#### Analíticas Predictivas

- **Predicción de demanda**: Estimar el volumen de citas por día y hora para las próximas
  2-4 semanas, permitiendo al negocio planificar personal y horarios
- **Pronóstico de ingresos**: Proyección de ingresos mensuales basada en tendencias
  históricas y estacionalidad
- **Predicción de no-show**: Identificar citas con alta probabilidad de no-show para
  activar recordatorios adicionales o permitir overbooking controlado
- **Predicción de abandono**: Detectar clientes en riesgo de no volver (tiempo sin
  visitar, disminución de frecuencia)

#### Benchmarking

- Comparación anónima con el promedio del sector (todos los negocios BeautySpot)
- Ranking de desempeño: "Tu tasa de ocupación está por encima del 72% de barberías similares"
- Sugerencias de mejora basadas en brechas vs el promedio

### Enfoque Técnico

#### Arquitectura del Analytics Service

```
[Eventos de dominio] --> [RabbitMQ] --> [Analytics Consumer]
     (cita creada,           |              |
      pago registrado,       v              v
      reseña recibida)  [Event Store]  [Aggregation Engine]
                                        |
                                        v
                                  [PostgreSQL Analytics DB]
                                        |
                                        v
                                  [Prediction Engine] --> [Redis Cache]
                                        |
                                        v
                                  [Analytics API]
```

#### Modelo de Datos Analíticos

```typescript
// Tabla de eventos (Event Sourcing parcial)
model AnalyticsEvent {
  id          String   @id @default(uuid())
  businessId  String
  eventType   String   // APPOINTMENT_CREATED, PAYMENT_REGISTERED, etc.
  payload     Json
  timestamp   DateTime @default(now())

  @@index([businessId, eventType, timestamp])
  @@map("analytics_events")
}

// Tablas agregadas para consultas rápidas
model DailyMetrics {
  id              String   @id @default(uuid())
  businessId      String
  date            DateTime
  totalAppointments Int
  completedAppointments Int
  cancelledAppointments Int
  noShowAppointments Int
  totalRevenue    Float
  newClients      Int
  recurringClients Int
  avgTicketPrice  Float
  occupancyRate   Float

  @@unique([businessId, date])
  @@map("daily_metrics")
}

model DemandPrediction {
  id              String   @id @default(uuid())
  businessId      String
  predictedDate   DateTime
  predictedHour   Int      // 0-23
  predictedDemand Float    // Citas esperadas
  confidence      Float    // 0.0 - 1.0
  modelVersion    String
  createdAt       DateTime @default(now())

  @@index([businessId, predictedDate])
  @@map("demand_predictions")
}
```

#### Motor de Predicción

```typescript
class PredictionEngine {
  // Predicción de demanda basada en patrones históricos
  async predictDemand(
    businessId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<DemandPrediction[]> {
    const historicalData = await this.getHistoricalPatterns(businessId);

    // En MVP: modelo heurístico basado en promedios históricos
    // Factores:
    // - Promedio de citas por día de la semana (últimas 12 semanas)
    // - Ajuste estacional (festivos, temporada alta/baja)
    // - Tendencia (crecimiento/decrecimiento reciente)

    const predictions: DemandPrediction[] = [];

    for (const date of eachDay(dateFrom, dateTo)) {
      const dayOfWeek = date.getDay();
      const hourlyPattern = historicalData.dayOfWeekPatterns[dayOfWeek];

      for (let hour = 8; hour <= 20; hour++) {
        const avgDemand = hourlyPattern[hour] || 0;
        const seasonalFactor = this.getSeasonalFactor(date);
        const trendFactor = historicalData.trend;

        const predictedDemand = avgDemand * seasonalFactor * trendFactor;
        const confidence = this.calculateConfidence(
          historicalData,
          dayOfWeek,
          hour
        );

        predictions.push({
          businessId,
          predictedDate: date,
          predictedHour: hour,
          predictedDemand,
          confidence,
        });
      }
    }

    return predictions;
  }

  // Predicción de no-show por cita
  async predictNoShow(appointmentId: string): Promise<number> {
    const appointment = await this.getAppointment(appointmentId);
    const clientFeatures = await this.getClientFeatures(appointment.clientId);

    // Factores predictivos:
    // - Tasa de no-show histórica del cliente (peso: 0.35)
    // - Horario de la cita (temprano = más no-show) (peso: 0.15)
    // - Días entre reserva y cita (más días = más no-show) (peso: 0.20)
    // - Día de la semana (lunes = más no-show) (peso: 0.10)
    // - Clima (si está disponible) (peso: 0.10)
    // - Historial reciente (últimas 4 semanas) (peso: 0.10)

    let score = 0;
    score += clientFeatures.noShowRate * 0.35;
    score += this.morningPenalty(appointment.startTime) * 0.15;
    score += this.advanceBookingPenalty(appointment) * 0.2;
    score += this.dayOfWeekPenalty(appointment.startTime) * 0.1;
    score += clientFeatures.recentNoShowRate * 0.1;
    // Clima: se omite en MVP

    return Math.min(score, 1.0); // Clamp 0-1
  }
}
```

### Alcance MVP vs Futuro

| Funcionalidad                       | MVP             | Post-MVP             |
| ----------------------------------- | --------------- | -------------------- |
| Métricas operativas básicas         | Si              | Si                   |
| Gráficos de tendencias              | Si              | Si                   |
| Comparativa entre períodos          | Si              | Si                   |
| Predicción de demanda               | Si (heurística) | Si (ML)              |
| Pronóstico de ingresos              | Si (lineal)     | Si (ARIMA/Prophet)   |
| Predicción de no-show               | Si (scoring)    | Si (clasificador ML) |
| Predicción de abandono              | No              | Si                   |
| Benchmarking anónimo                | Si (básico)     | Si (avanzado)        |
| Reportes PDF exportables            | Si              | Si                   |
| Reportes programados por email      | No              | Si                   |
| Sugerencias accionables             | No              | Si                   |
| Modelo ML (scikit-learn/tensorflow) | No              | Si                   |
| Dashboard en tiempo real            | No              | Si (websockets)      |

---

## 6. Recordatorios Inteligentes Multi-Canal

### Descripción

Sistema de recordatorios que no solo envía notificaciones en horarios fijos, sino que
adapta el canal, timing y contenido según el perfil de comportamiento de cada cliente.
El objetivo es maximizar la tasa de confirmación y minimizar los no-shows.

### Funcionalidades

- **Timing personalizado**: Enviar recordatorios en el momento óptimo para cada cliente
  basado en cuándo suele interactuar con sus notificaciones
- **Multi-canal con escalamiento**: Si el cliente no responde por email, intentar por
  push notification, luego por WhatsApp, finalmente por SMS
- **Contenido adaptativo**: Ajustar el tono y urgencia del recordatorio según la
  cercanía de la cita y el perfil del cliente
- **Confirmación en un clic**: Botones de confirmación directa en cada recordatorio
- **Reagendamiento rápido**: Link o botón para reagendar directamente desde el
  recordatorio
- **A/B testing de mensajes**: Probar diferentes versiones de recordatorios para
  optimizar tasas de conversión

### Enfoque Técnico

#### Arquitectura

```
[Cita Creada] --> [Reminder Scheduler]
                        |
                        v
                 [Reminder Queue] (RabbitMQ - delayed messages)
                        |
                   +----+----+----+
                   |         |    |
                   v         v    v
              [Email]   [Push]  [WhatsApp]  [SMS]
                   |         |    |          |
                   +----+----+----+----------+
                        |
                        v
                 [Response Tracker]
                        |
                        v
                 [Escalation Engine] --> Si no responde, escalar al siguiente canal
```

#### Modelo de Recordatorios

```typescript
model Reminder {
  id             String   @id @default(uuid())
  appointmentId  String
  clientId       String
  businessId     String
  channel        ReminderChannel  // EMAIL, PUSH, WHATSAPP, SMS
  status         ReminderStatus   // PENDING, SENT, DELIVERED, CONFIRMED, FAILED
  scheduledAt    DateTime
  sentAt         DateTime?
  deliveredAt    DateTime?
  confirmedAt    DateTime?
  failureReason  String?
  payload        Json
  retryCount     Int      @default(0)
  createdAt      DateTime @default(now())

  @@index([appointmentId, channel])
  @@map("reminders")
}

enum ReminderChannel {
  EMAIL
  PUSH
  WHATSAPP
  SMS
}

enum ReminderStatus {
  PENDING
  SENT
  DELIVERED
  CONFIRMED
  FAILED
}
```

#### Motor de Timing Inteligente

```typescript
class SmartReminderEngine {
  // Calcular el momento óptimo para enviar un recordatorio
  calculateOptimalSendTime(
    appointmentTime: Date,
    reminderOffsetHours: number, // 24 o 2
    clientEngagementProfile: ClientEngagementProfile
  ): Date {
    const targetTime = new Date(
      appointmentTime.getTime() - reminderOffsetHours * 60 * 60 * 1000
    );

    // Ajustar basado en el perfil de engagement del cliente
    const { bestHour, bestDayPart } = clientEngagementProfile;

    // Si el cliente suele interactuar a las 10am, enviar cerca de las 10am
    // pero nunca más tarde de lo necesario
    const adjustedTime = this.adjustToBestHour(targetTime, bestHour);

    // No enviar fuera de horario razonable (8am - 9pm)
    return this.clampToReasonableHours(adjustedTime);
  }

  // Determinar el canal óptimo para el primer intento
  determinePrimaryChannel(clientId: string): ReminderChannel {
    const profile = this.getEngagementProfile(clientId);

    // Orden de preferencia basado en tasa de respuesta del cliente
    const channelPerformance = [
      { channel: "WHATSAPP", responseRate: profile.whatsappResponseRate },
      { channel: "PUSH", responseRate: profile.pushResponseRate },
      { channel: "EMAIL", responseRate: profile.emailResponseRate },
    ];

    channelPerformance.sort((a, b) => b.responseRate - a.responseRate);
    return channelPerformance[0].channel;
  }
}

interface ClientEngagementProfile {
  clientId: string;
  bestHour: number; // Hora con mayor tasa de apertura
  bestDayPart: "morning" | "afternoon" | "evening";
  whatsappResponseRate: number; // 0.0 - 1.0
  pushResponseRate: number; // 0.0 - 1.0
  emailResponseRate: number; // 0.0 - 1.0
  preferredChannel: ReminderChannel;
  avgResponseTimeMinutes: number;
}
```

#### Escalamiento de Canales

```typescript
// Flujo de escalamiento para un recordatorio de 24h
const ESCALATION_FLOW = [
  { channel: "WHATSAPP", delay: "0h", waitForResponse: "4h" },
  { channel: "PUSH", delay: "4h", waitForResponse: "4h" },
  { channel: "EMAIL", delay: "8h", waitForResponse: "4h" },
  { channel: "SMS", delay: "12h", waitForResponse: "until appointment" },
];

// Flujo de escalamiento para un recordatorio de 2h (más urgente)
const URGENT_ESCALATION_FLOW = [
  { channel: "WHATSAPP", delay: "0m", waitForResponse: "30m" },
  { channel: "SMS", delay: "30m", waitForResponse: "until appointment" },
];
```

### Alcance MVP vs Futuro

| Funcionalidad                     | MVP           | Post-MVP               |
| --------------------------------- | ------------- | ---------------------- |
| Recordatorio 24h por email        | Si            | Si                     |
| Recordatorio 2h por email         | Si            | Si                     |
| Recordatorio por push             | Si            | Si                     |
| Recordatorio por WhatsApp         | Si            | Si                     |
| Timing fijo (24h, 2h)             | Si            | Si                     |
| Timing personalizado              | No            | Si                     |
| Escalamiento automático de canal  | No            | Si                     |
| Confirmación en un clic           | Si (WhatsApp) | Si (todos los canales) |
| Reagendamiento desde recordatorio | Si (link)     | Si (flujo in-app)      |
| Perfil de engagement por cliente  | No            | Si                     |
| A/B testing de mensajes           | No            | Si                     |
| Métricas de efectividad           | Si (básico)   | Si (detallado)         |
| Recordatorio SMS                  | No            | Si                     |

---

## 7. Marketplace con SEO

### Descripción

Perfiles públicos de negocio optimizados para motores de búsqueda, permitiendo que los
negocios sean descubiertos orgánicamente por clientes potenciales que buscan servicios
de belleza en Google y otros buscadores. Esto crea un canal de adquisición gratuito y
sostenible para los negocios.

### Funcionalidades

- **Perfil público completo**: Página dedicada con toda la información del negocio
- **Meta tags dinámicos**: Open Graph, Twitter Cards, description personalizada
- **URLs semánticas**: `/barberia/barberia-elite-bogota` en vez de `/business/uuid`
- **Datos estructurados**: Schema.org LocalBusiness para rich snippets en Google
- **Sitemap XML**: Generación automática por negocio, actualizado al publicar cambios
- **Server-Side Rendering**: Perfiles renderizados en el servidor para indexación
- **Imágenes optimizadas**: Compresión automática, lazy loading, formatos modernos
- **Velocidad de carga**: Target <2s LCP para perfiles públicos

### Enfoque Técnico

#### Datos Estructurados (Schema.org)

```json
{
  "@context": "https://schema.org",
  "@type": "HairSalon",
  "name": "Barbería Elite",
  "description": "La mejor barbería de Bogotá. Cortes clásicos y modernos, barba, tratamientos capilares.",
  "url": "https://barberia-elite.beautyspot.co",
  "telephone": "+573001234567",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Carrera 15 #82-34",
    "addressLocality": "Bogotá",
    "addressRegion": "Cundinamarca",
    "postalCode": "110221",
    "addressCountry": "CO"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 4.711,
    "longitude": -74.0721
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "09:00",
      "closes": "20:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Saturday",
      "opens": "09:00",
      "closes": "17:00"
    }
  ],
  "priceRange": "$$",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.7",
    "reviewCount": "124"
  },
  "image": "https://cdn.beautyspot.co/businesses/elite/photo.jpg",
  "sameAs": [
    "https://instagram.com/barberiaelite",
    "https://facebook.com/barberiaelite"
  ]
}
```

#### Meta Tags Dinámicos

```html
<title>Barbería Elite | Cortes y Barba en Bogotá | BeautySpot</title>
<meta
  name="description"
  content="Barbería Elite en Bogotá. Cortes desde $25.000. Calificación 4.7 con 124 reseñas. Reserva tu cita online."
/>

<!-- Open Graph -->
<meta property="og:title" content="Barbería Elite | Bogotá" />
<meta
  property="og:description"
  content="Cortes desde $25.000. Calificación 4.7. Reserva online."
/>
<meta
  property="og:image"
  content="https://cdn.beautyspot.co/businesses/elite/og-image.jpg"
/>
<meta property="og:url" content="https://barberia-elite.beautyspot.co" />
<meta property="og:type" content="business.business" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Barbería Elite | Bogotá" />
<meta
  name="twitter:description"
  content="Cortes desde $25.000. Reserva online."
/>
```

#### Generación de Sitemap

```typescript
// Generar sitemap XML dinámicamente
@Get('sitemap.xml')
@Header('Content-Type', 'application/xml')
async generateSitemap(): Promise<string> {
  const businesses = await this.businessRepo.findMany({
    where: { isPublished: true, isActive: true },
    select: { slug: true, updatedAt: true },
  });

  const urls = businesses.map((b) => `
    <url>
      <loc>https://${b.slug}.beautyspot.co</loc>
      <lastmod>${b.updatedAt.toISOString().split('T')[0]}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.8</priority>
    </url>
  `);

  return `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc>https://beautyspot.co</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
      </url>
      ${urls.join('')}
    </urlset>`;
}
```

### Alcance MVP vs Futuro

| Funcionalidad                | MVP         | Post-MVP      |
| ---------------------------- | ----------- | ------------- |
| Perfil público con SSR       | Si          | Si            |
| Meta tags dinámicos          | Si          | Si            |
| URLs semánticas con slug     | Si          | Si            |
| Schema.org LocalBusiness     | Si          | Si            |
| Sitemap XML automático       | Si          | Si            |
| Open Graph / Twitter Cards   | Si          | Si            |
| Optimización de imágenes     | Si (básico) | Si (avanzado) |
| Google Business Profile sync | No          | Si            |
| Blog/contenido por negocio   | No          | Si            |
| Landing pages por servicio   | No          | Si            |
| AMP pages                    | No          | Si            |
| Canonical URLs               | Si          | Si            |
| Robots.txt dinámico          | Si          | Si            |
| Google Analytics por negocio | No          | Si            |

---

## 8. Disponibilidad en Tiempo Real

### Descripción

El calendario de disponibilidad se actualiza en tiempo real, reflejando cambios
instantáneamente cuando un slot es reservado, liberado o bloqueado. Esto previene
conflictos de doble reserva y proporciona una experiencia fluida al cliente.

### Funcionalidades

- **Actualización instantánea**: Al reservar un slot, todos los usuarios que están viendo
  la misma agenda ven el cambio inmediatamente
- **Prevención de doble reserva**: Si dos clientes intentan reservar el mismo slot
  simultáneamente, solo el primero tiene éxito
- **Indicador de demanda**: Mostrar cuántas personas están viendo un slot ("3 personas
  más están viendo este horario")
- **Bloqueo temporal**: Al iniciar una reserva, el slot se bloquea temporalmente (5 min)
  para el cliente mientras completa el proceso
- **Sincronización multi-dispositivo**: Si un profesional bloquea un horario desde su
  móvil, el dashboard del admin se actualiza inmediatamente

### Enfoque Técnico

#### Arquitectura de Tiempo Real

```
[Cliente A reservando] --WebSocket--> [API Gateway] --publicar--> [Redis Pub/Sub]
                                                                |
[Cliente B viendo agenda] <--WebSocket-- [API Gateway] <---suscribir---+
                                                                |
[Dashboard Admin] <--WebSocket-- [API Gateway] <---suscribir--------+
                                                                |
[App Profesional] <--WebSocket-- [API Gateway] <---suscribir--------+
```

#### Implementación con WebSockets

```typescript
@WebSocketGateway({ namespace: "/availability", cors: true })
class AvailabilityGateway {
  @WebSocketServer()
  server: Server;

  // Suscribirse a la agenda de un negocio
  @SubscribeMessage("subscribe")
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { businessId: string; date: string }
  ) {
    const room = `availability:${data.businessId}:${data.date}`;
    await client.join(room);

    // Enviar estado actual de disponibilidad
    const slots = await this.availabilityService.getAvailableSlots(
      data.businessId,
      new Date(data.date)
    );
    client.emit("availability:update", slots);
  }

  // Notificar cambio de disponibilidad (llamado internamente)
  async notifyAvailabilityChange(
    businessId: string,
    date: string,
    change: AvailabilityChange
  ) {
    const room = `availability:${businessId}:${date}`;
    this.server.to(room).emit("availability:changed", change);
  }
}
```

#### Bloqueo Temporal Optimista

```typescript
class AvailabilityService {
  // Reservar un slot con bloqueo temporal
  async reserveSlot(
    businessId: string,
    professionalId: string,
    startTime: Date,
    clientId: string
  ): Promise<SlotReservation> {
    const lockKey = `slot:${businessId}:${professionalId}:${startTime.toISOString()}`;

    // Intentar adquirir lock en Redis (SETNX con TTL de 5 minutos)
    const lockAcquired = await this.redis.set(
      lockKey,
      clientId,
      "NX",
      "EX",
      300 // 5 minutos
    );

    if (!lockAcquired) {
      throw new ConflictException(
        "Este horario acaba de ser reservado por otra persona"
      );
    }

    return {
      lockKey,
      clientId,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      status: "LOCKED",
    };
  }

  // Confirmar la reserva (al completar el checkout)
  async confirmReservation(
    lockKey: string,
    appointmentId: string
  ): Promise<void> {
    // Verificar que el lock sigue activo
    const lockValue = await this.redis.get(lockKey);
    if (!lockValue) {
      throw new ConflictException(
        "Tu reserva temporal ha expirado. Intenta de nuevo."
      );
    }

    // Crear la cita en la base de datos
    // El lock se elimina automáticamente al expirar el TTL
    // o se elimina manualmente tras crear la cita
    await this.redis.del(lockKey);
  }

  // Liberar un slot (al cancelar o expirar)
  async releaseSlot(
    businessId: string,
    professionalId: string,
    startTime: Date
  ): Promise<void> {
    const lockKey = `slot:${businessId}:${professionalId}:${startTime.toISOString()}`;
    await this.redis.del(lockKey);

    // Notificar a todos los suscriptores
    await this.availabilityGateway.notifyAvailabilityChange(
      businessId,
      startTime.toISOString().split("T")[0],
      {
        type: "SLOT_RELEASED",
        professionalId,
        startTime,
      }
    );
  }
}
```

### Alcance MVP vs Futuro

| Funcionalidad                                    | MVP          | Post-MVP       |
| ------------------------------------------------ | ------------ | -------------- |
| Bloqueo temporal de slot (Redis SETNX)           | Si           | Si             |
| Prevención de doble reserva                      | Si           | Si             |
| Actualización via polling (cada 30s)             | Si           | No             |
| Actualización via WebSocket en tiempo real       | No           | Si             |
| Indicador de demanda ("X personas viendo")       | No           | Si             |
| Sincronización multi-dispositivo                 | Si (polling) | Si (WebSocket) |
| Notificación push de nuevo slot disponible       | No           | Si             |
| Reconnect automático                             | Si (polling) | Si (WebSocket) |
| Queue de espera para slots populares             | No           | Si             |
| Overbooking controlado con predicción de no-show | No           | Si             |

---

## Resumen de Priorización por Fase

| Diferenciador                 | Fase MVP | Complejidad | Impacto                     |
| ----------------------------- | -------- | ----------- | --------------------------- |
| Geolocalización               | Fase 4   | Media       | Alto (descubrimiento)       |
| WhatsApp                      | Fase 4   | Media       | Alto (engagement LATAM)     |
| Fidelización                  | Fase 4   | Media       | Alto (retención)            |
| Analíticas + Predicciones     | Fase 4   | Alta        | Alto (valor para negocio)   |
| Recordatorios Inteligentes    | Fase 4   | Media       | Medio (reducción no-show)   |
| Marketplace SEO               | Fase 3   | Media       | Alto (adquisición orgánica) |
| Disponibilidad en Tiempo Real | Fase 2   | Alta        | Medio (experiencia)         |
| Sugerencias IA                | Fase 4   | Alta        | Medio (diferenciación)      |

### Enfoque MVP: Máximo impacto, complejidad razonable

Para el MVP, se priorizan las funcionalidades que generan el mayor valor percibido por
los usuarios con la menor complejidad técnica:

1. **WhatsApp + Geolocalización**: Los dos diferenciadores más visibles para el mercado
2. **Marketplace SEO**: Canal de adquisición orgánico sin costo recurrente
3. **Fidelización básica**: Retención de clientes con implementación simple
4. **Recordatorios con timing fijo**: Reducción de no-shows sin necesidad de ML
5. **Analíticas básicas**: Dashboard con métricas sin predicciones

Las funcionalidades de IA (predicciones, sugerencias de horarios, timing inteligente)
se implementan con heurísticas en el MVP y se migran a modelos ML reales post-lanzamiento,
cuando existan datos suficientes para entrenamiento.
