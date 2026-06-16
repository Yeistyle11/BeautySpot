# 12. Modelo de Negocio - BeautySpot SaaS

## Tabla de Contenidos

- [Propuesta de Valor](#propuesta-de-valor)
- [Modelo de Suscripcion SaaS](#modelo-de-suscripcion-saas)
- [Comparativa de Planes](#comparativa-de-planes)
- [Fuentes de Ingreso](#fuentes-de-ingreso)
- [Mercado Objetivo](#mercado-objetivo)
- [Estrategia de Adquisicion de Clientes](#estrategia-de-adquisicion-de-clientes)
- [Economia Unitaria](#economia-unitaria)
- [Estrategia de Crecimiento](#estrategia-de-crecimiento)
- [Panorama Competitivo](#panorama-competitivo)
- [Proyecciones Financieras](#proyecciones-financieras)

---

## Propuesta de Valor

### Para el Negocio (Barberia, Salon, Spa)

BeautySpot transforma la gestion de barberias, salones de belleza y spas en America Latina con una plataforma digital que:

1. **Elimina la agenda fisica**: Centraliza todas las citas en un sistema digital accesible desde cualquier dispositivo
2. **Atrae nuevos clientes**: El marketplace conecta a usuarios que buscan servicios con negocios cercanos
3. **Reduce las ausencias**: Los recordatorios automaticos y la confirmacion de citas disminuyen los no-shows
4. **Mejora la organizacion**: Dashboard claro con metricas de rendimiento, ingresos y ocupacion
5. **Professionaliza la imagen**: Perfil publico con servicios, profesionales y horarios

### Para el Cliente Final

- Encuentra barberias, salones y spas cercanos en un solo lugar
- Reserva citas en segundos, sin llamar por telefono
- Ve disponibilidad en tiempo real
- Historial de servicios y profesionales favoritos

### Diferenciadores Clave

| Diferenciador | Descripcion |
|--------------|-------------|
| Enfoque regional | Disenado para las necesidades y flujos de trabajo de America Latina |
| Marketplace integrado | No solo gestion, sino tambien adquisicion de clientes |
| Precio accesible | Planes adaptados al poder adquisitivo de la region |
| Sin pagos online obligatorios | Funciona con pagos manuales desde el dia uno |
| Multi-tipo de negocio | Barberias, salones de belleza y spas en una sola plataforma |

---

## Modelo de Suscripcion SaaS

### Estructura de Precios

Todos los precios en USD, facturados mensualmente. Se ofrecen descuentos por pago anual (2 meses gratis).

#### Plan Free - "Empieza Digital"

| Parametro | Valor |
|-----------|-------|
| Precio | $0 USD/mes |
| Profesionales | 1 |
| Citas mensuales | 50 |
| Servicios | Ilimitados |
| Marketplace | Si (perfil basico) |
| Notificaciones email | 50/mes |
| Dashboard | Basico |
| Soporte | Comunidad |
| Almacenamiento | 100 MB |

**Publico objetivo**: Negocios individuales (barberos independientes, manicuristas freelance) que quieren digitalizar su agenda sin costo.

#### Plan Basico - "Crece"

| Parametro | Valor |
|-----------|-------|
| Precio | $15 USD/mes ($150 USD/anual) |
| Profesionales | 3 |
| Citas mensuales | 300 |
| Servicios | Ilimitados |
| Marketplace | Si (perfil destacado) |
| Notificaciones email | 500/mes |
| Dashboard | Completo |
| Soporte | Email (48h) |
| Almacenamiento | 1 GB |
| Extras | Recordatorios automaticos, resenas |

**Publico objetivo**: Barberias pequenas, salones de belleza con 2-3 profesionales que necesitan organizacion basica.

#### Plan Profesional - "Domina"

| Parametro | Valor |
|-----------|-------|
| Precio | $30 USD/mes ($300 USD/anual) |
| Profesionales | 10 |
| Citas mensuales | Ilimitadas |
| Servicios | Ilimitados |
| Marketplace | Si (perfil premium + destacado) |
| Notificaciones email | Ilimitadas |
| Dashboard | Completo + reportes |
| Soporte | Chat (24h) |
| Almacenamiento | 5 GB |
| Extras | Resenas, programa fidelidad, reportes avanzados, API access |

**Publico objetivo**: Negocios establecidos con equipos de 4-10 profesionales que buscan optimizar su operacion.

#### Plan Enterprise - "Escala"

| Parametro | Valor |
|-----------|-------|
| Precio | Personalizado (desde $80 USD/mes) |
| Profesionales | Ilimitados |
| Citas mensuales | Ilimitadas |
| Servicios | Ilimitados |
| Marketplace | Si (maxima visibilidad) |
| Notificaciones | Ilimitadas + WhatsApp |
| Dashboard | Completo + BI personalizado |
| Soporte | Telefonico + Slack dedicado |
| Almacenamiento | Ilimitado |
| Extras | Multi-sucursal, SSO, API completa, integraciones custom, SLA garantizado |

**Publico objetivo**: Cadenas con multiples sucursales, spas grandes, negocios que necesitan integracion con sistemas existentes.

---

## Comparativa de Planes

### Feature Matrix

| Feature | Free | Basico | Profesional | Enterprise |
|---------|:----:|:------:|:-----------:|:----------:|
| **Gestion de Citas** | | | | |
| Crear/editar citas | Si | Si | Si | Si |
| Calendario visual | Diario | Diario/Semanal | Completo | Completo |
| Disponibilidad automatica | Si | Si | Si | Si |
| Recordatorios automaticos | No | Si | Si | Si |
| Citas recurrentes | No | No | Si | Si |
| **Gestion de Negocio** | | | | |
| Profesionales | 1 | 3 | 10 | Ilimitado |
| Servicios | Ilimitado | Ilimitado | Ilimitado | Ilimitado |
| Horarios por profesional | Si | Si | Si | Si |
| Dias libres/bloqueos | Si | Si | Si | Si |
| Multi-sucursal | No | No | No | Si |
| **Pagos** | | | | |
| Registro manual | Si | Si | Si | Si |
| Pagos online | No | No | Post-MVP | Si |
| Reporte de ingresos | Basico | Completo | Completo | BI |
| Facturacion | No | No | Post-MVP | Si |
| **Marketplace** | | | | |
| Perfil publico | Basico | Estándar | Destacado | Premium |
| Fotos del negocio | 3 | 5 | 15 | Ilimitado |
| Posicion en busqueda | Estandar | Mejorada | Destacada | Maxima |
| Ofertas y promociones | No | No | Si | Si |
| **Comunicacion** | | | | |
| Email notificaciones | 50/mes | 500/mes | Ilimitado | Ilimitado |
| Notificaciones push | No | Si | Si | Si |
| WhatsApp | No | No | No | Si |
| SMS | No | No | No | Si |
| **Analytics** | | | | |
| Dashboard basico | Si | Si | Si | Si |
| Reportes detallados | No | No | Si | Si |
| Exportacion datos | No | No | CSV | CSV + API |
| Reportes personalizados | No | No | No | Si |
| **Tecnico** | | | | |
| Almacenamiento | 100 MB | 1 GB | 5 GB | Ilimitado |
| API access | No | No | Si | Si |
| SSO / SAML | No | No | No | Si |
| SLA garantizado | No | 99% | 99.5% | 99.9% |
| Soporte | Comunidad | Email | Chat | Telefonico + Slack |

---

## Fuentes de Ingreso

### 1. Suscripciones SaaS (Principal - 85% del revenue)

Ingreso recurrente mensual (MRR) de las suscripciones de los negocios:

| Plan | Precio/mes | % estimado de clientes | MRR por 100 clientes |
|------|-----------|:----------------------:|:--------------------:|
| Free | $0 | 60% | $0 |
| Basico | $15 | 25% | $375 |
| Profesional | $30 | 12% | $360 |
| Enterprise | $80+ | 3% | $240+ |
| **Total** | | **100%** | **$975+** |

**ARPU estimado** (Average Revenue Per User): ~$9.75 USD/mes por negocio registrado (incluyendo free).

### 2. Comisiones de Marketplace (Futuro - 10% del revenue)

Comision del 5-10% sobre citas reservadas a traves del marketplace por clientes nuevos:

| Concepto | Valor |
|----------|-------|
| Comision por cita de marketplace | 5% del valor del servicio |
| Comision premium (negocios Free) | 10% del valor del servicio |
| Sin comision (citas directas) | $0 |
| Estimado por cita promedio | $1,500 - $3,000 COP ($0.35 - $0.70 USD) |

**Habilitado en Fase 3** (post-monetizacion), cuando el marketplace tenga suficiente trafico.

### 3. Features Premium (5% del revenue)

Funcionalidades adicionales de pago:

| Feature | Precio |
|---------|--------|
| SMS adicionales | $0.05 USD por SMS |
| Almacenamiento extra | $2 USD/GB/mes |
| Dominio personalizado | $5 USD/mes |
| Facturacion electronica | $10 USD/mes |
| Integracion WhatsApp | $15 USD/mes |

---

## Mercado Objetivo

### Tamano del Mercado en America Latina

| Segmento | Establecimientos (LatAm) | TAM estimado |
|----------|:------------------------:|:------------:|
| Barberias | ~800,000 | $192M USD/anual |
| Salones de belleza | ~1,200,000 | $288M USD/anual |
| Spas | ~200,000 | $96M USD/anual |
| **Total** | **~2,200,000** | **$576M USD/anual** |

*TAM calculado asumiendo ARPU de $20 USD/mes promedio.*

### Mercado Inicial: Colombia

| Metrica | Valor |
|---------|-------|
| Barberias en Colombia | ~80,000 |
| Salones de belleza | ~120,000 |
| Spas | ~15,000 |
| **Total establecimientos** | **~215,000** |
| SAM (accesible con marketing digital) | ~60,000 |
| SOM (alcanzable en primer ano) | ~500-1,000 |
| Tasa de penetracion ano 1 | ~0.3% |

### Expansion Geografica

| Fase | Mercado | Timeline | Establecimientos |
|------|---------|----------|:----------------:|
| Fase 1 | Colombia | Meses 1-6 | 215,000 |
| Fase 2 | Mexico + Peru | Meses 7-12 | ~600,000 |
| Fase 3 | Argentina + Chile | Meses 13-18 | ~350,000 |
| Fase 4 | Brasil | Meses 19-24 | ~700,000 |

### Perfil del Cliente Ideal (ICP)

**Negocio tipo**:
- Barberia o salon de belleza con 1-5 empleados
- Ubicado en zona urbana de Colombia
- Actualmente usa agenda fisica o WhatsApp para gestionar citas
- Tiene presencia en redes sociales (Instagram)
- Ingreso mensual del negocio: $3,000,000 - $15,000,000 COP ($700 - $3,500 USD)
- El dueno atiende clientes y gestiona la administracion

**Persona de decision**:
- Edad: 25-45 anos
- Genero: Mixto (mayormente hombres en barberias, mujeres en salones)
- Nivel tecnologico: Basico-intermedio (usa WhatsApp, Instagram, redes sociales)
- Motivacion: Ahorrar tiempo, verse mas profesional, conseguir mas clientes
- Objecion principal: "Ya uso WhatsApp, para que necesito otra cosa?"

---

## Estrategia de Adquisicion de Clientes

### Canal 1: Marketplace SEO (Principal)

| Accion | Detalle |
|--------|---------|
| SEO local | Optimizar perfiles publicos para "barberia cerca de mi", "salon de belleza [ciudad]" |
| Google My Business | Cada negocio verificado aparece en Google Maps |
| Landing por ciudad | Paginas dedicadas: beautyspot.co/barberias/bogota, /medellin, etc. |
| Presupuesto | $500 USD/mes (content + SEO tools) |
| Conversion estimada | 10% de visitantes al marketplace se registran como clientes |

### Canal 2: Redes Sociales

| Plataforma | Estrategia | Presupuesto |
|-----------|-----------|:-----------:|
| Instagram | Antes/despues, tutoriales, testimonios, reels | $300 USD/mes |
| TikTok | Contenido viral, tips de barberia, tras bastidores | $200 USD/mes |
| Facebook Groups | Grupos de barberos, comunidad de belleza | $100 USD/mes |
| YouTube | Tutoriales de uso de la plataforma, testimonios | $200 USD/mes |

### Canal 3: Referidos

| Programa | Detalle |
|----------|---------|
| "Trae un colega" | 1 mes gratis en plan Basico por cada referido que se registre |
| Referido cliente | Descuento en primera cita por referir un amigo al marketplace |
| Programa de embajadores | Barberos influyentes promocionan la plataforma a cambio de plan gratis |

### Canal 4: Alianzas Estrategicas

| Alianza | Detalle |
|---------|---------|
| Proveedores de productos | Marcas de productos capilares incluyen BeautySpot en sus kits |
| Escuelas de barberia | Acceso gratuito para estudiantes, descuento al graduarse |
| Camaras de comercio | Partnerships para digitalizacion de pequenos negocios |
| Bancos/Fintechs | Promociones cruzadas con cuentas de negocios |

### Canal 5: Ventas Directas (Enterprise)

| Accion | Detalle |
|--------|---------|
| LinkedIn | Outreach a duenos de cadenas y negocios grandes |
| Cold email | Secuencia de 5 emails a negocios identificados |
| Eventos | Asistir a ferias de belleza y barberia |
| Demo personalizada | Llamada de 30 min con demo en vivo |

### Presupuesto de Marketing Mensual (Ano 1)

| Canal | Presupuesto | % del Total |
|-------|:-----------:|:-----------:|
| SEO + Content | $500 | 33% |
| Redes sociales (ads) | $800 | 27% |
| Referidos (costo de meses gratis) | $200 | 13% |
| Alianzas | $100 | 7% |
| Ventas directas | $400 | 13% |
| Contingencia | $500 | 7% |
| **Total** | **$2,500** | **100%** |

---

## Economia Unitaria

### Metricas Clave

| Metrica | Target Ano 1 | Target Ano 2 |
|---------|:------------:|:------------:|
| CAC (Costo de Adquisicion) | $25 USD | $18 USD |
| LTV (Lifetime Value) | $180 USD | $270 USD |
| Ratio LTV:CAC | 7.2x | 15x |
| Payback period | 2.5 meses | 1.5 meses |
| Tasa de churn mensual | 8% | 5% |
| ARPU mensual | $9.75 USD | $15 USD |
| Margen bruto | 70% | 80% |

### Calculo de CAC (Costo de Adquisicion por Cliente)

```
CAC = (Marketing + Ventas) / Nuevos Clientes

Mes 6 (150 negocios registrados):
- Marketing acumulado: $15,000 USD (6 meses)
- Ventas acumuladas: $2,400 USD
- Clientes nuevos (60% de registrados pagan): 90
- CAC = $17,400 / 90 = $19.33 USD

Ano 1 (500 negocios registrados):
- Marketing acumulado: $30,000 USD
- Ventas acumuladas: $4,800 USD
- Clientes pagantes (40% de registrados): 200
- CAC = $34,800 / 200 = $17.40 USD
```

### Calculo de LTV (Lifetime Value)

```
LTV = ARPU x Margen Bruto x (1 / Churn Rate)

Escenario conservador (Ano 1):
- ARPU mensual: $9.75 USD
- Margen bruto: 70%
- Churn mensual: 8%
- Vida util promedio: 1/0.08 = 12.5 meses

LTV = $9.75 x 0.70 x 12.5 = $85.31 USD

Escenario optimista (Ano 2):
- ARPU mensual: $15 USD
- Margen bruto: 80%
- Churn mensual: 5%
- Vida util promedio: 1/0.05 = 20 meses

LTV = $15 x 0.80 x 20 = $240 USD
```

### Punto de Equilibrio (Break-Even)

```
Costos fijos mensuales (Ano 1):
- Infraestructura (cloud): $500 USD
- Equipo (2 devs, 1 marketing): $8,000 USD
- Herramientas y servicios: $500 USD
- Total costos fijos: $9,000 USD/mes

Revenue mensual necesario:
$9,000 / (ARPU x Margen) = $9,000 / ($9.75 x 0.70) = 1,319 clientes pagantes

Break-even estimado: Mes 14-16 (con 500+ negocios registrados, 200+ pagantes)
```

---

## Estrategia de Crecimiento

### Embudo de Conversion: Freemium a Pago

```
                   ┌─────────────────────────┐
                   │    AWARENESS             │
                   │    Visitantes web        │
                   │    10,000/mes            │
                   └───────────┬─────────────┘
                               │ 20%
                   ┌───────────▼─────────────┐
                   │    REGISTRO              │
                   │    Cuentas creadas       │
                   │    2,000/mes             │
                   └───────────┬─────────────┘
                               │ 30%
                   ┌───────────▼─────────────┐
                   │    ACTIVACION            │
                   │    Negocios configurados │
                   │    600/mes               │
                   └───────────┬─────────────┘
                               │ 25%
                   ┌───────────▼─────────────┐
                   │    CONVERSION            │
                   │    Clientes pagantes     │
                   │    150/mes               │
                   └───────────┬─────────────┘
                               │ 85% retencion
                   ┌───────────▼─────────────┐
                   │    RETENCION             │
                   │    Clientes activos      │
                   │    127/mes               │
                   └───────────┬─────────────┘
                               │ 10%
                   ┌───────────▼─────────────┐
                   │    EXPANSION             │
                   │    Upgrade de plan       │
                   │    13/mes                │
                   └─────────────────────────┘
```

### Palancas de Crecimiento

| Palanca | Descripcion | Impacto |
|---------|-------------|---------|
| Efecto red marketplace | Mas negocios atraen mas clientes, mas clientes atraen mas negocios | Alto |
| SEO organico | Contenido de barberia/beleza rankea en Google | Alto |
| Referidos | Cada negocio recomienda a sus colegas | Alto |
| Expansion geografica | Replicar exito de Colombia en otros paises | Medio |
| Upselling | Migrar usuarios Free a Basico, Basico a Profesional | Medio |
| Integraciones | Conectar con herramientas que ya usan (WhatsApp, Instagram) | Medio |

### Hitos de Crecimiento

| Mes | Hito | Metrica |
|-----|------|---------|
| 3 | Lanzamiento MVP | 0 negocios |
| 6 | Product-Market Fit inicial | 100 negocios registrados |
| 9 | Validacion de monetizacion | 50 clientes pagantes |
| 12 | Break-even cercano | 200 clientes pagantes |
| 18 | Expansion a Mexico | 500 clientes pagantes |
| 24 | Leadership en LatAm | 2,000 clientes pagantes |

---

## Panorama Competitivo

### Competidores Directos en America Latina

| Competidor | Pais base | Modelo | Precios | Fortalezas | Debilidades |
|-----------|-----------|--------|---------|-----------|-------------|
| **Reservio** | Brasil | SaaS + Marketplace | $15-50 USD/mes | Gran base de usuarios en Brasil, buena UX | Fuerte solo en Brasil, sin pagos manuales |
| **SalaoVIP** | Brasil | SaaS | $10-40 USD/mes | Especifico para salones, buenos reportes | Sin marketplace, solo Brasil |
| **AgendaPro** | Chile | SaaS | $20-60 USD/mes | Buen producto, soporte local | Caro para mercado colombiano, sin marketplace |
| **Turnero** | Argentina | SaaS | $10-30 USD/mes | Simple de usar, buen precio | Funcionalidad limitada, sin marketplace |
| **Booksy** | Global | Marketplace + SaaS | $30-50 USD/mes | Marca fuerte, buena app movil | Caro, enfoque premium, no adapta a LatAm |
| **Fresha** | Global | SaaS + Marketplace | Free + comision | Gratis, buena UX, global | Modelo de comision no atractivo para LatAm |

### Ventaja Competitiva de BeautySpot

```
                    BeautySpot
                    ┌────────────────────┐
                    │ Mercado-           │
                    │ place  ←─────┐     │
                    │ integrado     │     │
                    │          Sinergia   │
                    │ SaaS    ←─────┘     │
                    │ regionalizado       │
                    └────────────────────┘

Competidores:
    Booksy/Fresha:    Marketplace global, caro para LatAm
    Reservio/SalaoVIP: Solo SaaS, solo Brasil
    AgendaPro:         Solo SaaS, caro
```

| Diferenciador | BeautySpot vs Competencia |
|--------------|--------------------------|
| Precio | 30-50% mas barato que Booksy/Fresha |
| Modelo | Freemium real (plan Free util) vs free limitado |
| Marketplace | Integrado desde el inicio vs inexistente |
| Pagos | Manual + online vs solo online (obligatorio) |
| Regional | Disenado para flujos de LatAm vs adaptado |
| Idioma | Espanol nativo vs traduccion de ingles/portugues |

---

## Proyecciones Financieras

### Escenario Conservador (Ano 1)

| Mes | Negocios Registrados | Clientes Pagantes | MRR | Costos | Burn Rate |
|:---:|:--------------------:|:------------------:|:---:|:------:|:---------:|
| 3 | 20 | 5 | $75 | $9,500 | -$9,425 |
| 6 | 150 | 40 | $500 | $9,500 | -$9,000 |
| 9 | 400 | 100 | $1,200 | $10,000 | -$8,800 |
| 12 | 700 | 200 | $2,400 | $10,500 | -$8,100 |
| **Total Ano 1** | | | **~$12,000** | **~$118,000** | **-$106,000** |

### Escenario Moderado (Ano 2)

| Mes | Negocios Registrados | Clientes Pagantes | MRR | Costos | Burn Rate |
|:---:|:--------------------:|:------------------:|:---:|:------:|:---------:|
| 15 | 1,200 | 400 | $5,600 | $12,000 | -$6,400 |
| 18 | 2,000 | 700 | $10,500 | $14,000 | -$3,500 |
| 21 | 3,000 | 1,100 | $17,600 | $16,000 | +$1,600 |
| 24 | 4,000 | 1,500 | $25,000 | $18,000 | +$7,000 |
| **Total Ano 2** | | | **~$175,000** | **~$180,000** | **-$5,000** |

### Punto de Break-Even

- **Break-even operativo**: Mes 20-22 (MRR > costos operativos)
- **Break-even total** (incluyendo inversion inicial): Mes 30-36
- **Inversion total requerida**: ~$150,000 USD (18 meses de runway)

### Uso de Fondos

| Rubro | % | Monto (USD) |
|--------|---:|:-----------:|
| Equipo de desarrollo (2-3 devs) | 55% | $82,500 |
| Marketing y adquisicion | 20% | $30,000 |
| Infraestructura y herramientas | 10% | $15,000 |
| Operaciones y legales | 10% | $15,000 |
| Reserva / Contingencia | 5% | $7,500 |
| **Total** | **100%** | **$150,000** |
