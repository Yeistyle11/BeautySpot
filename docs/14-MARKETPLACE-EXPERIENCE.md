# 14 - Marketplace Experience: Perfiles Inmersivos y Descubrimiento

## Resumen

Este documento redefine el marketplace de BeautySpot como una experiencia envolvente donde cada negocio
construye su identidad digital, atrae clientes mediante contenido configurable (banner, historia,
servicios, equipo), y los usuarios descubren, exploran y se conectan con establecimientos a través
de una navegación rica en contenido visual y social (reseñas, calificaciones, portfolio).

---

## 1. Vision del Marketplace

### Problema Actual

El marketplace existe como un servicio backend basico (`marketplace-service`) con:

- Busqueda por texto, ciudad, tipo y geolocalizacion
- Un perfil de negocio plano (`BusinessProfileEntity`) con datos basicos
- Reseñas simples con rating y comentario
- **Sin experiencia visual**, sin personalizacion del negocio, sin contenido editorial

### Propuesta

Transformar el marketplace en **un escaparate digital** donde:

1. **El negocio es protagonista**: Configura que ve el mundo sobre el (banner, historia, galeria, equipo)
2. **El usuario se enamora antes de reservar**: Descubre la personalidad del lugar, ve el trabajo del equipo
3. **La confianza se construye con contenido**: Reseñas verificadas, portfolio real, calificaciones transparentes
4. **El descubrimiento es una experiencia**: No una lista plana sino un feed curado con secciones tematicas

---

## 2. Arquitectura de la Experiencia

### 2.1 Mapa de Navegacion del Marketplace

```
LANDING MARKETPLACE
├── Hero con busqueda + categorias visuales
├── Feed curado
│   ├── "Populares cerca de ti" (carousel)
│   ├── "Recien llegados" (carousel)
│   ├── "Con cupo hoy" (carousel)
│   ├── "Mejor calificados" (grid)
│   ├── "Explora por categoria" (tarjetas grandes)
│   └── "Tambien te puede interesar" (recomendaciones)
├── Busqueda avanzada (filtros, mapa, lista)
│   └── Resultados en cards con preview
└── PERFIL PUBLICO DEL NEGOCIO (inmersivo)
    ├── Hero Banner (cover + logo + datos clave)
    ├── Secciones configurables (tabs o scroll)
    │   ├── Inicio / Resumen
    │   ├── Nuestra Historia (editorial)
    │   ├── Servicios (catalogo visual)
    │   ├── Equipo (cards de profesionales)
    │   ├── Galeria / Portfolio
    │   ├── Reseñas y Calificaciones
    │   └── Ubicacion y Contacto
    └── FAB: "Reservar ahora" (siempre visible)
```

### 2.2 Flujo del Usuario en el Marketplace

```
Descubrir → Explorar → Conocer → Confiar → Reservar
   │           │          │         │         │
 Landing    Perfil     Historia  Reseñas   Booking
 feed       card       equipo    ratings   flow
 categorias galeria    servicios portfolio
```

Cada paso profundiza la relacion usuario-negocio. El objetivo es que el usuario **sienta que ya conoce
el lugar** antes de reservar.

---

## 3. Perfil Publico Inmersivo del Negocio

### 3.1 Hero Banner (Above the Fold)

La primera impresion. Ocupa 100vh en movil y 70vh en desktop.

```
┌──────────────────────────────────────────────────┐
│                                                  │
│          [Cover Image / Banner Video]            │
│                                                  │
│    ┌─────────────────────────────────┐           │
│    │ [Logo]  BARBERIA ELITE          │           │
│    │         Barberia · Bogota       │           │
│    │         ★ 4.7 (124 reseñas)     │           │
│    │         Abierto ahora · 800m    │           │
│    └─────────────────────────────────┘           │
│                                                  │
│         [ RESERVAR AHORA ]  [ COMPARTIR ]        │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Elementos configurables por el negocio:**

- Cover image (obligatoria, min 1200x600px) o video corto (max 15s)
- Logo (superpuesto, circular)
- Tagline: frase corta configurable (max 80 chars)
- Badge de verificado (si aplica)

**Informacion automatica (del core-service):**

- Tipo de negocio + ciudad
- Rating promedio + total de reseñas
- Estado actual: "Abierto ahora" / "Cierra a las 8:00 PM"
- Distancia al usuario (si hay geolocalizacion)

### 3.2 Navegacion por Secciones (Configurables)

El negocio elige que secciones mostrar y en que orden. Cada seccion se activa/desactiva
y se reordena desde el panel de administracion.

#### Seccion: "Nuestra Historia" (Story)

Contenido editorial que el negocio redacta. Es el corazon emocional del perfil.

```
┌──────────────────────────────────────────────────┐
│  NUESTRA HISTORIA                                │
│                                                  │
│  [Foto del fundador / equipo fundador]           │
│                                                  │
│  "Barberia Elite nacio en 2018 de la mano de    │
│   Carlos y Maria, dos apasionados del arte       │
│   de la barberia clasica. Lo que empezo como     │
│   un pequeno espacio en Chapinero hoy es un      │
│   referente de estilo en Bogota..."              │
│                                                  │
│  Fundado: 2018                                   │
│  Fundadores: Carlos Perez, Maria Gomez           │
│  Especialidad: Cortes clasicos y modernos        │
│  [Leer mas]                                      │
└──────────────────────────────────────────────────┘
```

**Campos configurables:**

- Titulo de la seccion (default: "Nuestra Historia")
- Texto completo (rich text, max 2000 caracteres)
- Foto principal (imagen del local, equipo, fundador)
- Anio de fundacion
- Nombre(s) de fundador(es)
- Especialidades destacadas (tags)
- Links a redes sociales (Instagram, Facebook, TikTok)

#### Seccion: "Nuestros Servicios" (Catalogo Visual)

No es una lista plana sino un catalogo con imagenes, categorias y precios.

```
┌──────────────────────────────────────────────────┐
│  NUESTROS SERVICIOS          [Ver todo]          │
│                                                  │
│  ┌─ CORTES ─────────────────────────────────┐    │
│  │                                          │    │
│  │  [img] Corte Clasico     [img] Degradado │    │
│  │   $25.000 · 30 min        $30.000 · 45m  │    │
│  │                                          │    │
│  │  [img] Corte + Barba     [img] Infantil  │    │
│  │   $40.000 · 1 hora        $20.000 · 30m  │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌─ BARBA ──────────────────────────────────┐    │
│  │  [img] Afeitado          [img] Diseño    │    │
│  │   $20.000 · 30 min        $15.000 · 20m  │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌─ TRATAMIENTOS ───────────────────────────┐    │
│  │  [img] Facial             [img] Capilar  │    │
│  │   $50.000 · 45 min        $45.000 · 30m  │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

**Campos por servicio (del core-service + extensiones):**

- Nombre, precio (COP), duracion
- Imagen del servicio (nuevo campo configurable)
- Descripcion corta (max 150 chars)
- Categoria (para agrupacion visual)
- Badge: "Popular", "Nuevo", "Mas reservado"
- Disponibilidad: "Disponible hoy" / "Proximo cupo: manana 10:00 AM"

#### Seccion: "Nuestro Equipo" (Team Showcase)

Cada profesional como una tarjeta con personalidad.

```
┌──────────────────────────────────────────────────┐
│  CONOCE A NUESTRO EQUIPO                         │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │  [Foto]  │ │  [Foto]  │ │  [Foto]  │         │
│  │  Carlos  │ │  Maria   │ │  Andres  │         │
│  │  Perez   │ │  Gomez   │ │  Ruiz    │         │
│  │          │ │          │ │          │         │
│  │ ★ 4.9   │ │ ★ 4.8   │ │ ★ 4.7   │         │
│  │ 47 reseñas│ 32 reseñas│ 28 reseñas│         │
│  │          │ │          │ │          │         │
│  │ Cortes   │ │ Barba    │ │ Tratam.  │         │
│  │ Degradado│ │ Diseño   │ │ Facial   │         │
│  │          │ │          │ │          │         │
│  │ "5 anos │ │ "La reina│ │ "Especial│         │
│  │  de exp."│ │  barba"  │ │  facial" │         │
│  │          │ │          │ │          │         │
│  │[VER PERFIL]│[VER PERFIL]│[VER PERFIL]│       │
│  └──────────┘ └──────────┘ └──────────┘         │
└──────────────────────────────────────────────────┘
```

**Campos del profesional (existentes + nuevos):**

- Nombre, foto, bio corta (tagline personal, max 60 chars)
- Especialidades (tags visuales)
- Calificacion promedio + total de reseñas
- Anios de experiencia
- Portfolio: galeria de trabajos realizados (max 12 imagenes)
- Redes sociales personales (Instagram)
- Horario proximo disponible: "Proximo cupo: hoy 3:00 PM"
- CTA: "Reservar con Carlos" (link directo al booking)

#### Seccion: "Galeria" (Visual Portfolio)

Galeria visual del negocio con distintas categorias.

```
┌──────────────────────────────────────────────────┐
│  GALERIA                        [Ver todo]       │
│                                                  │
│  [Todo] [Local] [Trabajos] [Ambiente]            │
│                                                  │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐               │
│  │     │ │     │ │     │ │     │                │
│  │ img │ │ img │ │ img │ │ img │                │
│  │     │ │     │ │     │ │     │                │
│  └─────┘ └─────┘ └─────┘ └─────┘               │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐               │
│  │     │ │     │ │     │ │     │                │
│  │ img │ │ img │ │ img │ │ img │                │
│  │     │ │     │ │     │ │     │                │
│  └─────┘ └─────┘ └─────┘ └─────┘               │
│                                                  │
│  [Lightbox al hacer click]                       │
└──────────────────────────────────────────────────┘
```

**Categorias configurables por el negocio:**

- Local (fotos del espacio)
- Trabajos realizados (antes/despues, resultados)
- Ambiente (decoracion, detalles)
- Eventos (cursos, meetups, colaboraciones)
- El negocio puede crear categorias personalizadas

**Campos por imagen:**

- URL de imagen (optimizada, max 5MB original)
- Titulo (opcional)
- Categoria (tag)
- Fecha de subida
- Destacada (aparece primero)

#### Seccion: "Resenas y Calificaciones" (Social Proof)

Sistema de reseñas enriquecido con respuestas del negocio y metricas desglosadas.

```
┌──────────────────────────────────────────────────┐
│  RESENAS Y CALIFICACIONES                        │
│                                                  │
│  ┌───────────────────────────────────────────┐   │
│  │           ★ 4.7                            │   │
│  │     Promedio de 124 reseñas               │   │
│  │                                            │   │
│  │  5★ ████████████████████░░  78%            │   │
│  │  4★ ██████████░░░░░░░░░░░  15%            │   │
│  │  3★ ████░░░░░░░░░░░░░░░░░   4%            │   │
│  │  2★ ██░░░░░░░░░░░░░░░░░░░   2%            │   │
│  │  1★ █░░░░░░░░░░░░░░░░░░░░   1%            │   │
│  │                                            │   │
│  │  [Filtros: Todos | 5★ | 4★ | Con foto]    │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  ┌───────────────────────────────────────────┐   │
│  │  [Avatar] Juan D.  ★★★★★  Hace 2 dias    │   │
│  │                                            │   │
│  │  "Increible experiencia. Carlos es un     │   │
│  │   artista con las tijeras. El local es    │   │
│  │   impecable y la atencion de primera."    │   │
│  │                                            │   │
│  │  Servicio: Corte + Barba                  │   │
│  │  Profesional: Carlos Perez                │   │
│  │  [Foto 1] [Foto 2]                        │   │
│  │                                            │   │
│  │  ┌─ Respuesta del negocio ─────────────┐  │   │
│  │  │ "Gracias Juan! Siempre es un gusto  │  │   │
│  │  │  atenderte. Te esperamos pronto."   │  │   │
│  │  │  Hace 1 dia                         │  │   │
│  │  └─────────────────────────────────────┘  │   │
│  │                                            │   │
│  │  [Util] [Reportar]                        │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  [Cargar mas reseñas]                            │
└──────────────────────────────────────────────────┘
```

**Campos de resena enriquecida:**

- Rating (1-5 estrellas, obligatorio)
- Comentario (texto, max 1000 caracteres)
- Fotos adjuntas (max 3)
- Servicio recibido (auto-vinculado a la cita)
- Profesional que atendio (auto-vinculado)
- Fecha de la cita
- Respuesta del negocio (texto, max 500 caracteres)
- Util para otros (upvote de otros usuarios)
- Verificada (badge: "Resena verificada" = proviene de cita completada)

#### Seccion: "Ubicacion y Contacto"

```
┌──────────────────────────────────────────────────┐
│  UBICACION Y CONTACTO                            │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │                                          │    │
│  │           [Mapa interactivo]             │    │
│  │              📍                          │    │
│  │                                          │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Cra 15 #82-34, Chapinero, Bogota                │
│  Horario: Lun-Vie 9:00-20:00, Sab 9:00-17:00    │
│  Telefono: +57 300 123 4567                      │
│  Instagram: @barberiaelite                       │
│  [Como llegar] [Llamar] [WhatsApp]               │
└──────────────────────────────────────────────────┘
```

---

## 4. Entidades y Modelo de Datos Extendido

### 4.1 Extensiones al BusinessProfileEntity

Se agregan campos al perfil publico para soportar contenido configurable:

```typescript
// marketplace-service: business-profile.entity.ts
// CAMPOS NUEVOS (agregar al entity existente)

@Column({ name: "tagline", type: "varchar", length: 80, nullable: true })
tagline!: string; // Frase corta bajo el nombre

@Column({ name: "story_title", type: "varchar", length: 100, nullable: true })
storyTitle!: string; // Titulo de la seccion historia (default: "Nuestra Historia")

@Column({ name: "story_text", type: "text", nullable: true })
storyText!: string; // Texto completo de la historia del negocio

@Column({ name: "story_image", nullable: true })
storyImage!: string; // Imagen principal de la historia

@Column({ name: "founded_year", type: "int", nullable: true })
foundedYear!: number; // Anio de fundacion

@Column({ name: "founders", type: "varchar", nullable: true })
founders!: string; // Nombres de fundadores

@Column({ type: "jsonb", name: "social_links", nullable: true })
socialLinks!: {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  website?: string;
};

@Column({ type: "jsonb", name: "section_config", nullable: true })
sectionConfig!: {
  sections: {
    id: string;           // "story" | "services" | "team" | "gallery" | "reviews" | "location"
    enabled: boolean;
    order: number;        // Orden de aparicion (1 = primero)
    customTitle?: string; // Titulo personalizado
  }[];
};

@Column({ name: "gallery_images", type: "jsonb", nullable: true })
galleryImages!: {
  url: string;
  title?: string;
  category?: string;     // "local" | "trabajos" | "ambiente" | "eventos" | custom
  featured?: boolean;
}[];

@Column({ name: "is_published", default: false })
isPublished!: boolean; // El negocio controla cuando publicar su perfil

@Column({ name: "profile_completeness", type: "int", default: 0 })
profileCompleteness!: number; // Porcentaje de completitud (calculado)
```

### 4.2 Extensiones al ReviewEntity

Se agregan campos para reseñas enriquecidas:

```typescript
// marketplace-service: review.entity.ts
// CAMPOS NUEVOS

@Column({ name: "service_name", nullable: true })
serviceName!: string; // Nombre del servicio al momento de la resena (desnormalizado)

@Column({ name: "professional_name", nullable: true })
professionalName!: string; // Nombre del profesional (desnormalizado)

@Column({ type: "jsonb", name: "photos", nullable: true })
photos!: string[]; // URLs de fotos adjuntas (max 3)

@Column({ name: "is_verified", default: false })
isVerified!: boolean; // True si proviene de una cita completada

@Column({ name: "helpful_count", default: 0 })
helpfulCount!: number; // Contador de "util para otros"
```

### 4.3 Nueva Entidad: ProfessionalProfile (Marketplace)

Perfil publico del profesional dentro del marketplace. Se sincroniza desde core-service
pero el negocio puede enriquecerlo.

```typescript
@Entity("professional_profiles")
export class ProfessionalProfileEntity {
  @PrimaryColumn("uuid") id!: string;

  @Column({ type: "uuid", name: "professional_id" }) professionalId!: string;
  @Column({ type: "uuid", name: "business_id" }) businessId!: string;

  // Datos basicos (sincronizados desde core)
  @Column() name!: string;
  @Column({ nullable: true }) photo!: string;
  @Column({ type: "text", nullable: true }) bio!: string;
  @Column({ type: "simple-array" }) specialties!: string[];
  @Column({ name: "years_exp", default: 0 }) yearsExp!: number;

  // Datos de marketplace (configurables)
  @Column({ name: "tagline", nullable: true }) tagline!: string; // "El rey de la barba"
  @Column({ type: "jsonb", nullable: true }) portfolio!: {
    url: string;
    title?: string;
    category?: string;
  }[];
  @Column({ name: "social_instagram", nullable: true }) socialInstagram!: string;

  // Metricas (calculadas)
  @Column({ type: "decimal", precision: 3, scale: 2, default: 0 }) rating!: number;
  @Column({ name: "total_reviews", default: 0 }) totalReviews!: number;

  @Column({ default: true }) active!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;

  @BeforeInsert()
  generateId(): void { if (!this.id) this.id = uuidv4(); }
}
```

### 4.4 Nueva Entidad: ReviewHelpful (Vote)

Registro de votos "util" en reseñas.

```typescript
@Entity("review_helpful")
@Unique(["reviewId", "userId"])
export class ReviewHelpfulEntity {
  @PrimaryColumn("uuid") id!: string;

  @Column({ type: "uuid", name: "review_id" }) reviewId!: string;
  @Column({ type: "uuid", name: "user_id" }) userId!: string;

  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;

  @BeforeInsert()
  generateId(): void { if (!this.id) this.id = uuidv4(); }
}
```

---

## 5. APIs del Marketplace

### 5.1 Landing del Marketplace (Feed Curado)

```
GET /marketplace/feed
  ?lat={latitude}
  &lng={longitude}
  &city={ciudad}

Response:
{
  "heroBanner": { ... },              // Banner dinamico (negocio destacado)
  "categories": [
    { "id": "barberia", "name": "Barberias", "icon": "...", "count": 45 },
    { "id": "salon", "name": "Salones de Belleza", "icon": "...", "count": 32 },
    { "id": "spa", "name": "Spas y Centros Esteticos", "icon": "...", "count": 18 }
  ],
  "sections": [
    {
      "id": "popular_nearby",
      "title": "Populares cerca de ti",
      "type": "carousel",
      "items": [ BusinessProfilePreview ]
    },
    {
      "id": "available_today",
      "title": "Con cupo disponible hoy",
      "type": "carousel",
      "items": [ BusinessProfilePreview ]
    },
    {
      "id": "top_rated",
      "title": "Mejor calificados",
      "type": "grid",
      "items": [ BusinessProfilePreview ]
    },
    {
      "id": "new_on_platform",
      "title": "Recien llegados a BeautySpot",
      "type": "carousel",
      "items": [ BusinessProfilePreview ]
    }
  ]
}
```

### 5.2 Preview de Negocio (para Cards del Feed)

```
BusinessProfilePreview: {
  id: string;
  slug: string;
  name: string;
  businessType: string;
  tagline: string;              // NUEVO: frase corta
  logo: string;
  coverImage: string;
  city: string;
  rating: number;
  totalReviews: number;
  distanceKm: number;           // Si hay geolocalizacion
  priceFrom: number;            // Precio del servicio mas economico (COP)
  isOpen: boolean;              // Calculado segun horario actual
  nextAvailableSlot: string;    // ISO datetime o null
  topServices: string[];        // Nombres de los 3 servicios mas reservados
  verified: boolean;
}
```

### 5.3 Perfil Publico Completo

```
GET /marketplace/profiles/{slug}

Response:
{
  // Datos basicos
  "id": "uuid",
  "slug": "barberia-elite",
  "name": "Barberia Elite",
  "tagline": "Donde el estilo se encuentra con la tradicion",
  "description": "...",
  "logo": "https://...",
  "coverImage": "https://...",
  "businessType": "barberia",
  "verified": true,
  "isPublished": true,

  // Ubicacion
  "address": "Cra 15 #82-34, Chapinero",
  "city": "Bogota",
  "state": "Cundinamarca",
  "country": "Colombia",
  "lat": 4.7110,
  "lng": -74.0721,
  "phone": "+57 300 123 4567",
  "email": "info@barberiaelite.com",
  "socialLinks": {
    "instagram": "@barberiaelite",
    "facebook": "barberiaelite",
    "tiktok": "@barberiaelite",
    "website": "https://barberiaelite.com"
  },

  // Historia
  "storyTitle": "Nuestra Historia",
  "storyText": "Barberia Elite nacio en 2018...",
  "storyImage": "https://...",
  "foundedYear": 2018,
  "founders": "Carlos Perez, Maria Gomez",

  // Metricas
  "rating": 4.7,
  "totalReviews": 124,

  // Configuracion de secciones
  "sectionConfig": {
    "sections": [
      { "id": "story", "enabled": true, "order": 1, "customTitle": null },
      { "id": "services", "enabled": true, "order": 2, "customTitle": "Lo que hacemos" },
      { "id": "team", "enabled": true, "order": 3, "customTitle": null },
      { "id": "gallery", "enabled": true, "order": 4, "customTitle": "Nuestro Espacio" },
      { "id": "reviews", "enabled": true, "order": 5, "customTitle": null },
      { "id": "location", "enabled": true, "order": 6, "customTitle": null }
    ]
  },

  // Galeria
  "galleryImages": [
    { "url": "...", "title": "Frente del local", "category": "local", "featured": true },
    { "url": "...", "title": "Corte degradado", "category": "trabajos", "featured": false }
  ],

  // Horario (desde core-service)
  "hours": [
    { "day": 1, "open": "09:00", "close": "20:00" },
    { "day": 2, "open": "09:00", "close": "20:00" },
    ...
  ],
  "isOpenNow": true,

  // Datos relacionados (servicios, equipo, reseñas)
  "services": [ ServicePreview ],
  "professionals": [ ProfessionalProfilePreview ],
  "reviews": {
    "summary": { "average": 4.7, "total": 124, "distribution": { 5: 78, 4: 15, 3: 4, 2: 2, 1: 1 } },
    "items": [ ReviewItem ] // Primeras 10
  },

  // SEO
  "metaTitle": "Barberia Elite | Cortes y Barba en Bogota | BeautySpot",
  "metaDescription": "...",
  "schemaOrg": { ... }
}
```

### 5.4 Endpoint de Configuracion (para el negocio)

```
PUT /marketplace/profiles/{slug}/config
  Body: {
    "tagline": "...",
    "storyTitle": "...",
    "storyText": "...",
    "storyImage": "...",
    "foundedYear": 2018,
    "founders": "...",
    "socialLinks": { ... },
    "sectionConfig": { ... },
    "galleryImages": [ ... ]
  }

POST /marketplace/profiles/{slug}/gallery
  Body: FormData con imagen + metadata
  Response: { url: string }

DELETE /marketplace/profiles/{slug}/gallery/{imageIndex}

POST /marketplace/profiles/{slug}/publish  // Publicar perfil
POST /marketplace/profiles/{slug}/unpublish // Despublicar
```

### 5.5 Endpoint de Reseñas Enriquecidas

```
POST /marketplace/reviews
  Body: {
    "businessId": "uuid",
    "appointmentId": "uuid",    // Obligatorio para reseña verificada
    "professionalId": "uuid",
    "rating": 5,
    "comment": "...",
    "photos": ["url1", "url2"]  // Max 3
  }

PUT /marketplace/reviews/{id}/response
  Body: { "response": "Gracias por tu resena..." }

POST /marketplace/reviews/{id}/helpful  // Votar "util"

GET /marketplace/profiles/{slug}/reviews
  ?page=1&limit=10&rating=5&withPhotos=true
```

---

## 6. Calculo de Completitud del Perfil

El porcentaje de completitud guia al negocio para que su perfil sea atractivo.

```typescript
function calculateProfileCompleteness(profile: BusinessProfile): number {
  let score = 0;
  const maxScore = 100;

  // Datos basicos (30 puntos)
  if (profile.name) score += 5;
  if (profile.description) score += 5;
  if (profile.logo) score += 10;
  if (profile.coverImage) score += 10;

  // Historia (20 puntos)
  if (profile.storyText && profile.storyText.length > 100) score += 15;
  if (profile.storyImage) score += 5;

  // Galeria (15 puntos)
  if (profile.galleryImages && profile.galleryImages.length >= 3) score += 10;
  if (profile.galleryImages && profile.galleryImages.length >= 6) score += 5;

  // Redes sociales (10 puntos)
  if (profile.socialLinks?.instagram) score += 5;
  if (profile.socialLinks?.facebook || profile.socialLinks?.tiktok) score += 5;

  // Ubicacion completa (10 puntos)
  if (profile.address && profile.city) score += 5;
  if (profile.lat && profile.lng) score += 5;

  // Servicios con imagen (10 puntos)
  // (calculado externamente: cuantos servicios tienen imagen)
  if (servicesWithImage > 0) score += 5;
  if (servicesWithImage >= totalServices * 0.5) score += 5;

  // Profesionales con foto (5 puntos)
  if (professionalsWithPhoto > 0) score += 5;

  return Math.min(score, maxScore);
}
```

---

## 7. Wireframes: Flujo Completo del Marketplace

### 7.1 Landing Marketplace (Home)

```
┌──────────────────────────────────────────────────┐
│  BeautySpot                              [Login] │
├──────────────────────────────────────────────────┤
│                                                  │
│  Descubre el mejor lugar para tu estilo          │
│  [Busca barberias, salones o spas...]  [Buscar]  │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ ✂        │ │ 💇       │ │ 🧖       │         │
│  │Barberias │ │ Salones  │ │   Spas   │         │
│  │   45     │ │   32     │ │   18     │         │
│  └──────────┘ └──────────┘ └──────────┘         │
│                                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  🔥 Populares cerca de ti                       │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │[img] │ │[img] │ │[img] │ │[img] │  >>>      │
│  │Elite │ │Style │ │Corte │ │Princ │           │
│  │★4.7  │ │★4.5  │ │★4.9  │ │★4.3  │           │
│  │800m  │ │1.2km │ │2.5km │ │3.1km │           │
│  └──────┘ └──────┘ └──────┘ └──────┘           │
│                                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  🕐 Con cupo disponible hoy                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │[img] │ │[img] │ │[img] │ │[img] │  >>>      │
│  │Elite │ │NewSt │ │Urban │ │Fresh │           │
│  │3:00PM│ │4:30PM│ │2:00PM│ │5:00PM│           │
│  └──────┘ └──────┘ └──────┘ └──────┘           │
│                                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  ⭐ Mejor calificados                           │
│  ┌──────┐ ┌──────┐ ┌──────┐                     │
│  │[img] │ │[img] │ │[img] │                     │
│  │Corte │ │Elite │ │Style │                     │
│  │★4.9  │ │★4.7  │ │★4.5  │                     │
│  │231 r │ │124 r │ │98 r  │                     │
│  └──────┘ └──────┘ └──────┘                     │
│  ┌──────┐ ┌──────┐ ┌──────┐                     │
│  │[img] │ │[img] │ │[img] │                     │
│  │Urban │ │Princ │ │Fresh │                     │
│  │★4.4  │ │★4.3  │ │★4.2  │                     │
│  └──────┘ └──────┘ └──────┘                     │
│                                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  🆕 Recien llegados                             │
│  ┌──────┐ ┌──────┐ ┌──────┐                     │
│  │[img] │ │[img] │ │[img] │  >>>               │
│  │NewSt │ │Fresh │ │Urban │                     │
│  │Nuevo │ │Nuevo │ │Nuevo │                     │
│  └──────┘ └──────┘ └──────┘                     │
│                                                  │
├──────────────────────────────────────────────────┤
│  [Home] [Buscar] [Reservas] [Favs] [Perfil]     │
└──────────────────────────────────────────────────┘
```

### 7.2 Perfil Publico Inmersivo (Scroll Vertical)

```
┌──────────────────────────────────────────────────┐
│  ← Volver    [Compartir] [❤ Favorito]           │
├──────────────────────────────────────────────────┤
│                                                  │
│  ████████████████████████████████████████████    │
│  ████  BANNER / COVER IMAGE  ██████████████     │
│  ████████████████████████████████████████████    │
│                                                  │
│  ┌─────┐                                         │
│  │Logo │  BARBERIA ELITE                         │
│  └─────┘  Donde el estilo se encuentra con       │
│           la tradicion                           │
│           Barberia · Bogota                      │
│           ★ 4.7 (124 reseñas) · Verificado       │
│           Abierto ahora · Cierra a las 8:00 PM   │
│           A 800m de ti                           │
│                                                  │
│  [ 📅 RESERVAR AHORA ]  [ 📞 Llamar ]           │
│                                                  │
├──────────────────────────────────────────────────┤
│  [Inicio] [Historia] [Servicios] [Equipo]        │
│  [Galeria] [Resenas] [Ubicacion]                 │
├──────────────────────────────────────────────────┤
│                                                  │
│  ═══ NUESTRA HISTORIA ═══                       │
│                                                  │
│  [Foto fundadores / local]                       │
│                                                  │
│  "Barberia Elite nacio en 2018 de la mano       │
│   de Carlos y Maria, dos apasionados del        │
│   arte de la barberia clasica..."               │
│                                                  │
│  Fundado: 2018                                   │
│  Fundadores: Carlos Perez, Maria Gomez           │
│  [Leer mas]                                      │
│                                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  ═══ NUESTROS SERVICIOS ═══  [Ver todo]         │
│                                                  │
│  ┌─ CORTES ─────────────────────────────────┐    │
│  │ [img] Corte Clasico    $25.000 · 30 min  │    │
│  │ [img] Degradado        $30.000 · 45 min  │    │
│  │ [img] Corte + Barba    $40.000 · 1 hora  │    │
│  └──────────────────────────────────────────┘    │
│  ┌─ BARBA ──────────────────────────────────┐    │
│  │ [img] Afeitado         $20.000 · 30 min  │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  ═══ CONOCE A NUESTRO EQUIPO ═══                │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │  [Foto]  │ │  [Foto]  │ │  [Foto]  │         │
│  │  Carlos  │ │  Maria   │ │  Andres  │         │
│  │  Perez   │ │  Gomez   │ │  Ruiz    │         │
│  │ ★ 4.9   │ │ ★ 4.8   │ │ ★ 4.7   │         │
│  │ Cortes   │ │ Barba    │ │ Faciales │         │
│  │ "El maes │ │ "La reina│ │ "Especia│         │
│  │  tro"    │ │  de la b"│ │  lista"  │         │
│  │          │ │          │ │          │         │
│  │[Reservar]│ │[Reservar]│ │[Reservar]│         │
│  └──────────┘ └──────────┘ └──────────┘         │
│                                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  ═══ GALERIA ═══                        [Todo]  │
│  [Local] [Trabajos] [Ambiente]                   │
│                                                  │
│  ┌─────┐ ┌─────┐ ┌─────┐                        │
│  │ img │ │ img │ │ img │                        │
│  └─────┘ └─────┘ └─────┘                        │
│  ┌─────┐ ┌─────┐ ┌─────┐                        │
│  │ img │ │ img │ │ img │                        │
│  └─────┘ └─────┘ └─────┘                        │
│                                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  ═══ RESENAS Y CALIFICACIONES ═══               │
│                                                  │
│       ★ 4.7                                     │
│  Promedio de 124 reseñas                        │
│  5★ ████████████████░░  78%                     │
│  4★ ████░░░░░░░░░░░░░  15%                     │
│  3★ ██░░░░░░░░░░░░░░░   4%                     │
│  2★ █░░░░░░░░░░░░░░░░   2%                     │
│  1★ ░░░░░░░░░░░░░░░░░   1%                     │
│                                                  │
│  ─────────────────────────────                   │
│  [Avatar] Juan D. ★★★★★ Hace 2 dias             │
│  "Increible experiencia..."                      │
│  Servicio: Corte + Barba · Carlos Perez          │
│  [Foto] [Foto]                                   │
│  ┌─ Barberia Elite ──────────────────┐           │
│  │ "Gracias Juan! Te esperamos..."  │           │
│  └───────────────────────────────────┘           │
│  [Util (5)] [Reportar]                           │
│  ─────────────────────────────                   │
│  [Cargar mas reseñas]                            │
│                                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  ═══ UBICACION Y CONTACTO ═══                   │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │           [Mapa interactivo]             │    │
│  └──────────────────────────────────────────┘    │
│  Cra 15 #82-34, Chapinero, Bogota                │
│  Lun-Vie 9:00-20:00, Sab 9:00-17:00             │
│  [Como llegar] [Llamar] [WhatsApp]               │
│                                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  [ 📅 RESERVAR AHORA ]  (FAB flotante)           │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 8. Panel de Configuracion del Marketplace (para el Negocio)

El owner/admin accede desde su dashboard para configurar el perfil publico.

### 8.1 Pantalla de Configuracion

```
┌──────────────────────────────────────────────────┐
│  ← Configuracion    Perfil Publico      [Vista   │
│                                          previa] │
├──────────────────────────────────────────────────┤
│                                                  │
│  Completitud del perfil: ████████░░ 75%          │
│                                                  │
│  ┌─ BANNER Y DATOS BASICOS ────────────────┐     │
│  │                                          │     │
│  │  Cover Image:                            │     │
│  │  ┌──────────────────────────────────┐    │     │
│  │  │  [Arrastra o haz click para      │    │     │
│  │  │   subir imagen de portada]       │    │     │
│  │  └──────────────────────────────────┘    │     │
│  │  Min 1200x600px. Max 5MB.               │     │
│  │                                          │     │
│  │  Logo: [Subir logo]                      │     │
│  │  Tagline: [Donde el estilo...    ] 0/80  │     │
│  │  Descripcion: [Texto del negocio ] 0/300 │     │
│  └──────────────────────────────────────────┘     │
│                                                  │
│  ┌─ NUESTRA HISTORIA ──────────────────────┐     │
│  │                                          │     │
│  │  Titulo: [Nuestra Historia       ]       │     │
│  │  Texto: [Rich text editor...          ]  │     │
│  │  Imagen: [Subir foto]                    │     │
│  │  Fundado en: [2018]                      │     │
│  │  Fundadores: [Carlos Perez, Maria Gomez] │     │
│  └──────────────────────────────────────────┘     │
│                                                  │
│  ┌─ GALERIA ───────────────────────────────┐     │
│  │                                          │     │
│  │  [Arrastra imagenes aqui]                │     │
│  │  Max 20 imagenes. Max 5MB cada una.      │     │
│  │                                          │     │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │     │
│  │  │ img │ │ img │ │ img │ │ img │       │     │
│  │  │  ✏  │ │  ✏  │ │  ✏  │ │  ✏  │       │     │
│  │  │  🗑  │ │  🗑  │ │  🗑  │ │  🗑  │       │     │
│  │  └─────┘ └─────┘ └─────┘ └─────┘       │     │
│  │                                          │     │
│  │  Al editar imagen:                       │     │
│  │  - Titulo: [Frente del local]            │     │
│  │  - Categoria: [Local ▼]                  │     │
│  │  - [Destacada]                           │     │
│  └──────────────────────────────────────────┘     │
│                                                  │
│  ┌─ REDES SOCIALES ────────────────────────┐     │
│  │  Instagram: [@barberiaelite    ]         │     │
│  │  Facebook:  [barberiaelite    ]          │     │
│  │  TikTok:    [@barberiaelite   ]          │     │
│  │  Web:       [https://barberia... ]       │     │
│  └──────────────────────────────────────────┘     │
│                                                  │
│  ┌─ ORDEN DE SECCIONES ────────────────────┐     │
│  │                                          │     │
│  │  Arrastra para reordenar:                │     │
│  │  ☑ 1. Nuestra Historia                  │     │
│  │  ☑ 2. Servicios                         │     │
│  │  ☑ 3. Equipo                            │     │
│  │  ☑ 4. Galeria                           │     │
│  │  ☑ 5. Resenas                           │     │
│  │  ☑ 6. Ubicacion                         │     │
│  │                                          │     │
│  │  Desmarca para ocultar una seccion.      │     │
│  └──────────────────────────────────────────┘     │
│                                                  │
│  [Guardar cambios]  [Vista previa]  [Publicar]   │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 9. Reglas de Negocio del Marketplace

### 9.1 Visibilidad

| Condicion                    | Visible en Marketplace      |
| ---------------------------- | --------------------------- |
| Perfil publicado + activo    | Si, en busqueda y feed      |
| Perfil no publicado          | No visible                  |
| Negocio desactivado          | No visible                  |
| Negocio suspendido (admin)   | No visible                  |
| Perfil con < 30% completitud | Visible pero sin destacarse |

### 9.2 Destacados en el Feed

Los negocios se ordenan en los carousels segun:

**"Populares cerca de ti"**: basado en un score compuesto:

```
score = (rating * 0.30) + (totalReviews_normalizado * 0.20) +
        (completitud_perfil * 0.15) + (reservas_ultimo_mes * 0.20) +
        (frescura_contenido * 0.15)
```

**"Con cupo hoy"**: negocios con slots disponibles hoy, ordenados por rating

**"Mejor calificados"**: orden directa por rating (min 5 reseñas)

**"Recien llegados"**: creados en los ultimos 30 dias, ordenados por completitud

### 9.3 Reseñas

| Regla                             | Detalle                                         |
| --------------------------------- | ----------------------------------------------- |
| Solo clientes con cita completada | Pueden dejar resena verificada                  |
| Una resena por cita               | Max 1 resena por appointment                    |
| Rating obligatorio                | 1-5 estrellas, sin decimales                    |
| Comentario opcional               | Pero obligatorio si rating < 4                  |
| Fotos max 3                       | Max 5MB cada una                                |
| Respuesta del negocio             | Max 1 respuesta por resena                      |
| Edicion                           | El cliente puede editar su resena dentro de 48h |
| Reporte                           | Cualquier usuario puede reportar una resena     |

---

## 10. SEO y Performance

### 10.1 SEO por Perfil

Cada perfil publico genera automaticamente:

- **Meta title**: `{nombre} | {tipo} en {ciudad} | BeautySpot`
- **Meta description**: Auto-generada con tagline, rating, y precio desde
- **Open Graph**: Imagen de cover, titulo, descripcion
- **Schema.org LocalBusiness**: Datos estructurados completos
- **URL canonica**: `https://beautyspot.co/negocio/{slug}`
- **Sitemap**: Incluido automaticamente

### 10.2 Performance Targets

| Metrica                        | Objetivo |
| ------------------------------ | -------- |
| LCP (Largest Contentful Paint) | < 2.5s   |
| FID (First Input Delay)        | < 100ms  |
| CLS (Cumulative Layout Shift)  | < 0.1    |
| TTFB (Time to First Byte)      | < 600ms  |
| Lighthouse Performance         | > 85     |

### 10.3 Estrategia de Caché

| Recurso                 | TTL    | Estrategia                          |
| ----------------------- | ------ | ----------------------------------- |
| Feed del marketplace    | 5 min  | Redis, invalidar al publicar perfil |
| Perfil publico completo | 15 min | Redis + CDN, invalidar al editar    |
| Imagenes de galeria     | 24h    | CDN (CloudFront/Fastly)             |
| Busqueda con filtros    | 2 min  | Redis, cache por query hash         |
| Reseñas                 | 10 min | Redis, invalidar al nueva resena    |
| Rating promedio         | 30 min | Redis, recalculo en background      |

---

## 11. Implementacion por Fases

### Fase 1: Perfil Enriquecido (Sprint 5 MVP)

**Entregables:**

- Extension de `BusinessProfileEntity` con campos de historia, galeria, config
- API de configuracion del perfil (PUT /profiles/{slug}/config)
- API publica del perfil completo (GET /profiles/{slug})
- Panel de configuracion basico (sin drag-and-drop)
- Galeria simple (upload + display)
- Calculo de completitud

### Fase 2: Feed Curado + Busqueda Mejorada

**Entregables:**

- API de feed con secciones curadas
- Cards de preview enriquecidas (con tagline, precio desde, disponibilidad)
- Landing del marketplace con carousels
- Busqueda con filtros avanzados (tipo, servicios, rating minimo)
- Integracion con disponibilidad en tiempo real (nextAvailableSlot)

### Fase 3: Profesional Profiles + Reseñas Enriquecidas

**Entregables:**

- Nueva entidad `ProfessionalProfileEntity`
- Cards de profesionales con portfolio y tagline
- Extension de `ReviewEntity` con fotos, servicio, profesional
- Distribucion de calificaciones (barra de 5★ a 1★)
- Respuestas del negocio a reseñas
- Votos "util" en reseñas

### Fase 4: Pulido Visual y Engagement

**Entregables:**

- Reordenamiento de secciones via drag-and-drop
- Preview en vivo del perfil (WYSIWYG)
- Banner/video en hero
- Favoritos (guardar negocios)
- Recomendaciones personalizadas
- SEO completo (Schema.org, sitemap, meta tags)
- Performance optimization (lazy loading, blur-up)

---

## 12. Dependencias con Otros Servicios

| Servicio             | Dependencia                                                    |
| -------------------- | -------------------------------------------------------------- |
| core-service         | Datos maestros del negocio, servicios, profesionales, horarios |
| booking-service      | Disponibilidad en tiempo real, proximo slot disponible         |
| auth-service         | Identidad del cliente para reseñas, permisos del negocio       |
| notification-service | Notificar al negocio de nuevas reseñas                         |
| api-gateway          | Enrutamiento publico del marketplace (sin auth para perfiles)  |

### Sincronizacion de Datos

El marketplace no duplica datos maestros. Los sincroniza:

```
core-service (fuente de verdad)
    │
    ├── Evento: business.updated → marketplace sincroniza BusinessProfile
    ├── Evento: professional.updated → marketplace sincroniza ProfessionalProfile
    ├── Evento: service.updated → marketplace actualiza preview de servicios
    │
booking-service
    │
    ├── API call: GET /booking/availability/next?businessId=X → nextAvailableSlot
    │
auth-service
    │
    ├── API call: GET /auth/users/{id} → datos del cliente para reseñas
```
